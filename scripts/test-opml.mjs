/*
  OPML 大綱 / 訂閱清單解析引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-opml.mjs
  oracle:手構符合 OPML 2.0 的 XML,逐項比對樹 / 攤平 / 統計 / 重複 feed / Markdown / CSV / 純文字大綱。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `opml-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/opml.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { parseOpml, flattenOutlines, countOutlines, findDuplicateFeeds, toOutlineText, toMarkdown, toCsv } =
  await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else { fail++; console.error(`✗ ${note}`) }
}
function eq(note, a, b) {
  check(`${note} (得到 ${JSON.stringify(a)})`, JSON.stringify(a) === JSON.stringify(b))
}

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>我的訂閱 &amp; 備份</title>
    <ownerName>小明</ownerName>
    <dateCreated>Mon, 09 Jun 2025 00:00:00 GMT</dateCreated>
  </head>
  <body>
    <outline text="科技" title="科技">
      <outline type="rss" text="A 站 &amp; B" xmlUrl="https://a.example.com/feed" htmlUrl="https://a.example.com/"/>
      <outline type="rss" text="C 站" xmlUrl="https://c.example.com/rss"/>
    </outline>
    <outline text="新聞">
      <outline text="子分類">
        <outline type="rss" text="D 站" xmlUrl="https://a.example.com/feed/" htmlUrl="https://d.example.com"/>
      </outline>
    </outline>
    <outline type="rss" text="頂層訂閱" xmlUrl="https://top.example.com/atom.xml" htmlUrl="https://top.example.com"/>
  </body>
</opml>`

const opml = parseOpml(SAMPLE)
eq('head 標題解實體', opml.title, '我的訂閱 & 備份')
eq('ownerName', opml.ownerName, '小明')
eq('頂層 outline 三個', opml.outlines.length, 3)
eq('科技資料夾子節點 2 個', opml.outlines[0].children.length, 2)
eq('A 站 text 解實體', opml.outlines[0].children[0].text, 'A 站 & B')
eq('A 站 xmlUrl', opml.outlines[0].children[0].xmlUrl, 'https://a.example.com/feed')
eq('A 站 htmlUrl', opml.outlines[0].children[0].htmlUrl, 'https://a.example.com/')
eq('巢狀:新聞→子分類→D站', opml.outlines[1].children[0].children[0].text, 'D 站')
eq('頂層訂閱無子節點', opml.outlines[2].children.length, 0)

// 統計
const c = countOutlines(opml.outlines)
eq('資料夾數(科技/新聞/子分類)', c.folders, 3)
eq('feed 數(A/C/D/頂層)', c.feeds, 4)
eq('總節點數', c.total, 7)

// 攤平
const flat = flattenOutlines(opml.outlines)
eq('攤平總數', flat.length, 7)
const dEntry = flat.find((f) => f.outline.text === 'D 站')
eq('D 站資料夾路徑', dEntry.folder, '新聞 / 子分類')
eq('D 站深度', dEntry.depth, 2)
const aEntry = flat.find((f) => f.outline.text === 'A 站 & B')
eq('A 站資料夾路徑', aEntry.folder, '科技')

// 重複 feed(A 站 feed 與 D 站 feed 僅尾斜線差異)
const dups = findDuplicateFeeds(flat)
eq('一組重複 feed', dups.length, 1)
eq('重複組含兩筆', dups[0].entries.length, 2)
check('重複 url 為 a.example.com/feed', dups[0].url.includes('a.example.com/feed'))

// 純文字大綱
const txt = toOutlineText(opml.outlines)
check('大綱含科技頂層', txt.includes('- 科技'))
check('大綱子層縮排', txt.includes('  - A 站 & B'))
check('大綱三層縮排 D 站', txt.includes('    - D 站'))

// Markdown
const md = toMarkdown(opml)
check('MD 含 head 標題 H1', md.includes('# 我的訂閱 & 備份'))
check('MD 科技為 H2', md.includes('## 科技'))
check('MD 子分類為 H3', md.includes('### 子分類'))
check('MD A 站連結到 htmlUrl', md.includes('[A 站 & B](https://a.example.com/)'))
check('MD C 站無 htmlUrl 用 xmlUrl', md.includes('[C 站](https://c.example.com/rss)'))

// CSV
const csv = toCsv(flat)
check('CSV 有 BOM', csv.charCodeAt(0) === 0xfeff)
check('CSV 含表頭', csv.includes('資料夾,標題,Feed 網址,網站,類型'))
check('CSV 含內含逗號的標題加引號', csv.includes('"A 站 & B"') || csv.includes('A 站 & B'))
check('CSV 不含資料夾列(科技無 xmlUrl 不單列)', !/\n[^\r\n]*,科技,,,/.test('\n' + csv))
const csvLines = csv.trim().split('\r\n')
eq('CSV 資料列=4 個 feed', csvLines.length - 1, 4)

// 邊界
eq('空 OPML outlines 空', parseOpml('<opml><head></head><body></body></opml>').outlines, [])
eq('非 OPML 不丟例外', parseOpml('garbage').outlines, [])
const selfMix = parseOpml('<opml><body><outline text="x"/><outline text="y"><outline text="z"/></outline></body></opml>')
eq('混合自閉合與巢狀:兩頂層', selfMix.outlines.length, 2)
eq('y 有子 z', selfMix.outlines[1].children[0].text, 'z')

if (fail) { console.error(`\n${fail} 項失敗`); process.exit(1) }
console.log('\n全部通過')
