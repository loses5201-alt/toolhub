/*
  Identicon 引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-identicon.mjs
  oracle:FNV-1a 32 位元的公認測試向量("" = 0x811c9dc5、"a" = 0xe40c292c、
  "foobar" = 0xbf9cf968),以及決定性、左右對稱、SVG 結構等結構性質。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `identicon-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/identicon.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { hashString, identiconData, identiconSvg } = await import(out)

let pass = 0
let fail = 0
function eq(name, got, want) {
  if (got === want) pass++
  else {
    fail++
    console.error(`✗ ${name}\n    got:  ${got}\n    want: ${want}`)
  }
}
function ok(name, cond) {
  if (cond) pass++
  else {
    fail++
    console.error(`✗ ${name}`)
  }
}

// ---- FNV-1a 公認測試向量 ----
eq('FNV-1a("") = 0x811c9dc5', hashString(''), 0x811c9dc5)
eq('FNV-1a("a") = 0xe40c292c', hashString('a'), 0xe40c292c)
eq('FNV-1a("foobar") = 0xbf9cf968', hashString('foobar'), 0xbf9cf968)
ok('hash 為無號 32 位', hashString('anything') >= 0 && hashString('anything') <= 0xffffffff)
ok('不同輸入多為不同 hash', hashString('alice') !== hashString('bob'))

// ---- 決定性 ----
{
  const a = identiconData('alice@example.com')
  const b = identiconData('alice@example.com')
  eq('相同輸入 → 相同 hash', a.hash, b.hash)
  eq('相同輸入 → 相同顏色', a.color, b.color)
  ok('相同輸入 → 相同格子', JSON.stringify(a.cells) === JSON.stringify(b.cells))
}
ok('不同輸入 → 多半不同格子', JSON.stringify(identiconData('cat').cells) !== JSON.stringify(identiconData('dog').cells))

// ---- 格子尺寸與對稱 ----
{
  const d = identiconData('hello', 5)
  eq('gridSize=5', d.gridSize, 5)
  eq('5 列', d.cells.length, 5)
  ok('每列 5 欄', d.cells.every((r) => r.length === 5))
  // 左右鏡射對稱
  let sym = true
  for (let r = 0; r < 5; r++) {
    if (d.cells[r][0] !== d.cells[r][4]) sym = false
    if (d.cells[r][1] !== d.cells[r][3]) sym = false
  }
  ok('左右對稱', sym)
}
{
  // 偶數會自動 +1 變奇數
  const d = identiconData('x', 6)
  eq('偶數 gridSize 自動補成奇數', d.gridSize, 7)
  ok('7x7 對稱', d.cells.every((row, _r) => row.every((_v, c) => row[c] === row[6 - c])))
}

// ---- 顏色範圍 ----
{
  const d = identiconData('color-test')
  ok('色相 0–359', d.hue >= 0 && d.hue < 360)
  ok('色字串為 hsl()', /^hsl\(\d+, \d+%, \d+%\)$/.test(d.color))
}

// ---- 大量輸入不爆炸、皆對稱、皆有開啟格 ----
{
  let bad = 0
  let allEmpty = 0
  for (let i = 0; i < 300; i++) {
    const d = identiconData('user' + i)
    for (let r = 0; r < d.gridSize; r++) {
      for (let c = 0; c < d.gridSize; c++) {
        if (d.cells[r][c] !== d.cells[r][d.gridSize - 1 - c]) bad++
      }
    }
    if (d.cells.every((row) => row.every((v) => !v))) allEmpty++
  }
  ok('300 組皆左右對稱', bad === 0)
  ok('幾乎不會整張空白', allEmpty <= 2)
}

// ---- SVG 結構 ----
{
  const d = identiconData('svg-test')
  const svg = identiconSvg(d, { size: 100 })
  ok('SVG 開頭', svg.startsWith('<svg'))
  ok('SVG 含 xmlns', svg.includes('xmlns="http://www.w3.org/2000/svg"'))
  ok('SVG 含 viewBox 0 0 100 100', svg.includes('viewBox="0 0 100 100"'))
  ok('SVG 含背景 rect', svg.includes('width="100" height="100"'))
  ok('SVG 含顏色填充', svg.includes(d.color))
  ok('SVG 結尾', svg.trim().endsWith('</svg>'))
  // 開啟的格子數 = rect 數(扣掉背景那一個)
  const onCount = d.cells.flat().filter(Boolean).length
  const rectCount = (svg.match(/<rect /g) || []).length
  eq('rect 數 = 開啟格子數 + 背景', rectCount, onCount + 1)
}

// ---- SVG 選項 ----
{
  const d = identiconData('opt')
  const svg = identiconSvg(d, { size: 200, background: '#ffffff', padding: 0.2 })
  ok('自訂尺寸 200', svg.includes('width="200"'))
  ok('自訂背景白', svg.includes('fill="#ffffff"'))
}

console.log(`\nIdenticon:${pass} 通過、${fail} 失敗`)
if (fail > 0) process.exit(1)
