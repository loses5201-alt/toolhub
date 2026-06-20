/*
  CSS 單位換算引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-cssunits.mjs
  oracle 以 CSS 規範 1in=96px、1pt=96/72px、1pc=16px、rem 依根字級、em/% 依脈絡字級手算為準。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `cssunits-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/cssUnits.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { pxPerUnit, toPx, fromPx, convertAll, round } = await import('file://' + out)

let fail = 0
function eq(note, got, want) {
  const g = JSON.stringify(got)
  const w = JSON.stringify(want)
  if (g !== w) {
    console.error(`✗ ${note}\n   got:  ${g}\n   want: ${w}`)
    fail++
  } else {
    console.log(`✓ ${note}`)
  }
}

// pxPerUnit
eq('px=1', pxPerUnit('px'), 1)
eq('in=96', pxPerUnit('in'), 96)
eq('pt=96/72', round(pxPerUnit('pt'), 6), round(96 / 72, 6))
eq('pc=16', pxPerUnit('pc'), 16)
eq('cm=96/2.54', round(pxPerUnit('cm'), 6), round(96 / 2.54, 6))
eq('mm=96/25.4', round(pxPerUnit('mm'), 6), round(96 / 25.4, 6))
eq('rem 依根字級 20', pxPerUnit('rem', 20), 20)
eq('em 依脈絡字級 24', pxPerUnit('em', 16, 24), 24)
eq('% 依脈絡字級', pxPerUnit('%', 16, 16), 0.16)
eq('未知單位 NaN', Number.isNaN(pxPerUnit('vw')), true)

// toPx / fromPx
eq('16px → 16px', toPx(16, 'px'), 16)
eq('1rem(root16) = 16px', toPx(1, 'rem', 16), 16)
eq('1.5rem(root16) = 24px', toPx(1.5, 'rem', 16), 24)
eq('12pt = 16px', round(toPx(12, 'pt'), 4), 16)
eq('1in = 96px', toPx(1, 'in'), 96)
eq('16px → 1rem(root16)', fromPx(16, 'rem', 16), 1)
eq('16px → 12pt', round(fromPx(16, 'pt'), 4), 12)
eq('96px → 2.54cm', round(fromPx(96, 'cm'), 4), 2.54)

// convertAll:24px,root=16,context=16
const r = convertAll(24, 'px', 16, 16)
eq('valid', r.valid, true)
eq('px=24', r.px, 24)
eq('24px → 1.5rem', round(r.values.find((v) => v.unit === 'rem').value, 4), 1.5)
eq('24px → 1.5em(context16)', round(r.values.find((v) => v.unit === 'em').value, 4), 1.5)
eq('24px → 18pt', round(r.values.find((v) => v.unit === 'pt').value, 4), 18)
eq('24px → 150%(context16)', round(r.values.find((v) => v.unit === '%').value, 4), 150)

// em 依脈絡:2em,context=20 → 40px
const r2 = convertAll(2, 'em', 16, 20)
eq('2em(context20) = 40px', r2.px, 40)
eq('40px → 2.5rem(root16)', round(r2.values.find((v) => v.unit === 'rem').value, 4), 2.5)

// 錯誤
eq('非數字報錯', convertAll(NaN, 'px').error, '請輸入數值')
eq('壞單位報錯', convertAll(1, 'vw').error.includes('不支援'), true)
eq('字級 0 報錯', convertAll(1, 'rem', 0).error, '字級需大於 0')

// round
eq('round 去零', round(1.50000, 4), 1.5)

if (fail) {
  console.error(`\n${fail} 個測試失敗`)
  process.exit(1)
}
console.log('\n全部通過 ✓')
