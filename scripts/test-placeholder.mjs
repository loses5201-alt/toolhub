/*
  佔位圖產生引擎回歸測試(node 直接跑)。
  執行:node scripts/test-placeholder.mjs
  oracle:XML 跳脫規則、字級公式(min/8 夾 12–160)、SVG 結構、尺寸解析。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `placeholder-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/placeholder.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { escapeXml, autoFontSize, parseSize, placeholderText, buildSvg, svgToDataUri } =
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

// ---- escapeXml ----
eq(escapeXml('a<b>&"\''), 'a&lt;b&gt;&amp;&quot;&apos;', 'XML 五種特殊字元跳脫')
eq(escapeXml('普通文字'), '普通文字', '一般文字不變')

// ---- autoFontSize:min/8,夾 12–160 ----
eq(autoFontSize(640, 480), 60, '640×480 → 480/8=60')
eq(autoFontSize(800, 800), 100, '800×800 → 100')
eq(autoFontSize(40, 40), 12, '極小 → 夾為下限 12')
eq(autoFontSize(4000, 4000), 160, '極大 → 夾為上限 160')
ok(autoFontSize(100, 600) === autoFontSize(600, 100), '取較短邊,長寬對調結果相同')

// ---- parseSize ----
eq(parseSize('640x480'), { width: 640, height: 480 }, '640x480')
eq(parseSize('640×480'), { width: 640, height: 480 }, '全形 ×')
eq(parseSize(' 800 * 600 '), { width: 800, height: 600 }, '空白與 *')
eq(parseSize('1920 1080'), { width: 1920, height: 1080 }, '空白分隔')
eq(parseSize('abc'), null, '非尺寸 → null')
eq(parseSize('0x100'), null, '0 寬 → null')

// ---- placeholderText:預設「寬×高」 ----
eq(placeholderText({ width: 640, height: 480, bg: '#000', fg: '#fff' }), '640×480', '預設文字')
eq(placeholderText({ width: 1, height: 1, bg: '#000', fg: '#fff', text: 'Logo' }), 'Logo', '自訂文字')
eq(placeholderText({ width: 1, height: 1, bg: '#000', fg: '#fff', text: '   ' }), '1×1', '空白文字回預設')

// ---- buildSvg 結構 ----
const svg = buildSvg({ width: 320, height: 200, bg: '#cccccc', fg: '#333333' })
ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), 'SVG 標籤完整')
ok(svg.includes('width="320"') && svg.includes('height="200"'), '寬高屬性正確')
ok(svg.includes('viewBox="0 0 320 200"'), 'viewBox 正確')
ok(svg.includes('fill="#cccccc"'), '背景色填入')
ok(svg.includes('>320×200</text>'), '預設文字置入')
ok(svg.includes('font-size="25"'), '字級 = min(320,200)/8=25')
ok(!svg.includes('<line'), '預設不畫交叉線')

// 交叉線
const svgCross = buildSvg({ width: 100, height: 100, bg: '#eee', fg: '#999', cross: true })
ok((svgCross.match(/<line /g) || []).length === 2, 'cross=true 畫兩條對角線')

// 自訂字級與含特殊字元的文字
const svg2 = buildSvg({ width: 200, height: 200, bg: '#fff', fg: '#000', text: 'A<B', fontSize: 48 })
ok(svg2.includes('font-size="48"'), '自訂字級生效')
ok(svg2.includes('>A&lt;B</text>'), '文字內 < 已跳脫')

// ---- svgToDataUri ----
const uri = svgToDataUri('<svg></svg>')
ok(uri.startsWith('data:image/svg+xml;charset=utf-8,'), 'data URI 前綴正確')
ok(uri.includes('%3Csvg%3E'), 'SVG 內容 URL 編碼')

console.log(`\nplaceholder: ${pass} 通過, ${fail} 失敗`)
process.exit(fail ? 1 : 0)
