// curl 轉換回歸測試
import { execSync } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'curl-'))
const entry = join(dir, 'entry.mjs')
const src = join(process.cwd(), 'src/features/curlConvert.ts').replace(/\\/g, '\\\\')
writeFileSync(entry, `export { tokenize, parseCurl, toFetch, toPython } from '${src}'`)
const outFile = join(dir, 'bundle.mjs')
execSync(`npx esbuild ${entry} --bundle --format=esm --platform=node --outfile=${outFile}`, {
  stdio: ['ignore', 'ignore', 'inherit'],
})
const { tokenize, parseCurl, toFetch, toPython } = await import('file://' + outFile)

let pass = 0
let fail = 0
function ok(cond, msg) {
  if (cond) pass++
  else {
    fail++
    console.error('✗', msg)
  }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// ── tokenize ──
ok(eq(tokenize('curl https://a.com'), ['curl', 'https://a.com']), '基本切詞')
ok(eq(tokenize("curl -H 'A: b c' x"), ['curl', '-H', 'A: b c', 'x']), '單引號保留空白')
ok(eq(tokenize('curl -d "a=\\"q\\"" x'), ['curl', '-d', 'a="q"', 'x']), '雙引號內跳脫')
ok(eq(tokenize("-d'foo bar'"), ['-dfoo bar']), '引號黏在 token 內')
ok(eq(tokenize('curl \\\n  -X POST \\\n  x'), ['curl', '-X', 'POST', 'x']), '反斜線續行')
ok(eq(tokenize('  curl   x   '), ['curl', 'x']), '多重空白')

// ── 基本 GET ──
const g = parseCurl('curl https://api.example.com/users')
ok(g.method === 'GET' && g.url === 'https://api.example.com/users', '基本 GET')
ok(g.headers.length === 0 && g.body === null, '無標頭無 body')

// ── POST + header + json body(content-type 指定 → raw)──
const p = parseCurl(`curl -X POST https://x/api -H 'Content-Type: application/json' -d '{"a":1}'`)
ok(p.method === 'POST', '顯式 POST')
ok(eq(p.headers, [['Content-Type', 'application/json']]), '解析標頭')
ok(p.body === '{"a":1}' && p.bodyType === 'raw', 'json body 為 raw')

// ── 有 -d 無 -X → 預設 POST、urlencoded ──
const d = parseCurl("curl https://x -d 'name=jo&age=3'")
ok(d.method === 'POST' && d.body === 'name=jo&age=3' && d.bodyType === 'urlencoded', '有 data 預設 POST/urlencoded')

// ── 多個 -d 以 & 串接 ──
const md = parseCurl("curl https://x -d a=1 -d b=2")
ok(md.body === 'a=1&b=2', '多個 -d 串接')

// ── 黏在一起的短旗標 ──
const glued = parseCurl(`curl -XPUT https://x -H'X-Token: abc'`)
ok(glued.method === 'PUT', '-XPUT 黏寫')
ok(eq(glued.headers, [['X-Token', 'abc']]), "-H'..' 黏寫")

// ── --data-raw 與 --request=METHOD ──
const dr = parseCurl(`curl --request=PATCH https://x --data-raw 'hello'`)
ok(dr.method === 'PATCH' && dr.body === 'hello', '--request=PATCH 與 --data-raw')

// ── -u 基本認證 ──
const au = parseCurl('curl -u admin:secret https://x')
ok(eq(au.auth, { user: 'admin', pass: 'secret' }), '-u 解析認證')

// ── -G 把 data 併入查詢字串、method 仍 GET ──
const gq = parseCurl("curl -G https://x/search -d q=cat -d n=5")
ok(gq.method === 'GET' && gq.url === 'https://x/search?q=cat&n=5', '-G 併查詢字串')
ok(gq.body === null, '-G 不留 body')

// ── -F 表單 → multipart、POST ──
const form = parseCurl("curl -F file=@a.png -F name=joe https://x")
ok(form.method === 'POST' && form.bodyType === 'form', '-F multipart POST')
ok(eq(form.forms, [['file', '@a.png'], ['name', 'joe']]), '-F 欄位')

// ── -A / -e / -b 變成標頭 ──
const hh = parseCurl("curl -A 'MyAgent/1.0' -e https://ref -b 'sid=1' https://x")
ok(hh.headers.some(([k, v]) => k === 'User-Agent' && v === 'MyAgent/1.0'), '-A → User-Agent')
ok(hh.headers.some(([k]) => k === 'Referer'), '-e → Referer')
ok(hh.headers.some(([k]) => k === 'Cookie'), '-b → Cookie')

// ── 忽略無關旗標 ──
const ign = parseCurl('curl --compressed -L -k -s https://x')
ok(ign.url === 'https://x' && ign.method === 'GET', '忽略 --compressed/-L/-k/-s')

// ── 未知旗標警告 ──
const unk = parseCurl('curl --weird https://x')
ok(unk.warnings.some((w) => w.includes('--weird')), '未知旗標警告')

// ── 找不到網址警告 ──
ok(parseCurl('curl -X GET').warnings.some((w) => w.includes('網址')), '缺網址警告')

// ── URL 在中間、含 --url ──
ok(parseCurl('curl -H "A: 1" --url https://x').url === 'https://x', '--url 指定')

// ── toFetch 輸出 ──
const f = toFetch(p)
ok(f.includes("fetch('https://x/api'"), 'fetch URL')
ok(f.includes("method: 'POST'"), 'fetch method')
ok(f.includes("'Content-Type': 'application/json'"), 'fetch header')
ok(f.includes("body: '{\\'a\\':1}'") || f.includes('body:'), 'fetch body 存在')
const fAuth = toFetch(au)
ok(fAuth.includes("btoa('admin:secret')"), 'fetch 基本認證 btoa')
const fForm = toFetch(form)
ok(fForm.includes('new FormData()') && fForm.includes("formData.append('file'"), 'fetch FormData')

// ── toPython 輸出 ──
const py = toPython(p)
ok(py.includes('import requests'), 'python import')
ok(py.includes('requests.post('), 'python method')
ok(py.includes('headers = {'), 'python headers')
ok(py.includes('data = '), 'python data')
ok(toPython(au).includes("auth=('admin', 'secret')"), 'python auth')
ok(toPython(form).includes('files = {'), 'python files')
ok(toPython(g).includes('requests.get('), 'python get')

console.log(`curlconvert: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
