/*
  表格清理工坊引擎回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-tableclean.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `tableclean-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/tableClean.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const {
  parseTable,
  trimAll,
  dropEmptyRows,
  dedupeRows,
  filterRows,
  sortRows,
  selectColumns,
  toCSV,
  toObjects,
} = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// --- parseTable ---
const t1 = parseTable('name,age\nAlice,30\nBob,25', {})
check('parseTable 表頭', t1.headers.join(',') === 'name,age')
check('parseTable 列數', t1.rows.length === 2)
check('parseTable 內容', t1.rows[0].join(',') === 'Alice,30')

const t2 = parseTable('Alice,30\nBob,25', { hasHeader: false })
check('parseTable 無表頭自動產生欄名', t2.headers.join(',') === '欄位1,欄位2')
check('parseTable 無表頭列數', t2.rows.length === 2)

const tTsv = parseTable('a\tb\n1\t2', { delimiter: '\t' })
check('parseTable TSV 分隔', tTsv.headers.join(',') === 'a,b' && tTsv.rows[0].join(',') === '1,2')

const tRagged = parseTable('a,b,c\n1,2\n3,4,5,6', {})
check('parseTable 補齊短列', tRagged.rows[0].length === 3 && tRagged.rows[0][2] === '')
check('parseTable 裁切超長列', tRagged.rows[1].length === 3)

const tQuote = parseTable('name,note\n"Wang, A","a\nb"', {})
check('parseTable 引號內逗號/換行', tQuote.rows[0][0] === 'Wang, A' && tQuote.rows[0][1] === 'a\nb')

check('parseTable 空字串', parseTable('', {}).rows.length === 0)

// --- trimAll ---
const tr = trimAll(parseTable('a,b\n  x ,　y　', {}))
check('trimAll 去半形空白', tr.rows[0][0] === 'x')
check('trimAll 去全形空白', tr.rows[0][1] === 'y')

// --- dropEmptyRows ---
const de = dropEmptyRows(parseTable('a,b\n1,2\n,\n　,\n3,4', {}))
check('dropEmptyRows 刪全空列(含全形)', de.rows.length === 2)

// --- dedupeRows ---
const dd = dedupeRows(parseTable('a,b\n1,x\n1,x\n2,y', {}))
check('dedupeRows 整列去重', dd.table.rows.length === 2 && dd.removed === 1)
check('dedupeRows 保留第一筆', dd.table.rows[0].join(',') === '1,x')

const ddKey = dedupeRows(parseTable('id,name\n1,A\n1,B\n2,C', {}), { keyCols: [0] })
check('dedupeRows 指定欄去重', ddKey.table.rows.length === 2 && ddKey.removed === 1)

const ddCase = dedupeRows(parseTable('x\nAB\nab', {}), { caseSensitive: false })
check('dedupeRows 忽略大小寫', ddCase.table.rows.length === 1)
const ddCase2 = dedupeRows(parseTable('x\nAB\nab', {}), { caseSensitive: true })
check('dedupeRows 區分大小寫', ddCase2.table.rows.length === 2)

// 避免欄界混淆:["a b","c"] vs ["a","b c"] 不應視為相同
const ddBoundary = dedupeRows(parseTable('p,q\na b,c\na,b c', {}))
check('dedupeRows 欄界不混淆', ddBoundary.table.rows.length === 2)

// --- filterRows ---
const base = parseTable('name,age\nAlice,30\nBob,25\nCarol,40\nDave,', {})
check('filter contains', filterRows(base, { col: 0, op: 'contains', value: 'a' }).rows.length === 3) // Alice,Carol,Dave (忽略大小寫)
check('filter contains 大小寫敏感', filterRows(base, { col: 0, op: 'contains', value: 'a', caseSensitive: true }).rows.length === 2) // Carol,Dave
check('filter equals', filterRows(base, { col: 0, op: 'equals', value: 'bob' }).rows.length === 1)
check('filter notEquals', filterRows(base, { col: 0, op: 'notEquals', value: 'bob' }).rows.length === 3)
check('filter startsWith', filterRows(base, { col: 0, op: 'startsWith', value: 'c' }).rows.length === 1)
check('filter endsWith', filterRows(base, { col: 0, op: 'endsWith', value: 'e' }).rows.length === 2) // Alice,Dave
check('filter notEmpty', filterRows(base, { col: 1, op: 'notEmpty' }).rows.length === 3)
check('filter empty', filterRows(base, { col: 1, op: 'empty' }).rows.length === 1)
check('filter gt 數值', filterRows(base, { col: 1, op: 'gt', value: '28' }).rows.length === 2) // 30,40
check('filter lt 數值', filterRows(base, { col: 1, op: 'lt', value: '28' }).rows.length === 1) // 25
check('filter gt 非數值不通過', filterRows(base, { col: 0, op: 'gt', value: '5' }).rows.length === 0)
check('filter gt 含千分位', filterRows(parseTable('v\n"1,200"\n900', {}), { col: 0, op: 'gt', value: '1000' }).rows.length === 1)

// --- sortRows ---
const s1 = sortRows(base, { col: 1, numeric: true })
check('sort 數值升冪', s1.rows.map((r) => r[1]).join(',') === '25,30,40,') // 空值(非數值)排最後
const s2 = sortRows(base, { col: 1, numeric: true, descending: true })
check('sort 數值降冪 非數值仍最後', s2.rows.map((r) => r[1]).join(',') === '40,30,25,')
const s3 = sortRows(base, { col: 0 })
check('sort 文字升冪', s3.rows.map((r) => r[0]).join(',') === 'Alice,Bob,Carol,Dave')
// 穩定性:相同鍵保留原順序
const stab = sortRows(parseTable('k,v\na,1\nb,2\na,3', {}), { col: 0 })
check('sort 穩定', stab.rows.map((r) => r[1]).join(',') === '1,3,2')

// --- selectColumns ---
const sel = selectColumns(base, [1, 0])
check('selectColumns 重排', sel.headers.join(',') === 'age,name' && sel.rows[0].join(',') === '30,Alice')
const selDrop = selectColumns(base, [0])
check('selectColumns 只留一欄', selDrop.headers.length === 1 && selDrop.rows[0].length === 1)
const selBad = selectColumns(base, [0, 9])
check('selectColumns 忽略越界索引', selBad.headers.length === 1)

// --- 序列化 ---
check('toCSV round-trip', toCSV(parseTable('a,b\n1,2', {})) === 'a,b\r\n1,2')
check('toCSV 引號逸出', toCSV(parseTable('a\n"x,y"', {})) === 'a\r\n"x,y"')
const objs = toObjects(parseTable('a,b\n1,2', {}))
check('toObjects', objs.length === 1 && objs[0].a === '1' && objs[0].b === '2')

// --- 端到端管線 ---
const pipeline = selectColumns(
  sortRows(
    dedupeRows(dropEmptyRows(trimAll(parseTable('name,age\n Bob ,25\nBob,25\n,\nAlice,30', {})))).table,
    { col: 1, numeric: true },
  ),
  [0, 1],
)
check('端到端:trim→刪空→去重→排序→選欄', pipeline.rows.map((r) => r[0]).join(',') === 'Bob,Alice')

console.log(fail === 0 ? '\n全部通過 ✅' : `\n${fail} 筆失敗 ❌`)
process.exit(fail === 0 ? 0 : 1)
