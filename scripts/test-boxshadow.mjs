/*
  CSS box-shadow 產生引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-boxshadow.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `boxshadow-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/boxShadow.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { toCssColor, layerToCss, buildBoxShadow, buildCss, defaultLayer } = await import(
  'file://' + out
)

let fail = 0
function eq(note, got, want) {
  if (got === want) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}\n   got : ${JSON.stringify(got)}\n   want: ${JSON.stringify(want)}`)
  }
}

// --- toCssColor ---
eq('alpha=1 → #RRGGBB', toCssColor('#1e293b', 1), '#1e293b')
eq('alpha<1 → rgba', toCssColor('#1e293b', 0.25), 'rgba(30, 41, 59, 0.25)')
eq('無 # 前綴可解析', toCssColor('ff0000', 0.5), 'rgba(255, 0, 0, 0.5)')
eq('#RGB 短碼展開', toCssColor('#f00', 1), '#ff0000')
eq('#RGB 短碼 rgba', toCssColor('#fff', 0.8), 'rgba(255, 255, 255, 0.8)')
eq('大寫 hex 正規化為小寫', toCssColor('#AABBCC', 1), '#aabbcc')
eq('alpha 夾在 0–1(>1)', toCssColor('#000', 5), '#000000')
eq('alpha=0 → rgba a=0', toCssColor('#000000', 0), 'rgba(0, 0, 0, 0)')
eq('無效 hex 退回黑色', toCssColor('not-a-color', 0.5), 'rgba(0, 0, 0, 0.5)')

// --- layerToCss ---
const L = { x: 0, y: 8, blur: 24, spread: -4, hex: '#1e293b', alpha: 0.25, inset: false }
eq('外陰影完整片段', layerToCss(L), '0px 8px 24px -4px rgba(30, 41, 59, 0.25)')
eq('內陰影加 inset 前綴', layerToCss({ ...L, inset: true }), 'inset 0px 8px 24px -4px rgba(30, 41, 59, 0.25)')
eq('負位移', layerToCss({ ...L, x: -5, y: -10 }), '-5px -10px 24px -4px rgba(30, 41, 59, 0.25)')
eq('模糊不為負(夾 0)', layerToCss({ ...L, blur: -3 }), '0px 8px 0px -4px rgba(30, 41, 59, 0.25)')
eq('不透明度 1 用 hex', layerToCss({ ...L, alpha: 1 }), '0px 8px 24px -4px #1e293b')
eq('小數位移保留', layerToCss({ ...L, x: 1.5 }), '1.5px 8px 24px -4px rgba(30, 41, 59, 0.25)')

// --- buildBoxShadow ---
eq('空陣列 → none', buildBoxShadow([]), 'none')
eq('單層', buildBoxShadow([L]), '0px 8px 24px -4px rgba(30, 41, 59, 0.25)')
eq(
  '多層以逗號連接',
  buildBoxShadow([L, { ...L, y: 2, blur: 4, spread: 0, alpha: 0.1 }]),
  '0px 8px 24px -4px rgba(30, 41, 59, 0.25), 0px 2px 4px 0px rgba(30, 41, 59, 0.1)',
)

// --- buildCss ---
eq('完整宣告', buildCss([L]), 'box-shadow: 0px 8px 24px -4px rgba(30, 41, 59, 0.25);')
eq('空宣告為 none', buildCss([]), 'box-shadow: none;')

// --- defaultLayer ---
const d = defaultLayer()
eq('預設層為外陰影', d.inset, false)
eq('預設層 blur 非負', d.blur >= 0, true)
eq('預設層可組出字串', typeof layerToCss(d) === 'string' && layerToCss(d).includes('px'), true)

if (fail) {
  console.error(`\n${fail} 筆測試失敗`)
  process.exit(1)
}
console.log('\n全部通過')
