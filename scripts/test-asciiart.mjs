/*
  圖片轉 ASCII 藝術引擎回歸測試(node 直接跑)。
  執行:node scripts/test-asciiart.mjs
  oracle:亮度公式(Rec.601)、字元梯度索引定義、平均取樣與白底混合的手算值。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `asciiart-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/asciiArt.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { RAMPS, luminance, pickChar, rgbaToAscii, toText } = await import('file://' + out)

let fail = 0
let pass = 0
function ok(c, msg) {
  if (c) pass++
  else {
    fail++
    console.error('✗ FAIL:', msg)
  }
}
function near(got, want, eps, msg) {
  ok(Math.abs(got - want) <= eps, `${msg}（got ${got}, want ${want}）`)
}

// 用單色塊建構 width×height 的 RGBA 陣列
function solid(w, h, r, g, b, a = 255) {
  const d = new Array(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    d[i * 4] = r
    d[i * 4 + 1] = g
    d[i * 4 + 2] = b
    d[i * 4 + 3] = a
  }
  return d
}

// ---- 梯度資料 ----
ok(Object.keys(RAMPS).length >= 4, '至少 4 種字元梯度')
ok(RAMPS.standard.endsWith(' '), 'standard 梯度尾端為空白(最淺)')
ok(RAMPS.standard[0] === '@', 'standard 梯度開頭為最深字元')
ok(RAMPS.detailed.length >= 65, 'detailed 梯度夠細(>=65 階)')

// ---- 亮度 Rec.601 ----
near(luminance(255, 255, 255), 255, 1e-9, '白=255')
near(luminance(0, 0, 0), 0, 1e-9, '黑=0')
near(luminance(255, 0, 0), 76.245, 1e-3, '純紅亮度=0.299×255')
near(luminance(0, 255, 0), 149.685, 1e-3, '純綠亮度=0.587×255')
near(luminance(0, 0, 255), 29.07, 1e-3, '純藍亮度=0.114×255')

// ---- pickChar:亮→尾端,暗→開頭 ----
const ramp = RAMPS.standard // 長度 10,索引 0..9
ok(pickChar(255, ramp) === ramp[9], '最亮挑到尾端(空白)')
ok(pickChar(0, ramp) === ramp[0], '最暗挑到開頭(@)')
ok(pickChar(255, ramp, true) === ramp[0], '反相:最亮→開頭')
ok(pickChar(0, ramp, true) === ramp[9], '反相:最暗→尾端')
// 中灰 127.5 → ratio≈0.5 → round(0.5×9)=round(4.5)=5(JS round 進位)
ok(pickChar(127.5, ramp) === ramp[5], '中灰挑到中段')
ok(pickChar(123, '@') === '@', '單字元梯度永遠回該字元')
ok(pickChar(99, '') === ' ', '空梯度回空白')

// ---- 維持比例:列數 = round(h/w × cols × charAspect) ----
let res = rgbaToAscii(solid(100, 100, 0, 0, 0), 100, 100, { cols: 10, ramp, charAspect: 0.5 })
ok(res.cols === 10, '欄數=10')
ok(res.rows === 5, '正方圖 cols=10 charAspect=0.5 → rows=5')
ok(res.lines.length === 5, 'lines 與 rows 一致')
ok(res.lines.every((l) => l.length === 10), '每列長度=欄數')
ok(res.cells.length === 5 && res.cells[0].length === 10, 'cells 維度 [rows][cols]')

// charAspect=1 的正方圖 → rows=cols
res = rgbaToAscii(solid(40, 40, 0, 0, 0), 40, 40, { cols: 8, ramp, charAspect: 1 })
ok(res.rows === 8, 'charAspect=1 正方圖 rows=cols')

// ---- 全黑 → 全為最深字元 ----
res = rgbaToAscii(solid(20, 20, 0, 0, 0), 20, 20, { cols: 5, ramp, charAspect: 1 })
ok(toText(res).split('\n').every((l) => l === '@@@@@'), '全黑圖每格皆 @')

// ---- 全白 → 全為空白 ----
res = rgbaToAscii(solid(20, 20, 255, 255, 255), 20, 20, { cols: 5, ramp, charAspect: 1 })
ok(res.lines.every((l) => l === '     '), '全白圖每格皆空白')

// ---- 平均顏色正確保留 ----
res = rgbaToAscii(solid(10, 10, 10, 20, 30), 10, 10, { cols: 2, ramp, charAspect: 1 })
ok(res.cells[0][0].r === 10 && res.cells[0][0].g === 20 && res.cells[0][0].b === 30, '平均顏色保留原色')

// ---- 透明像素與白底混合 → 變空白(最淺) ----
res = rgbaToAscii(solid(10, 10, 0, 0, 0, 0), 10, 10, { cols: 5, ramp, charAspect: 1 })
ok(res.lines.every((l) => l === '     '), '全透明(alpha=0)混白底→空白')
ok(res.cells[0][0].r === 255, '透明處顏色混成白')
// 半透明黑 alpha=128 → 約 127 灰
res = rgbaToAscii(solid(4, 4, 0, 0, 0, 128), 4, 4, { cols: 1, ramp, charAspect: 1 })
near(res.cells[0][0].r, 127, 2, '半透明黑混白底≈127 灰')

// ---- 水平漸層:左暗右亮 → 首格較深、末格較淺 ----
{
  const w = 10,
    h = 2
  const d = new Array(w * h * 4)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = Math.round((x / (w - 1)) * 255)
      const i = (y * w + x) * 4
      d[i] = d[i + 1] = d[i + 2] = v
      d[i + 3] = 255
    }
  const r = rgbaToAscii(d, w, h, { cols: 10, ramp, charAspect: 1 })
  const first = ramp.indexOf(r.cells[0][0].char)
  const last = ramp.indexOf(r.cells[0][9].char)
  ok(first < last, '漸層:左格梯度索引 < 右格(左深右淺)')
  ok(r.cells[0][0].char === '@', '漸層最左為最深 @')
  ok(r.cells[0][9].char === ' ', '漸層最右為空白')
}

// ---- 邊界:cols 過大不超過像素、cols<1 夾為 1 ----
res = rgbaToAscii(solid(3, 3, 0, 0, 0), 3, 3, { cols: 100, ramp, charAspect: 1 })
ok(res.cols === 100 && res.lines[0].length === 100, 'cols 大於寬度仍輸出該欄數(放大取樣)')
res = rgbaToAscii(solid(4, 4, 0, 0, 0), 4, 4, { cols: 0, ramp, charAspect: 1 })
ok(res.cols === 1, 'cols<1 夾為 1')

console.log(`\nasciiart: ${pass} 通過, ${fail} 失敗`)
process.exit(fail ? 1 : 0)
