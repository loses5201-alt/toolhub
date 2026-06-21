/*
  EPUB 電子書解析引擎 —— 純函式、無 DOM 依賴(不用 DOMParser),可在 Node 直接測試。
  EPUB 本質是一個 ZIP:mimetype + META-INF/container.xml(指向 OPF)+ OPF(中繼資料 / manifest /
  spine 閱讀順序)+ 章節 XHTML + TOC(EPUB2 的 toc.ncx 或 EPUB3 的 nav.xhtml)。

  本檔只負責解析「字串內容」;解壓 ZIP、讀取位元組由 Vue 端用 JSZip 處理後餵進來。
  全程在你瀏覽器解析,電子書不上傳。
*/
import { decodeEntities } from './htmlToText'

export interface EpubMeta {
  title?: string
  creators: string[]
  language?: string
  publisher?: string
  date?: string
  identifiers: string[]
  description?: string
  subjects: string[]
  rights?: string
  version?: string // OPF version 屬性(2.0 / 3.0)
  coverItemId?: string // EPUB2 <meta name="cover" content="...">
}
export interface ManifestItem {
  id: string
  href: string // 相對 OPF 目錄
  mediaType: string
  properties?: string // EPUB3,如 cover-image / nav
}
export interface Opf {
  meta: EpubMeta
  manifest: ManifestItem[]
  spine: string[] // itemref idref 順序
  opfDir: string // OPF 所在目錄(供解析相對路徑)
}
export interface TocEntry {
  label: string
  href: string
  depth: number
}

// ---- 小型 XML 取值工具(容忍命名空間前綴)----

/** 解析一個開始標籤的屬性。 */
export function parseAttrs(tagText: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const re = /([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g
  let m: RegExpExecArray | null
  while ((m = re.exec(tagText))) {
    attrs[m[1]] = decodeEntities(m[3] ?? m[4] ?? '')
  }
  return attrs
}

/** 取出所有 localName 等於 name 的元素(忽略命名空間前綴),回傳屬性與內層文字。 */
export function findElements(xml: string, name: string): { attrs: Record<string, string>; inner: string }[] {
  const out: { attrs: Record<string, string>; inner: string }[] = []
  // 配對開始標籤(可能有前綴),擷取到對應結束或自閉合
  const re = new RegExp(`<([\\w.-]+:)?${name}\\b([^>]*?)(/?)>`, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    const attrs = parseAttrs(m[2] || '')
    if (m[3] === '/') {
      out.push({ attrs, inner: '' })
      continue
    }
    // 尋找對應結束標籤(同 localName)
    const closeRe = new RegExp(`</([\\w.-]+:)?${name}\\s*>`, 'gi')
    closeRe.lastIndex = re.lastIndex
    const c = closeRe.exec(xml)
    const inner = c ? xml.slice(re.lastIndex, c.index) : ''
    out.push({ attrs, inner })
    if (c) re.lastIndex = closeRe.lastIndex
  }
  return out
}

function firstText(xml: string, name: string): string | undefined {
  const els = findElements(xml, name)
  if (!els.length) return undefined
  const t = decodeEntities(els[0].inner.replace(/<[^>]+>/g, '')).trim()
  return t || undefined
}
function allText(xml: string, name: string): string[] {
  return findElements(xml, name)
    .map((e) => decodeEntities(e.inner.replace(/<[^>]+>/g, '')).trim())
    .filter(Boolean)
}

/** 從 META-INF/container.xml 取出 OPF 的完整路徑。 */
export function parseContainer(xml: string): string | null {
  const roots = findElements(xml, 'rootfile')
  for (const r of roots) {
    const p = r.attrs['full-path']
    if (p) return p
  }
  return null
}

function dirOf(path: string): string {
  const i = path.lastIndexOf('/')
  return i >= 0 ? path.slice(0, i + 1) : ''
}

/** 把相對於 OPF 目錄的 href 正規化成 ZIP 內的完整路徑(處理 ./ 與 ../)。 */
export function resolveHref(opfDir: string, href: string): string {
  const clean = href.split('#')[0]
  const parts = (opfDir + clean).split('/')
  const stack: string[] = []
  for (const p of parts) {
    if (p === '' || p === '.') continue
    if (p === '..') stack.pop()
    else stack.push(p)
  }
  return stack.join('/')
}

/** 解析 OPF(content.opf):中繼資料、manifest、spine。 */
export function parseOpf(xml: string, opfPath: string): Opf {
  const opfDir = dirOf(opfPath)
  const pkg = findElements(xml, 'package')[0]
  const version = pkg?.attrs['version']

  const metaBlock = findElements(xml, 'metadata')[0]?.inner ?? xml
  const meta: EpubMeta = {
    title: firstText(metaBlock, 'title'),
    creators: allText(metaBlock, 'creator'),
    language: firstText(metaBlock, 'language'),
    publisher: firstText(metaBlock, 'publisher'),
    date: firstText(metaBlock, 'date'),
    identifiers: allText(metaBlock, 'identifier'),
    description: firstText(metaBlock, 'description'),
    subjects: allText(metaBlock, 'subject'),
    rights: firstText(metaBlock, 'rights'),
    version,
  }
  // EPUB2 封面:<meta name="cover" content="cover-id">
  for (const m of findElements(metaBlock, 'meta')) {
    if ((m.attrs['name'] || '').toLowerCase() === 'cover' && m.attrs['content']) {
      meta.coverItemId = m.attrs['content']
    }
  }

  const manifestBlock = findElements(xml, 'manifest')[0]?.inner ?? ''
  const manifest: ManifestItem[] = findElements(manifestBlock, 'item').map((it) => ({
    id: it.attrs['id'] || '',
    href: it.attrs['href'] || '',
    mediaType: it.attrs['media-type'] || '',
    properties: it.attrs['properties'],
  }))

  const spineBlock = findElements(xml, 'spine')[0]?.inner ?? ''
  const spine = findElements(spineBlock, 'itemref')
    .map((r) => r.attrs['idref'] || '')
    .filter(Boolean)

  return { meta, manifest, spine, opfDir }
}

/** 找出封面圖片的 manifest item(EPUB3 properties=cover-image 優先,再退回 EPUB2 meta cover)。 */
export function findCoverHref(opf: Opf): string | null {
  const byProp = opf.manifest.find((i) => (i.properties || '').split(/\s+/).includes('cover-image'))
  if (byProp) return resolveHref(opf.opfDir, byProp.href)
  if (opf.meta.coverItemId) {
    const it = opf.manifest.find((i) => i.id === opf.meta.coverItemId)
    if (it) return resolveHref(opf.opfDir, it.href)
  }
  // 退而求其次:id 或 href 含 cover 的圖片
  const guess = opf.manifest.find(
    (i) => i.mediaType.startsWith('image/') && /cover/i.test(i.id + ' ' + i.href),
  )
  return guess ? resolveHref(opf.opfDir, guess.href) : null
}

/** 解析 EPUB2 的 toc.ncx(navPoint 可巢狀,以巢狀層級當深度)。 */
export function parseNcx(xml: string, opfDir: string): TocEntry[] {
  const out: TocEntry[] = []
  // 掃描所有 navPoint 開始 / 結束標記,用堆疊追蹤深度
  const tokenRe = /<navPoint\b[^>]*>|<\/navPoint\s*>/gi
  let depth = 0
  let m: RegExpExecArray | null
  while ((m = tokenRe.exec(xml))) {
    if (m[0][1] === '/') {
      depth = Math.max(0, depth - 1)
      continue
    }
    // 取此 navPoint 標頭到下一個 navPoint 邊界前的片段,抓 navLabel>text 與 content@src
    const segEnd = (() => {
      const next = xml.slice(tokenRe.lastIndex).search(/<navPoint\b|<\/navPoint\s*>/i)
      return next < 0 ? xml.length : tokenRe.lastIndex + next
    })()
    const seg = xml.slice(tokenRe.lastIndex, segEnd)
    const label = firstText(seg, 'text')
    const src = findElements(seg, 'content')[0]?.attrs['src']
    if (label && src) out.push({ label, href: resolveHref(opfDir, src), depth })
    depth++
  }
  return out
}

/** 解析 EPUB3 的 nav.xhtml(epub:type="toc" 的 <nav> 內的巢狀 <ol>/<li>/<a>)。 */
export function parseNav(xhtml: string, opfDir: string): TocEntry[] {
  const navs = findElements(xhtml, 'nav')
  let target = navs.find((n) => /toc/i.test(n.attrs['epub:type'] || n.attrs['type'] || ''))
  if (!target) target = navs[0]
  if (!target) return []
  const out: TocEntry[] = []
  // 以 <li> 巢狀深度估算層級
  const inner = target.inner
  const tokenRe = /<\/?(ol|li)\b[^>]*>|<a\b[^>]*>[\s\S]*?<\/a>/gi
  let depth = -1
  let m: RegExpExecArray | null
  while ((m = tokenRe.exec(inner))) {
    const tok = m[0]
    if (/^<ol/i.test(tok)) depth++
    else if (/^<\/ol/i.test(tok)) depth--
    else if (/^<a/i.test(tok)) {
      const aOpen = tok.match(/<a\b[^>]*>/i)?.[0] || ''
      const href = parseAttrs(aOpen)['href']
      const label = decodeEntities(tok.replace(/<[^>]+>/g, '')).trim()
      if (href && label) out.push({ label, href: resolveHref(opfDir, href), depth: Math.max(0, depth) })
    }
  }
  return out
}
