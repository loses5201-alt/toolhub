/*
  .docx(Word / OOXML)解析引擎 —— 純函式、無 DOM 依賴(不用 DOMParser),可在 Node 直接測試。
  .docx 本質是一個 ZIP:word/document.xml(正文)+ docProps/core.xml(標題 / 作者 / 日期等核心中繼資料)
  + docProps/app.xml(頁數 / 字數 / 應用程式等)。本檔只負責解析「字串內容」;解壓 ZIP 由 Vue 端用 JSZip
  處理後把各部分 XML 餵進來。全程在你瀏覽器解析,文件不上傳。

  正文模型:<w:body> 內依序為 <w:p>(段落)與 <w:tbl>(表格)。段落 <w:p> 內的 <w:pPr> 帶樣式
  (<w:pStyle w:val="Heading1"/> 標題、<w:numPr> 清單),其餘為 <w:r>(run);run 內 <w:rPr> 帶
  粗體 <w:b/> / 斜體 <w:i/>,文字在 <w:t>,另有 <w:tab/> / <w:br/> / <w:cr/>。
*/
import { decodeEntities } from './htmlToText'

export interface DocxCore {
  title?: string
  creator?: string
  lastModifiedBy?: string
  created?: string
  modified?: string
  subject?: string
  keywords?: string
  description?: string
  revision?: string
  category?: string
}
export interface DocxApp {
  pages?: string
  words?: string
  characters?: string
  paragraphs?: string
  lines?: string
  company?: string
  application?: string
}
export interface Run {
  text: string
  bold: boolean
  italic: boolean
}
export interface Para {
  type: 'p'
  heading: number // 0 = 非標題,1-6 = 標題層級
  list: number // -1 = 非清單,否則為縮排層級(ilvl)
  runs: Run[]
}
export interface TableBlock {
  type: 'table'
  rows: string[][]
}
export type Block = Para | TableBlock

// ---- 小型 XML 取值工具 ----

/** 取出第一個 <name>…</name> 的內層文字(name 可含命名空間前綴,如 dc:title),解開實體後 trim。 */
export function textOf(xml: string, name: string): string | undefined {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = xml.match(new RegExp(`<${esc}(?:\\s[^>]*)?>([\\s\\S]*?)</${esc}>`, 'i'))
  if (!m) return undefined
  const v = decodeEntities(m[1]).trim()
  return v || undefined
}

/**
 * 依序掃描出 xml 中頂層的 <w:tag>…</w:tag> 區塊(tags 可多個,如 ['p','tbl']),
 * 正確處理同名標籤巢狀(表格內含表格)與自閉合 <w:p/>。回傳保留原始順序。
 */
export function scanBlocks(xml: string, tags: string[]): { tag: string; inner: string }[] {
  const out: { tag: string; inner: string }[] = []
  const openRe = new RegExp(`<w:(${tags.join('|')})((?:\\s[^>]*)?)(/?)>`, 'g')
  let m: RegExpExecArray | null
  while ((m = openRe.exec(xml))) {
    const tag = m[1]
    if (m[3] === '/') {
      out.push({ tag, inner: '' }) // 自閉合(空段落)
      continue
    }
    const close = findClose(xml, openRe.lastIndex, tag)
    out.push({ tag, inner: xml.slice(openRe.lastIndex, close.start) })
    openRe.lastIndex = close.end // 跳過整個區塊(含巢狀),避免重複擷取內層
  }
  return out
}

/** 從 from 起找出 <w:tag> 對應的 </w:tag>(計入同名巢狀),回傳結束標籤的位置。 */
export function findClose(xml: string, from: number, tag: string): { start: number; end: number } {
  const re = new RegExp(`<w:${tag}((?:\\s[^>]*)?)(/?)>|</w:${tag}>`, 'g')
  re.lastIndex = from
  let depth = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    if (m[0][1] === '/') {
      if (depth === 0) return { start: m.index, end: re.lastIndex }
      depth--
    } else if (m[2] !== '/') {
      depth++ // 巢狀開始標籤(非自閉合)
    }
  }
  return { start: xml.length, end: xml.length }
}

// ---- run / 段落 ----

/** 取出 run 內的文字,依序處理 <w:t> 文字、<w:tab/>、<w:br/>、<w:cr/>。 */
export function runText(inner: string): string {
  let out = ''
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/?>|<w:br\s*\/?>|<w:cr\s*\/?>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(inner))) {
    if (m[1] !== undefined) out += decodeEntities(m[1])
    else if (m[0].startsWith('<w:tab')) out += '\t'
    else out += '\n'
  }
  return out
}

/** 解析段落 pPr,判斷標題層級與清單縮排。 */
function paraStyle(inner: string): { heading: number; list: number } {
  const pPrMatch = inner.match(/<w:pPr\b[^>]*>([\s\S]*?)<\/w:pPr>/i)
  const pPr = pPrMatch ? pPrMatch[1] : ''
  let heading = 0
  const styleM = pPr.match(/<w:pStyle\b[^>]*w:val="([^"]*)"/i)
  if (styleM) {
    const val = styleM[1]
    if (/heading|標題|title|見出/i.test(val)) {
      const d = val.match(/(\d+)/)
      heading = d ? Math.min(6, Math.max(1, parseInt(d[1], 10))) : 1
    }
  }
  let list = -1
  if (/<w:numPr\b/i.test(pPr)) {
    const ilvl = pPr.match(/<w:ilvl\b[^>]*w:val="(\d+)"/i)
    list = ilvl ? parseInt(ilvl[1], 10) : 0
  }
  return { heading, list }
}

/** 解析段落內所有 run(保留粗體 / 斜體)。 */
function paraRuns(inner: string): Run[] {
  const runs: Run[] = []
  const re = /<w:r((?:\s[^>]*)?)>([\s\S]*?)<\/w:r>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(inner))) {
    const body = m[2]
    const rPrM = body.match(/<w:rPr\b[^>]*>([\s\S]*?)<\/w:rPr>/i)
    const rPr = rPrM ? rPrM[1] : ''
    const bold = isOn(rPr, 'b')
    const italic = isOn(rPr, 'i')
    const text = runText(body)
    if (text) runs.push({ text, bold, italic })
  }
  return runs
}

/** rPr 內某開關屬性是否開啟(<w:b/> 或 <w:b w:val="true"/>,但 <w:b w:val="0|false|none"/> 視為關)。 */
function isOn(rPr: string, name: string): boolean {
  const m = rPr.match(new RegExp(`<w:${name}\\b([^>]*)>|<w:${name}\\b([^>]*)/>`, 'i'))
  if (!m) return false
  const attrs = (m[1] || m[2] || '')
  const val = attrs.match(/w:val="([^"]*)"/i)
  if (!val) return true
  return !/^(0|false|none|off)$/i.test(val[1])
}

/** 把一個表格儲存格(<w:tc> 內層)轉成純文字:各段落文字以換行相接。 */
function cellText(tcInner: string): string {
  const paras = scanBlocks(tcInner, ['p'])
  return paras
    .map((p) => paraRuns(p.inner).map((r) => r.text).join(''))
    .join('\n')
    .replace(/\n+/g, '\n')
    .trim()
}

/** 解析 document.xml 正文成區塊陣列(段落與表格)。 */
export function parseDocument(documentXml: string): Block[] {
  const bodyM = documentXml.match(/<w:body\b[^>]*>([\s\S]*)<\/w:body>/i)
  const body = bodyM ? bodyM[1] : documentXml
  const blocks: Block[] = []
  for (const b of scanBlocks(body, ['p', 'tbl'])) {
    if (b.tag === 'p') {
      const { heading, list } = paraStyle(b.inner)
      blocks.push({ type: 'p', heading, list, runs: paraRuns(b.inner) })
    } else {
      const rows: string[][] = []
      for (const tr of scanBlocks(b.inner, ['tr'])) {
        rows.push(scanBlocks(tr.inner, ['tc']).map((tc) => cellText(tc.inner)))
      }
      if (rows.length) blocks.push({ type: 'table', rows })
    }
  }
  return blocks
}

// ---- 輸出 ----

function paraText(p: Para): string {
  return p.runs.map((r) => r.text).join('')
}

/** 區塊轉乾淨純文字。 */
export function blocksToText(blocks: Block[]): string {
  const lines: string[] = []
  for (const b of blocks) {
    if (b.type === 'table') {
      for (const row of b.rows) lines.push(row.join('\t'))
      lines.push('')
    } else {
      lines.push(paraText(b))
    }
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function inlineMd(runs: Run[]): string {
  return runs
    .map((r) => {
      const lead = r.text.match(/^\s*/)![0]
      const tail = r.text.match(/\s*$/)![0]
      const core = r.text.slice(lead.length, r.text.length - tail.length)
      if (!core) return r.text
      const mark = r.bold && r.italic ? '***' : r.bold ? '**' : r.italic ? '*' : ''
      return lead + mark + core + mark + tail
    })
    .join('')
}

/** 區塊轉 Markdown(標題 #、清單 -、粗斜體、表格管線)。 */
export function blocksToMarkdown(blocks: Block[]): string {
  const out: string[] = []
  for (const b of blocks) {
    if (b.type === 'table') {
      if (!b.rows.length) continue
      const esc = (c: string) => c.replace(/\|/g, '\\|').replace(/\n/g, '<br>')
      const cols = Math.max(...b.rows.map((r) => r.length))
      const pad = (r: string[]) => Array.from({ length: cols }, (_, i) => esc(r[i] || ''))
      out.push('| ' + pad(b.rows[0]).join(' | ') + ' |')
      out.push('| ' + Array(cols).fill('---').join(' | ') + ' |')
      for (const r of b.rows.slice(1)) out.push('| ' + pad(r).join(' | ') + ' |')
      out.push('')
    } else if (b.heading > 0) {
      out.push('#'.repeat(b.heading) + ' ' + inlineMd(b.runs))
      out.push('')
    } else if (b.list >= 0) {
      out.push('  '.repeat(b.list) + '- ' + inlineMd(b.runs))
    } else {
      const t = inlineMd(b.runs)
      out.push(t)
      if (t) out.push('')
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** 估算字數(去掉所有空白字元後的字元數,中英皆適用)。 */
export function countChars(blocks: Block[]): number {
  return blocksToText(blocks).replace(/\s/g, '').length
}

// ---- 中繼資料 ----

export function parseCore(coreXml: string): DocxCore {
  return {
    title: textOf(coreXml, 'dc:title'),
    creator: textOf(coreXml, 'dc:creator'),
    lastModifiedBy: textOf(coreXml, 'cp:lastModifiedBy'),
    created: textOf(coreXml, 'dcterms:created'),
    modified: textOf(coreXml, 'dcterms:modified'),
    subject: textOf(coreXml, 'dc:subject'),
    keywords: textOf(coreXml, 'cp:keywords'),
    description: textOf(coreXml, 'dc:description'),
    revision: textOf(coreXml, 'cp:revision'),
    category: textOf(coreXml, 'cp:category'),
  }
}

export function parseApp(appXml: string): DocxApp {
  return {
    pages: textOf(appXml, 'Pages'),
    words: textOf(appXml, 'Words'),
    characters: textOf(appXml, 'Characters'),
    paragraphs: textOf(appXml, 'Paragraphs'),
    lines: textOf(appXml, 'Lines'),
    company: textOf(appXml, 'Company'),
    application: textOf(appXml, 'Application'),
  }
}
