/*
  PDF 簽名/蓋章版面計算的回歸測試(無需測試框架,node 直接跑)。
  只測純幾何函式(signLayout.ts),不碰 pdf-lib。
  執行:node scripts/test-signlayout.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `signlayout-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/tools/pdf-studio/signLayout.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { clamp, heightFrac, clampBox, centerBox, imagePlacement } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}
const approx = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps

// --- clamp ---
check('clamp 夾下界', clamp(-1, 0, 1) === 0)
check('clamp 夾上界', clamp(2, 0, 1) === 1)
check('clamp 範圍內不變', clamp(0.4, 0, 1) === 0.4)

// --- heightFrac ---
// 頁面 600x800,圖寬 50%(300pt),長寬比 0.5 → 圖高 150pt → 佔頁高 150/800
check('heightFrac 基本', approx(heightFrac({ nx: 0, ny: 0, nw: 0.5 }, 600, 800, 0.5), 150 / 800))
check('heightFrac 零尺寸不爆', heightFrac({ nx: 0, ny: 0, nw: 0.5 }, 0, 0, 0.5) === 0)

// --- imagePlacement ---
// 左上角放置(nx=0,ny=0):y = 頁高 - 圖高
const r1 = imagePlacement(600, 800, { nx: 0, ny: 0, nw: 0.5 }, 0.5)
check('imagePlacement 左上 x=0', approx(r1.x, 0))
check('imagePlacement 寬=頁寬×nw', approx(r1.width, 300))
check('imagePlacement 高=寬×比例', approx(r1.height, 150))
check('imagePlacement 左上 y=頁高-圖高', approx(r1.y, 800 - 150))

// 右下角:nx 使右緣貼齊、ny 使下緣貼齊
const r2 = imagePlacement(600, 800, { nx: 0.5, ny: 1 - 150 / 800, nw: 0.5 }, 0.5)
check('imagePlacement 右下 x', approx(r2.x, 300))
check('imagePlacement 右下 y≈0(貼底)', approx(r2.y, 0))
check('imagePlacement 右下 右緣貼齊頁寬', approx(r2.x + r2.width, 600))

// 畫面往下(ny 變大)→ pdf y 變小(往頁面下方),方向一致
const top = imagePlacement(600, 800, { nx: 0, ny: 0.1, nw: 0.2 }, 1)
const bot = imagePlacement(600, 800, { nx: 0, ny: 0.6, nw: 0.2 }, 1)
check('ny 變大 → pdf y 變小(畫面往下)', bot.y < top.y)

// --- clampBox ---
const c1 = clampBox({ nx: 0.9, ny: 0.9, nw: 0.5 }, 600, 800, 0.5)
check('clampBox 夾住右緣 nx=1-nw', approx(c1.nx, 0.5))
const hf = heightFrac({ nx: 0, ny: 0, nw: 0.5 }, 600, 800, 0.5)
check('clampBox 夾住下緣 ny=1-hf', approx(c1.ny, 1 - hf))
const c2 = clampBox({ nx: -0.3, ny: -0.2, nw: 0.3 }, 600, 800, 1)
check('clampBox 夾住負座標為 0', c2.nx === 0 && c2.ny === 0)
const c3 = clampBox({ nx: 0.2, ny: 0.2, nw: 5 }, 600, 800, 1)
check('clampBox 寬度上限 1', c3.nw === 1)
const c4 = clampBox({ nx: 0.2, ny: 0.2, nw: 0 }, 600, 800, 1)
check('clampBox 寬度下限 >0', c4.nw > 0)
// 夾過的框放進頁面後不應超出邊界
const c5 = clampBox({ nx: 2, ny: 2, nw: 0.4 }, 600, 800, 0.5)
const rc5 = imagePlacement(600, 800, c5, 0.5)
check('clampBox 後不超出右緣', rc5.x + rc5.width <= 600 + 1e-6)
check('clampBox 後不超出下緣(y>=0)', rc5.y >= -1e-6)
check('clampBox 後不超出上緣', rc5.y + rc5.height <= 800 + 1e-6)

// --- centerBox ---
const cb = centerBox(600, 800, 0.4, 0.5)
const rcb = imagePlacement(600, 800, cb, 0.5)
check('centerBox 水平置中', approx(rcb.x + rcb.width / 2, 300))
check('centerBox 垂直置中', approx(rcb.y + rcb.height / 2, 400))

if (fail) {
  console.error(`\n${fail} 個測試失敗`)
  process.exit(1)
}
console.log('\n全部通過')
