/*
  色彩混合引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-colormix.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `colormix-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/colorMix.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { parseColor, toHex, toRgbString, mix, alphaComposite, gradientSteps } = await import(
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
function near(note, got, want, eps = 1e-6) {
  if (Math.abs(got - want) <= eps) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}\n   got : ${got}\n   want: ~${want}`)
  }
}

// --- parseColor ---
eq('#fff', JSON.stringify(parseColor('#fff')), JSON.stringify({ r: 255, g: 255, b: 255, a: 1 }))
eq('#000000', JSON.stringify(parseColor('#000000')), JSON.stringify({ r: 0, g: 0, b: 0, a: 1 }))
eq('無井號 ff0000', JSON.stringify(parseColor('ff0000')), JSON.stringify({ r: 255, g: 0, b: 0, a: 1 }))
eq('#RGBA', JSON.stringify(parseColor('#f008')), JSON.stringify({ r: 255, g: 0, b: 0, a: 0x88 / 255 }))
eq('#RRGGBBAA', JSON.stringify(parseColor('#ff000080')), JSON.stringify({ r: 255, g: 0, b: 0, a: 0x80 / 255 }))
eq('rgb()', JSON.stringify(parseColor('rgb(10, 20, 30)')), JSON.stringify({ r: 10, g: 20, b: 30, a: 1 }))
eq('rgba()', JSON.stringify(parseColor('rgba(10,20,30,0.5)')), JSON.stringify({ r: 10, g: 20, b: 30, a: 0.5 }))
eq('rgb 百分比', JSON.stringify(parseColor('rgb(100%, 0%, 0%)')), JSON.stringify({ r: 255, g: 0, b: 0, a: 1 }))
eq('非法回 null', parseColor('not a color'), null)
eq('空回 null', parseColor(''), null)
eq('hex 長度 5 非法', parseColor('#12345'), null)

// --- toHex / toRgbString ---
eq('toHex 不透明', toHex({ r: 255, g: 128, b: 0, a: 1 }), '#ff8000')
eq('toHex 帶 alpha', toHex({ r: 255, g: 0, b: 0, a: 0x80 / 255 }), '#ff000080')
eq('toRgbString 不透明', toRgbString({ r: 1, g: 2, b: 3, a: 1 }), 'rgb(1, 2, 3)')
eq('toRgbString rgba', toRgbString({ r: 1, g: 2, b: 3, a: 0.5 }), 'rgba(1, 2, 3, 0.5)')

const C = (s) => parseColor(s)

// --- mix ---
eq('白黑混 0.5 → #808080', toHex(mix(C('#fff'), C('#000'), 0.5)), '#808080')
eq('紅藍混 0.5 → #800080', toHex(mix(C('#ff0000'), C('#0000ff'), 0.5)), '#800080')
eq('ratio 0 全 c1', toHex(mix(C('#ff0000'), C('#00ff00'), 0)), '#ff0000')
eq('ratio 1 全 c2', toHex(mix(C('#ff0000'), C('#00ff00'), 1)), '#00ff00')
near('alpha 一起內插', mix({ r: 0, g: 0, b: 0, a: 0 }, { r: 0, g: 0, b: 0, a: 1 }, 0.5).a, 0.5)
eq('ratio 超界夾 1', toHex(mix(C('#000'), C('#fff'), 5)), '#ffffff')

// --- alphaComposite ---
eq('半透明黑疊白 → #808080', toHex(alphaComposite(C('rgba(0,0,0,0.5)'), C('#fff'))), '#808080')
eq('半透明紅疊白 → #ff8080', toHex(alphaComposite(C('rgba(255,0,0,0.5)'), C('#fff'))), '#ff8080')
eq('不透明前景蓋過背景', toHex(alphaComposite(C('#123456'), C('#fff'))), '#123456')
eq('全透明前景 → 背景', toHex(alphaComposite(C('rgba(255,0,0,0)'), C('#abcdef'))), '#abcdef')
// 結果 alpha:半透明疊不透明背景 → 不透明
near('疊不透明背景結果 a=1', alphaComposite(C('rgba(0,0,0,0.5)'), C('#fff')).a, 1)
// 兩個半透明疊加
const stacked = alphaComposite(C('rgba(255,0,0,0.5)'), C('rgba(0,0,255,0.5)'))
near('半透明疊半透明 a = 0.75', stacked.a, 0.75)

// --- gradientSteps ---
const g = gradientSteps(C('#000'), C('#fff'), 3)
eq('色階段數', g.length, 3)
eq('色階頭', toHex(g[0]), '#000000')
eq('色階中', toHex(g[1]), '#808080')
eq('色階尾', toHex(g[2]), '#ffffff')
eq('色階最少 2 段', gradientSteps(C('#000'), C('#fff'), 1).length, 2)

if (fail) {
  console.error(`\n${fail} 個測試未通過`)
  process.exit(1)
} else {
  console.log('\n全部 colorMix 測試通過')
}
