/*
  JSON Schema 產生器引擎回歸測試(node 直接跑)。
  執行:node scripts/test-jsonschema.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `jsonschema-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/jsonSchema.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { inferSchema, mergeSchemas, buildSchema, generate } = await import('file://' + out)

let fail = 0
let pass = 0
function deep(a, b, msg) {
  const ja = JSON.stringify(a)
  const jb = JSON.stringify(b)
  if (ja === jb) pass++
  else {
    fail++
    console.error(`✗ FAIL: ${msg}\n   got  ${ja}\n   want ${jb}`)
  }
}
function ok(c, msg) {
  if (c) pass++
  else {
    fail++
    console.error('✗ FAIL:', msg)
  }
}

// 基本型別
deep(inferSchema(null), { type: 'null' }, 'null')
deep(inferSchema(true), { type: 'boolean' }, 'boolean')
deep(inferSchema(42), { type: 'integer' }, 'integer')
deep(inferSchema(3.14), { type: 'number' }, 'number')
deep(inferSchema('hi'), { type: 'string' }, 'string plain')

// string format 偵測
deep(inferSchema('a@b.com'), { type: 'string', format: 'email' }, 'email format')
deep(inferSchema('2020-01-02'), { type: 'string', format: 'date' }, 'date format')
deep(
  inferSchema('2020-01-02T03:04:05Z'),
  { type: 'string', format: 'date-time' },
  'date-time format',
)
deep(inferSchema('https://x.com/y'), { type: 'string', format: 'uri' }, 'uri format')
deep(
  inferSchema('550e8400-e29b-41d4-a716-446655440000'),
  { type: 'string', format: 'uuid' },
  'uuid format',
)
// 關閉 format 偵測
deep(
  inferSchema('a@b.com', { detectFormat: false }),
  { type: 'string' },
  'format off',
)

// 物件
deep(
  inferSchema({ name: 'Bob', age: 30 }),
  {
    type: 'object',
    properties: { name: { type: 'string' }, age: { type: 'integer' } },
    required: ['name', 'age'],
  },
  'simple object',
)
// requireAll off
deep(
  inferSchema({ a: 1 }, { requireAll: false }),
  { type: 'object', properties: { a: { type: 'integer' } } },
  'requireAll off no required',
)

// 空陣列
deep(inferSchema([]), { type: 'array' }, 'empty array')

// 同型別陣列
deep(
  inferSchema([1, 2, 3]),
  { type: 'array', items: { type: 'integer' } },
  'int array',
)
// integer + number 混合 → number
deep(
  inferSchema([1, 2.5]),
  { type: 'array', items: { type: 'number' } },
  'int+number -> number',
)

// 混型別陣列 → anyOf
deep(
  inferSchema([1, 'x']),
  { type: 'array', items: { anyOf: [{ type: 'integer' }, { type: 'string' }] } },
  'mixed array anyOf',
)

// 物件陣列:required 取交集
deep(
  inferSchema([
    { a: 1, b: 2 },
    { a: 3 },
  ]),
  {
    type: 'array',
    items: {
      type: 'object',
      properties: { a: { type: 'integer' }, b: { type: 'integer' } },
      required: ['a'],
    },
  },
  'object array required intersection',
)

// 巢狀物件
deep(
  inferSchema({ user: { id: 1, tags: ['x', 'y'] } }),
  {
    type: 'object',
    properties: {
      user: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'tags'],
      },
    },
    required: ['user'],
  },
  'nested object',
)

// mergeSchemas 直接
deep(
  mergeSchemas([{ type: 'string' }, { type: 'string' }]),
  { type: 'string' },
  'merge identical',
)
deep(
  mergeSchemas([{ type: 'string', format: 'email' }, { type: 'string' }]),
  { type: 'string' },
  'merge string drop conflicting format',
)
// anyOf 攤平去重
deep(
  mergeSchemas([{ type: 'integer' }, { type: 'string' }, { type: 'integer' }]),
  { anyOf: [{ type: 'integer' }, { type: 'string' }] },
  'anyOf flatten dedupe',
)

// buildSchema 含 $schema 標頭
{
  const s = buildSchema({ a: 1 })
  ok(s.$schema === 'http://json-schema.org/draft-07/schema#', 'buildSchema has $schema')
  ok(s.type === 'object', 'buildSchema type object')
}

// generate 文字介面
{
  const r = generate('{"x": 1}')
  ok(r.ok, 'generate ok')
  ok(r.schema.includes('"type": "integer"'), 'generate contains integer')
}
{
  const r = generate('{bad json}')
  ok(!r.ok, 'generate bad json -> not ok')
  ok(r.error.includes('JSON 解析失敗'), 'generate error message')
}

// 頂層純陣列
deep(
  inferSchema(['a', 'b']),
  { type: 'array', items: { type: 'string' } },
  'top-level array',
)

console.log(`\njsonSchema: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
