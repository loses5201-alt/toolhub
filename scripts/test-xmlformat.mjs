/*
  XML 格式化引擎回歸測試(node 直接跑)。
  執行:node scripts/test-xmlformat.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `xmlformat-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/xmlFormat.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { formatXml, minifyXml } = await import('file://' + out)

let fail = 0
let pass = 0
function ok(c, msg) {
  if (c) pass++
  else {
    fail++
    console.error('✗ FAIL:', msg)
  }
}
function eq(input, expected, msg, opts) {
  const r = formatXml(input, opts)
  if (!r.ok) {
    fail++
    console.error(`✗ FAIL: ${msg} — 格式化失敗:${r.error}`)
    return
  }
  if (r.output === expected) pass++
  else {
    fail++
    console.error(`✗ FAIL: ${msg}\n--- got ---\n${r.output}\n--- want ---\n${expected}\n-----------`)
  }
}

// ---- 精確輸出 ----
eq('<a><b>1</b><b>2</b></a>', '<a>\n  <b>1</b>\n  <b>2</b>\n</a>', 'nested siblings')
eq('<root><item id="1">x</item></root>', '<root>\n  <item id="1">x</item>\n</root>', 'attr + text inline')
eq('<a><img src="x"/></a>', '<a>\n  <img src="x"/>\n</a>', 'self-closing')
eq('<a></a>', '<a></a>', 'empty element inline')
eq('<a>  </a>', '<a></a>', 'whitespace-only treated empty')
eq('<a>hello</a>', '<a>hello</a>', 'single text inline')
eq('<?xml version="1.0"?><a><b/></a>', '<?xml version="1.0"?>\n<a>\n  <b/>\n</a>', 'xml declaration')
eq('<a><!-- hi --><b/></a>', '<a>\n  <!-- hi -->\n  <b/>\n</a>', 'comment preserved')
eq('<a><b>1</b></a>', '<a>\n    <b>1</b>\n</a>', 'indent=4', { indent: 4 })
eq('<a   x="1"   y="2"  ><b/></a>', '<a x="1" y="2">\n  <b/>\n</a>', 'tag whitespace normalised')
eq('<a><![CDATA[ <x> ]]></a>', '<a>\n  <![CDATA[ <x> ]]>\n</a>', 'cdata preserved as block')
eq(
  '<feed><title>Hi</title><entry><id>1</id></entry></feed>',
  '<feed>\n  <title>Hi</title>\n  <entry>\n    <id>1</id>\n  </entry>\n</feed>',
  'rss-like nesting',
)
eq('<a>&lt;keep&gt; &amp; more</a>', '<a>&lt;keep&gt; &amp; more</a>', 'entities untouched')

// ---- minify ----
{
  const r = minifyXml('<a>\n  <b>1</b>\n  <b>2</b>\n</a>')
  ok(r.ok && r.output === '<a><b>1</b><b>2</b></a>', 'minify removes inter-tag whitespace')
  ok(minifyXml('<a>hi there</a>').output === '<a>hi there</a>', 'minify keeps text')
  ok(minifyXml('<?xml version="1.0"?>\n<a/>').output === '<?xml version="1.0"?><a/>', 'minify decl + selfclose')
}

// ---- 冪等性 + 結構保留 ----
const samples = [
  '<a><b x="1">t</b><c/><d><e>1</e><e>2</e></d></a>',
  '<?xml version="1.0" encoding="UTF-8"?><svg width="10"><rect x="0"/><g><circle r="5"/></g></svg>',
  '<root><!-- note --><item>a</item><item><![CDATA[raw <b>]]></item></root>',
  '<project><dependencies><dependency><groupId>x</groupId><artifactId>y</artifactId></dependency></dependencies></project>',
]
for (const s of samples) {
  const once = formatXml(s).output
  const twice = formatXml(once).output
  ok(once === twice, `idempotent: ${s.slice(0, 36)}…`)
  // 格式化前後壓縮結果一致(結構與內容未變)
  ok(minifyXml(s).output === minifyXml(once).output, `structure preserved: ${s.slice(0, 36)}…`)
}

// ---- 錯誤處理 ----
ok(!formatXml('<a></b>').ok, '標籤不相符應失敗')
ok(!formatXml('<a><b></a>').ok, '巢狀不相符應失敗')
ok(!formatXml('<a>').ok, '未關閉標籤應失敗')
ok(!formatXml('</a>').ok, '多出結束標籤應失敗')
ok(!formatXml('<!-- x').ok, '未結束註解應失敗')
ok(!formatXml('<![CDATA[ x').ok, '未結束 CDATA 應失敗')
ok(formatXml('').ok && formatXml('').output === '', '空字串 ok')
ok(formatXml('   ').output === '', '純空白 ok')

console.log(`\nXML 格式化:${pass} 通過${fail ? `,${fail} 失敗` : ''}`)
if (fail) process.exit(1)
