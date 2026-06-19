/*
  HTML 轉純文字引擎回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-htmltotext.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `htmltotext-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/htmlToText.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { htmlToText, decodeEntities } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// --- decodeEntities ---
check('&amp; → &', decodeEntities('a &amp; b') === 'a & b')
check('&lt;&gt; → <>', decodeEntities('&lt;tag&gt;') === '<tag>')
check('&quot; / &apos;', decodeEntities('&quot;x&apos;') === '"x\'')
check('&nbsp; → 空白', decodeEntities('a&nbsp;b') === 'a b')
check('十進位 &#39;', decodeEntities('it&#39;s') === "it's")
check('十六進位 &#x27;', decodeEntities('it&#x27;s') === "it's")
check('中文數值 &#20013;', decodeEntities('&#20013;&#25991;') === '中文')
check('未知具名實體原樣保留', decodeEntities('&unknownent;') === '&unknownent;')
check('非實體的 & 不動', decodeEntities('Tom & Jerry') === 'Tom & Jerry')
check('© ™', decodeEntities('&copy;&trade;') === '©™')

// --- htmlToText 基本 ---
check('去掉標籤', htmlToText('<p>Hello <b>World</b></p>') === 'Hello World')
check('<br> 換行', htmlToText('a<br>b') === 'a\nb')
check('段落間換行', htmlToText('<p>one</p><p>two</p>') === 'one\ntwo')
check('解開實體', htmlToText('<p>5 &gt; 3 &amp; 2 &lt; 4</p>') === '5 > 3 & 2 < 4')
check('script 整塊移除', htmlToText('<p>hi</p><script>alert(1)</script>') === 'hi')
check('style 整塊移除', htmlToText('<style>.a{color:red}</style><p>hi</p>') === 'hi')
check('註解移除', htmlToText('<!-- 註解 --><p>hi</p>') === 'hi')
check('清單加項目符號', htmlToText('<ul><li>蘋果</li><li>香蕉</li></ul>').includes('• 蘋果'))

// --- 進階 ---
check(
  '巢狀標籤',
  htmlToText('<div><h1>標題</h1><p>內文 <a href="#">連結</a></p></div>') === '標題\n內文 連結',
)
check('多重空白收斂', htmlToText('<p>a    b\t\tc</p>').includes('a b'))
check('過多空行壓成一行空白', !/\n\n\n/.test(htmlToText('<p>a</p><br><br><br><p>b</p>')))
check(
  '表格儲存格 Tab 分隔',
  htmlToText('<table><tr><td>姓名</td><td>年齡</td></tr></table>').includes('\t'),
)
check('&lt;script&gt; 解碼後不被當標籤', htmlToText('<p>用 &lt;script&gt; 標籤</p>') === '用 <script> 標籤')
check('純文字無標籤原樣', htmlToText('就是一段純文字') === '就是一段純文字')
check('空字串', htmlToText('') === '')
check('首尾空白 trim', htmlToText('  <p>  hi  </p>  ') === 'hi')
check('self-closing br 變體', htmlToText('a<br/>b<br />c') === 'a\nb\nc')
check('h1-h6 換行', htmlToText('<h2>章</h2>段').split('\n').length === 2)

if (fail) {
  console.error(`\n${fail} 個測試失敗`)
  process.exit(1)
}
console.log('\n全部通過')
