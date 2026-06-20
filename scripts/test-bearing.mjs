/*
  方位角 / 羅盤方位引擎回歸測試(node 直接跑)。
  執行:node scripts/test-bearing.mjs
  oracle:
   1) 幾何事實:從 (0,0) 往正北/東/南/西的點,起始方位角 = 0/90/180/270;
      往 (1,1) ≈ 45°(赤道附近)。
   2) compassPoint:0→N、90→E、180→S、270→W、45→NE、22.5→NNE;4/8/16 方位分級。
   3) finalBearing 與 initialBearing 的關係、backBearing = +180、normalize 環繞。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `bearing-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/bearing.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const {
  initialBearing,
  finalBearing,
  backBearing,
  normalizeBearing,
  compassPoint,
  computeBearing,
  distance,
} = await import('file://' + out)

let pass = 0
let fail = 0
function ok(name, cond) {
  if (cond) pass++
  else {
    fail++
    console.error('✗', name)
  }
}
const near = (a, b, eps = 0.05) => Math.abs(a - b) <= eps

// 1) 主要方向
ok('北:(0,0)->(1,0) = 0°', near(initialBearing(0, 0, 1, 0), 0))
ok('東:(0,0)->(0,1) = 90°', near(initialBearing(0, 0, 0, 1), 90))
ok('南:(0,0)->(-1,0) = 180°', near(initialBearing(0, 0, -1, 0), 180))
ok('西:(0,0)->(0,-1) = 270°', near(initialBearing(0, 0, 0, -1), 270))
ok('東北:(0,0)->(1,1) ≈ 45°', near(initialBearing(0, 0, 1, 1), 45, 0.1))

// 2) normalize / back
ok('normalize -90 = 270', normalizeBearing(-90) === 270)
ok('normalize 450 = 90', normalizeBearing(450) === 90)
ok('back 90 = 270', backBearing(90) === 270)
ok('back 200 = 20', backBearing(200) === 20)

// 3) compass
ok('compass 0 = N/北', (() => { const c = compassPoint(0); return c.abbr === 'N' && c.zh === '北' })())
ok('compass 90 = E/東', compassPoint(90).abbr === 'E')
ok('compass 180 = S/南', compassPoint(180).abbr === 'S')
ok('compass 270 = W/西', compassPoint(270).abbr === 'W')
ok('compass 45 = NE/東北', compassPoint(45).abbr === 'NE')
ok('compass 22.5 = NNE', compassPoint(22.5, 3).abbr === 'NNE')
ok('compass 359 環繞回 N', compassPoint(359).abbr === 'N')
// 精度分級
ok('4 方位:44° 取最近的 N(0°)', compassPoint(44, 1).abbr === 'N')
ok('4 方位:46° 取最近的 E(90°)', compassPoint(46, 1).abbr === 'E')
ok('8 方位:45° = NE', compassPoint(45, 2).abbr === 'NE')
ok('8 方位:22° 不會是 NNE(歸到 N)', compassPoint(22, 2).abbr === 'N')

// final bearing:沿經線南北走,起始與到達相同(都是正北/正南)
ok('經線上 final = initial', near(finalBearing(0, 0, 10, 0), 0))
// 一般情況 final 與 initial 不同(跨經度)
ok('跨經度 final ≠ initial', Math.abs(finalBearing(10, 0, 10, 80) - initialBearing(10, 0, 10, 80)) > 1)

// distance 與 computeBearing
ok('距離為正', distance(25.03, 121.56, 35.68, 139.77) > 2_000_000)
const r = computeBearing(25.0339, 121.5645, 35.6586, 139.7454) // 台北101 -> 東京鐵塔
ok('台北->東京 方位偏東北(0–90°)', r.initial > 0 && r.initial < 90)
ok('computeBearing 欄位齊全', r.compass && typeof r.distanceM === 'number' && typeof r.back === 'number')

console.log(`\n方位角:${pass} 通過,${fail} 失敗`)
if (fail) process.exit(1)
