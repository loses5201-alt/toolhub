/*
  分數 / 小數 / 百分比引擎回歸測試(node 直接跑)。
  執行:node scripts/test-fraction.mjs
  oracle(初等數論手算結果):
   1) 約分:6/8=3/4、-2/-4=1/2、0/5=0/1。
   2) 循環小數 → 分數:0.75=3/4、0.(3)=1/3、0.1(6)=1/6、0.(142857)=1/7、2.5=5/2。
   3) 連分數近似:π→355/113、0.3333333→1/3。
   4) 分數 → 小數字串:1/3=0.(3)、1/7=0.(142857)、1/8=0.125、2/3=0.(6)。
   5) 帶分數、百分比、parseFraction;decimalToFractionExact↔fractionToDecimalString 來回。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `fraction-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/fraction.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const {
  gcd,
  simplify,
  decimalToFractionExact,
  approxFraction,
  fractionToDecimalString,
  toMixed,
  toPercent,
  parseFraction,
} = await import('file://' + out)

let pass = 0
let fail = 0
function ok(name, cond) {
  if (cond) pass++
  else {
    fail++
    console.error('✗', name)
  }
}
const eqF = (f, n, d) => f && f.n === n && f.d === d

// 1) gcd / simplify
ok('gcd(12,8)=4', gcd(12, 8) === 4)
ok('gcd(7,13)=1', gcd(7, 13) === 1)
ok('simplify 6/8 = 3/4', eqF(simplify(6, 8), 3, 4))
ok('simplify -2/-4 = 1/2', eqF(simplify(-2, -4), 1, 2))
ok('simplify 2/-4 = -1/2', eqF(simplify(2, -4), -1, 2))
ok('simplify 0/5 = 0/1', eqF(simplify(0, 5), 0, 1))
ok('simplify 分母 0 丟例外', (() => { try { simplify(1, 0); return false } catch { return true } })())

// 2) 循環小數 → 分數
ok('0.75 = 3/4', eqF(decimalToFractionExact('0.75'), 3, 4))
ok('2.5 = 5/2', eqF(decimalToFractionExact('2.5'), 5, 2))
ok('0.(3) = 1/3', eqF(decimalToFractionExact('0.(3)'), 1, 3))
ok('0.1(6) = 1/6', eqF(decimalToFractionExact('0.1(6)'), 1, 6))
ok('0.(142857) = 1/7', eqF(decimalToFractionExact('0.(142857)'), 1, 7))
ok('0.(9) = 1', eqF(decimalToFractionExact('0.(9)'), 1, 1))
ok('-1.2(34) 正確', eqF(decimalToFractionExact('-1.2(34)'), -611, 495))
ok('方括號 0.[3] = 1/3', eqF(decimalToFractionExact('0.[3]'), 1, 3))
ok('整數字串 5 = 5/1', eqF(decimalToFractionExact('5'), 5, 1))
ok('亂字串 null', decimalToFractionExact('abc') === null)
ok('空字串 null', decimalToFractionExact('   ') === null)

// 驗證 -1.2(34):1.2(34)=1 + 0.2(34);0.2(34)=(234-2)/990=232/990=116/495;1+116/495=611/495 ✓

// 3) 連分數近似
ok('π → 355/113', eqF(approxFraction(Math.PI, 1000), 355, 113))
ok('0.3333333 → 1/3', eqF(approxFraction(0.3333333, 1000000), 1, 3))
ok('0.5 → 1/2', eqF(approxFraction(0.5, 100), 1, 2))
ok('近似負數', eqF(approxFraction(-0.25, 100), -1, 4))
ok('√2 近似分母 ≤ 100', (() => { const f = approxFraction(Math.SQRT2, 100); return Math.abs(f.n / f.d - Math.SQRT2) < 0.001 })())

// 4) 分數 → 小數字串
ok('1/3 = 0.(3)', fractionToDecimalString({ n: 1, d: 3 }) === '0.(3)')
ok('1/7 = 0.(142857)', fractionToDecimalString({ n: 1, d: 7 }) === '0.(142857)')
ok('1/8 = 0.125', fractionToDecimalString({ n: 1, d: 8 }) === '0.125')
ok('2/3 = 0.(6)', fractionToDecimalString({ n: 2, d: 3 }) === '0.(6)')
ok('1/6 = 0.1(6)', fractionToDecimalString({ n: 1, d: 6 }) === '0.1(6)')
ok('4/2 = 2(整數)', fractionToDecimalString({ n: 4, d: 2 }) === '2')
ok('-1/4 = -0.25', fractionToDecimalString({ n: -1, d: 4 }) === '-0.25')

// 來回:decimal → fraction → decimal 一致
for (const dec of ['0.(3)', '0.1(6)', '0.(142857)', '0.125', '0.(6)']) {
  const f = decimalToFractionExact(dec)
  ok(`往返 ${dec}`, fractionToDecimalString(f) === dec)
}

// 5) 帶分數 / 百分比 / parse
ok('7/3 → 2 又 1/3', (() => { const m = toMixed({ n: 7, d: 3 }); return m.whole === 2 && m.n === 1 && m.d === 3 })())
ok('-7/3 → -2 又 1/3', (() => { const m = toMixed({ n: -7, d: 3 }); return m.whole === -2 && m.n === 1 && m.d === 3 })())
ok('1/4 = 25%', toPercent({ n: 1, d: 4 }) === 25)
ok('parse 3/4', eqF(parseFraction('3/4'), 3, 4))
ok('parse 帶分數 1 1/2 = 3/2', eqF(parseFraction('1 1/2'), 3, 2))
ok('parse 整數 5', eqF(parseFraction('5'), 5, 1))
ok('parse 小數 0.75 = 3/4', eqF(parseFraction('0.75'), 3, 4))
ok('parse 循環 0.(3) = 1/3', eqF(parseFraction('0.(3)'), 1, 3))
ok('parse 分母 0 → null', parseFraction('1/0') === null)
ok('parse 空 → null', parseFraction('') === null)

console.log(`\n分數:${pass} 通過,${fail} 失敗`)
if (fail) process.exit(1)
