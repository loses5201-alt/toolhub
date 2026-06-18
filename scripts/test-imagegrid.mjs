/*
  九宮格切圖引擎回歸測試(node 直接跑,無框架)。
  imageGrid.ts 為純 TS、無相依,用 esbuild 打包成 ESM 後 import。
  執行:node scripts/test-imagegrid.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `imagegrid-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/imageGrid.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
  logLevel: 'silent',
})
const { computeCoverCrop, planGridTiles } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}
const near = (a, b) => Math.abs(a - b) < 1e-6

// ── computeCoverCrop ──
// 正方形目標、寬圖 → 裁左右成正方形
let c = computeCoverCrop(1000, 500, 1, 1)
check('寬圖裁成正方形(高為準)', near(c.sw, 500) && near(c.sh, 500))
check('寬圖水平置中', near(c.sx, 250) && near(c.sy, 0))
// 正方形目標、高圖 → 裁上下
c = computeCoverCrop(500, 1000, 1, 1)
check('高圖裁成正方形(寬為準)', near(c.sw, 500) && near(c.sh, 500))
check('高圖垂直置中', near(c.sx, 0) && near(c.sy, 250))
// 3:1 目標、正方形圖 → 取寬,裁上下
c = computeCoverCrop(900, 900, 3, 1)
check('3:1 取滿寬', near(c.sw, 900) && near(c.sh, 300))
check('3:1 垂直置中', near(c.sy, 300))
// 裁切結果落在原圖內
c = computeCoverCrop(640, 480, 3, 2)
check('裁切不超出原圖', c.sx >= 0 && c.sy >= 0 && c.sx + c.sw <= 640 + 1e-9 && c.sy + c.sh <= 480 + 1e-9)
check('3:2 目標比例正確', near(c.sw / c.sh, 3 / 2))

let threw = false
try { computeCoverCrop(0, 100, 1, 1) } catch { threw = true }
check('來源尺寸 0 丟錯', threw)
threw = false
try { computeCoverCrop(100, 100, 0, 1) } catch { threw = true }
check('長寬比 0 丟錯', threw)

// ── planGridTiles ──
const t = planGridTiles(1200, 1200, 3, 3)
check('3×3 共 9 格', t.length === 9)
check('顯示編號 1..9 連續', t.map((x) => x.displayIndex).join(',') === '1,2,3,4,5,6,7,8,9')
// 每格涵蓋且不重疊:面積總和 = 裁切面積
const cropArea = (() => { const cc = computeCoverCrop(1200, 1200, 3, 3); return cc.sw * cc.sh })()
const sumArea = t.reduce((s, x) => s + x.src.sw * x.src.sh, 0)
check('各格面積總和等於裁切面積', near(sumArea, cropArea))
// 左上角格(row0,col0)起點 = 裁切起點
const crop33 = computeCoverCrop(1200, 1200, 3, 3)
const tl = t.find((x) => x.row === 0 && x.col === 0)
check('左上格對齊裁切起點', near(tl.src.sx, crop33.sx) && near(tl.src.sy, crop33.sy))
// 右下格 postOrder = 1(IG 要最先貼),左上格 postOrder = 9
check('右下格最先貼(postOrder=1)', t.find((x) => x.displayIndex === 9).postOrder === 1)
check('左上格最後貼(postOrder=9)', t.find((x) => x.displayIndex === 1).postOrder === 9)
check('postOrder 為 1..9 排列', [...t.map((x) => x.postOrder)].sort((a, b) => a - b).join(',') === '1,2,3,4,5,6,7,8,9')
// 同列相鄰格水平接續
const r0 = t.filter((x) => x.row === 0).sort((a, b) => a.col - b.col)
check('同列格水平接續無縫', near(r0[0].src.sx + r0[0].src.sw, r0[1].src.sx))

// 非正方總網格(3×2)
const t32 = planGridTiles(900, 600, 3, 2)
check('3×2 共 6 格', t32.length === 6)
check('3×2 每格等寬等高', t32.every((x) => near(x.src.sw, t32[0].src.sw) && near(x.src.sh, t32[0].src.sh)))

threw = false
try { planGridTiles(1000, 1000, 0, 3) } catch { threw = true }
check('欄數 0 丟錯', threw)
threw = false
try { planGridTiles(1000, 1000, 3, -1) } catch { threw = true }
check('列數負數丟錯', threw)

if (fail) {
  console.error(`\n${fail} 個測試未通過`)
  process.exit(1)
}
console.log('\n全部 imageGrid 測試通過')
