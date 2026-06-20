/*
  螢幕像素密度(PPI)引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-ppi.mjs
  oracle 以畢氏定理對角線像素 ÷ 對角線英吋手算為準,常見螢幕規格交叉驗證。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `ppi-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/ppi.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { computePpi, retinaThreshold, isRetina, round } = await import('file://' + out)

let fail = 0
function eq(note, got, want) {
  const g = JSON.stringify(got)
  const w = JSON.stringify(want)
  if (g !== w) {
    console.error(`✗ ${note}\n   got:  ${g}\n   want: ${w}`)
    fail++
  } else {
    console.log(`✓ ${note}`)
  }
}

// 15.6" Full HD 筆電:1920×1080
const a = computePpi(1920, 1080, 15.6)
eq('valid', a.valid, true)
eq('1920×1080 對角線像素', round(a.diagonalPixels, 2), 2202.91)
eq('15.6" FHD ≈ 141.21 PPI', round(a.ppi, 2), 141.21)
eq('點距 ≈ 0.1799mm', round(a.dotPitchMm, 4), 0.1799)
eq('每公分像素 = ppi/2.54', round(a.ppcm, 2), round(141.2117 / 2.54, 2))
eq('總像素', a.totalPixels, 2073600)
eq('百萬像素', round(a.megapixels, 4), 2.0736)
eq('實體寬 ≈ 13.6 吋', round(a.widthInch, 2), 13.6)
eq('實體高 ≈ 7.65 吋', round(a.heightInch, 2), 7.65)

// 27" 2K:2560×1440 ≈ 108.79 PPI
eq('27" 2560×1440 ≈ 108.79 PPI', round(computePpi(2560, 1440, 27).ppi, 2), 108.79)

// 正方測試:對角線 = w×√2
const sq = computePpi(1000, 1000, Math.sqrt(2))
eq('1000×1000 @ √2 吋 → 1000 PPI', round(sq.ppi, 6), 1000)

// 錯誤
eq('尺寸 0 報錯', computePpi(1920, 1080, 0).error, '解析度與尺寸需大於 0')
eq('非數字報錯', computePpi(NaN, 1080, 15.6).error, '請輸入數值')

// 視網膜門檻:25cm 觀看距離約 349 PPI
eq('25cm 門檻 ≈ 349', round(retinaThreshold(25), 0), 349)
eq('門檻越遠越低:50cm < 25cm', retinaThreshold(50) < retinaThreshold(25), true)
eq('距離非正 NaN', Number.isNaN(retinaThreshold(0)), true)
eq('458 PPI 手機 @25cm 達視網膜', isRetina(458, 25), true)
eq('141 PPI 筆電 @25cm 未達', isRetina(141, 25), false)

// round
eq('round 去零', round(108.790000, 2), 108.79)

if (fail) {
  console.error(`\n${fail} 個測試失敗`)
  process.exit(1)
}
console.log('\n全部通過 ✓')
