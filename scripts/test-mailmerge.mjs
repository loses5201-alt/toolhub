/*
  合併列印 / 套印引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-mailmerge.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `mailmerge-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/mailMerge.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { extractPlaceholders, parseTable, merge } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// --- extractPlaceholders ---
check('取出佔位符', extractPlaceholders('嗨 {{姓名}},你的金額 {{金額}}').join(',') === '姓名,金額')
check('去重保留順序', extractPlaceholders('{{a}}{{b}}{{a}}').join(',') === 'a,b')
check('容許內部空白', extractPlaceholders('{{ 姓名 }}').join(',') === '姓名')
check('無佔位符回空', extractPlaceholders('純文字').length === 0)

// --- parseTable ---
const t1 = parseTable('姓名,金額\n小明,100\n小華,200')
check('表頭解析', t1.headers.join(',') === '姓名,金額')
check('列數', t1.rows.length === 2)
check('第二列內容', t1.rows[1].join('|') === '小華|200')

// Tab 分隔
const t2 = parseTable('a\tb\n1\t2')
check('自動偵測 Tab 分隔', t2.headers.join(',') === 'a,b' && t2.rows[0].join('|') === '1|2')

// 引號含逗號
const t3 = parseTable('姓名,地址\n小明,"台北市, 信義區"')
check('引號內逗號不分欄', t3.rows[0][1] === '台北市, 信義區')

// 引號內換行 + 跳脫引號
const t4 = parseTable('a,b\n"x\ny","他說""嗨"""')
check('引號內換行保留', t4.rows[0][0] === 'x\ny')
check('跳脫雙引號', t4.rows[0][1] === '他說"嗨"')

// 略過空白列
const t5 = parseTable('a\n1\n\n2\n')
check('略過全空白列', t5.rows.length === 2)

// --- merge ---
const m1 = merge('親愛的 {{姓名}},應繳 {{金額}} 元。', '姓名,金額\n小明,100\n小華,200')
check('合併 ok', m1.ok && m1.count === 2)
check('第一筆填入', m1.outputs[0] === '親愛的 小明,應繳 100 元。')
check('第二筆填入', m1.outputs[1] === '親愛的 小華,應繳 200 元。')
check('無缺欄', m1.missingFields.length === 0)

// 缺欄位 → 以空字串代入並回報
const m2 = merge('{{姓名}} 電話 {{電話}}', '姓名\n小明')
check('缺欄回報', m2.missingFields.join(',') === '電話')
check('缺欄以空字串代入', m2.outputs[0] === '小明 電話 ')

// 資料多餘欄位忽略
const m3 = merge('哈囉 {{姓名}}', '姓名,備註\n阿美,vip')
check('多餘欄位忽略', m3.outputs[0] === '哈囉 阿美')

// 同一佔位符多次出現
const m4 = merge('{{n}}{{n}}', 'n\nAB')
check('重複佔位符都填', m4.outputs[0] === 'ABAB')

// 錯誤處理
check('空範本報錯', merge('', 'a\n1').ok === false)
check('無資料報錯', merge('{{a}}', '').ok === false)
check('只有表頭→0 筆但 ok', merge('{{a}}', 'a').ok === true && merge('{{a}}', 'a').count === 0)

if (fail) {
  console.error(`\n${fail} 個測試未通過`)
  process.exit(1)
} else {
  console.log('\n全部通過 ✅')
}
