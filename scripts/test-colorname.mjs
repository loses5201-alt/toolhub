/*
  CSS 命名顏色查詢引擎回歸測試(node 直接跑)。
  執行:node scripts/test-colorname.mjs
  oracle:CSS Color Module Level 4 標準命名色的已知 HEX、HSL 轉換手算值、redmean 距離定義。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `colorname-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/colorName.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { CSS_COLORS, parseColor, rgbToHex, rgbToHsl, colorDistance, nearestNamed, describeColor } =
  await import('file://' + out)

let fail = 0
let pass = 0
function ok(c, msg) {
  if (c) pass++
  else {
    fail++
    console.error('✗ FAIL:', msg)
  }
}
function eq(got, want, msg) {
  ok(JSON.stringify(got) === JSON.stringify(want), `${msg}（got ${JSON.stringify(got)}, want ${JSON.stringify(want)}）`)
}

// ---- 資料表完整性 ----
ok(Object.keys(CSS_COLORS).length >= 145, `命名色數量充足（${Object.keys(CSS_COLORS).length}）`)
eq(CSS_COLORS.red, '#ff0000', 'red')
eq(CSS_COLORS.rebeccapurple, '#663399', 'rebeccapurple')
eq(CSS_COLORS.cornflowerblue, '#6495ed', 'cornflowerblue')
eq(CSS_COLORS.rebeccapurple, '#663399', 'rebeccapurple 存在')
ok(CSS_COLORS.gray === CSS_COLORS.grey, 'gray = grey 同義')

// ---- parseColor ----
eq(parseColor('#ff0000'), { r: 255, g: 0, b: 0, a: 1 }, '#ff0000')
eq(parseColor('#f00'), { r: 255, g: 0, b: 0, a: 1 }, '短碼 #f00')
eq(parseColor('#FF0000'), { r: 255, g: 0, b: 0, a: 1 }, '大寫 HEX')
eq(parseColor('teal'), { r: 0, g: 128, b: 128, a: 1 }, '命名色 teal')
eq(parseColor('rgb(52, 152, 219)'), { r: 52, g: 152, b: 219, a: 1 }, 'rgb()')
eq(parseColor('rgba(0,0,0,0.5)'), { r: 0, g: 0, b: 0, a: 0.5 }, 'rgba() 帶 alpha')
eq(parseColor('#00000080').a, 0.502, '8 位 HEX alpha')
eq(parseColor('hsl(0, 100%, 50%)'), { r: 255, g: 0, b: 0, a: 1 }, 'hsl 紅')
eq(parseColor('hsl(120, 100%, 50%)'), { r: 0, g: 255, b: 0, a: 1 }, 'hsl 綠')
eq(parseColor('hsl(240, 100%, 50%)'), { r: 0, g: 0, b: 255, a: 1 }, 'hsl 藍')
eq(parseColor('hsl(0, 0%, 100%)'), { r: 255, g: 255, b: 255, a: 1 }, 'hsl 白')
ok(parseColor('not a color') === null, '無效輸入 → null')
ok(parseColor('') === null, '空字串 → null')
ok(parseColor('rgb(1,2)') === null, 'rgb 參數不足 → null')

// ---- 往返 / HSL ----
eq(rgbToHex({ r: 100, g: 149, b: 237, a: 1 }), '#6495ed', 'rgbToHex cornflowerblue')
eq(rgbToHsl({ r: 255, g: 0, b: 0, a: 1 }), { h: 0, s: 100, l: 50 }, 'rgbToHsl 紅')
eq(rgbToHsl({ r: 128, g: 128, b: 128, a: 1 }), { h: 0, s: 0, l: 50 }, 'rgbToHsl 灰(無彩度)')

// ---- 距離 ----
ok(colorDistance({ r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 }) === 0, '同色距離 0')
ok(colorDistance({ r: 255, g: 0, b: 0 }, { r: 254, g: 0, b: 0 }) < colorDistance({ r: 255, g: 0, b: 0 }, { r: 0, g: 0, b: 255 }), '近色距離 < 遠色')

// ---- nearestNamed / exact ----
ok(nearestNamed({ r: 255, g: 0, b: 0 })[0].name === 'red' && nearestNamed({ r: 255, g: 0, b: 0 })[0].distance === 0, '正紅 → red(距離 0)')
ok(nearestNamed({ r: 254, g: 1, b: 1 })[0].name === 'red', '接近紅 → 最近是 red')
ok(nearestNamed({ r: 100, g: 149, b: 237 })[0].name === 'cornflowerblue', 'cornflowerblue 精確命中')
ok(nearestNamed({ r: 0, g: 0, b: 0 }).length === 8, '預設回 8 筆')
// 同 hex 的同義名只保留一個(cyan/aqua 同為 #00ffff)
{
  const names = nearestNamed({ r: 0, g: 255, b: 255 }).map((n) => n.name)
  ok(!(names.includes('cyan') && names.includes('aqua')), '同義同色名不重複出現')
}

// ---- describeColor ----
{
  const d = describeColor('#ff0000')
  ok(d.ok && d.hex === '#ff0000' && d.exactName === 'red' && d.rgbString === 'rgb(255, 0, 0)', 'describe #ff0000')
}
{
  const d = describeColor('rgba(0,0,0,0.5)')
  ok(d.ok && d.rgbString === 'rgba(0, 0, 0, 0.5)' && d.hslString === 'hsla(0, 0%, 0%, 0.5)', 'describe 帶 alpha 輸出 rgba/hsla')
}
{
  const d = describeColor('#6495ee')
  ok(d.ok && !d.exactName && d.nearest[0].name === 'cornflowerblue', '非標準色:無 exactName,最近為 cornflowerblue')
}
ok(!describeColor('xyz').ok, 'describe 無效輸入失敗')

console.log(`\nCSS 命名顏色:${pass} 通過${fail ? `,${fail} 失敗` : ''}`)
if (fail) process.exit(1)
