/*
  CSS cubic-bezier 緩動曲線引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-cubicbezier.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `cubicbezier-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/cubicBezier.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const {
  makeEasing,
  easeAt,
  sampleCurve,
  hasOvershoot,
  toBezierString,
  buildTransitionCss,
  parseBezier,
  PRESETS,
} = await import('file://' + out)

let fail = 0
function eq(note, got, want) {
  if (got === want) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}\n   got : ${JSON.stringify(got)}\n   want: ${JSON.stringify(want)}`)
  }
}
function near(note, got, want, eps = 1e-4) {
  if (Math.abs(got - want) <= eps) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}\n   got : ${got}\n   want: ~${want}`)
  }
}
function ok(note, cond) {
  eq(note, !!cond, true)
}

// --- linear:cubic-bezier(0,0,1,1) 必須 y === x ---
const linear = { x1: 0, y1: 0, x2: 1, y2: 1 }
for (const x of [0, 0.1, 0.25, 0.5, 0.73, 0.9, 1]) {
  near(`linear easeAt(${x}) = ${x}`, easeAt(linear, x), x)
}

// --- 所有範本:端點固定 0/1 ---
for (const p of PRESETS) {
  near(`${p.label} 端點 x=0 → 0`, easeAt(p.params, 0), 0)
  near(`${p.label} 端點 x=1 → 1`, easeAt(p.params, 1), 1)
}

// --- ease-in 慢起步:x=0.5 的 y 應 < 0.5 ---
const easeIn = { x1: 0.42, y1: 0, x2: 1, y2: 1 }
ok('ease-in 在 0.5 處低於對角線', easeAt(easeIn, 0.5) < 0.5)
// --- ease-out 快起步:x=0.5 的 y 應 > 0.5 ---
const easeOut = { x1: 0, y1: 0, x2: 0.58, y2: 1 }
ok('ease-out 在 0.5 處高於對角線', easeAt(easeOut, 0.5) > 0.5)

// --- ease-in-out 點對稱:easeAt(x) + easeAt(1-x) = 1 ---
const eio = { x1: 0.42, y1: 0, x2: 0.58, y2: 1 }
for (const x of [0.1, 0.3, 0.5, 0.65, 0.88]) {
  near(`ease-in-out 點對稱 @${x}`, easeAt(eio, x) + easeAt(eio, 1 - x), 1, 1e-3)
}

// --- 單調遞增(x1,x2 在 [0,1] 保證 y 隨 x 不遞減)---
const ease = { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 }
let prev = -1
let mono = true
for (let i = 0; i <= 20; i++) {
  const y = easeAt(ease, i / 20)
  if (y < prev - 1e-6) mono = false
  prev = y
}
ok('ease 對 x 單調遞增', mono)

// --- 過衝偵測 ---
ok('回彈過衝偵測為真', hasOvershoot({ x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 }))
ok('y 低於 0 也算過衝', hasOvershoot({ x1: 0.68, y1: -0.55, x2: 0.27, y2: 1 }))
ok('一般曲線無過衝', !hasOvershoot(ease))

// --- x 夾在 [0,1];y 不限 ---
eq('x1 超界夾到 1', toBezierString({ x1: 2, y1: 0, x2: 0.5, y2: 1 }), 'cubic-bezier(1, 0, 0.5, 1)')
eq('x2 負值夾到 0', toBezierString({ x1: 0.5, y1: 0, x2: -3, y2: 1 }), 'cubic-bezier(0.5, 0, 0, 1)')
eq(
  'y 允許超界',
  toBezierString({ x1: 0.34, y1: 1.56, x2: 0.64, y2: -0.2 }),
  'cubic-bezier(0.34, 1.56, 0.64, -0.2)',
)
eq('小數四捨五入到 3 位', toBezierString({ x1: 0.123456, y1: 0.1, x2: 0.25, y2: 1 }), 'cubic-bezier(0.123, 0.1, 0.25, 1)')

// --- transition CSS ---
eq('transition 預設', buildTransitionCss({ x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 }), 'transition: all 0.6s cubic-bezier(0.25, 0.1, 0.25, 1);')
eq('transition 指定屬性與時間', buildTransitionCss({ x1: 0, y1: 0, x2: 1, y2: 1 }, 'transform', 300), 'transition: transform 0.3s cubic-bezier(0, 0, 1, 1);')

// --- parseBezier ---
eq('解析 cubic-bezier(...) ', JSON.stringify(parseBezier('cubic-bezier(0.25, 0.1, 0.25, 1)')), JSON.stringify({ x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 }))
eq('解析裸數字', JSON.stringify(parseBezier('0, 0, 1, 1')), JSON.stringify({ x1: 0, y1: 0, x2: 1, y2: 1 }))
eq('解析負值與大於一', JSON.stringify(parseBezier('cubic-bezier(.68,-0.55,.27,1.55)')), JSON.stringify({ x1: 0.68, y1: -0.55, x2: 0.27, y2: 1.55 }))
eq('參數不足回 null', parseBezier('0,0,1'), null)
eq('含非數字回 null', parseBezier('a,b,c,d'), null)
eq('空字串回 null', parseBezier(''), null)

// --- sampleCurve ---
const pts = sampleCurve(ease, 10)
eq('取樣點數 = steps+1', pts.length, 11)
near('取樣首點 x=0', pts[0].x, 0)
near('取樣末點 x=1', pts[pts.length - 1].x, 1)
near('取樣首點 y=0', pts[0].y, 0)
near('取樣末點 y=1', pts[pts.length - 1].y, 1)

// --- 防呆:非有限輸入 ---
near('NaN 進度視為 0', easeAt(linear, NaN), 0)
near('x>1 夾到 1', easeAt(linear, 2), 1)
near('x<0 夾到 0', easeAt(linear, -1), 0)

// --- makeEasing 可重複呼叫 ---
const fn = makeEasing(ease)
ok('makeEasing 回傳函式', typeof fn === 'function')
near('makeEasing(0.5) 與 easeAt 一致', fn(0.5), easeAt(ease, 0.5))

if (fail) {
  console.error(`\n${fail} 個測試未通過`)
  process.exit(1)
} else {
  console.log('\n全部 cubic-bezier 測試通過')
}
