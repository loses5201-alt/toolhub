/*
  盤古之白(中英混排空格)引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-panguspacing.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `pangu-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/panguSpacing.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { addSpacing, addSpacingWithCount } = await import('file://' + out)

let fail = 0
function eq(note, got, want) {
  if (got === want) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}\n   got : ${JSON.stringify(got)}\n   want: ${JSON.stringify(want)}`)
  }
}

// --- 基本 ---
eq('空字串', addSpacing(''), '')
eq('null', addSpacing(null), '')
eq('純中文不動', addSpacing('你好世界'), '你好世界')
eq('純英文不動', addSpacing('hello world'), 'hello world')
eq('中文接英文', addSpacing('你好world'), '你好 world')
eq('英文接中文', addSpacing('world你好'), 'world 你好')
eq('中英夾雜', addSpacing('在GitHub上'), '在 GitHub 上')
eq('中文接數字', addSpacing('價格是100元'), '價格是 100 元')
eq('數字夾在中間', addSpacing('第1章'), '第 1 章')
eq('混合句', addSpacing('我用Vue3寫了app'), '我用 Vue3 寫了 app')

// --- 已有空格不重複加(idempotent)---
eq('已有空格不再加', addSpacing('你好 world'), '你好 world')
eq('套兩次結果相同', addSpacing(addSpacing('在GitHub上有100顆星')), addSpacing('在GitHub上有100顆星'))
eq('idempotent 範例', addSpacing('在GitHub上有100顆星'), '在 GitHub 上有 100 顆星')

// --- 標點介於中間時不插入(已有分隔)---
eq('中文逗號分隔不加', addSpacing('中文,abc'), '中文,abc')
eq('中文句號分隔不加', addSpacing('結束。Next'), '結束。Next')

// --- 換行保留 ---
eq('換行保留並逐處處理', addSpacing('第1行\n第2行'), '第 1 行\n第 2 行')
eq('多行', addSpacing('用Vue\n寫app'), '用 Vue\n寫 app')

// --- 日文 / 注音 ---
eq('日文假名接英文', addSpacing('これはtest'), 'これは test')
eq('英文接日文', addSpacing('testです'), 'test です')

// --- 連續 ---
eq('連續切換', addSpacing('a中b文c'), 'a 中 b 文 c')
eq('數字與中文交錯', addSpacing('共3人2狗'), '共 3 人 2 狗')

// --- count ---
const r1 = addSpacingWithCount('在GitHub上')
eq('count 結果正確', r1.result, '在 GitHub 上')
eq('count 數量正確', r1.added, 2)
eq('無變化 count 0', addSpacingWithCount('你好世界').added, 0)
eq('null count 0', addSpacingWithCount(null).added, 0)

if (fail) {
  console.error(`\n${fail} 筆測試失敗`)
  process.exit(1)
}
console.log('\n全部通過')
