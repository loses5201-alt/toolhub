/*
  進位轉換引擎回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-baseconvert.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `baseconvert-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/baseConvert.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { parseInBase, toBase, convertViews, groupBinary, bitLength, digitValue } =
  await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// --- digitValue ---
check('digitValue 0 = 0', digitValue('0') === 0)
check('digitValue f = 15', digitValue('f') === 15)
check('digitValue F = 15(忽略大小寫)', digitValue('F') === 15)
check('digitValue z = 35', digitValue('z') === 35)
check('digitValue ! = -1', digitValue('!') === -1)

// --- parseInBase 基本 ---
check('十進位 255', parseInBase('255', 10).value === 255n)
check('二進位 1111 1111 = 255', parseInBase('11111111', 2).value === 255n)
check('十六進位 FF = 255', parseInBase('FF', 16).value === 255n)
check('八進位 377 = 255', parseInBase('377', 8).value === 255n)
check('36 進位 z = 35', parseInBase('z', 36).value === 35n)
check('十六進位 0', parseInBase('0', 16).value === 0n)

// --- 前綴與分組 ---
check('0x 前綴(base16)', parseInBase('0xFF', 16).value === 255n)
check('0b 前綴(base2)', parseInBase('0b1010', 2).value === 10n)
check('0o 前綴(base8)', parseInBase('0o17', 8).value === 15n)
check('底線分組', parseInBase('1010_1100', 2).value === 172n)
check('空白分組', parseInBase('1111 0000', 2).value === 240n)
check('前後空白', parseInBase('  42  ', 10).value === 42n)

// --- 正負號 ---
check('負數', parseInBase('-255', 16 === 16 ? 10 : 10).value === -255n)
check('負十六進位', parseInBase('-ff', 16).value === -255n)
check('正號', parseInBase('+10', 10).value === 10n)

// --- 錯誤處理 ---
check('空字串報錯', parseInBase('', 10).ok === false)
check('非法字元報錯(2 進位放 2)', parseInBase('102', 2).ok === false)
check('非法字元報錯(十進位放 a)', parseInBase('1a', 10).ok === false)
check('進位超界報錯', parseInBase('1', 40).ok === false)
check('只有符號報錯', parseInBase('-', 10).ok === false)

// --- toBase ---
check('toBase 255 → 二進位', toBase(255n, 2) === '11111111')
check('toBase 255 → 十六進位(小寫)', toBase(255n, 16) === 'ff')
check('toBase 0', toBase(0n, 10) === '0')
check('toBase 負數', toBase(-255n, 16) === '-ff')
check('toBase 35 → 36 進位', toBase(35n, 36) === 'z')

// --- 超大整數(BigInt 不失真)---
const huge = parseInBase('ffffffffffffffff', 16).value
check('64 位元全 1 = 18446744073709551615', huge === 18446744073709551615n)
check('超大數來回一致', toBase(huge, 16) === 'ffffffffffffffff')
check('超大數十進位正確', toBase(huge, 10) === '18446744073709551615')

// --- convertViews ---
const v = convertViews(255n)
check('convertViews bin', v.bin === '11111111')
check('convertViews oct', v.oct === '377')
check('convertViews dec', v.dec === '255')
check('convertViews hex 大寫', v.hex === 'FF')

// --- groupBinary ---
check('groupBinary 8 位分兩組', groupBinary('11111111') === '1111 1111')
check('groupBinary 非 4 倍數左補', groupBinary('110011') === '11 0011')
check('groupBinary 負號保留', groupBinary('-1010') === '-1010')

// --- bitLength ---
check('bitLength 255 = 8', bitLength(255n) === 8)
check('bitLength 256 = 9', bitLength(256n) === 9)
check('bitLength 0 = 0', bitLength(0n) === 0)
check('bitLength 負數取絕對值', bitLength(-255n) === 8)

// --- 來回一致(各進位)---
for (const base of [2, 3, 8, 10, 16, 36]) {
  const n = 123456789n
  const round = parseInBase(toBase(n, base), base).value
  check(`來回一致 base ${base}`, round === n)
}

if (fail) {
  console.error(`\n${fail} 個測試失敗`)
  process.exit(1)
}
console.log('\n全部通過')
