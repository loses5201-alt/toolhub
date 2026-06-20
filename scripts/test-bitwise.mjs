/*
  位元運算引擎回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-bitwise.mjs
  oracle:逐筆手算的二補數結果,並用 JS 32 位元原生位元運算交叉驗證。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `bitwise-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/bitwise.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const {
  maskFor,
  wrap,
  asSigned,
  parseIntInput,
  compute,
  popcount,
  toBin,
  toHex,
  groupBin,
  views,
} = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// 取某運算結果的小工具
const op = (a, b, bits, shift, key) =>
  compute(a, b, bits, shift).find((r) => r.key === key).value

// --- maskFor ---
check('maskFor 8 = 0xFF', maskFor(8) === 0xffn)
check('maskFor 16 = 0xFFFF', maskFor(16) === 0xffffn)
check('maskFor 32 = 0xFFFFFFFF', maskFor(32) === 0xffffffffn)
check('maskFor 64 = 2^64-1', maskFor(64) === (1n << 64n) - 1n)

// --- wrap / asSigned 二補數 ---
check('wrap -5 @8 = 0xFB(251)', wrap(-5n, 8) === 251n)
check('wrap 300 @8 = 44(溢位取低位)', wrap(300n, 8) === 44n)
check('wrap -1 @16 = 0xFFFF', wrap(-1n, 16) === 0xffffn)
check('asSigned 0xFB @8 = -5', asSigned(0xfbn, 8) === -5n)
check('asSigned 0x7F @8 = 127', asSigned(0x7fn, 8) === 127n)
check('asSigned 0x80 @8 = -128', asSigned(0x80n, 8) === -128n)
check('asSigned 0xFFFF @16 = -1', asSigned(0xffffn, 16) === -1n)

// --- parseIntInput ---
check('parse 255', parseIntInput('255').value === 255n)
check('parse 0xFF = 255', parseIntInput('0xFF').value === 255n)
check('parse 0b1010 = 10', parseIntInput('0b1010').value === 10n)
check('parse 0o377 = 255', parseIntInput('0o377').value === 255n)
check('parse 含底線 1010_1100', parseIntInput('0b1010_1100').value === 0xacn)
check('parse 含空白 FF FF', parseIntInput('0xFF FF').value === 0xffffn)
check('parse -5 = -5', parseIntInput('-5').value === -5n)
check('parse 超大整數不失真', parseIntInput('0xFFFFFFFFFFFFFFFF').value === (1n << 64n) - 1n)
check('parse 空字串 → 失敗', parseIntInput('   ').ok === false)
check('parse 0xZZ → 失敗', parseIntInput('0xZZ').ok === false)
check('parse 0b12 → 失敗(2 不是二進位)', parseIntInput('0b12').ok === false)
check('parse 0x 後面沒數字 → 失敗', parseIntInput('0x').ok === false)
check('parse 純前綴 - → 失敗', parseIntInput('-').ok === false)

// --- 基本邏輯運算(8-bit)---
check('0xF0 AND 0x0F = 0', op(0xf0n, 0x0fn, 8, 0, 'and') === 0x00n)
check('0xF0 OR 0x0F = 0xFF', op(0xf0n, 0x0fn, 8, 0, 'or') === 0xffn)
check('0xF0 XOR 0x0F = 0xFF', op(0xf0n, 0x0fn, 8, 0, 'xor') === 0xffn)
check('0xCC AND 0xAA = 0x88', op(0xccn, 0xaan, 8, 0, 'and') === 0x88n)
check('0xCC OR 0xAA = 0xEE', op(0xccn, 0xaan, 8, 0, 'or') === 0xeen)
check('0xCC XOR 0xAA = 0x66', op(0xccn, 0xaan, 8, 0, 'xor') === 0x66n)
check('NOT 0xF0 @8 = 0x0F', op(0xf0n, 0n, 8, 0, 'nota') === 0x0fn)
check('NAND 0xCC 0xAA = 0x77', op(0xccn, 0xaan, 8, 0, 'nand') === 0x77n)
check('NOR 0xCC 0xAA = 0x11', op(0xccn, 0xaan, 8, 0, 'nor') === 0x11n)
check('XNOR 0xCC 0xAA = 0x99', op(0xccn, 0xaan, 8, 0, 'xnor') === 0x99n)

// --- 位移(8-bit)---
check('1 << 4 = 16', op(1n, 0n, 8, 4, 'shl') === 16n)
check('0x80 << 1 @8 溢位 = 0', op(0x80n, 0n, 8, 1, 'shl') === 0x00n)
check('0x80 >>> 1(邏輯)= 0x40', op(0x80n, 0n, 8, 1, 'shr') === 0x40n)
check('0x80 >> 1(算術)= 0xC0', op(0x80n, 0n, 8, 1, 'sar') === 0xc0n)
check('0x7F >> 1(算術正數)= 0x3F', op(0x7fn, 0n, 8, 1, 'sar') === 0x3fn)
check('負輸入 -1 @8 NOT = 0', op(-1n, 0n, 8, 0, 'nota') === 0x00n)

// --- popcount ---
check('popcount 0xFF = 8', popcount(0xffn) === 8)
check('popcount 0xCC = 4', popcount(0xccn) === 4)
check('popcount 0 = 0', popcount(0n) === 0)
check('popcount 0x80000000 = 1', popcount(0x80000000n) === 1)

// --- 格式化 ---
check('toBin 0xCC @8 = 11001100', toBin(0xccn, 8) === '11001100')
check('toBin -1 @8 = 11111111', toBin(-1n, 8) === '11111111')
check('toHex 0xF @8 補零 = 0F', toHex(0xfn, 8) === '0F')
check('toHex 255 @16 = 00FF', toHex(255n, 16) === '00FF')
check('groupBin 每 4 位分組', groupBin('11001100') === '1100 1100')
check('groupBin 不足 4 位', groupBin('101100') === '10 1100')

// --- views ---
const v = views(0x80n, 8)
check('views 0x80 @8 unsigned = 128', v.unsigned === '128')
check('views 0x80 @8 signed = -128', v.signed === '-128')
check('views 0x80 @8 hex = 0x80', v.hex === '0x80')
check('views 0x80 @8 bin = 10000000', v.bin === '10000000')
check('views 0x80 @8 set bits = 1', v.bits === 1)

// --- 交叉驗證:32-bit 與 JS 原生位元運算一致(JS 位元為 32 位有號)---
const samples = [
  [0x12345678n, 0x0f0f0f0fn],
  [0xdeadbeefn, 0xcafebaben],
  [0n, 0xffffffffn],
  [0x80000000n, 0x00000001n],
]
for (const [a, b] of samples) {
  const an = Number(a) | 0
  const bn = Number(b) | 0
  check(
    `32-bit AND 與 JS 一致 (${a.toString(16)})`,
    op(a, b, 32, 0, 'and') === BigInt((an & bn) >>> 0),
  )
  check(
    `32-bit OR 與 JS 一致 (${a.toString(16)})`,
    op(a, b, 32, 0, 'or') === BigInt((an | bn) >>> 0),
  )
  check(
    `32-bit XOR 與 JS 一致 (${a.toString(16)})`,
    op(a, b, 32, 0, 'xor') === BigInt((an ^ bn) >>> 0),
  )
  check(
    `32-bit NOT A 與 JS 一致 (${a.toString(16)})`,
    op(a, b, 32, 0, 'nota') === BigInt(~an >>> 0),
  )
  check(
    `32-bit A>>>3(邏輯)與 JS 一致 (${a.toString(16)})`,
    op(a, b, 32, 3, 'shr') === BigInt((Number(a) >>> 3) >>> 0),
  )
  check(
    `32-bit A>>3(算術)與 JS 一致 (${a.toString(16)})`,
    op(a, b, 32, 3, 'sar') === BigInt((an >> 3) >>> 0),
  )
}

// --- 64-bit 不失真 ---
check(
  '64-bit XOR 全 1 = 0',
  op((1n << 64n) - 1n, (1n << 64n) - 1n, 64, 0, 'xor') === 0n,
)
check(
  '64-bit NOT 0 = 全 1',
  op(0n, 0n, 64, 0, 'nota') === (1n << 64n) - 1n,
)

if (fail) {
  console.error(`\n${fail} 筆測試失敗`)
  process.exit(1)
}
console.log('\n全部通過')
