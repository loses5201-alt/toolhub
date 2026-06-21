/*
  HTML 轉 Markdown 引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-htmltomarkdown.mjs
  oracle:手寫的 HTML → 預期 Markdown 對照(標題/強調/連結/圖片/清單/引言/
  程式碼/表格/分隔線/實體解碼),以結構正確性為準。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `h2m-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/htmlToMarkdown.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { htmlToMarkdown, decodeEntities } = await import(out)

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

// ---- 實體解碼 ----
eq('解碼 &amp;', decodeEntities('a &amp; b'), 'a & b')
eq('解碼 &lt;&gt;', decodeEntities('&lt;tag&gt;'), '<tag>')
eq('解碼數字', decodeEntities('&#65;&#x42;'), 'AB')
eq('解碼 nbsp', decodeEntities('a&nbsp;b'), 'a b')
eq('未知實體保留', decodeEntities('&unknownx;'), '&unknownx;')

// ---- 標題 ----
eq('h1', htmlToMarkdown('<h1>標題</h1>'), '# 標題')
eq('h3', htmlToMarkdown('<h3>小標</h3>'), '### 小標')

// ---- 段落與強調 ----
eq('段落', htmlToMarkdown('<p>一段文字</p>'), '一段文字')
eq('粗體', htmlToMarkdown('<p>這是<strong>重點</strong>。</p>'), '這是**重點**。')
eq('斜體 i', htmlToMarkdown('<p><i>斜</i></p>'), '*斜*')
eq('刪除線', htmlToMarkdown('<p><del>刪掉</del></p>'), '~~刪掉~~')
eq('行內程式碼', htmlToMarkdown('<p>用 <code>npm i</code> 安裝</p>'), '用 `npm i` 安裝')
eq('兩段空一行', htmlToMarkdown('<p>一</p><p>二</p>'), '一\n\n二')

// ---- 連結與圖片 ----
eq('連結', htmlToMarkdown('<a href="https://a.com">站</a>'), '[站](https://a.com)')
eq('圖片', htmlToMarkdown('<img src="x.png" alt="圖說">'), '![圖說](x.png)')
eq('無 href 的 a 只剩文字', htmlToMarkdown('<a>純文字</a>'), '純文字')

// ---- 無序清單 ----
eq('ul', htmlToMarkdown('<ul><li>甲</li><li>乙</li></ul>'), '- 甲\n- 乙')
// ---- 有序清單 ----
eq('ol', htmlToMarkdown('<ol><li>一</li><li>二</li></ol>'), '1. 一\n2. 二')
// ---- 巢狀清單 ----
{
  const md = htmlToMarkdown('<ul><li>外<ul><li>內</li></ul></li></ul>')
  ok('巢狀清單含縮排', md.includes('- 外') && md.includes('  - 內'))
}

// ---- 引言 ----
eq('blockquote', htmlToMarkdown('<blockquote><p>引用句</p></blockquote>'), '> 引用句')

// ---- 程式碼區塊 ----
{
  const md = htmlToMarkdown('<pre><code>line1\nline2</code></pre>')
  eq('pre 圍欄', md, '```\nline1\nline2\n```')
}

// ---- 分隔線 ----
eq('hr', htmlToMarkdown('<p>上</p><hr><p>下</p>'), '上\n\n---\n\n下')

// ---- 換行 br ----
{
  const md = htmlToMarkdown('<p>第一行<br>第二行</p>')
  ok('br 變成行尾兩空白換行', md.includes('  \n'))
  ok('br 兩行都在', md.includes('第一行') && md.includes('第二行'))
}

// ---- 表格 ----
{
  const html =
    '<table><thead><tr><th>名稱</th><th>數量</th></tr></thead>' +
    '<tbody><tr><td>蘋果</td><td>3</td></tr><tr><td>橘子</td><td>5</td></tr></tbody></table>'
  const md = htmlToMarkdown(html)
  const lines = md.split('\n')
  eq('表頭列', lines[0], '| 名稱 | 數量 |')
  eq('分隔列', lines[1], '| --- | --- |')
  eq('資料列1', lines[2], '| 蘋果 | 3 |')
  eq('資料列2', lines[3], '| 橘子 | 5 |')
}

// ---- script / style 內容被丟棄 ----
eq('丟棄 script', htmlToMarkdown('<p>前</p><script>alert(1)</script><p>後</p>'), '前\n\n後')
eq('丟棄 style', htmlToMarkdown('<style>p{color:red}</style><p>內文</p>'), '內文')

// ---- 註解與 DOCTYPE 被忽略 ----
eq('忽略註解', htmlToMarkdown('<!-- 註解 --><p>內容</p>'), '內容')
eq('忽略 doctype', htmlToMarkdown('<!DOCTYPE html><p>內容</p>'), '內容')

// ---- 空白收斂 ----
eq('多重空白收成單一', htmlToMarkdown('<p>a    b\n\n   c</p>'), 'a b c')

// ---- 容忍未閉合標籤 ----
ok('未閉合 strong 不爆炸', typeof htmlToMarkdown('<p><strong>沒關</p>') === 'string')

// ---- 巢狀強調 ----
eq('粗中帶斜', htmlToMarkdown('<p><strong>粗<em>斜</em></strong></p>'), '**粗*斜***')

// ---- 真實片段(div 包裹 + 連結 + 強調)----
{
  const html = '<div><h2>Hello</h2><p>看 <a href="https://x.io"><strong>這裡</strong></a> 吧</p></div>'
  const md = htmlToMarkdown(html)
  eq('div 片段', md, '## Hello\n\n看 [**這裡**](https://x.io) 吧')
}

console.log(`\nHTML 轉 Markdown:${pass} 通過、${fail} 失敗`)
if (fail > 0) process.exit(1)
