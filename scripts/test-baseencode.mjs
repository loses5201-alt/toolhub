/*
  Base32 / Base58 編解碼引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-baseencode.mjs
  Base32 向量取自 RFC 4648;Base58 取自常見公開向量。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `baseencode-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/baseEncode.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const {
  utf8ToBytes,
  bytesToUtf8,
  bytesToHex,
  hexToBytes,
  base32Encode,
  base32Decode,
  base58Encode,
  base58Decode,
} = await import('file://' + out)

let fail = 0
function eq(note, got, want) {
  if (got === want) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}\n   got : ${JSON.stringify(got)}\n   want: ${JSON.stringify(want)}`)
  }
}
const b32e = (s) => base32Encode(utf8ToBytes(s))
const b58e = (s) => base58Encode(utf8ToBytes(s))

// --- Base32 RFC 4648 測試向量 ---
eq('b32 ""', b32e(''), '')
eq('b32 f', b32e('f'), 'MY======')
eq('b32 fo', b32e('fo'), 'MZXQ====')
eq('b32 foo', b32e('foo'), 'MZXW6===')
eq('b32 foob', b32e('foob'), 'MZXW6YQ=')
eq('b32 fooba', b32e('fooba'), 'MZXW6YTB')
eq('b32 foobar', b32e('foobar'), 'MZXW6YTBOI======')

// --- Base32 解碼往返 ---
for (const s of ['', 'f', 'fo', 'foo', 'foobar', 'Hello, 世界!']) {
  eq(`b32 往返 ${JSON.stringify(s)}`, bytesToUtf8(base32Decode(base32Encode(utf8ToBytes(s)))), s)
}
eq('b32 解碼大小寫不敏感', bytesToUtf8(base32Decode('mzxw6ytboi======')), 'foobar')
eq('b32 解碼容忍空白', bytesToUtf8(base32Decode('MZXW 6YTB OI==')), 'foobar')
eq('b32 非法字元回 null', base32Decode('MZXW0YTB'), null) // 0 不在字母表
eq('b32 已知 hex', bytesToHex(base32Decode('MY======')), '66') // 'f'

// --- Base58 測試向量 ---
eq('b58 ""', b58e(''), '')
eq('b58 Hello World!', b58e('Hello World!'), '2NEpo7TZRRrLZSi2U')
eq('b58 hello', b58e('hello'), 'Cn8eVZg')
eq('b58 前導零 → 1', base58Encode(Uint8Array.from([0, 0, 1])), '112')

// --- Base58 解碼往返 ---
for (const s of ['', 'Hello World!', 'hello', 'Satoshi Nakamoto', '中文測試']) {
  eq(`b58 往返 ${JSON.stringify(s)}`, bytesToUtf8(base58Decode(base58Encode(utf8ToBytes(s)))), s)
}
eq('b58 前導零往返', JSON.stringify([...base58Decode('112')]), JSON.stringify([0, 0, 1]))
eq('b58 非法字元回 null', base58Decode('0OIl'), null) // 0,O,I,l 不在字母表
eq('b58 已知解碼', bytesToUtf8(base58Decode('2NEpo7TZRRrLZSi2U')), 'Hello World!')

// --- hex 輔助 ---
eq('hexToBytes', JSON.stringify([...hexToBytes('ff00ab')]), JSON.stringify([255, 0, 171]))
eq('hexToBytes 0x 前綴與空白', JSON.stringify([...hexToBytes('0x ff 00')]), JSON.stringify([255, 0]))
eq('hexToBytes 空', JSON.stringify([...hexToBytes('')]), JSON.stringify([]))
eq('hexToBytes 奇數長度 null', hexToBytes('abc'), null)
eq('hexToBytes 非 hex null', hexToBytes('zz'), null)
eq('bytesToHex', bytesToHex(Uint8Array.from([0, 255, 16])), '00ff10')

// --- 透過 hex 編 base58/base32 ---
eq('hex → b58', base58Encode(hexToBytes('0001')), '12')
eq('hex → b32', base32Encode(hexToBytes('66')), 'MY======')

if (fail) {
  console.error(`\n${fail} 個測試未通過`)
  process.exit(1)
} else {
  console.log('\n全部 baseEncode 測試通過')
}
