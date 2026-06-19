/*
  文字跳脫 / 還原引擎回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-escapetext.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `escapetext-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/escapeText.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { toJsonString, escapeForQuote, escapeUnicode, unescapeString } =
  await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// --- toJsonString ---
check('JSON 字串含引號', toJsonString('a"b') === '"a\\"b"')
check('JSON 換行', toJsonString('a\nb') === '"a\\nb"')
check('JSON 與原生一致', toJsonString('中文\t結束') === JSON.stringify('中文\t結束'))

// --- escapeForQuote ---
check('跳脫換行', escapeForQuote('a\nb') === 'a\\nb')
check('跳脫 tab', escapeForQuote('a\tb') === 'a\\tb')
check('跳脫反斜線', escapeForQuote('a\\b') === 'a\\\\b')
check('預設雙引號跳脫 "', escapeForQuote('say "hi"') === 'say \\"hi\\"')
check('雙引號模式不跳脫 \'', escapeForQuote("it's", '"') === "it's")
check('單引號模式跳脫 \'', escapeForQuote("it's", "'") === "it\\'s")
check('中文不動', escapeForQuote('中文') === '中文')
check('跳脫 \\0', escapeForQuote('a\0b') === 'a\\0b')

// --- escapeUnicode ---
check('中 → \\u4e2d', escapeUnicode('中') === '\\u4e2d')
check('ASCII 不動', escapeUnicode('abc123') === 'abc123')
check('混合', escapeUnicode('a中b') === 'a\\u4e2db')
check('控制字元也轉', escapeUnicode('\n') === '\\u000a')
check('emoji 轉代理對兩個 \\u', escapeUnicode('😀') === '\\ud83d\\ude00')

// --- unescapeString 基本 ---
check('還原換行', unescapeString('a\\nb').value === 'a\nb')
check('還原 tab', unescapeString('a\\tb').value === 'a\tb')
check('還原反斜線', unescapeString('a\\\\b').value === 'a\\b')
check('還原 \\uXXXX', unescapeString('\\u4e2d\\u6587').value === '中文')
check('還原 \\xXX', unescapeString('\\x41').value === 'A')
check('還原 \\u{...}', unescapeString('\\u{1f600}').value === '😀')
check('還原引號', unescapeString('say \\"hi\\"').value === 'say "hi"')
check('去外層雙引號', unescapeString('"a\\nb"').value === 'a\nb')
check('去外層單引號', unescapeString("'abc'").value === 'abc')
check('未知跳脫保留字元', unescapeString('\\q').value === 'q')
check('還原 \\/ ', unescapeString('a\\/b').value === 'a/b')

// --- unescapeString 錯誤 ---
check('結尾單獨反斜線報錯', unescapeString('abc\\').ok === false)
check('\\x 位數不足報錯', unescapeString('\\x4').ok === false)
check('\\u 位數不足報錯', unescapeString('\\u4e2').ok === false)
check('\\u{ 缺 } 報錯', unescapeString('\\u{1f600').ok === false)
check('\\u{} 非十六進位報錯', unescapeString('\\u{zz}').ok === false)

// --- 來回一致 ---
const samples = ['Hello\n世界\t!', 'tab\there', '引號 "和" 反斜線 \\', '😀 emoji', 'line1\r\nline2']
for (const orig of samples) {
  const round = unescapeString(escapeForQuote(orig)).value
  check(`escapeForQuote 來回一致:${JSON.stringify(orig).slice(0, 20)}`, round === orig)
  const round2 = unescapeString(escapeUnicode(orig)).value
  check(`escapeUnicode 來回一致:${JSON.stringify(orig).slice(0, 20)}`, round2 === orig)
}

if (fail) {
  console.error(`\n${fail} 個測試失敗`)
  process.exit(1)
}
console.log('\n全部通過')
