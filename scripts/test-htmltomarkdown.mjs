// HTML → Markdown 回歸測試
//   執行:node scripts/test-htmltomarkdown.mjs
//   以 Markdown 標準語法與手算 oracle 驗證結構保留(標題/清單/連結/粗體/表格/引言/程式碼)。
import { execSync } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'h2md-'))
const entry = join(dir, 'entry.mjs')
const src = join(process.cwd(), 'src/features/htmlToMarkdown.ts').replace(/\\/g, '\\\\')
writeFileSync(entry, `export { htmlToMarkdown, tokenize, buildTree } from '${src}'`)
const outFile = join(dir, 'bundle.mjs')
execSync(`npx esbuild ${entry} --bundle --format=esm --platform=node --outfile=${outFile}`, {
  stdio: ['ignore', 'ignore', 'inherit'],
})
const { htmlToMarkdown, tokenize, buildTree } = await import('file://' + outFile)

let pass = 0
let fail = 0
function eq(html, expected, msg) {
  const got = htmlToMarkdown(html)
  if (got === expected) pass++
  else {
    fail++
    console.error('✗', msg)
    console.error('   in :', JSON.stringify(html))
    console.error('   exp:', JSON.stringify(expected))
    console.error('   got:', JSON.stringify(got))
  }
}
function ok(cond, msg) {
  if (cond) pass++
  else {
    fail++
    console.error('✗', msg)
  }
}

// 標題 h1–h6
eq('<h1>x</h1>', '# x', 'h1')
eq('<h2>Title</h2>', '## Title', 'h2')
eq('<h3>T</h3>', '### T', 'h3')
eq('<h6>deep</h6>', '###### deep', 'h6')

// 段落與行內格式
eq('<p>Hello world</p>', 'Hello world', '段落')
eq('<p>a <b>bold</b> c</p>', 'a **bold** c', 'b → **')
eq('<strong>x</strong>', '**x**', 'strong → **')
eq('<em>y</em>', '*y*', 'em → *')
eq('<i>z</i>', '*z*', 'i → *')
eq('<del>old</del>', '~~old~~', 'del → ~~')
eq('<p>a<em> b </em>c</p>', 'a *b* c', 'emphasis 空白外移')

// 連結與圖片
eq('<a href="https://e.com">site</a>', '[site](https://e.com)', '連結')
eq('<a>txt</a>', 'txt', '無 href 連結退化為文字')
eq('<img src="a.png" alt="cat">', '![cat](a.png)', '圖片')
eq('<img alt="nope">', 'nope', '無 src 圖片退化為 alt')
eq('<a href="u"><b>x</b></a>', '[**x**](u)', '連結內含粗體')

// 行內 / 區塊程式碼
eq('<code>x = 1</code>', '`x = 1`', '行內 code')
eq(
  '<pre><code class="language-js">const a=1</code></pre>',
  '```js\nconst a=1\n```',
  'pre+code 帶語言',
)
eq('<pre>line1\nline2</pre>', '```\nline1\nline2\n```', 'pre 純文字保留換行')

// 清單
eq('<ul><li>a</li><li>b</li></ul>', '- a\n- b', '無序清單')
eq('<ol><li>a</li><li>b</li></ol>', '1. a\n2. b', '有序清單')
eq('<ol start="3"><li>a</li><li>b</li></ol>', '3. a\n4. b', '有序清單 start')
eq('<ul><li>a<ul><li>b</li></ul></li></ul>', '- a\n  - b', '巢狀清單緊湊')

// 引言 / 分隔線
eq('<blockquote><p>quote</p></blockquote>', '> quote', '引言')
eq('<hr>', '---', '分隔線')
eq('<hr/>', '---', '自閉分隔線')

// 表格(有 th / 無 th 皆以首列為表頭)
eq(
  '<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>',
  '| A | B |\n| --- | --- |\n| 1 | 2 |',
  '表格含 th',
)
eq(
  '<table><tr><td>A</td><td>B</td></tr><tr><td>1</td><td>2</td></tr></table>',
  '| A | B |\n| --- | --- |\n| 1 | 2 |',
  '表格無 th 以首列為表頭',
)

// 實體解碼
eq('<p>a &amp; b</p>', 'a & b', '&amp;')
eq('<p>a&nbsp;b</p>', 'a b', '&nbsp;')
eq('<p>5 &lt; 6</p>', '5 < 6', '&lt;')

// 移除 script / style / 註解
eq('<p>x</p><script>alert(1)</script>', 'x', 'script 移除')
eq('<p>x</p><style>.a{color:red}</style>', 'x', 'style 移除')
eq('<!-- c --><p>x</p>', 'x', '註解移除')

// 多段落 / 空白收斂 / 硬換行
eq('<p>a</p><p>b</p>', 'a\n\nb', '多段落空行分隔')
eq('<p>a   b</p>', 'a b', '多重空白收斂')
eq('<p>a<br>b</p>', 'a  \nb', 'br 硬換行(行尾兩空白)')

// Markdown 特殊字元跳脫
eq('<p>2 * 3</p>', '2 \\* 3', '星號跳脫')
eq('<p>see [1]</p>', 'see \\[1\\]', '方括號跳脫')

// 寬容解析:未閉合內嵌標籤
eq('<p>a <b>bold</p>', 'a **bold**', '未閉合 b 自動收斂')

// div 包區塊
eq('<div><h3>T</h3><p>p</p></div>', '### T\n\np', 'div 包標題與段落')

// 邊界
eq('', '', '空輸入')
eq('   ', '', '純空白')
eq('plain text only', 'plain text only', '純文字無標籤')

// tokenize / buildTree 結構
ok(tokenize('<p>hi</p>').length === 3, 'tokenize 三 token(open/text/close)')
ok(tokenize('<br>')[0].t === 'open' && tokenize('<br>')[0].selfClose === true, 'br 為自閉')
const tree = buildTree(tokenize('<ul><li>a</li></ul>'))
ok(
  tree.children[0].type === 'element' &&
    tree.children[0].tag === 'ul' &&
    tree.children[0].children[0].tag === 'li',
  'buildTree 巢狀結構',
)

// 綜合文件 round 一致性(結構完整)
const doc =
  '<h2>公告</h2><p>親愛的會員 &amp; 朋友:</p><ul><li>時間:<b>6/20</b></li><li>地點:台北</li></ul><p>詳見 <a href="https://example.com">官網</a>。</p>'
eq(
  doc,
  '## 公告\n\n親愛的會員 & 朋友:\n\n- 時間:**6/20**\n- 地點:台北\n\n詳見 [官網](https://example.com)。',
  '綜合文件',
)

console.log(`htmltomarkdown: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
