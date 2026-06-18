/*
  文件掃描美化引擎回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-docscan.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `docscan-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/docScan.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { luma, toGray, percentileBounds, adaptiveThreshold, applyScan } = await import(
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

// 建一張 RGBA 影像:fn(x,y) 回 [r,g,b]
function makeImg(width, height, fn) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = fn(x, y)
      const i = (y * width + x) * 4
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = 255
    }
  }
  return { data, width, height }
}

// --- luma ---
check('luma 純白=255', Math.round(luma(255, 255, 255)) === 255)
check('luma 純黑=0', Math.round(luma(0, 0, 0)) === 0)
check('luma 綠權重最高', luma(0, 255, 0) > luma(255, 0, 0) && luma(255, 0, 0) > luma(0, 0, 255))

// --- toGray ---
const solid = makeImg(4, 4, () => [120, 120, 120])
const g = toGray(solid)
check('toGray 長度 = w*h', g.length === 16)
check('toGray 灰色值正確', g[0] === 120 && g[15] === 120)

// --- percentileBounds ---
const ramp = new Uint8Array(256)
for (let v = 0; v < 256; v++) ramp[v] = v // 每個亮度各一個像素
const b0 = percentileBounds(ramp, 0)
check('percentileBounds clip0 全幅', b0.lo === 0 && b0.hi === 255)
const b10 = percentileBounds(ramp, 10)
check('percentileBounds 裁切後界內縮', b10.lo > 0 && b10.hi < 255 && b10.lo < b10.hi)
const uniform = new Uint8Array(100).fill(128)
const bu = percentileBounds(uniform, 5)
check('percentileBounds 全相同值回退全幅', bu.lo === 0 && bu.hi === 255)
check('percentileBounds 空陣列安全', percentileBounds(new Uint8Array(0), 5).hi === 255)

// --- adaptiveThreshold ---
const uniGray = new Uint8Array(64).fill(200) // 8x8 均勻
const uniTh = adaptiveThreshold(uniGray, 8, 8, 3, 8)
check('adaptiveThreshold 均勻影像全白', uniTh.every((v) => v === 255))
check('adaptiveThreshold 輸出只有 0/255', uniTh.every((v) => v === 0 || v === 255))
// 中央一個暗點(明顯低於鄰域平均)應判黑
const dot = new Uint8Array(81).fill(220)
dot[40] = 20 // 9x9 的中心
const dotTh = adaptiveThreshold(dot, 9, 9, 3, 8)
check('adaptiveThreshold 暗點判黑', dotTh[40] === 0)
check('adaptiveThreshold 暗點四周仍白', dotTh[0] === 255 && dotTh[80] === 255)
check('adaptiveThreshold 空影像安全', adaptiveThreshold(new Uint8Array(0), 0, 0, 1, 5).length === 0)

// --- applyScan: bw ---
// 半邊亮半邊暗的直向分界圖,bw 後應出現黑白
const halfImg = makeImg(20, 20, (x) => (x < 10 ? [40, 40, 40] : [230, 230, 230]))
const bw = applyScan(halfImg, { mode: 'bw', strength: 50 })
check('applyScan bw 長度 = w*h*4', bw.length === 20 * 20 * 4)
let onlyBin = true
for (let i = 0; i < bw.length; i += 4) {
  if (bw[i] !== 0 && bw[i] !== 255) onlyBin = false
  if (bw[i] !== bw[i + 1] || bw[i] !== bw[i + 2]) onlyBin = false
  if (bw[i + 3] !== 255) onlyBin = false
}
check('applyScan bw 僅黑白且灰階且不透明', onlyBin)
let hasBlack = false
let hasWhite = false
for (let i = 0; i < bw.length; i += 4) {
  if (bw[i] === 0) hasBlack = true
  if (bw[i] === 255) hasWhite = true
}
check('applyScan bw 同時含黑與白', hasBlack && hasWhite)

// --- applyScan: gray ---
const dim = makeImg(10, 10, () => [80, 100, 120]) // 偏暗低對比
const gray = applyScan(dim, { mode: 'gray', strength: 80 })
let grayOk = true
for (let i = 0; i < gray.length; i += 4) {
  if (gray[i] !== gray[i + 1] || gray[i] !== gray[i + 2]) grayOk = false
  if (gray[i + 3] !== 255) grayOk = false
}
check('applyScan gray 三通道相等(去色)', grayOk)
check('applyScan gray 不更動原圖', dim.data[0] === 80)

// --- applyScan: color 對比拉伸 ---
// 一張只有 100..150 範圍的低對比彩圖,color 後極值應被拉開
const lowContrast = makeImg(16, 16, (x, y) => {
  const v = 100 + ((x + y) % 50)
  return [v, v - 5 < 0 ? 0 : v - 5, v]
})
const color = applyScan(lowContrast, { mode: 'color', strength: 100 })
let minV = 255
let maxV = 0
for (let i = 0; i < color.length; i += 4) {
  minV = Math.min(minV, color[i])
  maxV = Math.max(maxV, color[i])
}
check('applyScan color 拉伸後對比變大', maxV - minV > 50)
check('applyScan color alpha 不透明', color[3] === 255)
check('applyScan color 不更動原圖', lowContrast.data[0] === 100)

// 強度夾住於 0–100:極端強度不應拋錯
check('applyScan 強度<0 安全', applyScan(dim, { mode: 'bw', strength: -50 }).length === 400)
check('applyScan 強度>100 安全', applyScan(dim, { mode: 'gray', strength: 999 }).length === 400)

if (fail) {
  console.error(`\n${fail} 項失敗`)
  process.exit(1)
}
console.log('\n全部通過')
