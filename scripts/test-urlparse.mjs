/*
  網址解析引擎回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-urlparse.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `urlparse-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/urlParse.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { parseUrl, buildUrl, parseQuery, buildQuery } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// --- parseUrl 完整網址 ---
const full = parseUrl('https://user:pw@example.com:8080/a/b?x=1&y=hello%20world&debug#sec')
check('完整網址 ok', full.ok === true)
check('protocol', full.parts.protocol === 'https:')
check('username', full.parts.username === 'user')
check('password', full.parts.password === 'pw')
check('hostname', full.parts.hostname === 'example.com')
check('port', full.parts.port === '8080')
check('pathname', full.parts.pathname === '/a/b')
check('hash', full.parts.hash === '#sec')
check('參數數量 3', full.params.length === 3)
check('參數 x', full.params[0].key === 'x' && full.params[0].value === '1')
check('參數 y 解碼空白', full.params[1].value === 'hello world')
check('旗標參數 debug', full.params[2].key === 'debug' && full.params[2].flag === true)

// --- 自動補協定 ---
const noproto = parseUrl('example.com/path?a=1')
check('沒協定可解析', noproto.ok === true)
check('自動補 https', noproto.assumedProtocol === true && noproto.parts.protocol === 'https:')
check('已有協定不補', parseUrl('http://example.com').assumedProtocol !== true)

// --- 錯誤處理 ---
check('空字串報錯', parseUrl('   ').ok === false)
check('純文字無法解析', parseUrl('這不是網址 還有空白').ok === false)

// --- parseQuery ---
check('parseQuery 空回空陣列', parseQuery('').length === 0)
check('parseQuery 去開頭 ?', parseQuery('?a=1').length === 1)
check('parseQuery 重複鍵保留', parseQuery('a=1&a=2').length === 2)
check('parseQuery 保留順序', parseQuery('b=2&a=1')[0].key === 'b')
check('parseQuery + 轉空白', parseQuery('q=a+b')[0].value === 'a b')
check('parseQuery 中文解碼', parseQuery('name=%E4%B8%AD%E6%96%87')[0].value === '中文')
check('parseQuery 壞 %XX 不丟例外', parseQuery('q=%zz')[0].value === '%zz')
check('parseQuery 旗標無等號', parseQuery('flag')[0].flag === true)
check('parseQuery 略過空段', parseQuery('a=1&&b=2').length === 2)

// --- buildQuery ---
check('buildQuery 基本', buildQuery([{ key: 'a', value: '1' }]) === 'a=1')
check('buildQuery 空白編碼', buildQuery([{ key: 'q', value: 'a b' }]) === 'q=a%20b')
check('buildQuery 中文編碼', buildQuery([{ key: 'n', value: '中' }]) === 'n=%E4%B8%AD')
check('buildQuery 旗標不加等號', buildQuery([{ key: 'flag', value: '', flag: true }]) === 'flag')
check(
  'buildQuery 多個用 & 串',
  buildQuery([{ key: 'a', value: '1' }, { key: 'b', value: '2' }]) === 'a=1&b=2',
)

// --- buildUrl 來回一致 ---
const rebuilt = buildUrl(full.parts, full.params)
const reparsed = parseUrl(rebuilt)
check('buildUrl 來回 hostname 一致', reparsed.parts.hostname === 'example.com')
check('buildUrl 來回 port 一致', reparsed.parts.port === '8080')
check('buildUrl 來回 參數值一致', reparsed.params[1].value === 'hello world')
check('buildUrl 來回 hash 一致', reparsed.parts.hash === '#sec')
check('buildUrl 含使用者資訊', buildUrl(full.parts, full.params).includes('user:pw@'))

// --- 移除追蹤參數情境 ---
const tracked = parseUrl('https://shop.example.com/item?id=42&utm_source=fb&utm_medium=cpc')
const cleaned = tracked.params.filter((p) => !p.key.startsWith('utm_'))
check('過濾 utm 後剩 1 個', cleaned.length === 1)
check('清理後網址', buildUrl(tracked.parts, cleaned) === 'https://shop.example.com/item?id=42')

if (fail) {
  console.error(`\n${fail} 個測試失敗`)
  process.exit(1)
}
console.log('\n全部通過')
