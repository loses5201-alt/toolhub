/*
  顏色對比引擎回歸測試(node 直接跑,esbuild 即時轉 TS)。
  執行:node scripts/test-contrast.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `contrast-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/contrast.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { parseColor, toHex, relativeLuminance, contrastRatio, grade } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}
const near = (a, b, eps = 0.01) => Math.abs(a - b) <= eps

// --- parseColor ---
check('#fff → 255,255,255', (() => { const c = parseColor('#fff'); return c.r === 255 && c.g === 255 && c.b === 255 })())
check('#000000 → 0,0,0', (() => { const c = parseColor('#000000'); return c.r === 0 && c.g === 0 && c.b === 0 })())
check('無 # 也可 (1f9a7e)', (() => { const c = parseColor('1f9a7e'); return c.r === 0x1f && c.g === 0x9a && c.b === 0x7e })())
check('rgb(18, 52, 86) 解析', (() => { const c = parseColor('rgb(18, 52, 86)'); return c.r === 18 && c.g === 52 && c.b === 86 })())
check('大小寫混合 #AbCdEf', (() => { const c = parseColor('#AbCdEf'); return c.r === 0xab && c.g === 0xcd && c.b === 0xef })())
check('非法字串回 null', parseColor('hello') === null)
check('rgb 超範圍回 null', parseColor('rgb(300,0,0)') === null)
check('長度不對回 null', parseColor('#12345') === null)

// --- toHex ---
check('toHex 補零並大寫', toHex({ r: 1, g: 2, b: 3 }) === '#010203')
check('toHex 夾限超界值', toHex({ r: 999, g: -5, b: 128 }) === '#FF0080')

// --- relativeLuminance 端點 ---
check('白亮度 = 1', near(relativeLuminance({ r: 255, g: 255, b: 255 }), 1))
check('黑亮度 = 0', near(relativeLuminance({ r: 0, g: 0, b: 0 }), 0))

// --- contrastRatio ---
const W = { r: 255, g: 255, b: 255 }
const K = { r: 0, g: 0, b: 0 }
check('黑白對比 = 21', near(contrastRatio(W, K), 21, 0.05))
check('同色對比 = 1', near(contrastRatio(W, W), 1, 0.001))
check('順序無關', near(contrastRatio(W, K), contrastRatio(K, W), 0.0001))

// #767676 在白底約 4.54(通過一般字 AA);#777777 約 4.48(未過)—— WCAG 常被引用的臨界
check('#767676/白 >= 4.5(過 AA)', contrastRatio(parseColor('#767676'), W) >= 4.5)
check('#777777/白 < 4.5(未過 AA)', contrastRatio(parseColor('#777777'), W) < 4.5)

// --- grade ---
let g = grade(K, W)
check('黑白:一般字 AAA 通過', g.normalAA && g.normalAAA && g.largeAA && g.largeAAA && g.uiAA)
check('黑白 ratio 四捨五入兩位', g.ratio === 21)

g = grade(parseColor('#a8a8a8'), W) // 約 2.38:一般字與大字皆不過
check('淺灰/白:一般字與大字皆不過', !g.normalAA && !g.largeAA && !g.uiAA)

// 對比約 3.x:過大字 AA / UI,但不過一般字 AA
g = grade(parseColor('#8a8a8a'), W)
check('中灰/白:大字 AA 與 UI 過、一般字 AA 不過', g.largeAA && g.uiAA && !g.normalAA)

// 對比 4.5~7 之間:過一般字 AA 與大字 AAA,但不過一般字 AAA
g = grade(parseColor('#717171'), W)
check('深灰/白:一般字 AA 過、一般字 AAA 不過', g.normalAA && !g.normalAAA && g.largeAAA)

if (fail) {
  console.error(`\n${fail} 項失敗`)
  process.exit(1)
}
console.log('\n顏色對比引擎全部通過')
