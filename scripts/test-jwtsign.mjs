/*
  JWT 簽發引擎回歸測試 —— 核對 jwt.io 著名 HS256 向量、與 Node 內建 crypto 交叉驗證,
  並與本檔的 verifyHmac 做往返(簽發→驗證)。執行:node scripts/test-jwtsign.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHmac } from 'node:crypto'

const out = join(tmpdir(), `jwtsign-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/jwt.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const {
  encodeSegment,
  buildHeader,
  signingInput,
  applyTimeClaims,
  signJwt,
  verifyHmac,
  decodeJwt,
} = await import('file://' + out)

let fail = 0
let pass = 0
function eq(a, b, msg) {
  if (a === b) pass++
  else {
    fail++
    console.error(`✗ FAIL: ${msg} — got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`)
  }
}
function ok(c, msg) {
  if (c) pass++
  else {
    fail++
    console.error('✗ FAIL:', msg)
  }
}

// Node 端參考實作:Base64Url
function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function nodeSign(payload, secret, alg) {
  const hashMap = { HS256: 'sha256', HS384: 'sha384', HS512: 'sha512' }
  const header = { alg, typ: 'JWT' }
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
  const sig = createHmac(hashMap[alg], secret).update(input).digest()
  return `${input}.${b64url(sig)}`
}

// --- encodeSegment / buildHeader / signingInput ---
eq(encodeSegment({ alg: 'HS256', typ: 'JWT' }), 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', 'encodeSegment 標準標頭')
eq(JSON.stringify(buildHeader('HS384')), '{"alg":"HS384","typ":"JWT"}', 'buildHeader HS384')
{
  const payload = { sub: '1234567890', name: 'John Doe', iat: 1516239022 }
  eq(
    signingInput(buildHeader('HS256'), payload),
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ',
    'signingInput 對齊 jwt.io',
  )
}

// --- 著名 jwt.io HS256 向量(secret = "your-256-bit-secret") ---
{
  const payload = { sub: '1234567890', name: 'John Doe', iat: 1516239022 }
  const token = await signJwt(payload, 'your-256-bit-secret', 'HS256')
  eq(
    token,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    'jwt.io 官方 HS256 向量',
  )
}

// --- 與 Node crypto 交叉驗證(多組 payload × 演算法) ---
const cases = [
  [{ a: 1 }, 'secret', 'HS256'],
  [{ user: '王小明', roles: ['admin', 'user'], n: 42 }, '台灣密鑰🔑', 'HS256'],
  [{ sub: 'x' }, 'k', 'HS384'],
  [{ data: { nested: true }, arr: [1, 2, 3] }, 'a-much-longer-secret-key-exceeding-block-size-........................', 'HS512'],
  [{}, 'k', 'HS256'], // 空 payload
]
for (const [payload, secret, alg] of cases) {
  const mine = await signJwt(payload, secret, alg)
  eq(mine, nodeSign(payload, secret, alg), `crypto 交叉驗證 ${alg} ${JSON.stringify(payload).slice(0, 20)}`)
}

// --- 簽發 → 用本檔 verifyHmac 驗證(往返) ---
for (const [payload, secret, alg] of cases) {
  const token = await signJwt(payload, secret, alg)
  const r = await verifyHmac(token, secret)
  ok(r.supported && r.valid === true, `verifyHmac 往返成立 ${alg}`)
  // 密鑰錯誤應驗證失敗
  const bad = await verifyHmac(token, secret + 'x')
  ok(bad.valid === false, `錯誤密鑰應失敗 ${alg}`)
  // decodeJwt 應能解回原 payload
  const d = decodeJwt(token)
  ok(d.ok && JSON.stringify(d.payload) === JSON.stringify(payload), `decodeJwt 解回 payload ${alg}`)
  ok(d.alg === alg, `decodeJwt 讀到 alg ${alg}`)
}

// --- applyTimeClaims ---
{
  const base = { sub: 'u1' }
  const r1 = applyTimeClaims(base, { iat: true, expSeconds: 3600 }, 1000)
  eq(r1.iat, 1000, 'applyTimeClaims iat')
  eq(r1.exp, 4600, 'applyTimeClaims exp = now + 3600')
  ok(r1.nbf === undefined, 'applyTimeClaims 未要求 nbf 則不加')
  ok(r1.sub === 'u1', 'applyTimeClaims 保留原欄位')
  ok(base.iat === undefined, 'applyTimeClaims 不更動原物件')

  const r2 = applyTimeClaims(base, { nbf: true }, 500)
  eq(r2.nbf, 500, 'applyTimeClaims nbf')
  ok(r2.exp === undefined, 'expSeconds 未給不加 exp')

  const r3 = applyTimeClaims(base, { expSeconds: 0 }, 500)
  ok(r3.exp === undefined, 'expSeconds=0 不加 exp')

  const r4 = applyTimeClaims(base, { expSeconds: 90.7 }, 500)
  eq(r4.exp, 590, 'expSeconds 取整數秒')
}

// --- 時間宣告併入後仍可被 Node crypto 驗證一致 ---
{
  const payload = applyTimeClaims({ sub: 'time' }, { iat: true, expSeconds: 60 }, 1700000000)
  const mine = await signJwt(payload, 'tk', 'HS256')
  eq(mine, nodeSign(payload, 'tk', 'HS256'), '帶時間宣告的 token 與 crypto 一致')
}

console.log(`\njwtsign: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
