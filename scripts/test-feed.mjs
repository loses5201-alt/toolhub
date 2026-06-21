/*
  RSS / Atom / RDF 訂閱源解析引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-feed.mjs
  oracle:手構符合各規範的 feed XML,逐項比對 kind / 頻道資訊 / 文章欄位 / 日期 ISO / Markdown 輸出。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `feed-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/feed.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { parseFeed, feedToMarkdown } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else { fail++; console.error(`✗ ${note}`) }
}
function eq(note, a, b) {
  check(`${note} (得到 ${JSON.stringify(a)})`, JSON.stringify(a) === JSON.stringify(b))
}

// ---- RSS 2.0 ----
const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>我的部落格</title>
    <link>https://blog.example.com/</link>
    <description>測試用 &amp; 範例</description>
    <lastBuildDate>Tue, 10 Jun 2025 09:00:00 +0000</lastBuildDate>
    <generator>WordPress</generator>
    <item>
      <title>第一篇 &amp; 開張</title>
      <link>https://blog.example.com/1</link>
      <pubDate>Mon, 09 Jun 2025 12:30:00 +0000</pubDate>
      <dc:creator>小明</dc:creator>
      <category>公告</category>
      <category>雜記</category>
      <guid isPermaLink="false">post-1</guid>
      <description><![CDATA[<p>這是 <b>摘要</b> 內容。</p>]]></description>
    </item>
    <item>
      <title>第二篇</title>
      <link>https://blog.example.com/2</link>
      <pubDate>Sun, 08 Jun 2025 00:00:00 +0000</pubDate>
      <content:encoded><![CDATA[<p>全文內容更長更詳細。</p>]]></content:encoded>
      <description>短摘要</description>
    </item>
  </channel>
</rss>`
const rss = parseFeed(RSS)
eq('RSS kind', rss.kind, 'rss')
eq('RSS 頻道標題', rss.title, '我的部落格')
eq('RSS 頻道描述解實體', rss.description, '測試用 & 範例')
eq('RSS 頻道連結', rss.link, 'https://blog.example.com/')
eq('RSS generator', rss.generator, 'WordPress')
eq('RSS 文章數', rss.items.length, 2)
eq('RSS 文章1 標題解實體', rss.items[0].title, '第一篇 & 開張')
eq('RSS 文章1 連結', rss.items[0].link, 'https://blog.example.com/1')
eq('RSS 文章1 作者 dc:creator', rss.items[0].author, '小明')
eq('RSS 文章1 分類兩筆', rss.items[0].categories, ['公告', '雜記'])
eq('RSS 文章1 guid', rss.items[0].id, 'post-1')
eq('RSS 文章1 摘要轉純文字', rss.items[0].summary, '這是 摘要 內容。')
eq('RSS 文章1 ISO 日期', rss.items[0].iso, '2025-06-09T12:30:00.000Z')
eq('RSS 文章2 優先用 content:encoded', rss.items[1].summary, '全文內容更長更詳細。')
check('RSS lastBuildDate', rss.updated === 'Tue, 10 Jun 2025 09:00:00 +0000')

// ---- Atom ----
const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom 範例</title>
  <subtitle>副標題</subtitle>
  <link rel="self" href="https://example.org/feed.atom"/>
  <link rel="alternate" href="https://example.org/"/>
  <updated>2025-06-10T10:00:00Z</updated>
  <generator>Hugo</generator>
  <entry>
    <title>Atom 文章一</title>
    <link rel="alternate" href="https://example.org/a"/>
    <link rel="edit" href="https://example.org/a/edit"/>
    <id>tag:example.org,2025:a</id>
    <published>2025-06-09T08:00:00Z</published>
    <updated>2025-06-09T09:00:00Z</updated>
    <author><name>Alice</name><email>a@example.org</email></author>
    <category term="news" label="新聞"/>
    <summary type="html">&lt;p&gt;HTML 摘要&lt;/p&gt;</summary>
  </entry>
</feed>`
const atom = parseFeed(ATOM)
eq('Atom kind', atom.kind, 'atom')
eq('Atom 頻道標題', atom.title, 'Atom 範例')
eq('Atom subtitle', atom.description, '副標題')
eq('Atom 頻道挑 alternate 連結', atom.link, 'https://example.org/')
eq('Atom generator', atom.generator, 'Hugo')
eq('Atom 文章數', atom.items.length, 1)
eq('Atom 文章 標題', atom.items[0].title, 'Atom 文章一')
eq('Atom 文章 挑 alternate href', atom.items[0].link, 'https://example.org/a')
eq('Atom 文章 author/name', atom.items[0].author, 'Alice')
eq('Atom 文章 分類用 term', atom.items[0].categories, ['news'])
eq('Atom 文章 id', atom.items[0].id, 'tag:example.org,2025:a')
eq('Atom 文章 摘要轉純文字', atom.items[0].summary, 'HTML 摘要')
eq('Atom 文章 日期優先 updated', atom.items[0].iso, '2025-06-09T09:00:00.000Z')

// ---- RDF (RSS 1.0):item 為 channel 的兄弟 ----
const RDF = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel rdf:about="https://old.example.com/">
    <title>老式 RDF 站</title>
    <link>https://old.example.com/</link>
    <description>RSS 1.0</description>
  </channel>
  <item rdf:about="https://old.example.com/x">
    <title>RDF 文章</title>
    <link>https://old.example.com/x</link>
    <dc:date>2025-06-01T00:00:00Z</dc:date>
    <dc:creator>編輯</dc:creator>
    <description>內文</description>
  </item>
</rdf:RDF>`
const rdf = parseFeed(RDF)
eq('RDF kind', rdf.kind, 'rdf')
eq('RDF 頻道標題', rdf.title, '老式 RDF 站')
eq('RDF 取到 channel 外的 item', rdf.items.length, 1)
eq('RDF 文章標題', rdf.items[0].title, 'RDF 文章')
eq('RDF 文章 dc:date ISO', rdf.items[0].iso, '2025-06-01T00:00:00.000Z')
eq('RDF 文章 dc:creator', rdf.items[0].author, '編輯')

// ---- 邊界 ----
eq('無法辨識回 unknown', parseFeed('<html><body>hi</body></html>').kind, 'unknown')
eq('unknown items 空', parseFeed('not xml').items, [])
const noDate = parseFeed(`<rss><channel><title>t</title><item><title>x</title><pubDate>不是日期</pubDate></item></channel></rss>`)
eq('壞日期 iso 為 undefined', noDate.items[0].iso, undefined)
eq('壞日期保留原字串', noDate.items[0].date, '不是日期')
const empty = parseFeed(`<rss><channel><title>空頻道</title></channel></rss>`)
eq('空頻道 0 文章', empty.items.length, 0)

// 自閉合 link 不應吃掉後面內容
const selfClose = parseFeed(`<feed xmlns="http://www.w3.org/2005/Atom"><title>T</title><link href="https://x/"/><entry><title>E</title><link href="https://x/e"/></entry></feed>`)
eq('Atom 自閉合 head link', selfClose.link, 'https://x/')
eq('Atom 自閉合 entry link', selfClose.items[0].link, 'https://x/e')

// ---- Markdown 輸出 ----
const md = feedToMarkdown(rss)
check('Markdown 含頻道標題 H1', md.includes('# 我的部落格'))
check('Markdown 文章為連結 H2', md.includes('## [第一篇 & 開張](https://blog.example.com/1)'))
check('Markdown 含日期', md.includes('2025-06-09'))
check('Markdown 含作者與分類', md.includes('小明') && md.includes('公告, 雜記'))
check('Markdown 含摘要', md.includes('這是 摘要 內容。'))

if (fail) { console.error(`\n${fail} 項失敗`); process.exit(1) }
console.log('\n全部通過')
