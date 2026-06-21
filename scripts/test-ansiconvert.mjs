/*
  ANSI 終端機色碼轉換引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-ansiconvert.mjs
  oracle:ECMA-48 SGR 定義、xterm 標準調色盤、xterm 256 色立方/灰階公式,
  以及手算的 strip / span 切分。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `ansi-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/ansiConvert.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { ANSI_16, color256, stripAnsi, ansiToSpans, ansiToHtml, escapeHtml, styleToCss } =
  await import(out)

const ESC = String.fromCharCode(27)
const BEL = String.fromCharCode(7)

let pass = 0
let fail = 0
function eq(name, got, want) {
  const g = JSON.stringify(got)
  const w = JSON.stringify(want)
  if (g === w) {
    pass++
  } else {
    fail++
    console.error(`✗ ${name}\n    got:  ${g}\n    want: ${w}`)
  }
}
function ok(name, cond) {
  if (cond) pass++
  else {
    fail++
    console.error(`✗ ${name}`)
  }
}

// ---- 調色盤常數 ----
eq('16 色長度', ANSI_16.length, 16)
eq('黑', ANSI_16[0], '#000000')
eq('紅', ANSI_16[1], '#cd0000')
eq('亮紅', ANSI_16[9], '#ff0000')
eq('白', ANSI_16[15], '#ffffff')

// ---- 256 色 ----
eq('256:0=標準黑', color256(0), '#000000')
eq('256:15=標準白', color256(15), '#ffffff')
eq('256:16=色立方原點', color256(16), '#000000')
eq('256:231=色立方頂點', color256(231), '#ffffff')
eq('256:21=純藍(0,0,255)', color256(21), '#0000ff') // 16 + 5 = b=5 → 255
eq('256:196=純紅', color256(196), '#ff0000') // 16+180 → r=5,g=0,b=0
eq('256:46=純綠', color256(46), '#00ff00') // 16+30 → g=5
eq('256:232=最暗灰 8', color256(232), '#080808')
eq('256:255=最亮灰 238', color256(255), '#eeeeee')
eq('256:夾鉗負數', color256(-5), '#000000')
eq('256:夾鉗超界', color256(999), '#eeeeee')

// ---- stripAnsi ----
eq('strip:紅字', stripAnsi(`${ESC}[31mhi${ESC}[0m`), 'hi')
eq('strip:無跳脫原樣', stripAnsi('plain text [keep] (this)'), 'plain text [keep] (this)')
eq('strip:多碼', stripAnsi(`${ESC}[1;32mOK${ESC}[0m done`), 'OK done')
eq('strip:清螢幕 CSI', stripAnsi(`${ESC}[2J${ESC}[Hhome`), 'home')
eq('strip:游標移動', stripAnsi(`a${ESC}[3Db`), 'ab')
eq('strip:OSC 標題(BEL 結尾)', stripAnsi(`${ESC}]0;my title${BEL}body`), 'body')
eq('strip:OSC(ST 結尾)', stripAnsi(`${ESC}]0;t${ESC}\\body`), 'body')
eq('strip:保留方括號文字', stripAnsi('array[0] = x'), 'array[0] = x')
eq('strip:256 色', stripAnsi(`${ESC}[38;5;196mR${ESC}[0m`), 'R')
eq('strip:真彩', stripAnsi(`${ESC}[38;2;10;20;30mX${ESC}[0m`), 'X')
// 跨整段、含換行
eq(
  'strip:多行 log',
  stripAnsi(`${ESC}[32m+ added${ESC}[0m\n${ESC}[31m- removed${ESC}[0m`),
  '+ added\n- removed',
)

// ---- ansiToSpans:基本顏色 ----
{
  const s = ansiToSpans(`pre${ESC}[31mred${ESC}[0mpost`)
  eq('span 切三段', s.length, 3)
  eq('span0 純文字', s[0], { text: 'pre', style: {} })
  eq('span1 紅字', s[1].text, 'red')
  eq('span1 fg', s[1].style.fg, '#cd0000')
  eq('span2 reset 後純文字', s[2], { text: 'post', style: {} })
}
// 合併同樣式
{
  const s = ansiToSpans(`${ESC}[1mA${ESC}[1mB`)
  eq('連續同樣式合併成一段', s.length, 1)
  eq('合併文字', s[0].text, 'AB')
  ok('合併後 bold', s[0].style.bold === true)
}
// 粗體 + 前景 + 背景
{
  const s = ansiToSpans(`${ESC}[1;31;42mx`)
  ok('bold', s[0].style.bold === true)
  eq('fg 紅', s[0].style.fg, '#cd0000')
  eq('bg 綠', s[0].style.bg, '#00cd00')
}
// 高亮前景 90-97 / 背景 100-107
{
  const s = ansiToSpans(`${ESC}[91;102mx`)
  eq('亮紅前景', s[0].style.fg, '#ff0000')
  eq('亮綠背景', s[0].style.bg, '#00ff00')
}
// 256 色前景 + 真彩背景
{
  const s = ansiToSpans(`${ESC}[38;5;46;48;2;1;2;3mx`)
  eq('256 前景純綠', s[0].style.fg, '#00ff00')
  eq('真彩背景', s[0].style.bg, '#010203')
}
// 關閉屬性:22 關粗體、39 還原預設前景
{
  const s = ansiToSpans(`${ESC}[1;31mA${ESC}[22mB${ESC}[39mC`)
  ok('A 粗體紅', s[0].style.bold && s[0].style.fg === '#cd0000')
  ok('B 關粗體仍紅', !s[1].style.bold && s[1].style.fg === '#cd0000')
  ok('C 關前景仍非粗體', s[2].style.fg === undefined && !s[2].style.bold)
}
// 空 SGR = reset
{
  const s = ansiToSpans(`${ESC}[31mA${ESC}[mB`)
  eq('ESC[m 視為 reset', s[1].style.fg, undefined)
}
// 下劃線 / 刪除線 / 斜體 / 反白
{
  const s = ansiToSpans(`${ESC}[3;4;9;7mx`)
  ok('italic', s[0].style.italic === true)
  ok('underline', s[0].style.underline === true)
  ok('strike', s[0].style.strike === true)
  ok('inverse', s[0].style.inverse === true)
}
// 無跳脫:單一純文字段
{
  const s = ansiToSpans('hello')
  eq('純文字一段', s.length, 1)
  eq('純文字內容', s[0], { text: 'hello', style: {} })
}

// ---- escapeHtml ----
eq('escape <', escapeHtml('<a>'), '&lt;a&gt;')
eq('escape & 與引號', escapeHtml('a & "b"'), 'a &amp; &quot;b&quot;')

// ---- styleToCss ----
eq('css 純前景', styleToCss({ fg: '#ff0000' }), 'color:#ff0000')
eq('css 粗體底線', styleToCss({ bold: true, underline: true }), 'font-weight:bold;text-decoration:underline')
eq(
  'css inverse 交換並補預設',
  styleToCss({ fg: '#111111' }, {}), // 無 inverse → 直接前景
  'color:#111111',
)
{
  // inverse 沒指定色時用預設前/背景對調
  const css = styleToCss({ inverse: true }, { defaultFg: '#eeeeee', defaultBg: '#222222' })
  ok('inverse 用預設對調', css.includes('color:#222222') && css.includes('background-color:#eeeeee'))
}
{
  const css = styleToCss({ fg: '#aabbcc', bg: '#112233', inverse: true })
  ok('inverse 交換明指色', css.includes('color:#112233') && css.includes('background-color:#aabbcc'))
}

// ---- ansiToHtml ----
eq('html 純文字不包 span', ansiToHtml('hi'), 'hi')
eq('html 跳脫 < 與無樣式', ansiToHtml('a<b>c'), 'a&lt;b&gt;c')
{
  const h = ansiToHtml(`${ESC}[31mred${ESC}[0m`)
  ok('html 紅字 span', h === '<span style="color:#cd0000">red</span>')
}
{
  const h = ansiToHtml(`x${ESC}[1;34mbold blue${ESC}[0my`)
  ok('html 前後純文字 + 中間 span', h.startsWith('x<span') && h.endsWith('span>y'))
  ok('html 含粗體與藍', h.includes('font-weight:bold') && h.includes('color:#0000ee'))
}
{
  // span 內文字要 HTML 跳脫
  const h = ansiToHtml(`${ESC}[31m<tag>${ESC}[0m`)
  ok('html span 內跳脫', h.includes('&lt;tag&gt;'))
}

// 往返健全性:strip 等於把 spans 文字接起來
{
  const sample = `${ESC}[1;31mError:${ESC}[0m something ${ESC}[33mwarn${ESC}[0m\nplain[0]`
  const joined = ansiToSpans(sample)
    .map((s) => s.text)
    .join('')
  eq('spans 文字接合 == strip', joined, stripAnsi(sample))
}

console.log(`\nANSI 轉換:${pass} 通過、${fail} 失敗`)
if (fail > 0) process.exit(1)
