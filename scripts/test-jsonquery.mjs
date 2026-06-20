/*
  JSON 查詢引擎(JSONPath 子集)回歸測試(node 直接跑)。
  執行:node scripts/test-jsonquery.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `jsonquery-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/jsonQuery.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { queryJson } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

const store = JSON.stringify({
  store: {
    book: [
      { category: 'reference', author: 'Nigel Rees', title: 'Sayings of the Century', price: 8.95 },
      { category: 'fiction', author: 'Evelyn Waugh', title: 'Sword of Honour', price: 12.99 },
      { category: 'fiction', author: 'Herman Melville', title: 'Moby Dick', isbn: '0-553-21311-3', price: 8.99 },
      { category: 'fiction', author: 'J. R. R. Tolkien', title: 'The Lord of the Rings', isbn: '0-395-19395-8', price: 22.99 },
    ],
    bicycle: { color: 'red', price: 19.95 },
  },
})

// helper:取結果陣列
const q = (path, json = store) => queryJson(json, path)

// ── 基本屬性與索引 ──────────────────────────────────────
{
  const r = q('$.store.book[0].title')
  check('基本路徑取值', r.ok && r.count === 1 && r.results[0] === 'Sayings of the Century')
}
check('可省略 $ 開頭', q('store.book[0].title').results[0] === 'Sayings of the Century')
check('負索引取尾端', q('$.store.book[-1].title').results[0] === 'The Lord of the Rings')
check('索引越界回空', q('$.store.book[10]').ok && q('$.store.book[10]').count === 0)
check('屬性不存在回空(不報錯)', q('$.store.car').ok && q('$.store.car').count === 0)
check('$ 單獨回根節點', q('$').count === 1 && q('$').results[0].store !== undefined)

// ── 萬用字元 ────────────────────────────────────────────
check('陣列萬用 [*]', q('$.store.book[*]').count === 4)
check('屬性萬用 .*', q('$.store.*').count === 2)
{
  const authors = q('$.store.book[*].author').results
  check('萬用後取屬性', authors.length === 4 && authors[1] === 'Evelyn Waugh')
}

// ── 遞迴下降 ────────────────────────────────────────────
check('遞迴 ..author', q('$..author').count === 4)
{
  const prices = q('$.store..price').results
  check('遞迴 ..price 含書與單車', prices.length === 5 && prices.includes(19.95) && prices.includes(8.95))
}
check('遞迴接 key ..color', q('$..color').count === 1 && q('$..color').results[0] === 'red')
check('遞迴接萬用 ..book[*].title', q('$..book[*].title').count === 4)

// ── 切片 ────────────────────────────────────────────────
check('切片 [1:3]', q('$.store.book[1:3]').count === 2)
check('切片 [:2]', q('$.store.book[:2]').count === 2)
check('切片 [::2]', q('$.store.book[::2]').count === 2)
check('切片負值 [-2:]', q('$.store.book[-2:]').count === 2)
{
  const r = q('$.store.book[-2:].title').results
  check('切片負值內容正確', r[0] === 'Moby Dick' && r[1] === 'The Lord of the Rings')
}

// ── 過濾器 ──────────────────────────────────────────────
check('過濾存在 [?(@.isbn)]', q('$.store.book[?(@.isbn)]').count === 2)
check('過濾數值 < ', q('$.store.book[?(@.price < 10)]').count === 2)
check('過濾數值 >= ', q('$.store.book[?(@.price >= 12.99)]').count === 2)
check('過濾數值 > ', q('$.store.book[?(@.price > 20)]').count === 1)
check('過濾字串 == ', q('$.store.book[?(@.category == "fiction")]').count === 3)
check('過濾字串 != ', q('$.store.book[?(@.category != "fiction")]').count === 1)
check('過濾單引號字串', q("$.store.book[?(@.category == 'reference')]").count === 1)

// ── 中括號 / 引號屬性 ──────────────────────────────────
check('中括號字串鍵', q('$["store"]["bicycle"]["color"]').results[0] === 'red')
{
  const doc = JSON.stringify({ 'full name': '王小明', list: [1, 2, 3] })
  check('含空白的鍵', q("$['full name']", doc).results[0] === '王小明')
}

// ── 頂層陣列 ────────────────────────────────────────────
{
  const arr = JSON.stringify([10, 20, 30])
  check('頂層陣列 [1]', q('$[1]', arr).results[0] === 20)
  check('頂層陣列 [*]', q('$[*]', arr).count === 3)
  check('頂層陣列 [-1]', q('$[-1]', arr).results[0] === 30)
}

// ── 中文鍵與值 ──────────────────────────────────────────
{
  const doc = JSON.stringify({ 使用者: [{ 姓名: '小明' }, { 姓名: '小華' }] })
  check('中文鍵遞迴', q('$..姓名', doc).count === 2 && q('$..姓名', doc).results[0] === '小明')
}

// ── 輸出格式 ────────────────────────────────────────────
{
  const r = q('$.store.bicycle')
  check('output 為美化 JSON', r.output.includes('\n') && JSON.parse(r.output)[0].color === 'red')
}

// ── 錯誤處理(不丟例外)─────────────────────────────────
check('JSON 無效報錯', !q('$.a', '{bad json}').ok)
check('空 JSON 報錯', !q('$.a', '   ').ok)
check('空路徑報錯', !q('   ', store).ok)
check('過濾語法錯誤報錯', !q('$.store.book[?(price > 1)]').ok) // 缺 @
check('切片 step 0 報錯', !q('$.store.book[1:3:0]').ok)
check('未閉合中括號報錯', !q('$.store.book[0').ok)

console.log(fail === 0 ? '\nAll json-query tests passed.' : `\n${fail} test(s) FAILED.`)
process.exit(fail === 0 ? 0 : 1)
