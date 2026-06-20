/*
  照片加邊框版面計算引擎回歸測試(node 直接跑)。
  執行:node scripts/test-imageframe.mjs
  oracle:目標比例定義、邊框=長邊×百分比、置中與「補滿較短維度」的幾何手算。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `imageframe-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/imageFrame.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { computeFrame, aspectValue } = await import('file://' + out)

let fail = 0
let pass = 0
function ok(c, msg) {
  if (c) pass++
  else {
    fail++
    console.error('✗ FAIL:', msg)
  }
}
function eq(got, want, msg) {
  ok(got === want, `${msg}（got ${got}, want ${want}）`)
}

// ---- aspectValue ----
eq(aspectValue('square'), 1, 'square=1')
eq(aspectValue('16:9'), 16 / 9, '16:9 比值')
eq(aspectValue('original'), null, 'original 無比值')

// ---- original:四周等寬邊框,外形同源圖長大 ----
{
  const L = computeFrame({ srcW: 800, srcH: 600, aspect: 'original', marginPercent: 10 })
  // margin = max(800,600)*0.1 = 80
  eq(L.margin, 80, 'original margin = 長邊×10%')
  eq(L.canvasW, 960, 'canvasW = 800+160')
  eq(L.canvasH, 760, 'canvasH = 600+160')
  eq(L.drawX, 80, '置中 X')
  eq(L.drawY, 80, '置中 Y')
  eq(L.drawW, 800, '圖寬不變')
  eq(L.drawH, 600, '圖高不變')
}

// ---- margin 0 + original = 原樣 ----
{
  const L = computeFrame({ srcW: 500, srcH: 300, aspect: 'original', marginPercent: 0 })
  eq(L.margin, 0, 'margin 0')
  eq(L.canvasW, 500, '畫布同源寬')
  eq(L.canvasH, 300, '畫布同源高')
  eq(L.drawX, 0, '無偏移')
}

// ---- 橫圖 → 正方形:以寬為準,補高 ----
{
  // 1000×500,margin0 → minW=1000 minH=500,1000/500=2 >= 1 → canvasW=1000, canvasH=1000
  const L = computeFrame({ srcW: 1000, srcH: 500, aspect: 'square', marginPercent: 0 })
  eq(L.canvasW, 1000, '正方:canvasW=長邊')
  eq(L.canvasH, 1000, '正方:canvasH=canvasW')
  eq(L.drawX, 0, '橫圖左右貼齊(無邊框時)')
  eq(L.drawY, 250, '上下置中 (1000-500)/2')
}

// ---- 直圖 → 正方形:以高為準,補寬 ----
{
  const L = computeFrame({ srcW: 500, srcH: 1000, aspect: 'square', marginPercent: 0 })
  eq(L.canvasW, 1000, '直圖補寬到 1000')
  eq(L.canvasH, 1000, 'canvasH=1000')
  eq(L.drawX, 250, '左右置中')
  eq(L.drawY, 0, '上下貼齊')
}

// ---- 含邊框的正方形:邊框 + 比例同時成立 ----
{
  // 800×600 margin10% → margin=80, minW=960 minH=760。960/760≈1.263 >=1 → canvasW=960 canvasH=960
  const L = computeFrame({ srcW: 800, srcH: 600, aspect: 'square', marginPercent: 10 })
  eq(L.margin, 80, 'margin 80')
  eq(L.canvasW, 960, 'canvasW=minW=960')
  eq(L.canvasH, 960, 'canvasH=960(補高成正方)')
  eq(L.drawX, 80, 'X = (960-800)/2')
  eq(L.drawY, 180, 'Y = (960-600)/2')
  ok(L.drawX >= L.margin && L.drawY >= L.margin, '四周皆 ≥ margin')
}

// ---- 9:16 直式(限動):橫圖補成高瘦 ----
{
  // 1600×900 margin0 → minW1600 minH900。比 r=9/16=0.5625。1600/900≈1.778 >= 0.5625 → 以寬為準 canvasW=1600 canvasH=round(1600/0.5625)=2844
  const L = computeFrame({ srcW: 1600, srcH: 900, aspect: '9:16', marginPercent: 0 })
  eq(L.canvasW, 1600, '9:16 canvasW=1600')
  eq(L.canvasH, Math.round(1600 / (9 / 16)), '9:16 canvasH 由比例算')
  ok(L.canvasH > L.canvasW, '9:16 為直式(高>寬)')
  eq(L.drawX, 0, 'X 貼齊')
  eq(L.drawY, Math.round((L.canvasH - 900) / 2), 'Y 置中')
}

// ---- 比例邊界:剛好符合比例的圖不應再補邊(margin0) ----
{
  const L = computeFrame({ srcW: 400, srcH: 400, aspect: 'square', marginPercent: 0 })
  eq(L.canvasW, 400, '正方圖→正方:不變寬')
  eq(L.canvasH, 400, '不變高')
  eq(L.drawX, 0, '無偏移')
}

// ---- marginPercent 夾鉗 ----
{
  const L = computeFrame({ srcW: 100, srcH: 100, aspect: 'original', marginPercent: 999 })
  eq(L.margin, 50, 'marginPercent 夾為 50% → 100×0.5=50')
}

console.log(`\nimageframe: ${pass} 通過, ${fail} 失敗`)
process.exit(fail ? 1 : 0)
