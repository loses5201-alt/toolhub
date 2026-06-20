// 圖片差異比對回歸測試
import { execSync } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'imagediff-'))
const entry = join(dir, 'entry.mjs')
const src = join(process.cwd(), 'src/features/imageDiff.ts').replace(/\\/g, '\\\\')
writeFileSync(entry, `export { colorDelta, diffImages } from '${src}'`)
const outFile = join(dir, 'bundle.mjs')
execSync(`npx esbuild ${entry} --bundle --format=esm --platform=node --outfile=${outFile}`, {
  stdio: ['ignore', 'ignore', 'inherit'],
})
const { colorDelta, diffImages } = await import('file://' + outFile)

let pass = 0
let fail = 0
function ok(cond, msg) {
  if (cond) pass++
  else {
    fail++
    console.error('✗', msg)
  }
}

// 用 [r,g,b,a,...] 建像素陣列
function px(...colors) {
  const arr = []
  for (const c of colors) arr.push(c[0], c[1], c[2], c.length > 3 ? c[3] : 255)
  return arr
}
const BLACK = [0, 0, 0]
const WHITE = [255, 255, 255]
const RED = [255, 0, 0]

// ── colorDelta ──
ok(colorDelta(px(RED), px(RED), 0, 0) === 0, '相同色色差=0')
ok(colorDelta(px(BLACK), px(BLACK), 0, 0) === 0, '黑對黑=0')
const dBW = colorDelta(px(BLACK), px(WHITE), 0, 0)
ok(dBW > 30000 && dBW <= 35215, '黑↔白色差很大(≈32857,不超過上限 35215)')
ok(colorDelta(px(BLACK), px([10, 10, 10]), 0, 0) > 0, '微小差異 > 0')
ok(
  colorDelta(px(BLACK), px(WHITE), 0, 0) > colorDelta(px(BLACK), px([128, 128, 128]), 0, 0),
  '差越大色差越大',
)
// 全透明像素疊白底 → 兩個全透明應相等(都成白)
ok(colorDelta(px([0, 0, 0, 0]), px([255, 255, 255, 0]), 0, 0) < 1, '全透明疊白底後相等')

// ── diffImages:完全相同 ──
const same = diffImages(px(RED, BLACK, WHITE, RED), px(RED, BLACK, WHITE, RED), 2, 2)
ok(same.changed === 0, '相同圖 changed=0')
ok(same.total === 4 && same.ratio === 0, 'total 與 ratio')
ok(same.output.length === 16, 'output 長度 = 像素*4')
// 未變動處被淡化為灰階(預設 dim),且 alpha=255
ok(same.output[3] === 255 && same.output[0] === same.output[1] && same.output[1] === same.output[2], '未變動處為灰階')

// ── 一個像素不同 ──
const oneDiff = diffImages(px(RED, BLACK, WHITE, RED), px(RED, BLACK, WHITE, BLACK), 2, 2)
ok(oneDiff.changed === 1, '一像素不同 changed=1')
ok(Math.abs(oneDiff.ratio - 0.25) < 1e-9, 'ratio=0.25')
// 第 4 個像素(index3,pos12)應被標成紅色
ok(oneDiff.output[12] === 255 && oneDiff.output[13] === 0 && oneDiff.output[14] === 0, '差異處標紅')

// ── 自訂差異色 ──
const custom = diffImages(px(BLACK), px(WHITE), 1, 1, { diffColor: [0, 255, 0] })
ok(custom.output[0] === 0 && custom.output[1] === 255 && custom.output[2] === 0, '自訂差異色(綠)')

// ── dimUnchanged=false 保留原圖 ──
const nodim = diffImages(px(RED, RED), px(RED, RED), 2, 1, { dimUnchanged: false })
ok(nodim.output[0] === 255 && nodim.output[1] === 0 && nodim.output[2] === 0, '不淡化時保留原色')

// ── threshold:寬容度 ──
// 灰階接近的兩色,低門檻算差異、高門檻容忍
const a = px([100, 100, 100])
const b = px([130, 130, 130])
const strict = diffImages(a, b, 1, 1, { threshold: 0.01 })
const loose = diffImages(a, b, 1, 1, { threshold: 1 })
ok(strict.changed === 1, '嚴格門檻:視為不同')
ok(loose.changed === 0, '寬鬆門檻:容忍小差異')

// ── 邊界:空圖 ──
const empty = diffImages([], [], 0, 0)
ok(empty.changed === 0 && empty.total === 0 && empty.ratio === 0, '空圖')

// ── 大圖一致性:隨機相同兩圖 changed=0 ──
const n = 50
const big = []
for (let i = 0; i < n * 4; i++) big.push((i * 37) % 256)
const bigDiff = diffImages(big, big.slice(), n, 1)
ok(bigDiff.changed === 0, '相同大圖 changed=0')

console.log(`imagediff: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
