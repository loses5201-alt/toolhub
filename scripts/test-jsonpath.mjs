// JSONPath 引擎回歸測試 —— 以 Goessner 書店範例為 oracle。
import { execSync } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'jsonpath-'))
const entry = join(dir, 'entry.mjs')
writeFileSync(
  entry,
  `export { query, parsePath } from '${join(process.cwd(), 'src/features/jsonPath.ts').replace(/\\/g, '\\\\')}'`,
)
const outFile = join(dir, 'bundle.mjs')
execSync(`npx esbuild ${entry} --bundle --format=esm --platform=node --outfile=${outFile}`, {
  stdio: ['ignore', 'ignore', 'inherit'],
})
const { query, parsePath } = await import('file://' + outFile)

let pass = 0
let fail = 0
function ok(cond, msg) {
  if (cond) pass++
  else {
    fail++
    console.error('✗', msg)
  }
}
// 取出所有 value(陣列)
function vals(data, path) {
  return query(data, path).map((n) => n.value)
}
function eq(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

const store = {
  store: {
    book: [
      { category: 'reference', author: 'Nigel Rees', title: 'Sayings of the Century', price: 8.95 },
      { category: 'fiction', author: 'Evelyn Waugh', title: 'Sword of Honour', price: 12.99 },
      { category: 'fiction', author: 'Herman Melville', title: 'Moby Dick', isbn: '0-553-21311-3', price: 8.99 },
      { category: 'fiction', author: 'J. R. R. Tolkien', title: 'The Lord of the Rings', isbn: '0-395-19395-8', price: 22.99 },
    ],
    bicycle: { color: 'red', price: 19.95 },
  },
}

// ── 基本路徑 ──
ok(eq(vals(store, '$.store.bicycle.color'), ['red']), '$.store.bicycle.color')
ok(eq(vals(store, "$['store']['bicycle']['color']"), ['red']), 'bracket 鍵')
ok(eq(vals(store, '$.store.book[0].title'), ['Sayings of the Century']), 'book[0].title')
ok(eq(vals(store, '$.store.book[-1].author'), ['J. R. R. Tolkien']), '負數索引')
ok(
  eq(vals(store, '$.store.book[*].author'), ['Nigel Rees', 'Evelyn Waugh', 'Herman Melville', 'J. R. R. Tolkien']),
  '萬用 [*] 取作者',
)
ok(eq(vals(store, '$.store.book[*].author').length, 4), 'book[*] 四筆')

// ── 萬用 / 遞迴 ──
ok(vals(store, '$.store.*').length === 2, '$.store.* = book 與 bicycle')
ok(eq(vals(store, '$..author'), ['Nigel Rees', 'Evelyn Waugh', 'Herman Melville', 'J. R. R. Tolkien']), '$..author')
ok(eq(vals(store, '$..price').sort(), [12.99, 19.95, 22.99, 8.95, 8.99].sort()), '$..price 五筆')
ok(vals(store, '$..price').length === 5, '$..price 數量')
ok(eq(vals(store, '$.store..price').length, 5), '$.store..price 五筆')
ok(eq(vals(store, '$..book[2].title'), ['Moby Dick']), '$..book[2]')

// ── 聯集 / 切片 ──
ok(eq(vals(store, '$..book[0,1]').map((b) => b.price), [8.95, 12.99]), '索引聯集 [0,1]')
ok(eq(vals(store, '$..book[:2]').map((b) => b.price), [8.95, 12.99]), '切片 [:2]')
ok(eq(vals(store, '$..book[1:3]').map((b) => b.price), [12.99, 8.99]), '切片 [1:3]')
ok(eq(vals(store, '$..book[-2:]').map((b) => b.price), [8.99, 22.99]), '切片 [-2:]')
ok(eq(vals(store, '$..book[::2]').map((b) => b.price), [8.95, 8.99]), '切片 step=2')
ok(eq(vals(store, "$['store']['book'][0,2]").length, 2), 'bracket 聯集')

// ── 過濾 ──
ok(eq(vals(store, '$..book[?(@.isbn)].title'), ['Moby Dick', 'The Lord of the Rings']), '存在性過濾 isbn')
ok(eq(vals(store, '$..book[?(@.price<10)].title'), ['Sayings of the Century', 'Moby Dick']), 'price<10')
ok(eq(vals(store, '$..book[?(@.price<=8.99)]').length, 2), 'price<=8.99')
ok(eq(vals(store, "$..book[?(@.category=='reference')].author"), ['Nigel Rees'], 'category 字串等於'), 'category==reference')
ok(eq(vals(store, "$..book[?(@.category!='fiction')]").length, 1), 'category!=fiction')
ok(
  eq(vals(store, "$..book[?(@.price<10 && @.category=='fiction')].title"), ['Moby Dick']),
  'AND 條件',
)
ok(eq(vals(store, '$..book[?(@.price>20 || @.price<9)]').length, 3), 'OR 條件')
ok(eq(vals(store, '$..book[?(@.price>100)]').length, 0), '無命中回空')

// ── 路徑輸出正規化 ──
ok(query(store, '$.store.book[1].author')[0].path === "$['store']['book'][1]['author']", '正規化路徑')
ok(eq(query(store, '$..author').map((n) => n.path)[0], "$['store']['book'][0]['author']"), '遞迴路徑')

// ── 邊界 / 型別 ──
const nested = { a: { b: { c: [1, 2, { d: 'x' }] } }, list: [{ v: 0 }, { v: 1 }, { v: 2 }] }
ok(eq(vals(nested, '$.a.b.c[2].d'), ['x']), '深層巢狀')
ok(eq(vals(nested, '$.list[?(@.v>=1)].v'), [1, 2], 'v>=1'), 'v>=1')
ok(eq(vals(nested, '$..c[*]').length, 3), '$..c[*]')
ok(eq(vals({ x: [10, 20, 30] }, '$.x[5]'), []), '索引越界回空')
ok(eq(vals({ x: null }, '$.x'), [null]), 'null 值保留')
ok(eq(vals({ 'a.b': 1 }, "$['a.b']"), [1]), '鍵含點用 bracket')
ok(eq(vals({ items: [] }, '$.items[*]'), []), '空陣列萬用')
ok(eq(vals({ list: [{ flag: false }] }, '$.list[?(@.flag==false)]').length, 1), 'flag==false')
ok(eq(vals({ list: [{ flag: false }] }, '$.list[?(@.flag)]').length, 0), 'false 不通過存在真值')

// ── 物件上的過濾(對屬性值)──
const dict = { a: { ok: true, n: 1 }, b: { ok: false, n: 2 }, c: { ok: true, n: 3 } }
ok(eq(vals(dict, '$[?(@.ok==true)].n').sort(), [1, 3]), '物件值過濾')

// ── parsePath 錯誤處理 ──
function throws(fn) {
  try {
    fn()
    return false
  } catch {
    return true
  }
}
ok(throws(() => parsePath('')), '空路徑報錯')
ok(throws(() => query(store, '$.store[1:2:3:4]')), '切片超過三段報錯')
ok(throws(() => query(store, '$.store.book[abc]')), '非整數索引報錯')
ok(throws(() => query(store, '$.store.book[0')), '未閉合中括號報錯')
ok(!throws(() => query(store, '$')), '單獨 $ 不報錯')
ok(eq(vals(store, '$').length, 1), '$ 回整份')

console.log(`jsonpath: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
