/*
  隨機 ID 產生引擎回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-idgen.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `idgen-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/idGen.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const {
  uuidV4,
  isValidUuidV4,
  ulid,
  isValidUlid,
  encodeTimeBase32,
  nanoid,
  generate,
  NANO_URLSAFE,
} = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// --- UUID v4 ---
const u = uuidV4()
check('UUID 格式正確', isValidUuidV4(u))
check('UUID 版本位為 4', u[14] === '4')
check('UUID variant 在 89ab', '89ab'.includes(u[19].toLowerCase()))
check('UUID 長度 36', u.length === 36)
check('isValidUuidV4 拒絕亂字串', !isValidUuidV4('not-a-uuid'))
check('isValidUuidV4 拒絕版本 3', !isValidUuidV4('00000000-0000-3000-8000-000000000000'))
{
  const set = new Set()
  for (let i = 0; i < 2000; i++) set.add(uuidV4())
  check('2000 個 UUID 全不重複', set.size === 2000)
}

// --- ULID ---
const id = ulid()
check('ULID 長度 26', id.length === 26)
check('ULID 字元集正確', isValidUlid(id))
check('ULID 不含易混淆字 I L O U', !/[ILOU]/.test(id))
check('encodeTime 0 → 全 0', encodeTimeBase32(0, 10) === '0000000000')
check('encodeTime 1 → 末位 1', encodeTimeBase32(1, 10) === '0000000001')
check('encodeTime 32 → ...10', encodeTimeBase32(32, 10).endsWith('10'))
check('encodeTime 長度', encodeTimeBase32(Date.now(), 10).length === 10)
{
  // 時間較大者字典序較大(可排序性)
  const a = ulid(1000)
  const b = ulid(2000)
  check('ULID 時間大者字典序較大', a.slice(0, 10) < b.slice(0, 10))
  const set = new Set()
  for (let i = 0; i < 2000; i++) set.add(ulid())
  check('2000 個 ULID 全不重複', set.size === 2000)
}

// --- Nano ID ---
const n = nanoid()
check('Nano ID 預設長度 21', n.length === 21)
check('Nano ID 字元都在字元集內', [...n].every((c) => NANO_URLSAFE.includes(c)))
check('Nano ID 自訂長度', nanoid(10).length === 10)
check('Nano ID 自訂字元集', [...nanoid(50, 'ABC')].every((c) => 'ABC'.includes(c)))
check('Nano ID size 0 → 空字串', nanoid(0) === '')
{
  const set = new Set()
  for (let i = 0; i < 2000; i++) set.add(nanoid())
  check('2000 個 Nano ID 全不重複', set.size === 2000)
}
// 字元集太短/太長要報錯
let threw = false
try {
  nanoid(5, 'A')
} catch {
  threw = true
}
check('字元集只有 1 字報錯', threw)

// --- 分布大致均勻(粗略,避免明顯偏差)---
{
  const counts = {}
  for (let i = 0; i < 6400; i++) {
    const c = nanoid(1, 'AB')
    counts[c] = (counts[c] || 0) + 1
  }
  const a = counts['A'] || 0
  check('二元字元集分布大致均勻(A 介於 35%–65%)', a > 2240 && a < 4160)
}

// --- generate 批次 ---
check('generate uuid 5 個', generate('uuid', 5).length === 5)
check('generate ulid 全有效', generate('ulid', 10).every(isValidUlid))
check('generate nanoid 自訂長度', generate('nanoid', 3, { size: 8 }).every((x) => x.length === 8))
check('generate 上限 10000', generate('uuid', 999999).length === 10000)
check('generate 下限 1', generate('uuid', 0).length === 1)

if (fail) {
  console.error(`\n${fail} 個測試失敗`)
  process.exit(1)
}
console.log('\n全部通過')
