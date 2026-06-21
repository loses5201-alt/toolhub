/*
  瀏覽器書籤(Netscape Bookmark File Format)解析引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  Chrome / Edge / Firefox / Safari「匯出書籤」存的 .html 都是這個格式(巢狀 <DL><DT><H3>資料夾</H3> 與
  <DT><A HREF>連結</A>)。本引擎解析成資料夾樹,並能找重複、攤平、轉成 Markdown / CSV / 乾淨 HTML。

  全程在你瀏覽器處理,書籤(可能透露你的興趣與帳號)不上傳、不連網。
*/
import { decodeEntities } from './htmlToText'

export interface Bookmark {
  type: 'link'
  title: string
  url: string
  addDate?: number // epoch 毫秒
  icon?: string
}
export interface Folder {
  type: 'folder'
  name: string
  children: BookmarkNode[]
}
export type BookmarkNode = Bookmark | Folder

function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i'))
  return m ? m[1] : undefined
}
function cleanText(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, '')).trim()
}
function toMs(addDate: string | undefined): number | undefined {
  if (!addDate) return undefined
  const n = parseInt(addDate, 10)
  if (!Number.isFinite(n) || n <= 0) return undefined
  // Netscape ADD_DATE 為秒;少數匯出為毫秒 / 微秒
  if (n > 1e14) return Math.floor(n / 1000) // 微秒
  if (n > 1e12) return n // 毫秒
  return n * 1000 // 秒
}

/** 解析 Netscape 書籤 HTML 成資料夾樹(回傳根資料夾)。 */
export function parseBookmarks(html: string): Folder {
  const root: Folder = { type: 'folder', name: '書籤', children: [] }
  const stack: Folder[] = [root]
  let pending: Folder | null = null

  const re = /<h3\b[^>]*>([\s\S]*?)<\/h3>|<dl\b[^>]*>|<\/dl>|<a\b([^>]*)>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const top = stack[stack.length - 1]
    if (m[1] !== undefined) {
      // 資料夾標題
      const folder: Folder = { type: 'folder', name: cleanText(m[1]) || '(未命名資料夾)', children: [] }
      top.children.push(folder)
      pending = folder
    } else if (/^<\/dl/i.test(m[0])) {
      if (stack.length > 1) stack.pop()
    } else if (/^<dl/i.test(m[0])) {
      // 進入一個清單:若前面剛宣告資料夾,內容歸給它;否則維持目前層級
      stack.push(pending ?? top)
      pending = null
    } else {
      // 連結
      const tagAttrs = m[2] || ''
      const url = attr(tagAttrs, 'href')
      if (url) {
        top.children.push({
          type: 'link',
          title: cleanText(m[3] || '') || url,
          url: decodeEntities(url),
          addDate: toMs(attr(tagAttrs, 'add_date')),
          icon: attr(tagAttrs, 'icon'),
        })
      }
      pending = null
    }
  }
  return root
}

/** 攤平成「資料夾路徑 + 連結」清單。 */
export function flattenBookmarks(folder: Folder, path: string[] = []): { folder: string; bookmark: Bookmark }[] {
  const out: { folder: string; bookmark: Bookmark }[] = []
  for (const child of folder.children) {
    if (child.type === 'folder') out.push(...flattenBookmarks(child, [...path, child.name]))
    else out.push({ folder: path.join(' / '), bookmark: child })
  }
  return out
}

export function countNodes(folder: Folder): { folders: number; links: number } {
  let folders = 0
  let links = 0
  for (const c of folder.children) {
    if (c.type === 'folder') {
      folders++
      const sub = countNodes(c)
      folders += sub.folders
      links += sub.links
    } else links++
  }
  return { folders, links }
}

/** 正規化網址供比對重複(去除尾斜線 / fragment / 小寫 host)。 */
export function normalizeUrl(url: string): string {
  let u = url.trim()
  u = u.replace(/#.*$/, '')
  const m = u.match(/^(https?:\/\/)([^/]+)(.*)$/i)
  if (m) u = m[1].toLowerCase() + m[2].toLowerCase() + m[3]
  u = u.replace(/\/+$/, '')
  return u
}

/** 找重複網址,回傳每組(正規化後相同)含 2 筆以上的清單。 */
export function findDuplicates(
  items: { folder: string; bookmark: Bookmark }[],
): { url: string; entries: { folder: string; bookmark: Bookmark }[] }[] {
  const map = new Map<string, { folder: string; bookmark: Bookmark }[]>()
  for (const it of items) {
    const key = normalizeUrl(it.bookmark.url)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(it)
  }
  const out: { url: string; entries: { folder: string; bookmark: Bookmark }[] }[] = []
  for (const [url, entries] of map) if (entries.length > 1) out.push({ url, entries })
  return out
}

/** 轉成 Markdown(資料夾為標題,連結為清單)。 */
export function toMarkdown(folder: Folder, depth = 1): string {
  const lines: string[] = []
  for (const c of folder.children) {
    if (c.type === 'folder') {
      lines.push('')
      lines.push(`${'#'.repeat(Math.min(depth, 6))} ${c.name}`)
      const sub = toMarkdown(c, depth + 1)
      if (sub) lines.push(sub)
    } else {
      lines.push(`- [${c.title.replace(/\]/g, '\\]')}](${c.url})`)
    }
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function csvCell(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
/** 轉成 CSV(資料夾路徑、標題、網址、加入時間)。含 BOM 供 Excel。 */
export function toCsv(items: { folder: string; bookmark: Bookmark }[]): string {
  const rows = ['資料夾,標題,網址,加入時間']
  for (const { folder, bookmark } of items) {
    const date = bookmark.addDate ? new Date(bookmark.addDate).toISOString() : ''
    rows.push([folder, bookmark.title, bookmark.url, date].map(csvCell).join(','))
  }
  return '﻿' + rows.join('\r\n')
}
