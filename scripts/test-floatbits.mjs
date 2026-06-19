/*
  IEEE 754 浮點數位元檢視引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-floatbits.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `floatbits-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/floatBits.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { breakdown, breakdownFromHex, exactDecimal, bitsToNumber, parseHex } = await import(
  'file://' + out
)

let fail = 0
function eq(note, got, want) {
  if (got === want) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}\n   got : ${JSON.stringify(got)}\n   want: ${JSON.stringify(want)}`)
  }
}
function ok(note, cond) {
  eq(note, !!cond, true)
}

// --- double 已知 16 進位 ---
eq('double 1.0 hex', breakdown(1.0, 64).hex, '3FF0000000000000')
eq('double 0.5 hex', breakdown(0.5, 64).hex, '3FE0000000000000')
eq('double -2.0 hex', breakdown(-2.0, 64).hex, 'C000000000000000')
eq('double 0.1 hex', breakdown(0.1, 64).hex, '3FB999999999999A')
eq('double 0 hex', breakdown(0, 64).hex, '0000000000000000')

// --- float 已知 16 進位 ---
eq('float 1.0 hex', breakdown(1.0, 32).hex, '3F800000')
eq('float 0.1 hex', breakdown(0.1, 32).hex, '3DCCCCCD')
eq('float -1.0 hex', breakdown(-1.0, 32).hex, 'BF800000')

// --- 位元分解 1.0 (double): sign 0, exp 01111111111, frac 全 0 ---
const one = breakdown(1.0, 64)
eq('1.0 sign', one.signBit, '0')
eq('1.0 raw exponent', one.rawExponent, 1023)
eq('1.0 unbiased exponent', one.unbiasedExponent, 0)
eq('1.0 fraction 全 0', /^0+$/.test(one.fractionBits), true)
eq('1.0 分類 normal', one.classification, 'normal')
eq('1.0 exact', one.exactValue, '1')
eq('1.0 bits 長度 64', one.bits.length, 64)
eq('1.0 fraction 長度 52', one.fractionBits.length, 52)

// --- float 結構 ---
const f1 = breakdown(1.0, 32)
eq('float bits 長度 32', f1.bits.length, 32)
eq('float exponent 長度 8', f1.exponentBits.length, 8)
eq('float fraction 長度 23', f1.fractionBits.length, 23)

// --- 精確十進位:0.1 的雙精度真值 ---
eq(
  '0.1 (double) 精確值',
  breakdown(0.1, 64).exactValue,
  '0.1000000000000000055511151231257827021181583404541015625',
)
eq('0.1 (float) 精確值', breakdown(0.1, 32).exactValue, '0.100000001490116119384765625')
eq('0.5 精確值', breakdown(0.5, 64).exactValue, '0.5')
eq('整數 3 精確值', breakdown(3, 64).exactValue, '3')
eq('-2 精確值', breakdown(-2, 64).exactValue, '-2')

// --- 特殊值 ---
const inf = breakdown(Infinity, 64)
eq('Infinity 分類', inf.classification, 'infinity')
eq('Infinity hex', inf.hex, '7FF0000000000000')
eq('Infinity unbiased null', inf.unbiasedExponent, null)
eq('Infinity exact', inf.exactValue, 'Infinity')
const ninf = breakdown(-Infinity, 64)
eq('-Infinity exact', ninf.exactValue, '-Infinity')
const nan = breakdown(NaN, 64)
eq('NaN 分類', nan.classification, 'nan')
eq('NaN exact', nan.exactValue, 'NaN')
const negzero = breakdown(-0, 64)
eq('-0 分類', negzero.classification, 'zero')
eq('-0 sign bit', negzero.signBit, '1')
eq('-0 exact', negzero.exactValue, '-0')

// --- subnormal:double 最小正值 ---
const minSub = breakdown(5e-324, 64) // Number.MIN_VALUE
eq('最小 subnormal hex', minSub.hex, '0000000000000001')
eq('最小 subnormal 分類', minSub.classification, 'subnormal')
ok('最小 subnormal exact 為 0. 開頭極小值', minSub.exactValue.startsWith('0.0000'))
ok('最小 subnormal exact 含有效數字 4940656458412465', minSub.exactValue.includes('4940656458412465'))

// --- exactDecimal 直接測 ---
eq('exactDecimal 正指數', exactDecimal(3n, 2, false), '12') // 3*4
eq('exactDecimal 負指數', exactDecimal(1n, -3, false), '0.125') // 1/8
eq('exactDecimal 0', exactDecimal(0n, 5, false), '0')
eq('exactDecimal 負號', exactDecimal(1n, -2, true), '-0.25')

// --- round-trip:所有寬度都應還原原值 ---
for (const v of [1, 0.5, 0.1, 0.2, 0.3, -2, 1234.5678, Math.PI]) {
  eq(`double round-trip ${v}`, breakdown(v, 64).roundTrip, v)
}
ok('NaN round-trip 仍為 NaN', Number.isNaN(breakdown(NaN, 64).roundTrip))

// --- parseHex / breakdownFromHex ---
eq('parseHex 含 0x', parseHex('0x3FF0000000000000', 64), 0x3ff0000000000000n)
eq('parseHex 大小寫與空白', parseHex(' 3ff0 0000 0000 0000 ', 64), 0x3ff0000000000000n)
eq('parseHex 超長回 null', parseHex('3FF00000000000001', 64), null)
eq('parseHex 非 hex 回 null', parseHex('xyz', 64), null)
eq('parseHex 空回 null', parseHex('', 64), null)
const fromHex = breakdownFromHex('3FF0000000000000', 64)
eq('breakdownFromHex 還原 1.0', fromHex.roundTrip, 1)
eq('breakdownFromHex exact', fromHex.exactValue, '1')
eq('breakdownFromHex 非法回 null', breakdownFromHex('zz', 64), null)
eq('float hex 反查 1.0', breakdownFromHex('3F800000', 32).roundTrip, 1)

// --- bitsToNumber 直接 ---
eq('bitsToNumber double 1.0', bitsToNumber(0x3ff0000000000000n, 64), 1)
eq('bitsToNumber float 1.0', bitsToNumber(0x3f800000n, 32), 1)

if (fail) {
  console.error(`\n${fail} 個測試未通過`)
  process.exit(1)
} else {
  console.log('\n全部 floatBits 測試通過')
}
