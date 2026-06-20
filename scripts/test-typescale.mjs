/*
  字級比例(Type Scale)引擎回歸測試(node 直接跑)。
  執行:node scripts/test-typescale.mjs
  oracle(等比數列手算):
   1) base 16、ratio 1.25:step0=16、step1=20、step2=25、step-1=12.8;rem = px/16。
   2) ratio^0 = 1(基準階等於 base);排序由大到小;階數正確。
   3) toCss 命名(base / n 負號)與單位;錯誤輸入丟例外。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `typescale-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/typeScale.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { generateScale, toCss, RATIOS } = await import('file://' + out)

let pass = 0
let fail = 0
function ok(name, cond) {
  if (cond) pass++
  else {
    fail++
    console.error('✗', name)
  }
}

const scale = generateScale({ base: 16, ratio: 1.25, stepsUp: 2, stepsDown: 1 })
// 由大到小:step 2,1,0,-1
ok('階數順序 2,1,0,-1', scale.map((s) => s.step).join(',') === '2,1,0,-1')
const byStep = Object.fromEntries(scale.map((s) => [s.step, s]))
ok('step0 = 16px(基準)', byStep[0].px === 16)
ok('step1 = 20px', byStep[1].px === 20)
ok('step2 = 25px', byStep[2].px === 25)
ok('step-1 = 12.8px', byStep[-1].px === 12.8)
ok('step0 rem = 1', byStep[0].rem === 1)
ok('step1 rem = 1.25', byStep[1].rem === 1.25)
ok('step2 rem = 1.563(預設 3 位)', byStep[2].rem === 1.563)
ok('step2 rem 高精度 = 1.5625', generateScale({ base: 16, ratio: 1.25, stepsUp: 2, stepsDown: 0, round: 4 }).find((s) => s.step === 2).rem === 1.5625)

// ratio^0 = base 不論比例
ok('黃金比例 step0 = base', generateScale({ base: 18, ratio: 1.618, stepsUp: 0, stepsDown: 0 })[0].px === 18)

// 自訂 root
const r10 = generateScale({ base: 20, ratio: 1.5, stepsUp: 1, stepsDown: 0, rootPx: 10 })
ok('rootPx=10 時 base rem = 2', r10.find((s) => s.step === 0).rem === 2)
ok('rootPx=10 時 step1 = 30px / 3rem', (() => { const s = r10.find((x) => x.step === 1); return s.px === 30 && s.rem === 3 })())

// 只有基準階
const single = generateScale({ base: 16, ratio: 1.2, stepsUp: 0, stepsDown: 0 })
ok('0 階只有 1 列', single.length === 1 && single[0].step === 0)

// round 控制
const r2 = generateScale({ base: 16, ratio: 1.333, stepsUp: 1, stepsDown: 0, round: 2 })
ok('round=2 位', r2.find((s) => s.step === 1).px === 21.33)

// 錯誤
ok('base 0 丟例外', (() => { try { generateScale({ base: 0, ratio: 1.2, stepsUp: 1, stepsDown: 1 }); return false } catch { return true } })())
ok('ratio 0 丟例外', (() => { try { generateScale({ base: 16, ratio: 0, stepsUp: 1, stepsDown: 1 }); return false } catch { return true } })())

// toCss
const css = toCss(scale, { unit: 'rem' })
ok('CSS 含 :root', css.includes(':root {'))
ok('CSS base 命名', css.includes('--font-size-base: 1rem;'))
ok('CSS 正階命名', css.includes('--font-size-1: 1.25rem;'))
ok('CSS 負階命名 n1', css.includes('--font-size-n1: 0.8rem;'))
const cssPx = toCss(scale, { unit: 'px', prefix: 'fs' })
ok('CSS px 單位 + 前綴', cssPx.includes('--fs-1: 20px;'))

// RATIOS 表
ok('RATIOS 含黃金比例', RATIOS.some((r) => r.key === 'golden' && Math.abs(r.value - 1.618) < 1e-9))
ok('RATIOS 由小到大', (() => { for (let i = 1; i < RATIOS.length; i++) if (RATIOS[i].value <= RATIOS[i - 1].value) return false; return true })())

console.log(`\n字級比例:${pass} 通過,${fail} 失敗`)
if (fail) process.exit(1)
