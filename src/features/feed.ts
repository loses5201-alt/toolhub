/*
  RSS / Atom / RDF 訂閱源解析引擎 —— 純函式、無 DOM 依賴(不用 DOMParser),可在 Node 直接測試。

  訂閱源(feed)是部落格 / 新聞網站 / Podcast 用來推送新文章的 XML 檔。三種主流格式:
  RSS 2.0(<rss><channel><item>)、Atom(<feed><entry>)、RSS 1.0 / RDF(<rdf:RDF><item>)。
  本引擎把它們統一解析成「來源資訊 + 文章清單(標題 / 連結 / 日期 / 作者 / 摘要 / 分類)」。

  價值:離線打開存下來的 feed.xml 就能讀全文,不必連去原站(避免內嵌追蹤圖片 / 廣告 / 指紋),
  摘要一律轉成乾淨純文字。全程在你瀏覽器解析,不上傳、不連網。
*/
import { decodeEntities, htmlToText } from './htmlToText'

export type FeedKind = 'rss' | 'atom' | 'rdf' | 'unknown'

export interface FeedItem {
  title?: string
  link?: string
  date?: string // 原始日期字串
  iso?: string // 解析成功時的 ISO 8601
  author?: string
  summary?: string // 已轉乾淨純文字
  categories: string[]
  id?: string
}

export interface Feed {
  kind: FeedKind
  title?: string
  description?: string
  link?: string
  updated?: string
  generator?: string
  items: FeedItem[]
}

// ---- 小型 XML 取值工具 ----

/** 還原 CDATA 區段(<![CDATA[...]]>),其餘交給呼叫端解實體。 */
function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_m, inner) => inner)
}

/** 取出第一個 localName = name 的元素內層原始字串(忽略命名空間前綴)。 */
function firstInner(xml: string, name: string): string | undefined {
  const re = new RegExp(`<([\\w.-]+:)?${name}\\b[^>]*?(/?)>`, 'i')
  const m = re.exec(xml)
  if (!m) return undefined
  if (m[2] === '/') return ''
  const closeRe = new RegExp(`</([\\w.-]+:)?${name}\\s*>`, 'i')
  closeRe.lastIndex = m.index + m[0].length
  const c = closeRe.exec(xml)
  return c ? xml.slice(m.index + m[0].length, c.index) : ''
}

/** 取第一個元素的純文字(解 CDATA + 實體 + 去殘餘標籤)。 */
function firstText(xml: string, name: string): string | undefined {
  const inner = firstInner(xml, name)
  if (inner == null) return undefined
  const t = decodeEntities(stripCdata(inner).replace(/<[^>]+>/g, '')).trim()
  return t || undefined
}

/** 取所有 localName = name 的元素,回傳開始標籤屬性字串與內層字串。 */
function elements(xml: string, name: string): { tag: string; inner: string }[] {
  const out: { tag: string; inner: string }[] = []
  const re = new RegExp(`<([\\w.-]+:)?${name}\\b([^>]*?)(/?)>`, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    if (m[3] === '/') {
      out.push({ tag: m[2] || '', inner: '' })
      continue
    }
    const closeRe = new RegExp(`</([\\w.-]+:)?${name}\\s*>`, 'gi')
    closeRe.lastIndex = re.lastIndex
    const c = closeRe.exec(xml)
    const inner = c ? xml.slice(re.lastIndex, c.index) : ''
    out.push({ tag: m[2] || '', inner })
    if (c) re.lastIndex = closeRe.lastIndex
  }
  return out
}

function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'))
  return m ? decodeEntities(m[2] ?? m[3] ?? '') : undefined
}

function toIso(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const n = Date.parse(raw.trim())
  if (Number.isNaN(n)) return undefined
  return new Date(n).toISOString()
}

/** 摘要 HTML → 乾淨純文字,過長截斷。 */
function cleanSummary(inner: string | undefined, max = 600): string | undefined {
  if (inner == null) return undefined
  // type="html" 的 Atom 內容是「跳脫過的 HTML」(&lt;p&gt;),先解實體還原成標籤再轉純文字;
  // CDATA 內已是原始 HTML,decodeEntities 不會破壞。
  const text = htmlToText(decodeEntities(stripCdata(inner))).replace(/\n{3,}/g, '\n\n').trim()
  if (!text) return undefined
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text
}

// ---- 各格式解析 ----

function detectKind(xml: string): FeedKind {
  if (/<(\w+:)?feed\b/i.test(xml)) return 'atom'
  if (/<rdf:RDF\b/i.test(xml) || /<(\w+:)?RDF\b/i.test(xml)) return 'rdf'
  if (/<rss\b/i.test(xml) || /<channel\b/i.test(xml)) return 'rss'
  return 'unknown'
}

/** Atom <link> 多筆時挑 rel=alternate(或無 rel)的 href。 */
function atomLink(scope: string): string | undefined {
  const links = elements(scope, 'link')
  if (!links.length) return undefined
  const alt = links.find((l) => {
    const rel = attr(l.tag, 'rel')
    return !rel || rel === 'alternate'
  })
  return attr((alt ?? links[0]).tag, 'href')
}

function categoriesOf(scope: string, kind: FeedKind): string[] {
  const seen = new Set<string>()
  for (const c of elements(scope, 'category')) {
    const v =
      kind === 'atom'
        ? attr(c.tag, 'term') || attr(c.tag, 'label')
        : decodeEntities(stripCdata(c.inner).replace(/<[^>]+>/g, '')).trim()
    if (v) seen.add(v)
  }
  return [...seen]
}

function parseRssItem(inner: string): FeedItem {
  const date = firstText(inner, 'pubDate') || firstText(inner, 'date') // dc:date
  return {
    title: firstText(inner, 'title'),
    link: firstText(inner, 'link') || firstText(inner, 'guid'),
    date,
    iso: toIso(date),
    author: firstText(inner, 'creator') || firstText(inner, 'author'), // dc:creator
    summary:
      cleanSummary(firstInner(inner, 'encoded')) || // content:encoded
      cleanSummary(firstInner(inner, 'description')),
    categories: categoriesOf(inner, 'rss'),
    id: firstText(inner, 'guid'),
  }
}

function parseAtomEntry(inner: string): FeedItem {
  const date = firstText(inner, 'updated') || firstText(inner, 'published')
  const author = firstInner(inner, 'author')
  return {
    title: firstText(inner, 'title'),
    link: atomLink(inner),
    date,
    iso: toIso(date),
    author: author != null ? firstText(author, 'name') : undefined,
    summary: cleanSummary(firstInner(inner, 'content')) || cleanSummary(firstInner(inner, 'summary')),
    categories: categoriesOf(inner, 'atom'),
    id: firstText(inner, 'id'),
  }
}

/** 解析整個 feed 文字。無法辨識時 kind='unknown' 且 items 為空,不丟例外。 */
export function parseFeed(xml: string): Feed {
  const kind = detectKind(xml)
  if (kind === 'atom') {
    const feedInner = firstInner(xml, 'feed') ?? xml
    // 取頻道層的第一個 link(避免抓到 entry 內的)
    const headEnd = feedInner.search(/<(\w+:)?entry\b/i)
    const head = headEnd >= 0 ? feedInner.slice(0, headEnd) : feedInner
    return {
      kind,
      title: firstText(head, 'title'),
      description: firstText(head, 'subtitle'),
      link: atomLink(head),
      updated: firstText(head, 'updated'),
      generator: firstText(head, 'generator'),
      items: elements(feedInner, 'entry').map((e) => parseAtomEntry(e.inner)),
    }
  }
  if (kind === 'rss' || kind === 'rdf') {
    const channelInner = firstInner(xml, 'channel') ?? xml
    // RSS 2.0 的 item 在 channel 內;RDF 的 item 是 channel 的兄弟,故對整份 xml 取 item
    const items = elements(xml, 'item').map((e) => parseRssItem(e.inner))
    return {
      kind,
      title: firstText(channelInner, 'title'),
      description: firstText(channelInner, 'description'),
      link: firstText(channelInner, 'link'),
      updated: firstText(channelInner, 'lastBuildDate') || firstText(channelInner, 'pubDate') || firstText(channelInner, 'date'),
      generator: firstText(channelInner, 'generator'),
      items,
    }
  }
  return { kind: 'unknown', items: [] }
}

/** 匯出文章清單成 Markdown。 */
export function feedToMarkdown(feed: Feed): string {
  const lines: string[] = []
  if (feed.title) lines.push(`# ${feed.title}`, '')
  if (feed.description) lines.push(feed.description, '')
  for (const it of feed.items) {
    const title = it.title || '(無標題)'
    lines.push(it.link ? `## [${title}](${it.link})` : `## ${title}`)
    const meta: string[] = []
    if (it.iso) meta.push(it.iso.slice(0, 10))
    else if (it.date) meta.push(it.date)
    if (it.author) meta.push(it.author)
    if (it.categories.length) meta.push(it.categories.join(', '))
    if (meta.length) lines.push(`*${meta.join(' · ')}*`)
    if (it.summary) lines.push('', it.summary)
    lines.push('')
  }
  return lines.join('\n').trim() + '\n'
}
