/*
  Markdown 目錄(TOC)產生核心 —— 從 Markdown 標題產生帶錨點連結的目錄,
  錨點採 GitHub 風格 slug(保留中文、去標點、空白轉連字號、重複加序號)。
  純函式、無 DOM,可在 Node 測;全程瀏覽器、不連網、不上傳。
*/

export interface Heading {
  level: number // 1–6
  text: string // 已去除行內 markdown 的純文字
  slug: string // GitHub 風格錨點(已處理重複)
}

/** 去掉標題文字裡的行內 markdown(粗斜體、行內碼、連結保留文字、圖片去除)。 */
export function stripInline(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // 圖片
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 連結 → 文字
    .replace(/`([^`]*)`/g, '$1') // 行內碼
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // 粗體
    .replace(/(\*|_)(.*?)\1/g, '$2') // 斜體
    .replace(/~~(.*?)~~/g, '$1') // 刪除線
    .trim()
}

/**
 * GitHub 風格錨點 slug(對齊 github-slugger:先去標點,再把每個空白逐一換成連字號,
 * 保留底線與既有連字號;不含重複處理)。如此產生的錨點才能在 GitHub 上正確跳轉。
 */
export function githubSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\- _]+/gu, '') // 去掉字母/數字/連字號/底線/空白以外的字元(含中日韓保留)
    .replace(/ /g, '-') // 每個空白逐一換連字號(不合併)
}

/** 重複 slug 處理:第二次起加 -1、-2…(GitHub 規則)。 */
export function dedupeSlug(slug: string, seen: Map<string, number>): string {
  if (!seen.has(slug)) {
    seen.set(slug, 0)
    return slug
  }
  const n = (seen.get(slug) || 0) + 1
  seen.set(slug, n)
  return `${slug}-${n}`
}

/**
 * 解析 Markdown,取出 ATX 標題(# … ######)。
 * 會略過圍欄程式碼區塊(``` 或 ~~~)內的內容,避免把註解當標題。
 */
export function parseHeadings(markdown: string): Heading[] {
  const lines = markdown.split(/\r?\n/)
  const headings: Heading[] = []
  const seen = new Map<string, number>()
  let inFence = false
  let fenceMark = ''
  for (const line of lines) {
    const fence = line.match(/^\s*(```+|~~~+)/)
    if (fence) {
      if (!inFence) {
        inFence = true
        fenceMark = fence[1][0]
      } else if (fence[1][0] === fenceMark) {
        inFence = false
      }
      continue
    }
    if (inFence) continue
    const m = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/)
    if (!m) continue
    const level = m[1].length
    const text = stripInline(m[2])
    if (text === '') continue
    const slug = dedupeSlug(githubSlug(text), seen)
    headings.push({ level, text, slug })
  }
  return headings
}

export interface TocOptions {
  minLevel?: number // 收錄的最小標題層級(預設 1)
  maxLevel?: number // 收錄的最大標題層級(預設 6)
  ordered?: boolean // 有序清單(1. 2.)或無序(-)
  indent?: string // 每層縮排(預設兩個空白)
}

/** 由標題產生 Markdown 目錄字串。縮排以「相對最小收錄層級」計算。 */
export function buildToc(headings: Heading[], options: TocOptions = {}): string {
  const minLevel = options.minLevel ?? 1
  const maxLevel = options.maxLevel ?? 6
  const ordered = options.ordered ?? false
  const indent = options.indent ?? '  '
  const picked = headings.filter((h) => h.level >= minLevel && h.level <= maxLevel)
  if (picked.length === 0) return ''
  const base = Math.min(...picked.map((h) => h.level))
  return picked
    .map((h) => {
      const pad = indent.repeat(h.level - base)
      const bullet = ordered ? '1.' : '-'
      return `${pad}${bullet} [${h.text}](#${h.slug})`
    })
    .join('\n')
}
