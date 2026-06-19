/*
  等寬純文字表格引擎 —— 把 CSV/TSV 轉成在等寬字型下對齊的純文字表格(box-drawing / ASCII / 簡潔)。
  用於貼進純文字 email、程式碼註解、Slack、README 程式碼區塊、終端機文件。純函式、無 DOM,可在 Node 測。
*/
export type TableStyle = 'grid' | 'ascii' | 'simple'

/** 顯示寬度:CJK 全形字算 2,其餘算 1。 */
export function displayWidth(s: string): number {
  let w = 0
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0
    w += (cp >= 0x1100 && cp <= 0x115f) || (cp >= 0x2e80 && cp <= 0xa4cf) ||
      (cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xfe30 && cp <= 0xfe4f) || (cp >= 0xff00 && cp <= 0xff60) ||
      (cp >= 0xffe0 && cp <= 0xffe6) || (cp >= 0x20000 && cp <= 0x3fffd)
      ? 2
      : 1
  }
  return w
}

function pad(s: string, width: number, right: boolean): string {
  const gap = Math.max(0, width - displayWidth(s))
  return right ? ' '.repeat(gap) + s : s + ' '.repeat(gap)
}

function isNumeric(s: string): boolean {
  const t = s.trim().replace(/,/g, '')
  return t !== '' && !Number.isNaN(Number(t))
}

// CSV 解析(處理引號、跳脫 "" 、欄內逗號與換行)
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"'
          i++
        } else q = false
      } else cur += ch
    } else if (ch === '"') q = true
    else if (ch === ',') {
      row.push(cur)
      cur = ''
    } else if (ch === '\n') {
      row.push(cur)
      rows.push(row)
      row = []
      cur = ''
    } else if (ch !== '\r') cur += ch
  }
  row.push(cur)
  rows.push(row)
  // 去掉結尾因換行多出的空白列
  if (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') rows.pop()
  return rows
}

/** 解析貼上的內容為 string[][]。delimiter:'auto'(含 tab 視為 TSV,否則 CSV)/ ',' / '\t'。 */
export function parseDelimited(text: string, delimiter: 'auto' | ',' | '\t' = 'auto'): string[][] {
  const useTab = delimiter === '\t' || (delimiter === 'auto' && text.includes('\t'))
  if (useTab) {
    return text
      .replace(/\r/g, '')
      .split('\n')
      .filter((l, i, arr) => !(i === arr.length - 1 && l === '')) // 去結尾空行
      .map((l) => l.split('\t'))
  }
  return parseCSV(text)
}

const STYLES: Record<TableStyle, { tl: string; tm: string; tr: string; ml: string; mm: string; mr: string; bl: string; bm: string; br: string; h: string; v: string }> = {
  grid: { tl: '┌', tm: '┬', tr: '┐', ml: '├', mm: '┼', mr: '┤', bl: '└', bm: '┴', br: '┘', h: '─', v: '│' },
  ascii: { tl: '+', tm: '+', tr: '+', ml: '+', mm: '+', mr: '+', bl: '+', bm: '+', br: '+', h: '-', v: '|' },
  simple: { tl: '', tm: '', tr: '', ml: '', mm: '', mr: '', bl: '', bm: '', br: '', h: '-', v: '' },
}

export interface TextTableOpts {
  style?: TableStyle
  header?: boolean // 第一列當表頭
  rightNumeric?: boolean // 純數字欄右對齊
}

export function toTextTable(rows: string[][], opts: TextTableOpts = {}): string {
  const { style = 'grid', header = true, rightNumeric = true } = opts
  if (!rows.length) return ''
  const cols = Math.max(...rows.map((r) => r.length))
  const norm = rows.map((r) => {
    const a = r.slice()
    while (a.length < cols) a.push('')
    return a.map((c) => String(c ?? '').replace(/[\r\n\t]+/g, ' '))
  })
  const widths: number[] = []
  for (let c = 0; c < cols; c++) {
    let w = 0
    for (const r of norm) w = Math.max(w, displayWidth(r[c]))
    widths.push(w)
  }
  const bodyStart = header ? 1 : 0
  const body = norm.slice(bodyStart)
  const rightCol = widths.map((_, c) =>
    rightNumeric && body.length > 0 && body.every((r) => r[c].trim() === '' || isNumeric(r[c])) && body.some((r) => isNumeric(r[c])),
  )

  const s = STYLES[style]
  const border = (l: string, m: string, r: string) =>
    l + widths.map((w) => s.h.repeat(w + 2)).join(m) + r
  const rowLine = (cells: string[]) =>
    s.v + cells.map((c, i) => ' ' + pad(c, widths[i], rightCol[i]) + ' ').join(s.v) + s.v

  if (style === 'simple') {
    const out: string[] = []
    const renderRow = (cells: string[]) =>
      cells.map((c, i) => pad(c, widths[i], rightCol[i])).join('  ').replace(/\s+$/, '')
    norm.forEach((r, i) => {
      out.push(renderRow(r))
      if (header && i === 0) out.push(widths.map((w) => '-'.repeat(w)).join('  '))
    })
    return out.join('\n')
  }

  const out: string[] = [border(s.tl, s.tm, s.tr)]
  norm.forEach((r, i) => {
    out.push(rowLine(r))
    if (header && i === 0) out.push(border(s.ml, s.mm, s.mr))
  })
  out.push(border(s.bl, s.bm, s.br))
  return out.join('\n')
}
