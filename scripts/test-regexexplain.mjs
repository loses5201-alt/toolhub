// regexExplain 回歸測試。以 esbuild 打包 TS 後執行。
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const entry = resolve(__dirname, '../src/features/regexExplain.ts')

const out = await build({
  entryPoints: [entry],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
})
const mod = await import(
  'data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64')
)
const { explainRegex, matchAll } = mod

let pass = 0
let fail = 0
function ok(cond, msg) {
  if (cond) {
    pass++
  } else {
    fail++
    console.error('  ✗ ' + msg)
  }
}
// 找出第一個說明含某關鍵字、且原始片段等於 text 的 token
function hasToken(tokens, text, descContains) {
  return tokens.some((t) => t.text === text && (!descContains || t.desc.includes(descContains)))
}

// --- explainRegex ---
{
  const t = explainRegex('')
  ok(t.length === 0, '空 pattern 回空陣列')
}
{
  const t = explainRegex('abc')
  ok(t.length === 1 && t[0].kind === 'literal' && t[0].text === 'abc', '連續字面合併成一個 literal token')
}
{
  const t = explainRegex('\\d')
  ok(hasToken(t, '\\d', '數字') && t[0].kind === 'class', '\\d 解讀為數字字元類')
}
{
  const t = explainRegex('\\w\\s\\D')
  ok(t.length === 3 && t[0].text === '\\w' && t[2].text === '\\D', '連續字元類各自成 token')
}
{
  const t = explainRegex('^abc$')
  ok(t[0].text === '^' && t[0].kind === 'anchor', '^ 為錨點')
  ok(t[t.length - 1].text === '$' && t[t.length - 1].kind === 'anchor', '$ 為錨點')
}
{
  const t = explainRegex('\\bword\\b')
  ok(hasToken(t, '\\b', '邊界') && t[0].kind === 'anchor', '\\b 為單字邊界(anchor)')
}
{
  const t = explainRegex('a*')
  ok(hasToken(t, '*', '0 次以上'), '* 量詞說明')
}
{
  const t = explainRegex('a+?')
  ok(hasToken(t, '+', '1 次以上'), '+ 量詞')
  ok(hasToken(t, '?', '惰性'), '+? 中的 ? 解讀為惰性')
}
{
  const t = explainRegex('a{2,5}')
  ok(hasToken(t, '{2,5}', '2 到 5'), '{2,5} 範圍量詞')
}
{
  const t = explainRegex('a{3}')
  ok(hasToken(t, '{3}', '剛好出現 3'), '{3} 固定次數')
}
{
  const t = explainRegex('a{2,}')
  ok(hasToken(t, '{2,}', '至少 2'), '{2,} 至少次數')
}
{
  const t = explainRegex('.')
  ok(t[0].text === '.' && t[0].desc.includes('任一字元'), '. 任一字元')
}
{
  const t = explainRegex('[a-z0-9_]')
  ok(t.length === 1 && t[0].kind === 'set', '字元集合為單一 set token')
  ok(t[0].desc.includes('a 到 z') && t[0].desc.includes('0 到 9'), 'set 列出範圍')
}
{
  const t = explainRegex('[^abc]')
  ok(t[0].desc.includes('不是'), '否定字元集合')
}
{
  const t = explainRegex('[\\d.]')
  ok(t[0].kind === 'set' && t[0].text === '[\\d.]', 'set 內含跳脫且 . 為字面')
}
{
  const t = explainRegex('[]a]')
  ok(t[0].text === '[]a]', '開頭 ] 視為字面、集合正確收尾')
}
{
  const t = explainRegex('(?:abc)')
  ok(hasToken(t, '(?:', '不擷取'), '(?: 非擷取群組')
}
{
  const t = explainRegex('(?=foo)')
  ok(hasToken(t, '(?=', '正向先行'), '(?= 先行斷言')
}
{
  const t = explainRegex('(?<!foo)')
  ok(hasToken(t, '(?<!', '負向後行'), '(?<! 後行斷言')
}
{
  const t = explainRegex('(?<year>\\d{4})')
  ok(hasToken(t, '(?<year>', 'year'), '具名群組')
}
{
  const t = explainRegex('(a)\\1')
  ok(hasToken(t, '\\1', '第 1 個群組') && t.find((x) => x.text === '\\1').kind === 'backref', '數字回溯參照')
}
{
  const t = explainRegex('(?<n>a)\\k<n>')
  ok(hasToken(t, '\\k<n>', '具名群組「n」'), '具名回溯參照')
}
{
  const t = explainRegex('a|b')
  ok(hasToken(t, '|', '或'), '| 交替')
}
{
  const t = explainRegex('\\.\\\\')
  ok(t[0].text === '\\.' && t[0].kind === 'escape', '\\. 跳脫字面點')
  ok(t[1].text === '\\\\' && t[1].kind === 'escape', '\\\\ 跳脫反斜線')
}
{
  const t = explainRegex('\\n\\t')
  ok(hasToken(t, '\\n', '換行') && hasToken(t, '\\t', 'Tab'), '\\n \\t 控制字元')
}
{
  let threw = false
  try {
    explainRegex('(unclosed')
  } catch {
    threw = true
  }
  ok(threw, '不合法 pattern 擲出錯誤')
}
{
  let threw = false
  try {
    explainRegex('a', 'zz')
  } catch {
    threw = true
  }
  ok(threw, '不合法 flags 擲出錯誤')
}
// 真實案例:email 粗略樣式不報錯且段落完整
{
  const t = explainRegex('^[\\w.]+@[\\w.]+\\.\\w{2,}$')
  ok(t[0].text === '^' && t[t.length - 1].text === '$', 'email 樣式首尾為錨點')
  ok(t.some((x) => x.kind === 'set'), 'email 樣式含字元集合')
}

// --- matchAll ---
{
  const r = matchAll('\\d+', '', 'a1 b22 c333')
  ok(r.length === 3 && r[0].text === '1' && r[2].text === '333', 'matchAll 全域找出數字串')
}
{
  const r = matchAll('(\\d{4})-(\\d{2})', '', '2026-06 與 1999-12')
  ok(r.length === 2 && r[0].groups[0] === '2026' && r[0].groups[1] === '06', 'matchAll 擷取群組')
}
{
  const r = matchAll('(?<y>\\d{4})', '', '年份2026')
  ok(r[0].named.y === '2026', 'matchAll 具名群組')
}
{
  const r = matchAll('a*', '', 'bbb')
  ok(r.length >= 1, '零寬比對不會無限迴圈')
}
{
  const r = matchAll('ABC', 'i', 'xabcx')
  ok(r.length === 1 && r[0].index === 1, 'i 旗標忽略大小寫')
}

console.log(`regexExplain: ${pass} 通過, ${fail} 失敗`)
if (fail > 0) process.exit(1)
