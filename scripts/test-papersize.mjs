/*
  紙張尺寸與列印像素引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-papersize.mjs
  oracle 以 ISO 216 標準 mm 尺寸與 mm/25.4×dpi 手算為準,常見值(A4@300dpi=2480×3508)交叉驗證。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `papersize-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/paperSize.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { PAPERS, getPaper, mmToInch, mmToPx, dimensions, round } = await import('file://' + out)

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

// 標準尺寸
eq('A4 = 210×297mm', [getPaper('a4').widthMm, getPaper('a4').heightMm], [210, 297])
eq('A3 = 297×420mm', [getPaper('a3').widthMm, getPaper('a3').heightMm], [297, 420])
eq('A0 = 841×1189mm', [getPaper('a0').widthMm, getPaper('a0').heightMm], [841, 1189])
eq('B4 = 250×353mm', [getPaper('b4').widthMm, getPaper('b4').heightMm], [250, 353])
eq('US Letter = 215.9×279.4mm', [getPaper('letter').widthMm, getPaper('letter').heightMm], [215.9, 279.4])
eq('未知紙張 null', getPaper('zzz'), null)
eq('收錄數量', PAPERS.length, 19)

// mm 換算
eq('25.4mm = 1 inch', mmToInch(25.4), 1)
eq('210mm ≈ 8.27 inch', round(mmToInch(210), 2), 8.27)
eq('25.4mm @300dpi = 300px', mmToPx(25.4, 300), 300)

// A4 @300dpi = 2480×3508(知名值)
const a4 = dimensions('a4', 300, 'portrait')
eq('A4@300dpi 寬 2480px', a4.widthPx, 2480)
eq('A4@300dpi 高 3508px', a4.heightPx, 3508)
eq('A4 寬 21cm', a4.widthCm, 21)
eq('A4 高 29.7cm', a4.heightCm, 29.7)
eq('A4 寬 ≈ 8.27 inch', round(a4.widthIn, 2), 8.27)

// A4 @72dpi 螢幕
eq('A4@72dpi 寬 595px', dimensions('a4', 72).widthPx, 595)
eq('A4@72dpi 高 842px', dimensions('a4', 72).heightPx, 842)

// 橫式:寬高對調
const land = dimensions('a4', 300, 'landscape')
eq('A4 橫式 寬 3508px', land.widthPx, 3508)
eq('A4 橫式 高 2480px', land.heightPx, 2480)
eq('A4 橫式 寬 297mm', land.widthMm, 297)

// A3 @300dpi = 3508×4961
eq('A3@300dpi = 3508×4961', [dimensions('a3', 300).widthPx, dimensions('a3', 300).heightPx], [3508, 4961])

// 錯誤
eq('dpi 0 → null', dimensions('a4', 0), null)
eq('未知紙張 → null', dimensions('zzz', 300), null)

if (fail) {
  console.error(`\n${fail} 個測試失敗`)
  process.exit(1)
}
console.log('\n全部通過 ✓')
