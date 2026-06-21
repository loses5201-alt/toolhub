/*
  .docx 解析引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-docx.mjs
  oracle:手構符合 OOXML(WordprocessingML)規範的 document.xml / core.xml / app.xml 片段,
  逐項比對解析結果。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `docx-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/docx.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const {
  textOf, scanBlocks, findClose, runText,
  parseDocument, blocksToText, blocksToMarkdown, countChars, parseCore, parseApp,
} = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else { fail++; console.error(`✗ ${note}`) }
}

// ---- textOf ----
check('textOf 取值 + trim', textOf('<dc:title>  你好  </dc:title>', 'dc:title') === '你好')
check('textOf 解實體', textOf('<x>A &amp; B</x>', 'x') === 'A & B')
check('textOf 含屬性', textOf('<Words w:foo="1">42</Words>', 'Words') === '42')
check('textOf 找不到回 undefined', textOf('<a>x</a>', 'b') === undefined)
check('textOf 空白視為無', textOf('<a>   </a>', 'a') === undefined)

// ---- findClose / scanBlocks(巢狀)----
{
  const xml = '<w:tbl>A<w:tbl>B</w:tbl>C</w:tbl>D'
  const c = findClose(xml, '<w:tbl>'.length, 'tbl')
  check('findClose 跳過巢狀同名', xml.slice(c.start) === '</w:tbl>D')
}
{
  const blocks = scanBlocks('<w:p>1</w:p><w:p>2</w:p>', ['p'])
  check('scanBlocks 兩段落', blocks.length === 2 && blocks[0].inner === '1' && blocks[1].inner === '2')
}
{
  // 表格內含段落時,頂層只取 tbl(內層 p 不外漏)
  const blocks = scanBlocks('<w:p>x</w:p><w:tbl><w:tr><w:tc><w:p>in</w:p></w:tc></w:tr></w:tbl>', ['p', 'tbl'])
  check('scanBlocks 頂層 p+tbl(內層 p 不外漏)', blocks.length === 2 && blocks[0].tag === 'p' && blocks[1].tag === 'tbl')
}
check('scanBlocks 自閉合空段落', scanBlocks('<w:p/><w:p>x</w:p>', ['p']).length === 2)

// ---- runText(t / tab / br 依序)----
check('runText 串接 + 順序', runText('<w:t>a</w:t><w:tab/><w:t>b</w:t><w:br/><w:t>c</w:t>') === 'a\tb\nc')
check('runText 保留前後空白(xml:space)', runText('<w:t xml:space="preserve">  hi  </w:t>') === '  hi  ')
check('runText 解實體', runText('<w:t>&lt;tag&gt;</w:t>') === '<tag>')
check('runText 空 run', runText('<w:rPr><w:b/></w:rPr>') === '')

// ---- parseDocument 段落 / 標題 / 粗斜體 ----
const doc1 = `<?xml version="1.0"?>
<w:document xmlns:w="x"><w:body>
  <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>大標題</w:t></w:r></w:p>
  <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>粗</w:t></w:r><w:r><w:t>常</w:t></w:r></w:p>
  <w:p><w:r><w:rPr><w:i/></w:rPr><w:t>斜</w:t></w:r></w:p>
  <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr><w:r><w:t>項一</w:t></w:r></w:p>
  <w:p><w:pPr><w:numPr><w:ilvl w:val="1"/></w:numPr></w:pPr><w:r><w:t>子項</w:t></w:r></w:p>
  <w:sectPr/>
</w:body></w:document>`
const b1 = parseDocument(doc1)
check('parseDocument 段落數', b1.filter((b) => b.type === 'p').length === 5)
check('parseDocument 標題層級', b1[0].type === 'p' && b1[0].heading === 1)
check('parseDocument 粗體 run', b1[1].runs[0].bold === true && b1[1].runs[1].bold === false)
check('parseDocument 斜體 run', b1[2].runs[0].italic === true)
check('parseDocument 清單層級', b1[3].list === 0 && b1[4].list === 1)

// ---- 純文字輸出 ----
const txt1 = blocksToText(b1)
check('blocksToText 含標題文字', txt1.includes('大標題'))
check('blocksToText 粗常相連', txt1.includes('粗常'))
check('blocksToText 無 markdown 標記', !txt1.includes('**') && !txt1.includes('#'))

// ---- Markdown 輸出 ----
const md1 = blocksToMarkdown(b1)
check('blocksToMarkdown 標題 #', md1.includes('# 大標題'))
check('blocksToMarkdown 粗體 **', md1.includes('**粗**'))
check('blocksToMarkdown 斜體 *', md1.includes('*斜*'))
check('blocksToMarkdown 清單 -', md1.includes('- 項一'))
check('blocksToMarkdown 巢狀清單縮排', md1.includes('  - 子項'))

// ---- 表格 ----
const doc2 = `<w:document><w:body><w:tbl>
  <w:tr><w:tc><w:p><w:r><w:t>姓名</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>電話</w:t></w:r></w:p></w:tc></w:tr>
  <w:tr><w:tc><w:p><w:r><w:t>小明</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>0912</w:t></w:r></w:p></w:tc></w:tr>
</w:tbl></w:body></w:document>`
const b2 = parseDocument(doc2)
check('parseDocument 表格列數', b2[0].type === 'table' && b2[0].rows.length === 2)
check('parseDocument 表格儲存格', b2[0].rows[0][0] === '姓名' && b2[0].rows[1][1] === '0912')
check('blocksToText 表格用 Tab 分隔', blocksToText(b2).includes('姓名\t電話'))
const md2 = blocksToMarkdown(b2)
check('blocksToMarkdown 表格表頭', md2.includes('| 姓名 | 電話 |'))
check('blocksToMarkdown 表格分隔列', md2.includes('| --- | --- |'))

// ---- 表格儲存格含管線字元需跳脫 ----
const doc3 = `<w:document><w:body><w:tbl><w:tr><w:tc><w:p><w:r><w:t>a|b</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>`
check('blocksToMarkdown 跳脫儲存格管線', blocksToMarkdown(parseDocument(doc3)).includes('a\\|b'))

// ---- 字數 ----
check('countChars 去空白計數', countChars(parseDocument('<w:body><w:p><w:r><w:t>你好 世界</w:t></w:r></w:p></w:body>')) === 4)

// ---- isOn:粗體 val=0 視為關 ----
const docOff = `<w:body><w:p><w:r><w:rPr><w:b w:val="0"/></w:rPr><w:t>x</w:t></w:r></w:p></w:body>`
check('粗體 w:val="0" 視為關', parseDocument(docOff)[0].runs[0].bold === false)
const docOn = `<w:body><w:p><w:r><w:rPr><w:b w:val="true"/></w:rPr><w:t>x</w:t></w:r></w:p></w:body>`
check('粗體 w:val="true" 視為開', parseDocument(docOn)[0].runs[0].bold === true)

// ---- core.xml / app.xml ----
const core = `<?xml version="1.0"?>
<cp:coreProperties xmlns:cp="x" xmlns:dc="y" xmlns:dcterms="z">
  <dc:title>季報</dc:title><dc:creator>王小明</dc:creator>
  <cp:lastModifiedBy>李四</cp:lastModifiedBy>
  <dcterms:created>2024-01-02T03:04:05Z</dcterms:created>
  <cp:revision>3</cp:revision>
</cp:coreProperties>`
const c = parseCore(core)
check('parseCore title', c.title === '季報')
check('parseCore creator', c.creator === '王小明')
check('parseCore lastModifiedBy', c.lastModifiedBy === '李四')
check('parseCore created', c.created === '2024-01-02T03:04:05Z')
check('parseCore revision', c.revision === '3')
check('parseCore 缺欄位 undefined', c.subject === undefined)

const app = `<Properties><Pages>3</Pages><Words>1200</Words><Characters>5400</Characters><Company>某公司</Company><Application>Microsoft Office Word</Application></Properties>`
const a = parseApp(app)
check('parseApp pages', a.pages === '3')
check('parseApp words', a.words === '1200')
check('parseApp company', a.company === '某公司')

if (fail) { console.error(`\n${fail} 項失敗`); process.exit(1) }
console.log('\n全部通過')
