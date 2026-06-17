/*
  表格合併引擎回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-tablemerge.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `tablemerge-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/tableMerge.ts', 'src/features/tableClean.ts'],
  bundle: true,
  format: 'esm',
  outdir: out,
  logLevel: 'silent',
})
const { mergeTables } = await import('file://' + join(out, 'tableMerge.js'))
const { parseTable, toCSV } = await import('file://' + join(out, 'tableClean.js'))

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

const customers = parseTable('email,name\na@x.com,Alice\nb@x.com,Bob\nc@x.com,Carol', {})
const orders = parseTable('email,amount\na@x.com,100\nc@x.com,300', {})

// --- left join(預設)---
const lj = mergeTables(customers, orders, { leftKey: 0, rightKey: 0 })
check('left join 表頭(排除右 key)', lj.table.headers.join(',') === 'email,name,amount')
check('left join 保留全部左列', lj.table.rows.length === 3)
check('left join 對到填值', lj.table.rows[0].join(',') === 'a@x.com,Alice,100')
check('left join 沒對到留空', lj.table.rows[1].join(',') === 'b@x.com,Bob,')
check('left join matched 計數', lj.matched === 2)
check('left join unmatched 計數', lj.unmatched === 1)

// --- inner join ---
const ij = mergeTables(customers, orders, { leftKey: 0, rightKey: 0, type: 'inner' })
check('inner join 只留對到的列', ij.table.rows.length === 2)
check('inner join 內容', ij.table.rows[1].join(',') === 'c@x.com,Carol,300')

// --- includeRightKey ---
const withKey = mergeTables(customers, orders, { leftKey: 0, rightKey: 0, includeRightKey: true })
check('includeRightKey 帶入右 key(改名避衝突)', withKey.table.headers.join(',') === 'email,name,email(2),amount')
check('includeRightKey 值正確', withKey.table.rows[0].join(',') === 'a@x.com,Alice,a@x.com,100')

// --- 大小寫 / 去空白 key ---
const mixed = parseTable('mail,amt\nA@X.com , 999', {})
const csInsens = mergeTables(customers, mixed, { leftKey: 0, rightKey: 0 })
check('key 預設忽略大小寫+去空白(僅 key 去空白,值原樣保留)', csInsens.table.rows[0].join(',') === 'a@x.com,Alice, 999')
const csSens = mergeTables(customers, mixed, { leftKey: 0, rightKey: 0, caseSensitive: true })
check('caseSensitive=true 不對到', csSens.table.rows[0].join(',') === 'a@x.com,Alice,')

// --- 右表重複 key(VLOOKUP 取第一筆)---
const dupRight = parseTable('email,amount\na@x.com,100\na@x.com,200', {})
const dr = mergeTables(customers, dupRight, { leftKey: 0, rightKey: 0 })
check('右表重複 key 取第一筆', dr.table.rows[0][2] === '100')
check('rightDuplicates 計數', dr.rightDuplicates === 1)

// --- 欄名衝突自動改名 ---
const a = parseTable('id,note\n1,x', {})
const b = parseTable('id,note\n1,y', {})
const coll = mergeTables(a, b, { leftKey: 0, rightKey: 0 })
check('欄名衝突 note→note(2)', coll.table.headers.join(',') === 'id,note,note(2)')
check('衝突改名值不覆蓋', coll.table.rows[0].join(',') === '1,x,y')

// --- 多欄右表 ---
const wide = parseTable('email,city,vip\na@x.com,Taipei,Y', {})
const mw = mergeTables(customers, wide, { leftKey: 0, rightKey: 0 })
check('多欄右表全部帶入', mw.table.headers.join(',') === 'email,name,city,vip' && mw.table.rows[0].join(',') === 'a@x.com,Alice,Taipei,Y')

// --- 空右表 ---
const empty = mergeTables(customers, parseTable('email,amount', {}), { leftKey: 0, rightKey: 0 })
check('空右表:左 join 全部留空', empty.table.rows.length === 3 && empty.matched === 0)

// --- 序列化整合 ---
check('合併後可序列化', toCSV(lj.table) === 'email,name,amount\r\na@x.com,Alice,100\r\nb@x.com,Bob,\r\nc@x.com,Carol,300')

console.log(fail === 0 ? '\n全部通過 ✅' : `\n${fail} 筆失敗 ❌`)
process.exit(fail === 0 ? 0 : 1)
