/*
  Markdown 表格核心 —— 純函式、無 DOM,可在 Node 測。
  表格 ↔ GitHub/Notion 風格的 Markdown 表格互轉。
  data-convert 做 CSV/JSON/Excel,不含 Markdown;寫 README/issue/Notion 時靠這支。
  複用 tableClean 的 Table 型別。全程瀏覽器、不上傳。
*/
import type { Table } from './tableClean'

export type Align = 'left' | 'right' | 'center'

/** 顯示寬度:CJK 全形字算 2,其餘算 1(讓對齊在等寬字型下更整齊)。 */
function displayWidth(s: string): number {
  let w = 0
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0
    // 常見 CJK / 全形範圍粗略判斷
    w += (cp >= 0x1100 && cp <= 0x115f) || (cp >= 0x2e80 && cp <= 0xa4cf) ||
         (cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0xf900 && cp <= 0xfaff) ||
         (cp >= 0xfe30 && cp <= 0xfe4f) || (cp >= 0xff00 && cp <= 0xff60) ||
         (cp >= 0xffe0 && cp <= 0xffe6) || (cp >= 0x20000 && cp <= 0x3fffd)
      ? 2
      : 1
  }
  return w
}

/** Markdown 儲存格逸出:| → \|,換行 → 空白。 */
function escapeCell(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

function pad(s: string, width: number, align: Align): string {
  const gap = Math.max(0, width - displayWidth(s))
  if (align === 'right') return ' '.repeat(gap) + s
  if (align === 'center') {
    const left = Math.floor(gap / 2)
    return ' '.repeat(left) + s + ' '.repeat(gap - left)
  }
  return s + ' '.repeat(gap)
}

/** 表格 → Markdown(對齊填白方便閱讀,GitHub/Notion 皆可貼)。 */
export function tableToMarkdown(t: Table, aligns: Align[] = []): string {
  const cols = t.headers.length
  if (cols === 0) return ''
  const esc = (r: string[]) => Array.from({ length: cols }, (_, i) => escapeCell(r[i] ?? ''))
  const header = esc(t.headers)
  const body = t.rows.map(esc)
  // 各欄寬度(至少 3,容得下分隔列的 ---)
  const widths = Array.from({ length: cols }, (_, i) => {
    let w = displayWidth(header[i])
    for (const r of body) w = Math.max(w, displayWidth(r[i]))
    return Math.max(3, w)
  })
  const a = (i: number): Align => aligns[i] ?? 'left'
  const sep = widths.map((w, i) => {
    const dashes = '-'.repeat(Math.max(1, w - (a(i) === 'center' ? 2 : a(i) === 'left' ? 0 : 1)))
    if (a(i) === 'center') return ':' + dashes + ':'
    if (a(i) === 'right') return dashes + ':'
    return dashes
  })
  const line = (cells: string[]) => '| ' + cells.map((c, i) => pad(c, widths[i], a(i))).join(' | ') + ' |'
  return [line(header), '| ' + sep.join(' | ') + ' |', ...body.map(line)].join('\n')
}

/** 拆一行 Markdown 表格列(處理 \| 逸出、去頭尾外框 |)。 */
function splitRow(line: string): string[] {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1)
  const cells: string[] = []
  let cur = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '\\' && (s[i + 1] === '|' || s[i + 1] === '\\')) {
      cur += s[i + 1]
      i++
    } else if (c === '|') {
      cells.push(cur.trim())
      cur = ''
    } else {
      cur += c
    }
  }
  cells.push(cur.trim())
  return cells
}

const SEP_RE = /^\s*:?-{1,}:?\s*$/

/** Markdown 表格 → Table。找出表頭 + 分隔列(---),其後為內容。 */
export function markdownToTable(md: string): { ok: boolean; error?: string; table: Table; aligns: Align[] } {
  const fail = (error: string) => ({ ok: false, error, table: { headers: [], rows: [] }, aligns: [] as Align[] })
  const lines = (md ?? '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '')
  if (lines.length < 2) return fail('需要至少「表頭列 + 分隔列(---)」兩行')
  // 找分隔列:該行去掉 | 後每格都符合 ---/:--:/--:
  let sepIdx = -1
  for (let i = 1; i < lines.length; i++) {
    const cells = splitRow(lines[i])
    if (cells.length > 0 && cells.every((c) => SEP_RE.test(c))) {
      sepIdx = i
      break
    }
  }
  if (sepIdx === -1) return fail('找不到分隔列(由 - 與 | 組成,例如 |---|---|)')
  const headerLine = lines[sepIdx - 1]
  const headers = splitRow(headerLine)
  const sepCells = splitRow(lines[sepIdx])
  const aligns: Align[] = sepCells.map((c) => {
    const l = c.startsWith(':')
    const r = c.endsWith(':')
    return l && r ? 'center' : r ? 'right' : 'left'
  })
  const body = lines.slice(sepIdx + 1).map((l) => {
    const cells = splitRow(l)
    // 補齊/裁切到表頭欄數
    const out = cells.slice(0, headers.length)
    while (out.length < headers.length) out.push('')
    return out
  })
  return { ok: true, table: { headers, rows: body }, aligns }
}
