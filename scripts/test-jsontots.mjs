/*
  JSON → TypeScript 型別產生引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-jsontots.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `jsontots-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/jsonToTs.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { jsonToTs } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}
const gen = (obj, name) => jsonToTs(typeof obj === 'string' ? obj : JSON.stringify(obj), name)

// --- 基本型別 ---
const r1 = gen({ name: 'A', age: 30, ok: true })
check('成功', r1.ok)
check('root interface 名', r1.code.includes('export interface Root {'))
check('string 欄位', /name: string;/.test(r1.code))
check('number 欄位', /age: number;/.test(r1.code))
check('boolean 欄位', /ok: boolean;/.test(r1.code))

// --- null 與基本陣列 ---
const r2 = gen({ note: null, tags: ['a', 'b'] })
check('null 型別', /note: null;/.test(r2.code))
check('string 陣列', /tags: string\[\];/.test(r2.code))

const r3 = gen({ nums: [1, 2, 3], mixed: [1, 'a'] })
check('number 陣列', /nums: number\[\];/.test(r3.code))
check('混合陣列聯集加括號', /mixed: \(number \| string\)\[\];|mixed: \(string \| number\)\[\];/.test(r3.code))

// --- 巢狀物件 → 具名 interface ---
const r4 = gen({ user: { id: 1, city: 'TPE' } })
check('巢狀產生 interface', r4.code.includes('export interface User {'))
check('巢狀欄位引用', /user: User;/.test(r4.code))
check('巢狀內欄位', /id: number;/.test(r4.code) && /city: string;/.test(r4.code))

// --- 陣列內物件:合併 + 可選 + 單數命名 ---
const r5 = gen({ items: [{ a: 1 }, { a: 2, b: 'x' }] })
check('陣列物件 → 單數 interface Item', r5.code.includes('export interface Item {'))
check('陣列物件欄位引用', /items: Item\[\];/.test(r5.code))
check('全部都有的鍵不可選', /a: number;/.test(r5.code))
check('部分才有的鍵標可選', /b\?: string;/.test(r5.code))

// --- 同鍵不同型別 → 聯集 ---
const r6 = gen({ list: [{ v: 1 }, { v: 'two' }] })
check('同鍵不同型別聯集', /v: number \| string;|v: string \| number;/.test(r6.code))

// --- 不合法識別字的鍵加引號 ---
const r7 = gen({ 'a-b': 1, '2c': 2, 中文: 3 })
check('連字號鍵加引號', r7.code.includes('"a-b": number;'))
check('數字開頭鍵加引號', r7.code.includes('"2c": number;'))
check('中文鍵亦加引號', r7.code.includes('"中文": number;'))

// --- 根為陣列 → type 別名 ---
const r8 = gen([{ id: 1 }, { id: 2 }], 'Row')
check('根陣列用 type 別名', r8.code.includes('export type Row = Row2[];') || /export type Row = \w+\[\];/.test(r8.code))
check('根陣列元素 interface 存在', /export interface Row\d? \{/.test(r8.code))

// --- 根為基本值 ---
const r9 = gen(42, 'N')
check('根數字 type 別名', r9.code.includes('export type N = number;'))

// --- 名稱衝突 ---
const r10 = gen({ user: { profile: 1 }, data: { user: { x: 1 } } })
check('名稱衝突自動加序號', /interface User \{/.test(r10.code) && /interface User2 \{/.test(r10.code))

// --- 空物件 / 空陣列 ---
check('空物件', gen({}).code.includes('export interface Root {'))
check('空陣列欄位→unknown[]', /e: unknown\[\];/.test(gen({ e: [] }).code))

// --- 錯誤處理 ---
const bad = jsonToTs('{not json')
check('解析失敗回 ok=false', bad.ok === false && typeof bad.error === 'string')

// --- 名稱清理 ---
check('rootName 轉 PascalCase', gen({ a: 1 }, 'my response').code.includes('interface MyResponse {'))

// --- 深層巢狀整體健全 ---
const deep = gen({ order: { items: [{ sku: 'A', qty: 2 }], buyer: { name: 'X' } } })
check('深層:Order', deep.code.includes('interface Order {'))
check('深層:單數 Item', deep.code.includes('interface Item {'))
check('深層:Buyer', deep.code.includes('interface Buyer {'))
check('深層:items 引用 Item[]', /items: Item\[\];/.test(deep.code))

console.log(fail === 0 ? `\n全部通過` : `\n${fail} 筆失敗`)
process.exit(fail === 0 ? 0 : 1)
