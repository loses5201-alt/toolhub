/*
  TOTP / HOTP 引擎回歸測試 —— 以 RFC 4226 / RFC 6238 官方測試向量驗證。
  HMAC 用 Node 22 內建的 crypto.subtle(與瀏覽器相同)。
  執行:node scripts/test-totp.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `totp-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/totp.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { base32Decode, counterToBytes, truncate, hotp, totp, parseOtpauth } =
  await import('file://' + out)

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
function bytesEq(a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

// base32 解碼:RFC 4648 已知值
ok(bytesEq(base32Decode('MY======'), new Uint8Array([0x66])), 'base32 MY -> f')
ok(bytesEq(base32Decode('MZXW6'), new TextEncoder().encode('foo')), 'base32 MZXW6 -> foo')
ok(
  bytesEq(base32Decode('MZXW6YTBOI======'), new TextEncoder().encode('foobar')),
  'base32 padding stripped -> foobar',
)
// "12345678901234567890" 的 base32(TOTP RFC 6238 SHA1 種子)
ok(
  bytesEq(
    base32Decode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'),
    new TextEncoder().encode('12345678901234567890'),
  ),
  'base32 RFC6238 seed',
)
eq(base32Decode('').length, 0, 'base32 empty -> empty')
eq(base32Decode('0189'), null, 'base32 invalid chars -> null') // 0,1,8,9 不在字母表
// 大小寫與空白容忍
ok(bytesEq(base32Decode('mz xw 6'), new TextEncoder().encode('foo')), 'base32 lowercase+space')

// counterToBytes
ok(bytesEq(counterToBytes(0), new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0])), 'counter 0')
ok(bytesEq(counterToBytes(1), new Uint8Array([0, 0, 0, 0, 0, 0, 0, 1])), 'counter 1')
ok(
  bytesEq(counterToBytes(0x0102030405), new Uint8Array([0, 0, 0, 1, 2, 3, 4, 5])),
  'counter big-endian large',
)

// truncate(RFC 4226 §5.4 範例:已知 HMAC → 計算偏移)
{
  // RFC 4226 附錄 D 的 HMAC-SHA-1(counter=0)中段範例不易手列,改由 hotp 端對端驗證。
  // 這裡用一個建構好的 20 byte 陣列驗 offset 邏輯:最後一個 byte 低 4 位 = offset
  const h = new Uint8Array(20)
  h[19] = 0x05 // offset = 5
  h[5] = 0x7f
  h[6] = 0xff
  h[7] = 0xff
  h[8] = 0xff
  eq(truncate(h, 6), (0x7fffffff % 1000000).toString().padStart(6, '0'), 'truncate offset logic')
}

// HOTP:RFC 4226 附錄 D 官方向量(secret "12345678901234567890",counter 0–9)
const key = new TextEncoder().encode('12345678901234567890')
const hotpVectors = [
  '755224',
  '287082',
  '359152',
  '969429',
  '338314',
  '254676',
  '287922',
  '162583',
  '399871',
  '520489',
]
for (let c = 0; c < hotpVectors.length; c++) {
  const code = await hotp(key, c, 6, 'SHA-1')
  eq(code, hotpVectors[c], `HOTP counter ${c}`)
}

// TOTP:RFC 6238 附錄 B 官方向量(SHA1,8 位數,step 30)
const totpSha1 = [
  [59, '94287082'],
  [1111111109, '07081804'],
  [1111111111, '14050471'],
  [1234567890, '89005924'],
  [2000000000, '69279037'],
  [20000000000, '65353130'],
]
for (const [t, code] of totpSha1) {
  const r = await totp(key, t, { digits: 8, step: 30, algo: 'SHA-1' })
  eq(r.code, code, `TOTP SHA1 t=${t}`)
}

// TOTP SHA-256 向量(金鑰 32 bytes "12345678901234567890123456789012")
{
  const key256 = new TextEncoder().encode('12345678901234567890123456789012')
  const r = await totp(key256, 59, { digits: 8, algo: 'SHA-256' })
  eq(r.code, '46119246', 'TOTP SHA256 t=59')
}

// TOTP remaining / counter
{
  const r = await totp(key, 59, { step: 30 })
  eq(r.counter, 1, 'TOTP counter at t=59 -> 1')
  eq(r.remaining, 1, 'TOTP remaining at t=59 -> 1') // 30 - (59%30=29) = 1
}
{
  const r = await totp(key, 30, { step: 30 })
  eq(r.remaining, 30, 'TOTP remaining at t=30 -> 30 (just rolled)')
}

// 6 位數預設
{
  const r = await totp(key, 59)
  eq(r.code, '287082', 'TOTP default 6-digit t=59') // 94287082 的後 6 碼
}

// parseOtpauth
{
  const p = parseOtpauth(
    'otpauth://totp/ACME:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=ACME&digits=6&period=30&algorithm=SHA1',
  )
  ok(p.ok, 'parseOtpauth ok')
  eq(p.secret, 'JBSWY3DPEHPK3PXP', 'parseOtpauth secret')
  eq(p.issuer, 'ACME', 'parseOtpauth issuer')
  eq(p.digits, 6, 'parseOtpauth digits')
  eq(p.period, 30, 'parseOtpauth period')
  eq(p.algo, 'SHA-1', 'parseOtpauth algo')
  eq(p.label, 'ACME:alice@example.com', 'parseOtpauth label')
}
{
  const p = parseOtpauth('otpauth://totp/X?secret=ABC&algorithm=SHA256&digits=8')
  eq(p.algo, 'SHA-256', 'parseOtpauth SHA256')
  eq(p.digits, 8, 'parseOtpauth digits 8')
  eq(p.period, 30, 'parseOtpauth default period')
}
ok(!parseOtpauth('https://example.com').ok, 'parseOtpauth non-otpauth invalid')
ok(!parseOtpauth('otpauth://hotp/X?secret=ABC&counter=0').ok, 'parseOtpauth hotp rejected')
ok(!parseOtpauth('otpauth://totp/X?issuer=Y').ok, 'parseOtpauth missing secret')

console.log(`\ntotp: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
