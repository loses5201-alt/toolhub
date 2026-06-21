/*
  OPML 大綱 / 訂閱清單解析引擎 —— 純函式、無 DOM 依賴(不用 DOMParser),可在 Node 直接測試。

  OPML(Outline Processor Markup Language)是一種巢狀 <outline> 的 XML:
  - RSS 閱讀器(Feedly / Inoreader / NetNewsWire…)「匯出訂閱」存的就是 OPML,每個 outline 帶 xmlUrl(feed 網址);
  - 大綱 / 心智圖工具也用 OPML 交換階層式條列。
  本引擎把巢狀大綱解析成樹,可攤平、依資料夾分組、找重複 feed,並轉成 Markdown / CSV / 純文字大綱。

  價值:換閱讀器或備份訂閱時,離線就能看清楚訂閱了哪些站、分在哪個資料夾、有沒有重複。
  全程在你瀏覽器解析,清單(透露你的閱讀偏好)不上傳、不連網。
*/
import { decodeEntities } from './htmlToText'

export interface Outline {
  text: string
  title?: string
  type?: string
  xmlUrl?: string // feed 網址(訂閱項目才有)
  htmlUrl?: string // 網站首頁
  url?: string // 其他連結用途
  children: Outline[]
}
export interface Opml {
  title?: string
  ownerName?: string
  dateCreated?: string
  outlines: Outline[]
}
export interface FlatOutline {
  outline: Outline
  folder: string // 上層資料夾路徑,以 / 連接
  depth: number
}

function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'))
  if (!m) return undefined
  const v = decodeEntities(m[2] ?? m[3] ?? '').trim()
  return v || undefined
}

function firstTagText(xml: string, name: string): string | undefined {
  const m = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(xml)
  if (!m) return undefined
  const t = decodeEntities(m[1].replace(/<[^>]+>/g, '')).trim()
  return t || undefined
}

function makeOutline(tag: string): Outline {
  return {
    text: attr(tag, 'text') ?? attr(tag, 'title') ?? '',
    title: attr(tag, 'title'),
    type: attr(tag, 'type'),
    xmlUrl: attr(tag, 'xmlUrl') ?? attr(tag, 'xmlurl'),
    htmlUrl: attr(tag, 'htmlUrl') ?? attr(tag, 'htmlurl'),
    url: attr(tag, 'url'),
    children: [],
  }
}

/** 以堆疊解析 <body> 內巢狀的 <outline>(支援自閉合與含子節點兩種)。 */
function parseOutlines(body: string): Outline[] {
  const roots: Outline[] = []
  const stack: Outline[] = []
  // 逐一掃描 outline 開始 / 自閉合 / 結束標籤
  const re = /<outline\b([^>]*?)(\/?)>|<\/outline\s*>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) {
    if (m[0][1] === '/') {
      // 結束標籤
      if (stack.length) stack.pop()
      continue
    }
    const node = makeOutline(m[1] || '')
    const parent = stack[stack.length - 1]
    if (parent) parent.children.push(node)
    else roots.push(node)
    if (m[2] !== '/') stack.push(node) // 非自閉合 → 進入子層
  }
  return roots
}

/** 解析整份 OPML。無法辨識時 outlines 為空,不丟例外。 */
export function parseOpml(xml: string): Opml {
  const headMatch = /<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(xml)
  const head = headMatch ? headMatch[1] : ''
  const bodyMatch = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(xml)
  const body = bodyMatch ? bodyMatch[1] : ''
  return {
    title: firstTagText(head, 'title'),
    ownerName: firstTagText(head, 'ownerName'),
    dateCreated: firstTagText(head, 'dateCreated'),
    outlines: parseOutlines(body),
  }
}

/** 攤平成清單,帶資料夾路徑與深度。 */
export function flattenOutlines(outlines: Outline[]): FlatOutline[] {
  const out: FlatOutline[] = []
  const walk = (nodes: Outline[], folder: string, depth: number) => {
    for (const n of nodes) {
      out.push({ outline: n, folder, depth })
      if (n.children.length) {
        const label = n.text || n.title || ''
        walk(n.children, folder ? `${folder} / ${label}` : label, depth + 1)
      }
    }
  }
  walk(outlines, '', 0)
  return out
}

/** 統計:資料夾(有子節點者)與訂閱(有 xmlUrl 者)數量。 */
export function countOutlines(outlines: Outline[]): { folders: number; feeds: number; total: number } {
  let folders = 0, feeds = 0, total = 0
  const walk = (nodes: Outline[]) => {
    for (const n of nodes) {
      total++
      if (n.children.length) folders++
      if (n.xmlUrl) feeds++
      walk(n.children)
    }
  }
  walk(outlines)
  return { folders, feeds, total }
}

function normFeed(url: string): string {
  return url.trim().replace(/\/+$/, '').toLowerCase()
}

/** 找出 xmlUrl 重複的訂閱(忽略尾斜線與大小寫)。 */
export function findDuplicateFeeds(flat: FlatOutline[]): { url: string; entries: FlatOutline[] }[] {
  const map = new Map<string, FlatOutline[]>()
  for (const f of flat) {
    if (!f.outline.xmlUrl) continue
    const key = normFeed(f.outline.xmlUrl)
    const arr = map.get(key)
    if (arr) arr.push(f)
    else map.set(key, [f])
  }
  return [...map.entries()].filter(([, v]) => v.length > 1).map(([, entries]) => ({ url: entries[0].outline.xmlUrl!, entries }))
}

/** 轉成縮排純文字大綱。 */
export function toOutlineText(outlines: Outline[]): string {
  const lines: string[] = []
  const walk = (nodes: Outline[], depth: number) => {
    for (const n of nodes) {
      lines.push('  '.repeat(depth) + '- ' + (n.text || n.title || '(無標題)'))
      walk(n.children, depth + 1)
    }
  }
  walk(outlines, 0)
  return lines.join('\n') + '\n'
}

/** 轉成 Markdown(訂閱項目連結到網站,資料夾為標題)。 */
export function toMarkdown(opml: Opml): string {
  const lines: string[] = []
  if (opml.title) lines.push(`# ${opml.title}`, '')
  const walk = (nodes: Outline[], depth: number) => {
    for (const n of nodes) {
      const label = n.text || n.title || '(無標題)'
      if (n.children.length) {
        const h = '#'.repeat(Math.min(depth + 2, 6))
        lines.push(`${h} ${label}`, '')
        walk(n.children, depth + 1)
      } else {
        const link = n.htmlUrl || n.xmlUrl || n.url
        lines.push(link ? `- [${label}](${link})` : `- ${label}`)
      }
    }
  }
  walk(opml.outlines, 0)
  return lines.join('\n').trim() + '\n'
}

function csvCell(s: string): string {
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

/** 訂閱清單轉 CSV(含 BOM 供 Excel)。 */
export function toCsv(flat: FlatOutline[]): string {
  const rows = [['資料夾', '標題', 'Feed 網址', '網站', '類型']]
  for (const f of flat) {
    const o = f.outline
    if (!o.xmlUrl && !o.children.length) {
      // 葉節點但非 feed,仍列出
    }
    if (o.children.length) continue // 資料夾本身不列為訂閱列
    rows.push([f.folder, o.text || o.title || '', o.xmlUrl || '', o.htmlUrl || '', o.type || ''])
  }
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
