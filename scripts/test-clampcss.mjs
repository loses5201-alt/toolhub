/*
  CSS clamp() 流體尺寸引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-clampcss.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `clampcss-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/clampCss.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { fmt, pxToRem, buildClamp, resolveAt } = await import('file://' + out)

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

// --- fmt ---
eq('fmt 整數去尾零', fmt(1.0), '1')
eq('fmt 保留有效小數', fmt(1.5), '1.5')
eq('fmt 四捨五入到 4 位', fmt(0.8333333), '0.8333')
eq('fmt 去除 -0', fmt(-0), '0')
eq('fmt 非有限回 0', fmt(NaN), '0')

// --- pxToRem ---
near('16px = 1rem', pxToRem(16), 1)
near('24px = 1.5rem', pxToRem(24), 1.5)
near('自訂 root 20', pxToRem(30, 20), 1.5)

// --- 經典範例:16px@320 → 24px@1280,root 16 ---
const classic = { minViewport: 320, maxViewport: 1280, minSize: 16, maxSize: 24 }
const r = buildClamp(classic)
eq('經典 clamp 字串', r.css, 'clamp(1rem, 0.8333rem + 0.8333vw, 1.5rem)')
eq('經典 declaration', r.declaration, 'font-size: clamp(1rem, 0.8333rem + 0.8333vw, 1.5rem);')
near('slopeVw ≈ 0.8333', r.slopeVw, 0.83333, 1e-4)
eq('經典無警告', r.warnings.length, 0)

// --- resolveAt 在兩端與中點應與設計值吻合 ---
near('resolveAt 小端 = 16', resolveAt(classic, 320), 16)
near('resolveAt 大端 = 24', resolveAt(classic, 1280), 24)
near('resolveAt 中點 = 20', resolveAt(classic, 800), 20)
near('resolveAt 超出小端被夾住', resolveAt(classic, 100), 16)
near('resolveAt 超出大端被夾住', resolveAt(classic, 2000), 24)

// --- px 單位輸出 ---
const rpx = buildClamp({ ...classic, unit: 'px' })
eq('px 單位 clamp', rpx.css, 'clamp(16px, 13.3333px + 0.8333vw, 24px)')

// --- 自訂 root 字級 ---
const rroot = buildClamp({ minViewport: 320, maxViewport: 1280, minSize: 20, maxSize: 40, rootFontSize: 20 })
// slope = 20/960 = 0.020833..., intercept = 20 - 0.020833*320 = 13.3333px → /20 = 0.6667rem
// slopeVw = 2.0833, min=1rem max=2rem
eq('自訂 root clamp', rroot.css, 'clamp(1rem, 0.6667rem + 2.0833vw, 2rem)')

// --- 截距為 0 時省略(min 0 @ 0 設計很少見,造個 intercept=0)---
// minSize=0 @ minViewport=0, maxSize=10 @ maxViewport=1000: slope=0.01, intercept=0
const rzero = buildClamp({ minViewport: 0, maxViewport: 1000, minSize: 0, maxSize: 16 })
eq('截距為 0 省略只留 vw', rzero.css, 'clamp(0rem, 1.6vw, 1rem)')

// --- 兩寬度相同 → 警告 + 退化 ---
const rsame = buildClamp({ minViewport: 768, maxViewport: 768, minSize: 16, maxSize: 24 })
eq('同寬度有警告', rsame.warnings.length >= 1, true)
eq('同寬度退化 clamp', rsame.css, 'clamp(1rem, 1rem, 1.5rem)')

// --- minSize > maxSize:警告 + 兩端自動排序確保 min<=max ---
const rdesc = buildClamp({ minViewport: 320, maxViewport: 1280, minSize: 24, maxSize: 16 })
eq('遞減有警告', rdesc.warnings.some((w) => w.includes('縮小')), true)
eq('遞減仍 min<=max', rdesc.css.startsWith('clamp(1rem,'), true)
eq('遞減大端為 1.5rem', rdesc.css.endsWith('1.5rem)'), true)

// --- 視窗寬度顛倒 → 警告 ---
const rrev = buildClamp({ minViewport: 1280, maxViewport: 320, minSize: 16, maxSize: 24 })
eq('寬度顛倒有警告', rrev.warnings.some((w) => w.includes('對調')), true)

if (fail) {
  console.error(`\n${fail} 個測試未通過`)
  process.exit(1)
} else {
  console.log('\n全部 clamp 測試通過')
}
