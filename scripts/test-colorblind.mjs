/*
  色盲模擬引擎回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-colorblind.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `colorblind-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/colorBlind.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { clamp255, luma, simulateColor, simulatePixels, colorDistance, CVD_LABELS } = await import(
  'file://' + out
)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// clamp255
check('clamp255 夾下界', clamp255(-10) === 0)
check('clamp255 夾上界', clamp255(300) === 255)
check('clamp255 四捨五入', clamp255(127.6) === 128)

// luma:純白=255、純黑=0、綠權重最高
check('luma 純白', Math.round(luma(255, 255, 255)) === 255)
check('luma 純黑', luma(0, 0, 0) === 0)
check('luma 綠 > 紅 > 藍', luma(0, 255, 0) > luma(255, 0, 0) && luma(255, 0, 0) > luma(0, 0, 255))

// severity 0 = 原色不變(各型別)
for (const t of ['protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia']) {
  const [r, g, b] = simulateColor(123, 45, 200, t, 0)
  check(`severity 0 (${t}) 回原色`, r === 123 && g === 45 && b === 200)
}

// 灰色(R=G=B)在任何型別下幾乎不變(色覺障礙主要影響彩色)
for (const t of ['protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia']) {
  const [r, g, b] = simulateColor(128, 128, 128, t, 100)
  check(`灰色 (${t}) 仍接近灰`, Math.abs(r - 128) <= 3 && Math.abs(g - 128) <= 3 && Math.abs(b - 128) <= 3)
}

// achromatopsia:輸出三通道相等且等於 luma
{
  const [r, g, b] = simulateColor(255, 0, 0, 'achromatopsia', 100)
  check('全色盲 三通道相等', r === g && g === b)
  check('全色盲 = luma(紅)', r === clamp255(luma(255, 0, 0)))
}

// 純白 / 純黑 在所有型別、全模擬下維持白/黑(矩陣各列總和≈1)
for (const t of ['protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia']) {
  const w = simulateColor(255, 255, 255, t, 100)
  const k = simulateColor(0, 0, 0, t, 100)
  check(`純白 (${t}) 仍近白`, w[0] >= 250 && w[1] >= 250 && w[2] >= 250)
  check(`純黑 (${t}) 仍為黑`, k[0] === 0 && k[1] === 0 && k[2] === 0)
}

// 紅綠在綠色盲下「靠近」:模擬後紅、綠的差距應比原本小(這就是工具要凸顯的重點)
{
  const red = simulateColor(255, 0, 0, 'deuteranopia', 100)
  const green = simulateColor(0, 255, 0, 'deuteranopia', 100)
  const origDist = colorDistance([255, 0, 0], [0, 255, 0])
  const simDist = colorDistance(red, green)
  check('綠色盲下 紅綠距離縮小', simDist < origDist)
}
{
  const red = simulateColor(255, 0, 0, 'protanopia', 100)
  const green = simulateColor(0, 255, 0, 'protanopia', 100)
  check(
    '紅色盲下 紅綠距離縮小',
    colorDistance(red, green) < colorDistance([255, 0, 0], [0, 255, 0]),
  )
}

// severity 中間值在原色與全模擬之間
{
  const full = simulateColor(255, 0, 0, 'deuteranopia', 100)
  const half = simulateColor(255, 0, 0, 'deuteranopia', 50)
  const between = half[0] >= Math.min(255, full[0]) && half[0] <= Math.max(255, full[0])
  check('severity 50 介於原色與全模擬之間(R)', between)
  check('severity 50 ≠ 全模擬(有差異)', half[1] !== full[1] || half[2] !== full[2])
}

// colorDistance
check('colorDistance 相同=0', colorDistance([1, 2, 3], [1, 2, 3]) === 0)
check('colorDistance 對稱', colorDistance([0, 0, 0], [3, 4, 0]) === 5)

// simulatePixels:尺寸、alpha 保留、不更動輸入
{
  const width = 2
  const height = 2
  const data = new Uint8ClampedArray([
    255, 0, 0, 255, // 紅 不透明
    0, 255, 0, 128, // 綠 半透明
    0, 0, 255, 0, // 藍 全透明
    128, 128, 128, 200, // 灰
  ])
  const snapshot = Uint8ClampedArray.from(data)
  const res = simulatePixels({ data, width, height }, 'deuteranopia', 100)
  check('simulatePixels 輸出長度正確', res.length === width * height * 4)
  check('simulatePixels alpha 原樣保留', res[3] === 255 && res[7] === 128 && res[11] === 0 && res[15] === 200)
  check('simulatePixels 不更動輸入', data.every((v, i) => v === snapshot[i]))
  check('simulatePixels 確實改了顏色', res[0] !== 255 || res[1] !== 0 || res[2] !== 0)
}

// 標籤齊全
check('CVD_LABELS 四型別齊全', ['protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia'].every((t) => typeof CVD_LABELS[t] === 'string' && CVD_LABELS[t].length > 0))

console.log(fail === 0 ? '\nAll colorblind tests passed.' : `\n${fail} test(s) FAILED.`)
process.exit(fail === 0 ? 0 : 1)
