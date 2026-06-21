// JSON Schema → 範例 JSON 回歸測試
import { execSync } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'schemasample-'))
const entry = join(dir, 'entry.mjs')
const src = join(process.cwd(), 'src/features/schemaSample.ts').replace(/\\/g, '\\\\')
writeFileSync(entry, `export { sampleFromSchema } from '${src}'`)
const outFile = join(dir, 'bundle.mjs')
execSync(`npx esbuild ${entry} --bundle --format=esm --platform=node --outfile=${outFile}`, {
  stdio: ['ignore', 'ignore', 'inherit'],
})
const { sampleFromSchema } = await import('file://' + outFile)

let pass = 0
let fail = 0
function ok(cond, msg) {
  if (cond) pass++
  else {
    fail++
    console.error('✗', msg)
  }
}
// 解析回 JS 值方便斷言
const val = (schema, opts) => {
  const r = sampleFromSchema(JSON.stringify(schema), opts)
  if (!r.ok) throw new Error(r.error)
  return JSON.parse(r.sample)
}

// ── 基本型別 ──
ok(val({ type: 'string' }) === 'string', 'string → "string"')
ok(val({ type: 'integer' }) === 1, 'integer → 1')
ok(val({ type: 'number' }) === 1.5, 'number → 1.5')
ok(val({ type: 'boolean' }) === true, 'boolean → true')
ok(val({ type: 'null' }) === null, 'null → null')

// ── const / default / examples / enum 優先序 ──
ok(val({ const: 42 }) === 42, 'const')
ok(val({ type: 'string', default: 'hi' }) === 'hi', 'default')
ok(val({ type: 'string', examples: ['ex'] }) === 'ex', 'examples[0]')
ok(val({ type: 'string', enum: ['a', 'b'] }) === 'a', 'enum[0]')
ok(val({ enum: ['x'], default: 'y' }) === 'y', 'default 優先於 enum')

// ── string format ──
ok(val({ type: 'string', format: 'email' }) === 'user@example.com', 'email format')
ok(val({ type: 'string', format: 'date' }) === '2026-01-01', 'date format')
ok(val({ type: 'string', format: 'date-time' }).includes('T'), 'date-time format')
ok(val({ type: 'string', format: 'uuid' }).length === 36, 'uuid format')
ok(/^https/.test(val({ type: 'string', format: 'uri' })), 'uri format')
ok(val({ type: 'string', minLength: 8 }).length >= 8, 'minLength 補長')

// ── number 限制 ──
ok(val({ type: 'integer', minimum: 5 }) === 5, 'integer minimum')
ok(val({ type: 'integer', minimum: 3, multipleOf: 5 }) === 5, 'multipleOf 進位')
ok(val({ type: 'number', maximum: 10, minimum: undefined }) >= 0, 'number maximum fallback')

// ── 物件 ──
const o1 = val({
  type: 'object',
  properties: { id: { type: 'integer' }, name: { type: 'string' } },
})
ok(o1.id === 1 && o1.name === 'string', '物件屬性')

// ── requiredOnly ──
const o2 = val(
  {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'integer' }, name: { type: 'string' } },
  },
  { requiredOnly: true },
)
ok('id' in o2 && !('name' in o2), 'requiredOnly 只留必填')
const o2b = val(
  {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'integer' }, name: { type: 'string' } },
  },
  { requiredOnly: false },
)
ok('id' in o2b && 'name' in o2b, '預設全部輸出')

// ── 無 type 但有 properties 視為物件 ──
const o3 = val({ properties: { a: { type: 'boolean' } } })
ok(o3.a === true, '無 type+properties → object')

// ── 陣列 ──
const a1 = val({ type: 'array', items: { type: 'string' } })
ok(Array.isArray(a1) && a1.length === 1 && a1[0] === 'string', '陣列預設 1 筆')
const a2 = val({ type: 'array', items: { type: 'integer' } }, { arrayCount: 3 })
ok(a2.length === 3, 'arrayCount=3')
const a3 = val({ type: 'array', items: { type: 'integer' }, minItems: 2 })
ok(a3.length === 2, 'minItems 提升數量')
const a4 = val({ type: 'array', items: { type: 'integer' }, maxItems: 0 }, { arrayCount: 5 })
ok(a4.length === 0, 'maxItems 限制')
// tuple
const a5 = val({ type: 'array', items: [{ type: 'string' }, { type: 'integer' }] })
ok(a5.length === 2 && a5[0] === 'string' && a5[1] === 1, 'tuple items')

// ── 巢狀 ──
const n1 = val({
  type: 'object',
  properties: {
    user: {
      type: 'object',
      properties: { tags: { type: 'array', items: { type: 'string' } } },
    },
  },
})
ok(n1.user.tags[0] === 'string', '巢狀物件+陣列')

// ── $ref(definitions / $defs)──
const r1 = val({
  type: 'object',
  properties: { addr: { $ref: '#/definitions/Address' } },
  definitions: { Address: { type: 'object', properties: { city: { type: 'string' } } } },
})
ok(r1.addr.city === 'string', '$ref definitions')
const r2 = val({
  $defs: { Id: { type: 'integer', minimum: 100 } },
  type: 'object',
  properties: { id: { $ref: '#/$defs/Id' } },
})
ok(r2.id === 100, '$ref $defs')

// ── 遞迴 $ref 不無限迴圈 ──
const rec = sampleFromSchema(
  JSON.stringify({
    type: 'object',
    properties: { name: { type: 'string' }, next: { $ref: '#' } },
  }),
)
ok(rec.ok, '遞迴 $ref 仍成功(不爆堆疊)')

// ── allOf 合併 ──
const al = val({
  allOf: [
    { type: 'object', properties: { a: { type: 'integer' } } },
    { type: 'object', properties: { b: { type: 'string' } } },
  ],
})
ok(al.a === 1 && al.b === 'string', 'allOf 合併物件')

// ── anyOf / oneOf 取第一個 ──
ok(val({ anyOf: [{ type: 'string' }, { type: 'integer' }] }) === 'string', 'anyOf[0]')
ok(val({ oneOf: [{ type: 'integer' }, { type: 'string' }] }) === 1, 'oneOf[0]')

// ── type 為陣列(nullable)──
ok(val({ type: ['null', 'string'] }) === 'string', 'type 陣列取非 null')

// ── 真實 schema ──
const real = val({
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['id', 'email'],
  properties: {
    id: { type: 'integer', minimum: 1 },
    email: { type: 'string', format: 'email' },
    active: { type: 'boolean' },
    roles: { type: 'array', items: { type: 'string', enum: ['admin', 'user'] } },
  },
})
ok(real.id === 1 && real.email === 'user@example.com' && real.active === true && real.roles[0] === 'admin', '綜合 schema')

// ── 錯誤處理 ──
const err = sampleFromSchema('{bad')
ok(err.ok === false && /解析失敗/.test(err.error), '壞 JSON 報錯')

console.log(`schemasample: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
