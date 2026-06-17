/*
  JSON 攤平引擎回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-jsonflatten.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `jsonflatten-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/jsonFlatten.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { flattenOne, flattenJson, flattenedToCSV } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}
const keys = (o) => Object.keys(o).join(',')

// --- flattenOne 基本 ---
const o1 = flattenOne({ a: 1, b: 'x' })
check('扁平物件', o1.a === '1' && o1.b === 'x')

const o2 = flattenOne({ a: { b: { c: 5 } } })
check('巢狀物件路徑 a.b.c', o2['a.b.c'] === '5')

const o3 = flattenOne({ tags: ['x', 'y', 'z'] })
check('陣列索引 tags[0..2]', o3['tags[0]'] === 'x' && o3['tags[2]'] === 'z')

const o4 = flattenOne({ items: [{ id: 1 }, { id: 2 }] })
check('物件陣列路徑 items[0].id', o4['items[0].id'] === '1' && o4['items[1].id'] === '2')

// --- 型別轉換 ---
const o5 = flattenOne({ b: true, n: null, z: 0, f: false })
check('boolean true', o5.b === 'true')
check('boolean false', o5.f === 'false')
check('null → 空字串', o5.n === '')
check('數字 0', o5.z === '0')

// --- 頂層純值 / 空 ---
check('頂層純值用 value 鍵', flattenOne(42).value === '42')
check('空物件 → value 空', flattenOne({}).value === '')
check('空陣列 → value 空', flattenOne([]).value === '')
const o6 = flattenOne({ a: {}, b: [] })
check('巢狀空物件保留鍵', o6.a === '' && o6.b === '')

// --- flattenJson 頂層陣列 → 多列 ---
const r1 = flattenJson('[{"a":1},{"a":2,"b":3}]')
check('頂層陣列 ok', r1.ok && r1.rows.length === 2)
check('第二列有 b', r1.rows[1].b === '3')

// --- flattenJson 頂層物件 → 單列 ---
const r2 = flattenJson('{"user":{"name":"小明","roles":["admin","user"]}}')
check('頂層物件單列', r2.rows.length === 1)
check('深層路徑值', r2.rows[0]['user.name'] === '小明' && r2.rows[0]['user.roles[1]'] === 'user')

// --- 錯誤處理 ---
check('空字串報錯', flattenJson('').ok === false)
check('壞 JSON 報錯', flattenJson('{bad').ok === false)

// --- CSV 整合(欄位聯集、首見順序)---
const r3 = flattenJson('[{"a":1,"b":2},{"a":3,"c":4}]')
const csv = flattenedToCSV(r3.rows)
check('CSV 表頭聯集 a,b,c', csv.split('\r\n')[0] === 'a,b,c')
check('CSV 缺欄留空', csv.split('\r\n')[1] === '1,2,' && csv.split('\r\n')[2] === '3,,4')

// --- 含逗號值正確加引號(交給 objectsToCSV)---
const r4 = flattenJson('[{"note":"a,b"}]')
check('CSV 逗號值加引號', flattenedToCSV(r4.rows).split('\r\n')[1] === '"a,b"')

// --- 真實巢狀範例 ---
const real = flattenJson(JSON.stringify([
  { id: 1, addr: { city: '台北', zip: '100' }, tags: ['vip'] },
  { id: 2, addr: { city: '高雄', zip: '800' }, tags: [] },
]))
check('真實範例第一列', real.rows[0]['addr.city'] === '台北' && real.rows[0]['tags[0]'] === 'vip')
check('真實範例第二列空陣列', real.rows[1]['tags'] === '')

console.log(fail === 0 ? '\n全部通過 ✅' : `\n${fail} 筆失敗 ❌`)
process.exit(fail === 0 ? 0 : 1)
