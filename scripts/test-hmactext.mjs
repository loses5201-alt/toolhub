/*
  HMAC 引擎回歸測試 —— 以 Node 內建 crypto 交叉驗證,並核對已知 RFC 2202 向量。
  執行:node scripts/test-hmactext.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHmac } from 'node:crypto'

const out = join(tmpdir(), `hmactext-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/hmacText.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { bytesToBase64, hmacHex, hmacBase64, safeEqualHex } = await import('file://' + out)

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

// bytesToBase64 已知值
eq(bytesToBase64(new TextEncoder().encode('')), '', 'base64 empty')
eq(bytesToBase64(new TextEncoder().encode('f')), 'Zg==', 'base64 f')
eq(bytesToBase64(new TextEncoder().encode('fo')), 'Zm8=', 'base64 fo')
eq(bytesToBase64(new TextEncoder().encode('foo')), 'Zm9v', 'base64 foo')
eq(bytesToBase64(new TextEncoder().encode('foob')), 'Zm9vYg==', 'base64 foob')
eq(bytesToBase64(new TextEncoder().encode('fooba')), 'Zm9vYmE=', 'base64 fooba')
eq(bytesToBase64(new TextEncoder().encode('foobar')), 'Zm9vYmFy', 'base64 foobar')
eq(
  bytesToBase64(new Uint8Array([0xff, 0xff, 0xff])),
  '////',
  'base64 0xffffff',
)

// RFC 2202 HMAC-SHA-1 已知向量:key=0x0b*20, data="Hi There"
{
  const key = '\x0b'.repeat(20)
  const got = await hmacHex('Hi There', key, 'SHA-1')
  eq(got, 'b617318655057264e28bc0b6fb378c8ef146be00', 'RFC2202 HMAC-SHA1 Hi There')
}
// RFC 2202: key="Jefe", data="what do ya want for nothing?"
{
  const got = await hmacHex('what do ya want for nothing?', 'Jefe', 'SHA-1')
  eq(got, 'effcdf6ae5eb2fa2d27416d5f184df9c259a7c79', 'RFC2202 HMAC-SHA1 Jefe')
}
// RFC 4231 HMAC-SHA-256: key="Jefe", data="what do ya want for nothing?"
{
  const got = await hmacHex('what do ya want for nothing?', 'Jefe', 'SHA-256')
  eq(
    got,
    '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
    'RFC4231 HMAC-SHA256 Jefe',
  )
}

// 與 Node crypto 交叉驗證(多組訊息/金鑰/演算法/含中文與空字串)
const samples = [
  ['', 'secret'],
  ['hello world', 'key'],
  ['中文訊息含 emoji 😀', 'p@ssw0rd 金鑰'],
  ['{"event":"push","id":12345}', 'webhook_signing_secret'],
  ['a'.repeat(1000), 'k'.repeat(80)], // 訊息長、金鑰超過 block size
]
const algos = [
  ['SHA-1', 'sha1'],
  ['SHA-256', 'sha256'],
  ['SHA-512', 'sha512'],
]
for (const [msg, key] of samples) {
  for (const [webAlgo, nodeAlgo] of algos) {
    const refHex = createHmac(nodeAlgo, Buffer.from(key, 'utf8'))
      .update(Buffer.from(msg, 'utf8'))
      .digest('hex')
    const refB64 = createHmac(nodeAlgo, Buffer.from(key, 'utf8'))
      .update(Buffer.from(msg, 'utf8'))
      .digest('base64')
    eq(await hmacHex(msg, key, webAlgo), refHex, `hmacHex ${nodeAlgo} "${msg.slice(0, 12)}"`)
    eq(await hmacBase64(msg, key, webAlgo), refB64, `hmacBase64 ${nodeAlgo} "${msg.slice(0, 12)}"`)
  }
}

// safeEqualHex
ok(safeEqualHex('ABCDEF', 'abcdef'), 'safeEqual case-insensitive')
ok(safeEqualHex(' abc ', 'ABC'), 'safeEqual trims')
ok(!safeEqualHex('abc', 'abcd'), 'safeEqual length mismatch')
ok(!safeEqualHex('abc', 'abd'), 'safeEqual diff')
ok(safeEqualHex('', ''), 'safeEqual empty equal')

console.log(`\nhmacText: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
