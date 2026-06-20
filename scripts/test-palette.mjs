// 調色盤萃取回歸測試
import { execSync } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'palette-'))
const entry = join(dir, 'entry.mjs')
const src = join(process.cwd(), 'src/features/paletteExtract.ts').replace(/\\/g, '\\\\')
writeFileSync(
  entry,
  `export { rgbToHex, clamp255, luminance, extractPixels, medianCut, formatSwatches } from '${src}'`,
)
const outFile = join(dir, 'bundle.mjs')
execSync(`npx esbuild ${entry} --bundle --format=esm --platform=node --outfile=${outFile}`, {
  stdio: ['ignore', 'ignore', 'inherit'],
})
const m = await import('file://' + outFile)

let pass = 0
let fail = 0
function ok(cond, msg) {
  if (cond) pass++
  else {
    fail++
    console.error('✗', msg)
  }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// ── rgbToHex / clamp ──
ok(m.rgbToHex([255, 0, 0]) === '#ff0000', '紅')
ok(m.rgbToHex([0, 128, 255]) === '#0080ff', '藍')
ok(m.rgbToHex([0, 0, 0]) === '#000000', '黑')
ok(m.rgbToHex([255, 255, 255]) === '#ffffff', '白')
ok(m.rgbToHex([15, 16, 17]) === '#0f1011', '補零')
ok(m.clamp255(-5) === 0 && m.clamp255(300) === 255 && m.clamp255(7.6) === 8, 'clamp 與四捨五入')

// ── luminance:白 > 灰 > 黑 ──
ok(Math.abs(m.luminance([255, 255, 255]) - 1) < 1e-9, '白亮度=1')
ok(m.luminance([0, 0, 0]) === 0, '黑亮度=0')
ok(m.luminance([255, 255, 255]) > m.luminance([128, 128, 128]), '白>灰')
ok(m.luminance([128, 128, 128]) > m.luminance([0, 0, 0]), '灰>黑')

// ── extractPixels ──
const rgba = [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 0 /*透明*/, 10, 20, 30, 255]
ok(eq(m.extractPixels(rgba), [[255, 0, 0], [0, 255, 0], [10, 20, 30]]), '跳過全透明像素')
const opaque4 = [1, 0, 0, 255, 2, 0, 0, 255, 3, 0, 0, 255, 4, 0, 0, 255]
ok(eq(m.extractPixels(opaque4, { stride: 2 }), [[1, 0, 0], [3, 0, 0]]), 'stride 跳格抽樣取每隔一個')
ok(m.extractPixels([], {}).length === 0, '空資料')

// ── medianCut:兩種等量純色,中位數對齊邊界 → 切出兩個純色 ──
function rep(color, n) {
  return Array.from({ length: n }, () => color.slice())
}
const balanced = [...rep([255, 0, 0], 20), ...rep([0, 0, 255], 20)]
const pb = m.medianCut(balanced, 2)
ok(pb.length === 2, '切成 2 色')
ok(eq(pb.map((s) => s.hex).sort(), ['#0000ff', '#ff0000']), '兩個純色 hex')
ok(pb.every((s) => s.count === 20 && Math.abs(s.ratio - 0.5) < 1e-9), '各 20 像素、佔比 0.5')

// ── 平均值:單一色塊取平均 ──
const avg = m.medianCut([[0, 0, 0], [10, 20, 30]], 1)
ok(eq(avg[0].rgb, [5, 10, 15]), '單色塊取平均')
ok(avg[0].count === 2, '平均色塊像素數')

// ── 沿 R 軸三段(G/B 固定),保證乾淨切割並依數量遞減排序 ──
const axis = [...rep([0, 0, 0], 10), ...rep([100, 0, 0], 10), ...rep([255, 0, 0], 20)]
const pa = m.medianCut(axis, 3)
ok(pa.length === 3, '切成 3 色')
ok(pa[0].count === 20 && pa[0].hex === '#ff0000', '最多的(20)排第一')
ok(pa[0].count >= pa[1].count && pa[1].count >= pa[2].count, '依數量遞減排序')
ok(eq(pa.slice(1).map((s) => s.hex).sort(), ['#000000', '#640000']), '其餘兩色 hex(0 與 100)')
ok(pa.reduce((s, x) => s + x.count, 0) === 40, '像素數總和守恆')
ok(Math.abs(pa.reduce((s, x) => s + x.ratio, 0) - 1) < 1e-9, '佔比總和=1')

// ── 要求數量多於可分割色塊:不應無限迴圈、數量受限 ──
const allSame = rep([100, 100, 100], 20)
const ps = m.medianCut(allSame, 5)
ok(ps.length === 1, '純色只能得到 1 色塊')
ok(ps[0].hex === '#646464' && ps[0].ratio === 1, '純色塊 hex 與佔比')
ok(m.medianCut([], 5).length === 0, '空像素回空')
ok(m.medianCut(balanced, 0).length === 0, 'count=0 回空')

// 只有兩種不同像素卻要 4 色 → 最多 2
ok(m.medianCut([[0, 0, 0], [255, 255, 255]], 4).length === 2, '兩像素最多切 2')

// ── medianCut 不可變動傳入陣列(內部用 slice)──
const orig = [...rep([5, 0, 0], 2), ...rep([200, 0, 0], 2)]
const snapshot = JSON.stringify(orig)
m.medianCut(orig, 2)
ok(JSON.stringify(orig) === snapshot, '不變動輸入陣列')

// ── formatSwatches(以固定色票測,與量化無關)──
const manual = [
  { rgb: [255, 0, 0], hex: '#ff0000', count: 30, ratio: 0.75 },
  { rgb: [0, 0, 255], hex: '#0000ff', count: 10, ratio: 0.25 },
]
ok(m.formatSwatches(manual, 'hex') === '#ff0000\n#0000ff', 'hex 輸出')
ok(m.formatSwatches(manual, 'rgb') === 'rgb(255, 0, 0)\nrgb(0, 0, 255)', 'rgb 輸出')
ok(m.formatSwatches(manual, 'json') === '["#ff0000","#0000ff"]', 'json 輸出')
ok(m.formatSwatches(manual, 'css').includes('--color-1: #ff0000;'), 'css 變數輸出')
ok(m.formatSwatches(manual, 'css').startsWith(':root {'), 'css :root 包裹')

console.log(`palette: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
