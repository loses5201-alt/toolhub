/*
  Markdown → HTML 渲染核心 —— 純函式、無 DOM(字串處理,Node 可測)。
  寫筆記、README、issue、貼文時即時預覽並匯出乾淨 HTML,不必把內容貼到線上
  Markdown 編輯器。支援:標題、粗體/斜體/刪除線、行內與圍欄程式碼、連結、圖片、
  引言、清單(可巢狀)、水平線、表格(複用 markdownTable)。
  安全:所有文字都做 HTML 逸出、連結/圖片網址擋掉 javascript:/data: 等危險協定,
  故輸出可安全地放進 v-html。全程瀏覽器、不連網、不上傳。
*/
import { markdownToTable, type Align } from './markdownTable'
import type { Table } from './tableClean'

const ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** HTML 逸出,避免使用者內容被當成標籤執行。 */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPE[c])
}

/** 過濾網址:只允許安全協定,擋掉 javascript:/vbscript:/data:/file: 等。回空字串代表不安全。 */
function safeUrl(url: string): string {
  const u = url.trim()
  if (u === '') return ''
  // 相對路徑、錨點、查詢一律允許;只擋有危險 scheme 的絕對網址
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) {
    if (!/^(https?|mailto|tel|ftp):/i.test(u)) return ''
  }
  return u
}

const CODE_PH = '\u0000' // 不會出現在一般文字、也不受逸出/格式正則影響的佔位符

/** 行內語法:程式碼、圖片、連結、粗斜體、刪除線、自動連結。輸入為「未逸出」原文。 */
export function renderInline(text: string): string {
  // 1. 先抽出行內程式碼 `code`,避免內部符號被當成格式
  const codes: string[] = []
  let s = text.replace(/`([^`]+)`/g, (_m, code: string) => {
    codes.push(`<code>${escapeHtml(code)}</code>`)
    return `${CODE_PH}${codes.length - 1}${CODE_PH}`
  })
  // 2. HTML 逸出(在抽出程式碼後、套用格式前)
  s = escapeHtml(s)
  // 3. 圖片 ![alt](url)
  s = s.replace(/!\[([^\]]*)\]\(\s*([^)\s]+)\s*\)/g, (_m, alt: string, url: string) => {
    const safe = safeUrl(url)
    if (safe === '') return alt
    return `<img src="${safe}" alt="${alt}" loading="lazy">`
  })
  // 4. 連結 [text](url)
  s = s.replace(/\[([^\]]+)\]\(\s*([^)\s]+)\s*\)/g, (_m, label: string, url: string) => {
    const safe = safeUrl(url)
    if (safe === '') return label
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${label}</a>`
  })
  // 5. 粗斜體 / 刪除線(順序:三星 → 雙星 → 單星)
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>')
  // 底線版本:加邊界避免破壞 snake_case
  s = s.replace(/(^|[^A-Za-z0-9_])__(.+?)__(?![A-Za-z0-9_])/g, '$1<strong>$2</strong>')
  s = s.replace(/(^|[^A-Za-z0-9_])_(.+?)_(?![A-Za-z0-9_])/g, '$1<em>$2</em>')
  s = s.replace(/~~(.+?)~~/g, '<del>$1</del>')
  // 6. 自動連結 <https://...>(逸出後角括號已成 &lt; &gt;)
  s = s.replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, (_m, url: string) => {
    const safe = safeUrl(url)
    return safe === '' ? _m : `<a href="${safe}" target="_blank" rel="noopener noreferrer">${url}</a>`
  })
  // 7. 還原程式碼
  s = s.replace(new RegExp(`${CODE_PH}(\\d+)${CODE_PH}`, 'g'), (_m, n: string) => codes[Number(n)])
  return s
}

/** 一個段落內的多行:單純換行視為空白,行尾兩個以上空白或反斜線為強制換行 <br>。 */
function renderParagraph(lines: string[]): string {
  return lines
    .map((l, idx) => {
      const hard = /\s{2,}$/.test(l) || /\\$/.test(l)
      const inline = renderInline(l.replace(/\\\s*$/, '').replace(/\s+$/, ''))
      return idx < lines.length - 1 ? inline + (hard ? '<br>\n' : '\n') : inline
    })
    .join('')
}

function leadIndent(line: string): number {
  const m = line.match(/^[ \t]*/)
  return m ? m[0].length : 0
}

const ITEM_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/
const HR_RE = /^\s*([-*_])(\s*\1){2,}\s*$/
const HEADING_RE = /^(#{1,6})\s+(.*?)\s*#*\s*$/
const FENCE_RE = /^(\s*)(```+|~~~+)\s*([\w+-]*)\s*$/
const TABLE_SEP_RE = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/

function isBlockStart(line: string): boolean {
  return (
    HEADING_RE.test(line) ||
    FENCE_RE.test(line) ||
    /^\s*>/.test(line) ||
    HR_RE.test(line) ||
    ITEM_RE.test(line)
  )
}

/** 解析清單(含巢狀):回傳 HTML 與下一個未處理行索引。 */
function parseList(lines: string[], start: number): { html: string; next: number } {
  const first = lines[start].match(ITEM_RE)!
  const indent = first[1].length
  const ordered = /\d/.test(first[2])
  const tag = ordered ? 'ol' : 'ul'
  const items: string[] = []
  let i = start
  while (i < lines.length) {
    const m = lines[i].match(ITEM_RE)
    if (!m || m[1].length !== indent) break // 兄弟項用完或縮排不符
    const buf = [m[3]]
    i++
    while (i < lines.length) {
      if (/^\s*$/.test(lines[i])) {
        const nxt = lines[i + 1]
        if (nxt != null && /\S/.test(nxt) && leadIndent(nxt) > indent) {
          buf.push('')
          i++
          continue
        }
        break
      }
      const im = lines[i].match(ITEM_RE)
      if (im && im[1].length === indent) break // 同層兄弟
      if (leadIndent(lines[i]) > indent) {
        buf.push(lines[i].slice(indent)) // 去掉本層縮排,交給遞迴判斷子層
        i++
        continue
      }
      break // 縮排變淺 → 清單結束
    }
    let inner: string
    if (buf.length > 1) {
      const rest = renderMarkdown(buf.slice(1).join('\n')).trim()
      inner = rest === '' ? renderInline(buf[0]) : `${renderInline(buf[0])}\n${rest}`
    } else {
      inner = renderInline(buf[0])
    }
    items.push(`<li>${inner}</li>`)
  }
  return { html: `<${tag}>\n${items.join('\n')}\n</${tag}>`, next: i }
}

function renderTable(t: Table, aligns: Align[]): string {
  const al = (i: number) => (aligns[i] && aligns[i] !== 'left' ? ` style="text-align:${aligns[i]}"` : '')
  const head = t.headers.map((h, i) => `<th${al(i)}>${renderInline(h)}</th>`).join('')
  const body = t.rows
    .map((r) => '<tr>' + t.headers.map((_, i) => `<td${al(i)}>${renderInline(r[i] ?? '')}</td>`).join('') + '</tr>')
    .join('\n')
  return `<table>\n<thead>\n<tr>${head}</tr>\n</thead>\n<tbody>\n${body}\n</tbody>\n</table>`
}

/** Markdown 轉 HTML(安全、已逸出,可放進 v-html)。 */
export function renderMarkdown(src: string): string {
  const lines = (src ?? '').replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (/^\s*$/.test(line)) {
      i++
      continue
    }
    // 圍欄程式碼
    const fence = line.match(FENCE_RE)
    if (fence) {
      const close = fence[2][0] === '`' ? /^\s*`{3,}\s*$/ : /^\s*~{3,}\s*$/
      const buf: string[] = []
      i++
      while (i < lines.length && !close.test(lines[i])) {
        buf.push(lines[i])
        i++
      }
      i++ // 跳過結尾圍欄
      const lang = fence[3]
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : ''
      out.push(`<pre><code${cls}>${escapeHtml(buf.join('\n'))}</code></pre>`)
      continue
    }
    // 標題
    const h = line.match(HEADING_RE)
    if (h) {
      const level = h[1].length
      out.push(`<h${level}>${renderInline(h[2])}</h${level}>`)
      i++
      continue
    }
    // 水平線
    if (HR_RE.test(line)) {
      out.push('<hr>')
      i++
      continue
    }
    // 引言
    if (/^\s*>/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ''))
        i++
      }
      out.push(`<blockquote>\n${renderMarkdown(buf.join('\n')).trim()}\n</blockquote>`)
      continue
    }
    // 表格:本行含 | 且下一行是分隔列
    if (line.includes('|') && i + 1 < lines.length && lines[i + 1].includes('-') && TABLE_SEP_RE.test(lines[i + 1])) {
      const buf = [lines[i], lines[i + 1]]
      let j = i + 2
      while (j < lines.length && lines[j].includes('|') && !/^\s*$/.test(lines[j]) && !isBlockStart(lines[j])) {
        buf.push(lines[j])
        j++
      }
      const parsed = markdownToTable(buf.join('\n'))
      if (parsed.ok) {
        out.push(renderTable(parsed.table, parsed.aligns))
        i = j
        continue
      }
    }
    // 清單
    if (ITEM_RE.test(line)) {
      const { html, next } = parseList(lines, i)
      out.push(html)
      i = next
      continue
    }
    // 段落:收集到空行或下一個區塊起點
    const buf: string[] = []
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !isBlockStart(lines[i])) {
      buf.push(lines[i])
      i++
    }
    out.push(`<p>${renderParagraph(buf)}</p>`)
  }
  return out.join('\n')
}
