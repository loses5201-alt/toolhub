/*
  文字雜湊引擎回歸測試(MD5 / CRC32),以公開已知向量驗證。
  另用 Node 內建 crypto 交叉驗證 MD5(亂數輸入 200 組)。
  執行:node scripts/test-hashtext.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

const out = join(tmpdir(), `hashtext-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/hashText.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { md5Hex, crc32Hex, bytesToHex, md5, utf8Bytes } = await import('file://' + out)

let fail = 0
let pass = 0
function eq(a, b, msg) {
  if (a === b) {
    pass++
  } else {
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

// MD5 已知向量(RFC 1321 附錄)
eq(md5Hex(''), 'd41d8cd98f00b204e9800998ecf8427e', 'md5 empty')
eq(md5Hex('a'), '0cc175b9c0f1b6a831c399e269772661', 'md5 a')
eq(md5Hex('abc'), '900150983cd24fb0d6963f7d28e17f72', 'md5 abc')
eq(md5Hex('message digest'), 'f96b697d7cb7938d525a2f31aaf161d0', 'md5 message digest')
eq(
  md5Hex('abcdefghijklmnopqrstuvwxyz'),
  'c3fcd3d76192e4007dfb496cca67e13b',
  'md5 a-z',
)
eq(
  md5Hex('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'),
  'd174ab98d277d9f5a5611c2c9f419d9f',
  'md5 alnum',
)
eq(
  md5Hex('12345678901234567890123456789012345678901234567890123456789012345678901234567890'),
  '57edf4a22be3c955ac49da2e2107b67a',
  'md5 80 digits',
)
// 中文(UTF-8)
eq(md5Hex('中文'), createHash('md5').update('中文', 'utf8').digest('hex'), 'md5 中文 vs node')
// 邊界:55/56/64 位元組(padding 邊界)
for (const n of [54, 55, 56, 57, 63, 64, 65, 119, 120]) {
  const s = 'x'.repeat(n)
  eq(md5Hex(s), createHash('md5').update(s, 'utf8').digest('hex'), `md5 len ${n} vs node`)
}

// 亂數交叉驗證 200 組
let mismatch = 0
for (let i = 0; i < 200; i++) {
  const len = Math.floor(Math.random() * 300)
  const arr = Buffer.alloc(len)
  for (let j = 0; j < len; j++) arr[j] = Math.floor(Math.random() * 256)
  const mine = bytesToHex(md5(new Uint8Array(arr)))
  const ref = createHash('md5').update(arr).digest('hex')
  if (mine !== ref) mismatch++
}
eq(mismatch, 0, 'md5 200 random vs node')

// CRC32 已知向量
eq(crc32Hex(''), '00000000', 'crc32 empty')
eq(crc32Hex('123456789'), 'cbf43926', 'crc32 check value 123456789')
eq(crc32Hex('The quick brown fox jumps over the lazy dog'), '414fa339', 'crc32 fox')
eq(crc32Hex('a'), 'e8b7be43', 'crc32 a')

// bytesToHex / utf8Bytes sanity
eq(bytesToHex(new Uint8Array([0, 15, 255])), '000fff', 'bytesToHex')
eq(utf8Bytes('A').length, 1, 'utf8Bytes A len 1')
eq(utf8Bytes('中').length, 3, 'utf8Bytes 中 len 3')

console.log(`\nhashText: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
