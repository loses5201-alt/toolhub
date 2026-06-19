/*
  JSON 修復 / 寬鬆解析引擎回歸測試(node 直接跑)。
  執行:node scripts/test-jsonrepair.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `jsonrepair-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/jsonRepair.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { repairJson } = await import('file://' + out)

let fail = 0
let pass = 0
function ok(c, msg) {
  if (c) pass++
  else {
    fail++
    console.error('✗ FAIL:', msg)
  }
}
// 解析後 value 與預期深度相等
function val(input, expected, msg) {
  const r = repairJson(input)
  if (!r.ok) {
    fail++
    console.error(`✗ FAIL: ${msg} — 解析失敗:${r.error}`)
    return
  }
  const got = JSON.stringify(r.value)
  const want = JSON.stringify(expected)
  if (got === want) pass++
  else {
    fail++
    console.error(`✗ FAIL: ${msg}\n   got  ${got}\n   want ${want}`)
  }
}
function bad(input, msg) {
  const r = repairJson(input)
  ok(!r.ok, msg + ' (應失敗)')
}

// 標準 JSON 不變
val('{"a":1,"b":[2,3],"c":null}', { a: 1, b: [2, 3], c: null }, 'standard json')
val('[1,2,3]', [1, 2, 3], 'array')
val('"hello"', 'hello', 'top-level string')
val('42', 42, 'top-level number')
val('true', true, 'top-level true')

// 單引號
val("{'a': 'b'}", { a: 'b' }, 'single quotes')
val("['x', 'y']", ['x', 'y'], 'single quote array')

// 未加引號的鍵
val('{a: 1, b: 2}', { a: 1, b: 2 }, 'unquoted keys')
val('{ name: "Bob", age: 30 }', { name: 'Bob', age: 30 }, 'unquoted keys mixed')
val('{$ref: 1, _id: 2, a-b: 3}', { $ref: 1, _id: 2, 'a-b': 3 }, 'unquoted special key chars')

// 結尾多餘逗號
val('{"a":1,}', { a: 1 }, 'trailing comma object')
val('[1,2,3,]', [1, 2, 3], 'trailing comma array')
val('{"a":[1,2,],}', { a: [1, 2] }, 'nested trailing commas')

// 註解
val('{"a":1 // 行註解\n}', { a: 1 }, 'line comment')
val('{/* 區塊 */ "a": 1}', { a: 1 }, 'block comment')
val('[1, /* c */ 2, 3]', [1, 2, 3], 'inline block comment')
val('// 開頭註解\n{"a":1}', { a: 1 }, 'leading line comment')

// Python 風格字面量
val('{"a": True, "b": False, "c": None}', { a: true, b: false, c: null }, 'python literals')
val('[None, True, False]', [null, true, false], 'python literals array')
val('undefined', null, 'undefined -> null')

// NaN / Infinity -> null(JSON 合法)
val('{"a": NaN}', { a: null }, 'NaN -> null')
val('{"a": Infinity, "b": -Infinity}', { a: null, b: null }, 'Infinity -> null')

// 數字變體
val('{"a": 0xFF}', { a: 255 }, 'hex number')
val('{"a": 1_000}', { a: 1000 }, 'underscore separators')
val('{"a": .5, "b": +3}', { a: 0.5, b: 3 }, 'leading dot / plus sign')

// 跳脫字元
val('{"a": "line\\nbreak"}', { a: 'line\nbreak' }, 'escape newline')
val("{'a': 'it\\'s'}", { a: "it's" }, 'single quote escape')
val('{"a": "\\u4e2d\\u6587"}', { a: '中文' }, 'unicode escape')

// 混合大雜燴(LLM / JS 物件常見)
val(
  "{\n  name: 'ToolHub', // 名稱\n  tags: ['a', 'b',],\n  active: True,\n  score: NaN,\n}",
  { name: 'ToolHub', tags: ['a', 'b'], active: true, score: null },
  'kitchen sink',
)

// 巢狀
val('{a:{b:{c:[1,{d:True}]}}}', { a: { b: { c: [1, { d: true }] } } }, 'deep nested')

// 輸出格式
{
  const r = repairJson("{a:1,b:2}")
  ok(r.ok, 'format ok')
  ok(r.json.includes('\n  "a": 1'), 'pretty json has indent')
  ok(r.minified === '{"a":1,"b":2}', 'minified')
}

// 錯誤情形
bad('', 'empty input')
bad('{"a": }', 'missing value')
bad('{"a" 1}', 'missing colon')
bad('{"a":1} extra', 'trailing content')
bad("{'a': 'unterminated}", 'unterminated string')
bad('[1, 2', 'unterminated array')

// 與標準 JSON.parse 對拍(隨機合法 JSON 應一致)
const samples = [
  '{"x":[1,2,3],"y":{"z":true}}',
  '[null,false,"a",1.5,-2]',
  '{"中文":"值","emoji":"😀"}',
  '{"nested":{"deep":{"arr":[{"k":"v"}]}}}',
]
for (const s of samples) {
  const r = repairJson(s)
  ok(r.ok && JSON.stringify(r.value) === JSON.stringify(JSON.parse(s)), `vs JSON.parse ${s.slice(0, 20)}`)
}

console.log(`\njsonRepair: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
