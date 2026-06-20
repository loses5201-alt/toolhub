/*
  TOML ↔ JSON 引擎回歸測試。執行:node scripts/test-toml.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `toml-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/toml.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { parseToml, stringifyToml, tomlToJson, jsonToToml } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (!cond) {
    fail++
    console.error('❌', note)
  } else {
    console.log('✓', note)
  }
}
const p = (t) => parseToml(t).data
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// --- 基本鍵值 ---
check('字串值', p('a = "hello"').a === 'hello')
check('整數', p('a = 42').a === 42)
check('負整數', p('a = -7').a === -7)
check('正號整數', p('a = +9').a === 9)
check('底線數字', p('a = 1_000_000').a === 1000000)
check('浮點', p('a = 3.14').a === 3.14)
check('科學記號', p('a = 5e3').a === 5000)
check('十六進位', p('a = 0xFF').a === 255)
check('八進位', p('a = 0o17').a === 15)
check('二進位', p('a = 0b1010').a === 10)
check('布林 true', p('a = true').a === true)
check('布林 false', p('a = false').a === false)
check('inf', p('a = inf').a === Infinity)
check('-inf', p('a = -inf').a === -Infinity)
check('nan', Number.isNaN(p('a = nan').a))

// --- 字串種類 ---
check('字面字串不解跳脫', p("a = 'C:\\temp'").a === 'C:\\temp')
check('基本字串解跳脫 \\n', p('a = "x\\ny"').a === 'x\ny')
check('基本字串 unicode 跳脫', p('a = "\\u0041"').a === 'A')
check('多行基本字串去開頭換行', (() => {
  const o = p('a = """\nline1\nline2"""')
  return o.a === 'line1\nline2'
})())
check('多行字面字串', (() => {
  const o = p("a = '''\nraw\\nstay'''")
  return o.a === 'raw\\nstay'
})())
check('行尾反斜線吃掉換行', (() => {
  const o = p('a = """one \\\n   two"""')
  return o.a === 'one two'
})())

// --- 日期時間保留為字串 ---
check('日期', p('a = 2024-01-15').a === '2024-01-15')
check('日期時間 Z', p('a = 1979-05-27T07:32:00Z').a === '1979-05-27T07:32:00Z')
check('日期時間空格分隔', p('a = 2024-01-15 13:00:00').a === '2024-01-15 13:00:00')
check('本地時間', p('a = 07:32:00').a === '07:32:00')

// --- 註解 ---
check('整行註解略過', eq(p('# c\na = 1'), { a: 1 }))
check('行尾註解', p('a = 1 # trailing').a === 1)
check('# 在字串內不算註解', p('a = "x # y"').a === 'x # y')

// --- 表 ---
check('表', eq(p('[srv]\nhost = "h"\nport = 80'), { srv: { host: 'h', port: 80 } }))
check('巢狀表 [a.b.c]', eq(p('[a.b.c]\nx = 1'), { a: { b: { c: { x: 1 } } } }))
check('表後的根層?無;根鍵須在表前', eq(p('name = "app"\n[db]\nx = 1'), { name: 'app', db: { x: 1 } }))
check('多個表', eq(p('[a]\nx=1\n[b]\ny=2'), { a: { x: 1 }, b: { y: 2 } }))

// --- 點分鍵 ---
check('點分鍵', eq(p('a.b.c = 1'), { a: { b: { c: 1 } } }))
check('點分鍵合併', eq(p('a.b = 1\na.c = 2'), { a: { b: 1, c: 2 } }))
check('引號鍵', eq(p('"key with space" = 1'), { 'key with space': 1 }))

// --- 陣列 ---
check('整數陣列', eq(p('a = [1, 2, 3]').a, [1, 2, 3]))
check('字串陣列', eq(p('a = ["x", "y"]').a, ['x', 'y']))
check('空陣列', eq(p('a = []').a, []))
check('巢狀陣列', eq(p('a = [[1, 2], [3]]').a, [[1, 2], [3]]))
check('多行陣列含尾逗號與註解', (() => {
  const o = p('a = [\n  1, # one\n  2,\n  3,\n]')
  return eq(o.a, [1, 2, 3])
})())

// --- inline table ---
check('inline table', eq(p('a = { x = 1, y = 2 }').a, { x: 1, y: 2 }))
check('inline table 點分鍵', eq(p('a = { p.q = 1 }').a, { p: { q: 1 } }))
check('空 inline table', eq(p('a = {}').a, {}))

// --- 陣列表 [[ ]] ---
check('陣列表', eq(p('[[items]]\nn = 1\n[[items]]\nn = 2'), { items: [{ n: 1 }, { n: 2 }] }))
check('陣列表含子表', (() => {
  const o = p('[[fruit]]\nname = "apple"\n[fruit.physical]\ncolor = "red"')
  return eq(o, { fruit: [{ name: 'apple', physical: { color: 'red' } }] })
})())

// --- 真實片段(類 Cargo.toml)---
check('Cargo.toml 片段', (() => {
  const src = `[package]
name = "demo"
version = "0.1.0"
edition = "2021"

[dependencies]
serde = { version = "1.0", features = ["derive"] }
rand = "0.8"`
  const o = p(src)
  return o.package.name === 'demo' && o.dependencies.serde.version === '1.0' &&
    eq(o.dependencies.serde.features, ['derive']) && o.dependencies.rand === '0.8'
})())

// --- 錯誤處理 ---
check('缺 = 報錯', parseToml('a 1').error !== '')
check('表頭缺 ] 報錯', parseToml('[a\nx=1').error !== '')
check('字串未結束報錯', parseToml('a = "abc').error !== '')
check('陣列缺逗號報錯', parseToml('a = [1 2]').error !== '')
check('錯誤含行號', parseToml('a = 1\nb = ').error.includes('第 2 行') || parseToml('a=1\nb=').error.includes('2'))

// --- 序列化 JSON → TOML ---
check('序列化基本', stringifyToml({ a: 1, b: 'x' }).toml.includes('a = 1') && stringifyToml({ a: 1, b: 'x' }).toml.includes('b = "x"'))
check('序列化表', stringifyToml({ s: { x: 1 } }).toml.includes('[s]'))
check('序列化巢狀表用點路徑', stringifyToml({ a: { b: { c: 1 } } }).toml.includes('[a.b]'))
check('序列化陣列表', (() => {
  const t = stringifyToml({ items: [{ n: 1 }, { n: 2 }] }).toml
  return (t.match(/\[\[items\]\]/g) || []).length === 2
})())
check('序列化布林與浮點', stringifyToml({ a: true, b: 1.5 }).toml.includes('a = true') && stringifyToml({ a: true, b: 1.5 }).toml.includes('b = 1.5'))
check('序列化純量陣列', stringifyToml({ a: [1, 2, 3] }).toml.includes('a = [1, 2, 3]'))
check('序列化非物件報錯', stringifyToml([1, 2]).error !== '')
check('序列化含空白鍵加引號', stringifyToml({ 'a b': 1 }).toml.includes('"a b" = 1'))
check('序列化 inf/nan', stringifyToml({ a: Infinity, b: NaN }).toml.includes('a = inf') && stringifyToml({ a: Infinity, b: NaN }).toml.includes('b = nan'))

// --- 往返一致 ---
check('往返 TOML→JSON→TOML→JSON 一致', (() => {
  const src = `name = "app"
[server]
host = "localhost"
port = 8080
tags = ["a", "b"]

[[users]]
id = 1

[[users]]
id = 2`
  const o1 = p(src)
  const back = jsonToToml(JSON.stringify(o1)).toml
  const o2 = p(back)
  return eq(o1, o2)
})())

// --- 包裝函式 ---
check('tomlToJson 輸出有效 JSON', (() => {
  const { json, error } = tomlToJson('a = 1')
  return !error && JSON.parse(json).a === 1
})())
check('jsonToToml 壞 JSON 報錯', jsonToToml('{bad}').error !== '')

console.log(fail === 0 ? '\n全部通過 ✅' : `\n${fail} 筆失敗 ❌`)
process.exit(fail === 0 ? 0 : 1)
