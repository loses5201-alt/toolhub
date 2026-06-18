/*
  表格拆分引擎回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-tablesplit.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `tablesplit-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/tableSplit.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { safeFileName, splitByRows, splitByColumn, uniqueFileNames } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

const tbl = (headers, rows) => ({ headers, rows })

// --- safeFileName ---
check('safeFileName 去非法字元', safeFileName('a/b:c*d?').replace(/_/g, '#') === 'a#b#c#d#')
check('safeFileName 空字串回 fallback', safeFileName('') === '未命名')
check('safeFileName 自訂 fallback', safeFileName('   ', 'X') === 'X')
check('safeFileName 去前後點與空白', safeFileName('  ..名稱..  ') === '名稱')
check('safeFileName 夾長度 80', safeFileName('字'.repeat(200)).length === 80)
check('safeFileName 保留中文', safeFileName('台北市') === '台北市')

// --- splitByRows ---
const t = tbl(['name', 'age'], [['a', '1'], ['b', '2'], ['c', '3'], ['d', '4'], ['e', '5']])
const r2 = splitByRows(t, 2)
check('splitByRows 份數 = ceil(5/2)=3', r2.length === 3)
check('splitByRows 每份帶表頭', r2.every((p) => p.table.headers.join() === 'name,age'))
check('splitByRows 前兩份各 2 列', r2[0].table.rows.length === 2 && r2[1].table.rows.length === 2)
check('splitByRows 最後一份 1 列', r2[2].table.rows.length === 1)
check('splitByRows 不漏列', r2.reduce((s, p) => s + p.table.rows.length, 0) === 5)
check('splitByRows 順序保留', r2[0].table.rows[0][0] === 'a' && r2[2].table.rows[0][0] === 'e')
check('splitByRows 編號補零對齊', r2[0].name === '第1份')
const r1 = splitByRows(t, 1)
check('splitByRows size=1 共 5 份且補零兩位', r1.length === 5 && r1[0].name === '第1份')
check('splitByRows size=0 視為 1', splitByRows(t, 0).length === 5)
check('splitByRows size 超過列數 → 1 份', splitByRows(t, 99).length === 1)
check('splitByRows 空表 → 0 份', splitByRows(tbl(['a'], []), 3).length === 0)
check('splitByRows 小數無條件捨去', splitByRows(t, 2.9).length === 3)

// --- splitByColumn ---
const orders = tbl(
  ['區域', '客戶', '金額'],
  [
    ['北區', '甲', '100'],
    ['南區', '乙', '200'],
    ['北區', '丙', '300'],
    ['', '丁', '400'],
    ['南區', '戊', '500'],
  ],
)
const g = splitByColumn(orders, 0)
check('splitByColumn 三組(北/南/空白)', g.length === 3)
check('splitByColumn 首見順序:北區先', g[0].name === '北區' && g[1].name === '南區')
check('splitByColumn 空白歸一組且標 (空白)', g[2].name === '(空白)')
check('splitByColumn 北區有 2 列', g[0].table.rows.length === 2)
check('splitByColumn 同組保留原順序', g[0].table.rows[0][1] === '甲' && g[0].table.rows[1][1] === '丙')
check('splitByColumn 不漏列', g.reduce((s, p) => s + p.table.rows.length, 0) === 5)
check('splitByColumn 預設保留分組欄', g[0].table.headers.length === 3)
const gDrop = splitByColumn(orders, 0, { dropKeyColumn: true })
check('splitByColumn dropKeyColumn 移除該欄', gDrop[0].table.headers.join() === '客戶,金額')
check('splitByColumn dropKeyColumn 列同步移除欄', gDrop[0].table.rows[0].length === 2)
check('splitByColumn 自訂 emptyLabel', splitByColumn(orders, 0, { emptyLabel: '無' })[2].name === '無')
check('splitByColumn 欄超界 → 空陣列', splitByColumn(orders, 9).length === 0)
check('splitByColumn 負欄 → 空陣列', splitByColumn(orders, -1).length === 0)
check('splitByColumn 值前後空白會 trim 後分組', splitByColumn(tbl(['c'], [['x'], [' x ']]), 0).length === 1)
// 大小寫
const cs = tbl(['c'], [['A'], ['a'], ['B']])
check('splitByColumn 預設大小寫敏感', splitByColumn(cs, 0).length === 3)
check('splitByColumn 忽略大小寫合併', splitByColumn(cs, 0, { caseSensitive: false }).length === 2)
check('splitByColumn 忽略大小寫取首見寫法', splitByColumn(cs, 0, { caseSensitive: false })[0].name === 'A')

// --- uniqueFileNames ---
const parts = [{ name: '北區' }, { name: '北/區' }, { name: '北區' }]
const names = uniqueFileNames(parts, 'csv')
check('uniqueFileNames 加副檔名', names[0] === '北區.csv')
check('uniqueFileNames 非法字元已清', names[1] === '北_區.csv')
check('uniqueFileNames 同名加序號', names[2] === '北區 (2).csv')
check('uniqueFileNames 接受帶點副檔名', uniqueFileNames([{ name: 'x' }], '.json')[0] === 'x.json')
check('uniqueFileNames 全部唯一', new Set(names.map((n) => n.toLowerCase())).size === names.length)

if (fail) {
  console.error(`\n${fail} 項測試未通過`)
  process.exit(1)
}
console.log('\n表格拆分:全部測試通過 ✅')
