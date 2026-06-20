/*
  Open Graph / Twitter Card / SEO meta 標籤產生 + 解析引擎 —— 純函式、無 DOM 依賴,
  可在 Node 直接測試。
  - generateMeta:由欄位產生完整的 <title> + description + Open Graph + Twitter Card meta 標籤。
  - parseMeta:從現有 HTML(<head> 那段)反向抽出這些欄位,方便檢視 / 修改別人的設定。
  Open Graph 是 FB / LINE / Slack 等分享連結時顯示標題圖片用的標準;Twitter Card 是 X 用的。
  全程在你的瀏覽器處理,不連網、不上傳。
*/

export interface OgFields {
  title: string
  description: string
  url: string
  image: string
  siteName: string
  type: string // website / article …
  twitterCard: string // summary / summary_large_image
}

export const EMPTY_FIELDS: OgFields = {
  title: '',
  description: '',
  url: '',
  image: '',
  siteName: '',
  type: 'website',
  twitterCard: 'summary_large_image',
}

/** HTML 屬性值跳脫(& < > " )。 */
export function escapeAttr(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** HTML 文字內容跳脫(用於 <title>)。 */
export function escapeText(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function metaProp(prop: string, content: string): string {
  return `<meta property="${prop}" content="${escapeAttr(content)}" />`
}
function metaName(name: string, content: string): string {
  return `<meta name="${name}" content="${escapeAttr(content)}" />`
}

/** 由欄位產生 meta 標籤(只輸出有值的項目)。 */
export function generateMeta(f: OgFields): string {
  const lines: string[] = []
  if (f.title) lines.push(`<title>${escapeText(f.title)}</title>`)
  if (f.description) lines.push(metaName('description', f.description))

  // Open Graph
  if (f.title) lines.push(metaProp('og:title', f.title))
  if (f.description) lines.push(metaProp('og:description', f.description))
  if (f.type) lines.push(metaProp('og:type', f.type))
  if (f.url) lines.push(metaProp('og:url', f.url))
  if (f.image) lines.push(metaProp('og:image', f.image))
  if (f.siteName) lines.push(metaProp('og:site_name', f.siteName))

  // Twitter Card
  if (f.twitterCard) lines.push(metaName('twitter:card', f.twitterCard))
  if (f.title) lines.push(metaName('twitter:title', f.title))
  if (f.description) lines.push(metaName('twitter:description', f.description))
  if (f.image) lines.push(metaName('twitter:image', f.image))

  return lines.join('\n')
}

/** 解析單一 HTML 標籤的屬性成 map(小寫鍵)。 */
function parseAttrs(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g
  let m: RegExpExecArray | null
  while ((m = re.exec(tag))) {
    const key = m[1].toLowerCase()
    const val = m[3] != null ? m[3] : m[4] != null ? m[4] : m[5] != null ? m[5] : ''
    attrs[key] = decodeEntities(val)
  }
  return attrs
}

function decodeEntities(s: string): string {
  return (s || '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

/** 從 HTML 抽取 OG / Twitter / SEO 欄位。 */
export function parseMeta(html: string): OgFields {
  const f: OgFields = { ...EMPTY_FIELDS, type: '', twitterCard: '' }
  const src = html || ''

  // <title>
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(src)
  if (titleMatch) f.title = decodeEntities(titleMatch[1].trim())

  // 逐一掃 <meta> 標籤
  const metaRe = /<meta\b[^>]*>/gi
  let m: RegExpExecArray | null
  const og: Record<string, string> = {}
  const tw: Record<string, string> = {}
  let metaDesc = ''
  while ((m = metaRe.exec(src))) {
    const attrs = parseAttrs(m[0])
    const content = attrs.content || ''
    const prop = (attrs.property || '').toLowerCase()
    const name = (attrs.name || '').toLowerCase()
    if (prop.startsWith('og:')) og[prop] = content
    else if (name.startsWith('twitter:')) tw[name] = content
    else if (name === 'description') metaDesc = content
  }

  f.title = og['og:title'] || f.title || tw['twitter:title'] || ''
  f.description = og['og:description'] || metaDesc || tw['twitter:description'] || ''
  f.url = og['og:url'] || ''
  f.image = og['og:image'] || tw['twitter:image'] || ''
  f.siteName = og['og:site_name'] || ''
  f.type = og['og:type'] || ''
  f.twitterCard = tw['twitter:card'] || ''
  return f
}

/** 給一些設定健檢提醒(長度、缺漏)。 */
export function metaWarnings(f: OgFields): string[] {
  const w: string[] = []
  if (!f.title) w.push('缺少標題(title / og:title)。')
  else if (f.title.length > 60) w.push(`標題偏長(${f.title.length} 字),搜尋結果可能被截斷,建議 ≤ 60 字元。`)
  if (!f.description) w.push('缺少描述(description / og:description)。')
  else if (f.description.length > 160) w.push(`描述偏長(${f.description.length} 字),建議 ≤ 160 字元。`)
  if (!f.image) w.push('缺少分享預覽圖(og:image),社群分享時不會有大圖。')
  if (!f.url) w.push('缺少 og:url(分享時的正規網址)。')
  if (f.image && !/^https?:\/\//i.test(f.image)) w.push('og:image 建議用完整的絕對網址(以 https:// 開頭),否則部分平台抓不到。')
  return w
}
