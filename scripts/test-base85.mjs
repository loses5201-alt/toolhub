/*
  Base85 / Ascii85 / Z85 引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-base85.mjs
  oracle:Z85 RFC 32 官方測試向量(86 4F D2 6F B5 59 F7 5B → "HelloWorld")、
  Ascii85 'z' 縮寫、手算的 "sure"→"F*2M7",以及大量隨機位元組往返一致。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `base85-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/base85.ts'],
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
  encodeAscii85,
  decodeAscii85,
  encodeZ85,
  decodeZ85,
} = await import(out)

let pass = 0
let fail = 0
function eq(name, got, want) {
  if (got === want) pass++
  else {
    fail++
    console.error(`✗ ${name}\n    got:  ${JSON.stringify(got)}\n    want: ${JSON.stringify(want)}`)
  }
}
function ok(name, cond) {
  if (cond) pass++
  else {
    fail++
    console.error(`✗ ${name}`)
  }
}
function throws(name, fn) {
  try {
    fn()
    fail++
    console.error(`✗ ${name}(預期丟錯但沒有)`)
  } catch {
    pass++
  }
}
const bytesEq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])

// ---- hex helpers ----
eq('bytesToHex', bytesToHex(new Uint8Array([0, 15, 255])), '000fff')
ok('hexToBytes 往返', bytesEq(hexToBytes('000fff'), new Uint8Array([0, 15, 255])))
throws('hexToBytes 非法', () => hexToBytes('xyz'))

// ---- Z85 官方測試向量 ----
{
  const v = new Uint8Array([0x86, 0x4f, 0xd2, 0x6f, 0xb5, 0x59, 0xf7, 0x5b])
  eq('Z85 官方向量編碼 → HelloWorld', encodeZ85(v), 'HelloWorld')
  ok('Z85 官方向量解碼', bytesEq(decodeZ85('HelloWorld'), v))
}
throws('Z85 編碼長度非 4 倍數', () => encodeZ85(new Uint8Array([1, 2, 3])))
throws('Z85 解碼長度非 5 倍數', () => decodeZ85('Hello1'))
throws('Z85 解碼非法字元', () => decodeZ85('Hell~'))

// ---- Ascii85 'z' 縮寫 ----
eq('Ascii85 四個零 → z', encodeAscii85(new Uint8Array([0, 0, 0, 0])), 'z')
ok('Ascii85 解碼 z', bytesEq(decodeAscii85('z'), new Uint8Array([0, 0, 0, 0])))

// ---- Ascii85 手算向量 "sure" → "F*2M7" ----
eq('Ascii85 "sure" → F*2M7', encodeAscii85(utf8ToBytes('sure')), 'F*2M7')
eq('Ascii85 解碼 F*2M7 → sure', bytesToUtf8(decodeAscii85('F*2M7')), 'sure')

// ---- Ascii85 Adobe 包裹 ----
{
  const enc = encodeAscii85(utf8ToBytes('sure'), { delimiters: true })
  eq('Ascii85 加 <~ ~>', enc, '<~F*2M7~>')
  eq('Ascii85 解 <~ ~>', bytesToUtf8(decodeAscii85(enc)), 'sure')
}

// ---- Ascii85 部分組(非 4 倍數)----
{
  // 1 byte → 2 字元
  const e1 = encodeAscii85(new Uint8Array([0x4d])) // 'M'
  eq('Ascii85 1 byte 輸出 2 字元', e1.length, 2)
  ok('Ascii85 1 byte 往返', bytesEq(decodeAscii85(e1), new Uint8Array([0x4d])))
  // 3 bytes → 4 字元
  const e3 = encodeAscii85(utf8ToBytes('Man'))
  eq('Ascii85 3 bytes 輸出 4 字元', e3.length, 4)
  ok('Ascii85 3 bytes 往返', bytesToUtf8(decodeAscii85(e3)) === 'Man')
}

// ---- Ascii85 容忍空白與換行 ----
{
  const enc = encodeAscii85(utf8ToBytes('Hello, World!'))
  const withWs = enc.slice(0, 3) + '\n  ' + enc.slice(3)
  eq('Ascii85 含空白仍可解', bytesToUtf8(decodeAscii85(withWs)), 'Hello, World!')
}
throws('Ascii85 非法字元', () => decodeAscii85('abc' + String.fromCharCode(200)))

// ---- 往返一致(大量隨機)----
function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
{
  const rnd = mulberry32(12345)
  let rtFail = 0
  for (let trial = 0; trial < 200; trial++) {
    const len = Math.floor(rnd() * 30)
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) bytes[i] = Math.floor(rnd() * 256)
    // Ascii85 往返
    if (!bytesEq(decodeAscii85(encodeAscii85(bytes)), bytes)) rtFail++
    if (!bytesEq(decodeAscii85(encodeAscii85(bytes, { delimiters: true })), bytes)) rtFail++
    // Z85 往返(補到 4 倍數)
    const padLen = Math.ceil(len / 4) * 4
    const padded = new Uint8Array(padLen)
    padded.set(bytes)
    if (!bytesEq(decodeZ85(encodeZ85(padded)), padded)) rtFail++
  }
  ok('200 組隨機 Ascii85/Z85 往返一致', rtFail === 0)
}

// ---- 空輸入 ----
eq('Ascii85 空輸入', encodeAscii85(new Uint8Array([])), '')
ok('Ascii85 空解碼', decodeAscii85('').length === 0)
eq('Z85 空輸入', encodeZ85(new Uint8Array([])), '')

console.log(`\nBase85:${pass} 通過、${fail} 失敗`)
if (fail > 0) process.exit(1)
