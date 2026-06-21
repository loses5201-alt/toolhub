/*
  描述統計引擎回歸測試(node 直接跑)。
  執行:node scripts/test-descriptivestats.mjs

  oracle(以課本定義、手算與 Excel 函式對照):
   A) 經典資料 [2,4,4,4,5,5,7,9]:n=8、sum=40、mean=5、median=4.5、mode=[4](3 次)、
      min=2 max=9 range=7、母體變異數=4(母體 SD=2)、樣本變異數=32/7、
      Q1=4、Q3=5.5、IQR=1.5(Excel QUARTILE.INC)。
   B) 對稱資料 [1,2,3,4,5]:mean=3、median=3、無眾數、母體變異數=2、樣本變異數=2.5、
      偏度=0(對稱)、峰度=−1.2(Excel KURT)、Q1=2、Q3=4、無離群值。
   C) 含離群 [1,2,3,4,5,100]:Q1=2.25、Q3=4.75、IQR=2.5、上界=8.5 → 100 為離群值。
   D) 平均數 [1,2,4]:幾何平均=2(³√8)、調和平均=12/7、RMS=√7。
   E) 偏度 [1,2,3,4,10]:Excel SKEW=(5/12)·(180/s³)、s³=12.5^1.5 → ≈1.69705。
   F) parseNumbers:容忍換行/逗號/空白/分號、忽略非數字並計數、科學記號與負數。
   G) percentile 線性內插一般性、histogram 分組與總數守恆。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `descriptivestats-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/descriptiveStats.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const {
  parseNumbers,
  summarize,
  percentile,
  histogram,
  geometricMean,
  harmonicMean,
  rootMeanSquare,
  skewness,
  kurtosis,
} = await import(out)

let pass = 0
let fail = 0
function ok(cond, msg) {
  if (cond) pass++
  else {
    fail++
    console.error('✗', msg)
  }
}
function close(a, b, msg, eps = 1e-9) {
  ok(a !== null && a !== undefined && Math.abs(a - b) <= eps, `${msg} (got ${a}, want ${b})`)
}
function arrEq(a, b, msg) {
  ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`)
}

// ── A) 經典資料 ──
const A = summarize([2, 4, 4, 4, 5, 5, 7, 9])
ok(A.count === 8, 'A count')
close(A.sum, 40, 'A sum')
close(A.mean, 5, 'A mean')
close(A.median, 4.5, 'A median')
arrEq(A.modes, [4], 'A mode value')
ok(A.modeCount === 3, 'A mode count')
close(A.min, 2, 'A min')
close(A.max, 9, 'A max')
close(A.range, 7, 'A range')
close(A.popVariance, 4, 'A pop variance')
close(A.popStdDev, 2, 'A pop SD')
close(A.sampleVariance, 32 / 7, 'A sample variance')
close(A.sampleStdDev, Math.sqrt(32 / 7), 'A sample SD')
close(A.q1, 4, 'A Q1')
close(A.q3, 5.5, 'A Q3')
close(A.iqr, 1.5, 'A IQR')
// 上界 = Q3 + 1.5·IQR = 5.5 + 2.25 = 7.75 → 9 為離群值;下界 = 4 − 2.25 = 1.75 → 2 仍在界內
close(A.upperFence, 7.75, 'A upper fence')
arrEq(A.outliers, [9], 'A outlier 9')
close(A.stdError, Math.sqrt(32 / 7) / Math.sqrt(8), 'A std error')

// ── B) 對稱資料 ──
const B = summarize([1, 2, 3, 4, 5])
close(B.mean, 3, 'B mean')
close(B.median, 3, 'B median')
arrEq(B.modes, [], 'B no mode')
ok(B.modeCount === 1, 'B mode count 1 (all unique)')
close(B.popVariance, 2, 'B pop variance')
close(B.sampleVariance, 2.5, 'B sample variance')
close(B.skewness, 0, 'B skewness symmetric = 0', 1e-12)
close(B.kurtosis, -1.2, 'B kurtosis (Excel KURT)', 1e-9)
close(B.q1, 2, 'B Q1')
close(B.q3, 4, 'B Q3')
arrEq(B.outliers, [], 'B no outliers')
close(B.coefVariation, Math.sqrt(2.5) / 3, 'B coef variation')

// ── C) 含離群值 ──
const C = summarize([100, 1, 2, 3, 4, 5])
close(C.q1, 2.25, 'C Q1')
close(C.q3, 4.75, 'C Q3')
close(C.iqr, 2.5, 'C IQR')
close(C.upperFence, 8.5, 'C upper fence')
arrEq(C.outliers, [100], 'C outlier 100')
close(C.min, 1, 'C min')
close(C.max, 100, 'C max')

// ── D) 平均數家族 ──
close(geometricMean([1, 2, 4]), 2, 'D geometric mean')
close(harmonicMean([1, 2, 4]), 12 / 7, 'D harmonic mean')
close(rootMeanSquare([1, 2, 4]), Math.sqrt(7), 'D rms')
ok(geometricMean([1, -2, 4]) === null, 'D geometric mean null on non-positive')
ok(harmonicMean([0, 2]) === null, 'D harmonic mean null on non-positive')

// ── E) 偏度非零 ──
close(skewness([1, 2, 3, 4, 10]), (5 / 12) * (180 / Math.pow(12.5, 1.5)), 'E skewness', 1e-9)
close(skewness([1, 2, 3, 4, 10]), 1.69705, 'E skewness approx', 1e-4)

// ── 小樣本邊界 ──
ok(summarize([5]).sampleVariance === null, 'n=1 sample variance null')
ok(summarize([5]).sampleStdDev === null, 'n=1 sample SD null')
close(summarize([5]).popVariance, 0, 'n=1 pop variance 0')
ok(skewness([1, 2]) === null, 'n=2 skewness null')
ok(kurtosis([1, 2, 3]) === null, 'n=3 kurtosis null')
ok(summarize([]) === null, 'empty summarize null')
// 全相同值:SD=0、無離群、單一直方圖
const same = summarize([7, 7, 7, 7])
close(same.popStdDev, 0, 'same pop SD 0')
arrEq(same.modes, [7], 'same mode')

// ── F) parseNumbers ──
arrEq(parseNumbers('1\n2\n3').values, [1, 2, 3], 'F newline')
arrEq(parseNumbers('1, 2 ,3; 4').values, [1, 2, 3, 4], 'F mixed delimiters')
arrEq(parseNumbers('1\t2\t3').values, [1, 2, 3], 'F tab')
arrEq(parseNumbers('-1.5 2e3 .5').values, [-1.5, 2000, 0.5], 'F negative/sci/decimal')
const pr = parseNumbers('1 abc 2 NaN 3 12px')
arrEq(pr.values, [1, 2, 3], 'F ignore non-numbers')
ok(pr.ignored === 3, 'F ignored count')
arrEq(parseNumbers('   ').values, [], 'F whitespace only')

// ── G) percentile / histogram ──
close(percentile([1, 2, 3, 4, 5], 50), 3, 'G median via percentile')
close(percentile([1, 2, 3, 4], 50), 2.5, 'G p50 even')
close(percentile([10, 20, 30, 40], 25), 17.5, 'G p25 interp')
close(percentile([42], 90), 42, 'G single value percentile')
const hist = histogram([1, 2, 3, 4, 5, 6, 7, 8], 4)
ok(hist.length === 4, 'G histogram bin count')
ok(hist.reduce((s, b) => s + b.count, 0) === 8, 'G histogram total conserved')
const histSame = histogram([5, 5, 5])
ok(histSame.length === 1 && histSame[0].count === 3, 'G histogram all-equal single bin')
ok(histogram([]).length === 0, 'G histogram empty')

console.log(`\n描述統計引擎測試:${pass} 通過、${fail} 失敗`)
if (fail > 0) process.exit(1)
