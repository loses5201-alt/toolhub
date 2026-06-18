/*
  PDF N-up 版面計算的回歸測試(無需測試框架,node 直接跑)。
  只測純幾何函式(nupLayout.ts),不碰 pdf-lib。
  執行:node scripts/test-pdfnup.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `pdfnup-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/tools/pdf-studio/nupLayout.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { A4, sheetLayout, cellBox, fitInto } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}
const approx = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps

// 版面預設
const l2 = sheetLayout(2)
check('2-up 為橫式(寬>高)', l2.sheetW > l2.sheetH)
check('2-up 紙寬 = A4 高', approx(l2.sheetW, A4.h))
check('2-up cols=2 rows=1', l2.cols === 2 && l2.rows === 1)
check('2-up perSheet=2', l2.perSheet === 2)

const l4 = sheetLayout(4)
check('4-up 為直式(高>寬)', l4.sheetH > l4.sheetW)
check('4-up 2×2', l4.cols === 2 && l4.rows === 2 && l4.perSheet === 4)
check('6-up perSheet=6', sheetLayout(6).perSheet === 6)
check('9-up 3×3', sheetLayout(9).cols === 3 && sheetLayout(9).rows === 3)
check('不支援的值退回 2-up', sheetLayout(3).perSheet === 2 && sheetLayout(99).cols === 2)

// 格子位置(用 4-up,margin=20 gap=10)
const lay = sheetLayout(4)
const m = 20
const g = 10
const usableW = lay.sheetW - 2 * m - g * (lay.cols - 1)
const usableH = lay.sheetH - 2 * m - g * (lay.rows - 1)
const cw = usableW / lay.cols
const ch = usableH / lay.rows

const c0 = cellBox(0, lay, m, g) // 左上
check('格子0 x = margin', approx(c0.x, m))
check('格子0 寬 = 欄寬', approx(c0.w, cw))
check('格子0 高 = 列高', approx(c0.h, ch))
check('格子0(上排)頂端貼近紙頂', approx(c0.y + c0.h, lay.sheetH - m))

const c1 = cellBox(1, lay, m, g) // 右上
check('格子1 x = margin + 欄寬 + gap', approx(c1.x, m + cw + g))
check('格子1 與格子0 同高(同列)', approx(c1.y, c0.y))

const c2 = cellBox(2, lay, m, g) // 左下
check('格子2 回到左邊(換列)', approx(c2.x, m))
check('格子2 在格子0 下方', c2.y < c0.y)
check('格子2 底端貼近紙底(下排最後一列)', approx(c2.y, m))

// 所有格子都落在紙內
for (let i = 0; i < lay.perSheet; i++) {
  const b = cellBox(i, lay, m, g)
  const inside = b.x >= m - 1e-9 && b.y >= m - 1e-9 && b.x + b.w <= lay.sheetW - m + 1e-9 && b.y + b.h <= lay.sheetH - m + 1e-9
  check(`格子${i} 落在邊界內`, inside)
}

// fitInto:等比例縮放置中
const box = { x: 100, y: 200, w: 300, h: 400 }
// 寬高比 1:1 的來源 → 受限於 box 寬 300
const sq = fitInto(100, 100, box)
check('正方形塞進直box → 邊長=box寬', approx(sq.w, 300) && approx(sq.h, 300))
check('正方形水平置中(貼齊box左右)', approx(sq.x, 100))
check('正方形垂直置中', approx(sq.y, 200 + (400 - 300) / 2))
check('縮放後不超出 box', sq.w <= box.w + 1e-9 && sq.h <= box.h + 1e-9)

// 很寬的來源 → 受限於 box 寬,高度變小並垂直置中
const wide = fitInto(800, 100, box)
check('寬來源:寬=box寬', approx(wide.w, 300))
check('寬來源:維持比例(高=寬/8)', approx(wide.h, 300 / 8))
check('寬來源:垂直置中', approx(wide.y, 200 + (400 - 300 / 8) / 2))

// 不變形:輸出寬高比 = 輸入寬高比
check('fitInto 維持寬高比', approx(wide.w / wide.h, 800 / 100, 1e-4))
check('來源尺寸為 0 不爆', fitInto(0, 100, box).w === 0)

if (fail) {
  console.error(`\n${fail} 項失敗`)
  process.exit(1)
}
console.log('\nPDF N-up 版面測試全部通過')
