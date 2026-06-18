/*
  清單加工引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-linetools.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `linetools-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/lineTools.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { processLines, PRESETS, DEFAULT_OPTIONS } = await import('file://' + out)

let fail = 0
function eq(note, got, want) {
  if (got === want) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}\n   got : ${JSON.stringify(got)}\n   want: ${JSON.stringify(want)}`)
  }
}

// --- 預設行為:trim + 刪空白行,以換行連接 ---
eq('預設 trim + 刪空白行', processLines('  a \n\n b \n'), 'a\nb')
eq('空字串回空', processLines(''), '')
eq('全空白回空', processLines('  \n \n'), '')
eq('null 視為空', processLines(null), '')

// --- 去重保留首次出現 ---
eq('去重保留首次順序', processLines('b\na\nb\nc\na', { dedupe: true }), 'b\na\nc')
eq('不去重保留全部', processLines('a\na', { dedupe: false }), 'a\na')

// --- 引號 + 逸出 ---
eq('單引號包裹', processLines('a\nb', { quote: 'single' }), "'a'\n'b'")
eq('單引號逸出為兩個單引號(SQL 慣例)', processLines("O'Brien", { quote: 'single' }), "'O''Brien'")
eq('雙引號逸出', processLines('say "hi"', { quote: 'double' }), '"say \\"hi\\""')
eq('反引號包裹', processLines('a', { quote: 'backtick' }), '`a`')
eq('雙引號逸出反斜線', processLines('a\\b', { quote: 'double' }), '"a\\\\b"')

// --- 前後綴 ---
eq('前後綴', processLines('a\nb', { prefix: '<', suffix: '>' }), '<a>\n<b>')
eq('Markdown 清單', processLines('a\nb', { prefix: '- ' }), '- a\n- b')

// --- 編號 ---
eq('編號預設從 1', processLines('x\ny', { numbering: true }), '1. x\n2. y')
eq('編號自訂起始與分隔', processLines('x\ny', { numbering: true, numberStart: 5, numberSep: ') ' }), '5) x\n6) y')
eq('編號在引號/前綴之外', processLines('x', { numbering: true, quote: 'single', prefix: '- ' }), "1. - 'x'")

// --- 連接字元與外框 ---
eq('逗號連接', processLines('a\nb\nc', { joiner: ', ' }), 'a, b, c')
eq('外框', processLines('a\nb', { joiner: ', ', outerPrefix: '[', outerSuffix: ']' }), '[a, b]')

// --- 預設範本(presets)組合 ---
const byId = (id) => PRESETS.find((p) => p.id === id).options
eq(
  'preset SQL IN',
  processLines('a\nb\na', byId('sql-in')),
  "('a', 'b')", // 含去重
)
eq('preset 逗號清單', processLines('a\nb\nc', byId('comma')), 'a, b, c')
eq('preset JSON 陣列', processLines('a\nb', byId('json-array')), '["a", "b"]')
eq('preset Markdown', processLines('a\nb', byId('markdown')), '- a\n- b')
eq('preset 編號', processLines('a\nb', byId('numbered')), '1. a\n2. b')
eq('preset 純換行去重', processLines('a\na\nb', byId('lines')), 'a\nb')

// --- 不 trim 時保留行內空白但仍可刪空白行 ---
eq('不 trim 保留行首空白', processLines('  a\nb', { trimEach: false, removeEmpty: false }), '  a\nb')

// --- 預設選項物件存在且合理 ---
eq('DEFAULT trimEach=true', DEFAULT_OPTIONS.trimEach, true)
eq('DEFAULT joiner 換行', DEFAULT_OPTIONS.joiner, '\n')

if (fail) {
  console.error(`\n${fail} 個測試未通過`)
  process.exit(1)
}
console.log('\n全部 linetools 測試通過')
