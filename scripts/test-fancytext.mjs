/*
  Unicode 花式字引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-fancytext.mjs
  oracle:Unicode 數學字母符號區塊的標準碼位偏移,以及被挪到 Letterlike
  Symbols 的保留字母(如雙線體 C=ℂ U+2102、花體 e=ℯ U+212F、斜體 h=ℎ U+210E)。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `fancy-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/fancyText.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { ALPHA_STYLES, styleText, combineText, spaceOut, flipText, allVariants } = await import(out)

let pass = 0
let fail = 0
function eq(name, got, want) {
  if (got === want) pass++
  else {
    fail++
    console.error(`✗ ${name}\n    got:  ${JSON.stringify(got)}\n    want: ${JSON.stringify(want)}`)
  }
}
function ok(name, cond) {
  if (cond) pass++
  else {
    fail++
    console.error(`✗ ${name}`)
  }
}
const style = (id) => ALPHA_STYLES.find((s) => s.id === id)
// 取字串第一個字元的碼位(處理 astral)
const cp = (s) => s.codePointAt(0)

// ---- 數學粗體(連續,含數字)----
eq('粗體 A = U+1D400', cp(styleText('A', style('bold'))), 0x1d400)
eq('粗體 Z = U+1D419', cp(styleText('Z', style('bold'))), 0x1d419)
eq('粗體 a = U+1D41A', cp(styleText('a', style('bold'))), 0x1d41a)
eq('粗體 z = U+1D433', cp(styleText('z', style('bold'))), 0x1d433)
eq('粗體 0 = U+1D7CE', cp(styleText('0', style('bold'))), 0x1d7ce)
eq('粗體 5 = U+1D7D3', cp(styleText('5', style('bold'))), 0x1d7d3)
eq('粗體保留非英數', styleText('A! B', style('bold')).length > 0, true)
eq('粗體不動空白與符號', styleText('a-b', style('bold')).slice(2, 3), '-')

// ---- 斜體 h 例外 ----
eq('斜體 a = U+1D44E', cp(styleText('a', style('italic'))), 0x1d44e)
eq('斜體 h = U+210E(保留)', cp(styleText('h', style('italic'))), 0x210e)
eq('斜體 A = U+1D434', cp(styleText('A', style('italic'))), 0x1d434)

// ---- 花體保留字母 ----
eq('花體 A = U+1D49C', cp(styleText('A', style('script'))), 0x1d49c)
eq('花體 B = ℬ U+212C', cp(styleText('B', style('script'))), 0x212c)
eq('花體 e = ℯ U+212F', cp(styleText('e', style('script'))), 0x212f)
eq('花體 H = ℋ U+210B', cp(styleText('H', style('script'))), 0x210b)
eq('花體 a = U+1D4B6', cp(styleText('a', style('script'))), 0x1d4b6)

// ---- 哥德體保留字母 ----
eq('哥德 C = ℭ U+212D', cp(styleText('C', style('fraktur'))), 0x212d)
eq('哥德 H = ℌ U+210C', cp(styleText('H', style('fraktur'))), 0x210c)
eq('哥德 R = ℜ U+211C', cp(styleText('R', style('fraktur'))), 0x211c)
eq('哥德 A = U+1D504', cp(styleText('A', style('fraktur'))), 0x1d504)

// ---- 雙線體保留字母與數字 ----
eq('雙線 C = ℂ U+2102', cp(styleText('C', style('double-struck'))), 0x2102)
eq('雙線 H = ℍ U+210D', cp(styleText('H', style('double-struck'))), 0x210d)
eq('雙線 R = ℝ U+211D', cp(styleText('R', style('double-struck'))), 0x211d)
eq('雙線 N = ℕ U+2115', cp(styleText('N', style('double-struck'))), 0x2115)
eq('雙線 A = U+1D538', cp(styleText('A', style('double-struck'))), 0x1d538)
eq('雙線 1 = U+1D7D9', cp(styleText('1', style('double-struck'))), 0x1d7d9)

// ---- 無襯線 / 等寬 數字 ----
eq('無襯線 0 = U+1D7E2', cp(styleText('0', style('sans'))), 0x1d7e2)
eq('等寬 A = U+1D670', cp(styleText('A', style('monospace'))), 0x1d670)
eq('等寬 9 = U+1D7FF', cp(styleText('9', style('monospace'))), 0x1d7ff)

// ---- 圈圈字(不連續數字)----
eq('圈圈 A = Ⓐ U+24B6', cp(styleText('A', style('circled'))), 0x24b6)
eq('圈圈 a = ⓐ U+24D0', cp(styleText('a', style('circled'))), 0x24d0)
eq('圈圈 1 = ① U+2460', cp(styleText('1', style('circled'))), 0x2460)
eq('圈圈 0 = ⓪ U+24EA', cp(styleText('0', style('circled'))), 0x24ea)
eq('圈圈 9 = ⑨ U+2468', cp(styleText('9', style('circled'))), 0x2468)

// ---- 全形 ----
eq('全形 A = Ａ U+FF21', cp(styleText('A', style('fullwidth'))), 0xff21)
eq('全形 0 = ０ U+FF10', cp(styleText('0', style('fullwidth'))), 0xff10)
eq('全形 a = ａ U+FF41', cp(styleText('a', style('fullwidth'))), 0xff41)

// ---- 完整單字長度正確(astral 字元用碼點計)----
{
  const s = styleText('Hi5', style('bold'))
  eq('Hi5 粗體碼點數=3', [...s].length, 3)
  eq('Hi5 粗體 H', cp(s), 0x1d407)
}

// ---- 組合符號 ----
{
  const s = combineText('ab', 'strike')
  eq('刪除線:每字後加組合符號', [...s].length, 4)
  eq('刪除線第二碼=U+0336', s.codePointAt(1), 0x0336)
  eq('刪除線基字保留', s[0], 'a')
}
{
  const s = combineText('a b', 'underline')
  // 空白不加底線:a + U+0332 + space + b + U+0332
  eq('底線略過空白', [...s].length, 5)
  eq('底線符號=U+0332', s.codePointAt(1), 0x0332)
}

// ---- 寬鬆間距 ----
eq('寬鬆間距', spaceOut('abc'), 'a b c')
eq('寬鬆間距自訂', spaceOut('ab', '-'), 'a-b')

// ---- 上下顛倒 ----
eq('顛倒 abc', flipText('abc'), 'ɔqɐ')
eq('顛倒含反轉', flipText('Ja'), 'ɐſ')
eq('顛倒未知字保留', flipText('a中'), '中ɐ')
eq('顛倒問號', flipText('?'), '¿')

// ---- allVariants ----
{
  const v = allVariants('Test')
  ok('變體含字母樣式 + 4 特效', v.length === ALPHA_STYLES.length + 4)
  ok('變體都有 id/name/text', v.every((x) => x.id && x.name && typeof x.text === 'string'))
  ok('含上下顛倒', v.some((x) => x.id === 'flip'))
  ok('含刪除線', v.some((x) => x.id === 'strike'))
}

// ---- 空字串穩定 ----
eq('空字串粗體', styleText('', style('bold')), '')
eq('空字串顛倒', flipText(''), '')

console.log(`\n花式字:${pass} 通過、${fail} 失敗`)
if (fail > 0) process.exit(1)
