/*
  Markdown → HTML 渲染引擎回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-markdownrender.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `markdownrender-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/markdownRender.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { renderMarkdown, renderInline, escapeHtml } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}
const md = (s) => renderMarkdown(s)
const has = (s, frag) => s.includes(frag)

// --- escapeHtml ---
check('escapeHtml 角括號', escapeHtml('<a>&"\'') === '&lt;a&gt;&amp;&quot;&#39;')

// --- 標題 ---
check('h1', md('# 標題') === '<h1>標題</h1>')
check('h3', md('### 三級') === '<h3>三級</h3>')
check('h6', md('###### 六級') === '<h6>六級</h6>')
check('七個井字非標題(當段落)', has(md('####### x'), '<p>'))
check('標題尾端井字去掉', md('## 標題 ##') === '<h2>標題</h2>')

// --- 行內格式 ---
check('粗體', renderInline('這是 **粗** 字') === '這是 <strong>粗</strong> 字')
check('斜體', renderInline('*斜*') === '<em>斜</em>')
check('粗斜體', renderInline('***x***') === '<strong><em>x</em></strong>')
check('刪除線', renderInline('~~刪~~') === '<del>刪</del>')
check('底線粗體', renderInline('__粗__') === '<strong>粗</strong>')
check('snake_case 不被斜體破壞', renderInline('foo_bar_baz') === 'foo_bar_baz')
check('行內程式碼', renderInline('用 `code` 包') === '用 <code>code</code> 包')
check('程式碼內 * 不被當斜體', renderInline('`a*b*c`') === '<code>a*b*c</code>')
check('程式碼內角括號逸出', renderInline('`<b>`') === '<code>&lt;b&gt;</code>')

// --- 連結與圖片 ---
check('連結', has(renderInline('[官網](https://example.com)'), '<a href="https://example.com" target="_blank" rel="noopener noreferrer">官網</a>'))
{
  const r = renderInline('[x](javascript:alert(1))')
  check('javascript: 連結被擋(無 a 標籤、無 javascript)', !has(r, '<a') && !has(r, 'javascript'))
}
check('圖片', has(renderInline('![圖](https://e.com/a.png)'), '<img src="https://e.com/a.png" alt="圖" loading="lazy">'))
check('data: 圖片被擋', renderInline('![x](data:text/html,boom)') === 'x')
check('相對路徑連結允許', has(renderInline('[a](/path?x=1)'), 'href="/path?x=1"'))
check('自動連結 <url>', has(renderInline('看 <https://example.com> 喔'), '<a href="https://example.com"'))

// --- 逸出與 XSS ---
check('原始 HTML 被逸出', md('<script>alert(1)</script>') === '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>')
check('& 逸出', has(md('A & B'), 'A &amp; B'))

// --- 段落與換行 ---
check('段落', md('一段文字') === '<p>一段文字</p>')
check('兩段', md('第一段\n\n第二段') === '<p>第一段</p>\n<p>第二段</p>')
check('段內單換行視為換行符(非 br)', has(md('a\nb'), 'a\nb') && !has(md('a\nb'), '<br>'))
check('行尾兩空白為強制換行', has(md('a  \nb'), '<br>'))

// --- 水平線 ---
check('--- 水平線', md('---') === '<hr>')
check('*** 水平線', md('***') === '<hr>')
check('星號文字不是水平線', has(md('**bold**'), '<strong>'))

// --- 圍欄程式碼 ---
const fence = md('```js\nconst a = 1 < 2\n```')
check('圍欄程式碼 pre/code', has(fence, '<pre><code class="language-js">'))
check('圍欄內 < 逸出', has(fence, 'const a = 1 &lt; 2'))
check('圍欄內 markdown 不被解析', has(md('```\n# not heading\n```'), '# not heading'))
check('波浪號圍欄', has(md('~~~\nx\n~~~'), '<pre><code>x</code></pre>'))

// --- 引言 ---
check('引言', has(md('> 引用句'), '<blockquote>') && has(md('> 引用句'), '引用句'))
check('引言內含格式', has(md('> **重點**'), '<strong>重點</strong>'))

// --- 清單 ---
const ul = md('- 一\n- 二\n- 三')
check('無序清單', has(ul, '<ul>') && (ul.match(/<li>/g) || []).length === 3)
const ol = md('1. 甲\n2. 乙')
check('有序清單', has(ol, '<ol>') && has(ol, '<li>甲</li>'))
check('清單項目含格式', has(md('- **粗** 項'), '<li><strong>粗</strong> 項</li>'))
const nested = md('- 上\n  - 下')
check('巢狀清單', has(nested, '<ul>') && (nested.match(/<ul>/g) || []).length === 2 && has(nested, '<li>下</li>'))
const mixed = md('段落\n\n- a\n- b\n\n結尾')
check('清單前後有段落', has(mixed, '<p>段落</p>') && has(mixed, '<ul>') && has(mixed, '<p>結尾</p>'))

// --- 表格 ---
const table = md('| 名稱 | 數量 |\n| --- | ---: |\n| 蘋果 | 3 |\n| 香蕉 | 10 |')
check('表格 thead', has(table, '<table>') && has(table, '<th>名稱</th>'))
check('表格 td', has(table, '<td>蘋果</td>'))
check('表格右對齊', has(table, 'style="text-align:right"'))
check('表格儲存格含格式', has(md('| a | b |\n|---|---|\n| **粗** | x |'), '<td><strong>粗</strong></td>'))
check('含 | 但無分隔列不當表格', has(md('a | b | c'), '<p>'))

// --- 綜合 / 不崩潰 ---
check('空字串', md('') === '')
check('只有空白', md('   \n  \n') === '')
const doc = md('# 標題\n\n一段含 **粗體** 與 `code`。\n\n- 項目一\n- 項目二\n\n> 引言\n\n```\ncode block\n```')
check('綜合文件含所有區塊', has(doc, '<h1>') && has(doc, '<strong>') && has(doc, '<ul>') && has(doc, '<blockquote>') && has(doc, '<pre>'))

if (fail) {
  console.error(`\n${fail} 個測試未通過`)
  process.exit(1)
}
console.log('\nMarkdown 渲染:全部測試通過 ✅')
