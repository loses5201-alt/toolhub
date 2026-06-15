/*
  CSV ↔ JSON 轉換核心 —— 純前端、無相依套件,全程在瀏覽器處理。
  自製 CSV 解析器,正確處理引號內逗號、換行與跳脫雙引號("")。
*/

/** 解析 CSV/TSV 文字成二維陣列。支援雙引號包欄位、欄位內換行、"" 跳脫。 */
export function parseCSV(text: string, delimiter = ','): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  // 去除 BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  const n = text.length
  for (let i = 0; i < n; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === delimiter) {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      // 處理 \r\n:遇到 \r 時若下個是 \n 一起跳過
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      rows.push(row)
      row = []
    } else {
      field += c
    }
  }
  // 收尾最後一個欄位/列(若檔尾沒有換行)
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/** 二維陣列 + 表頭 → 物件陣列 */
export function rowsToObjects(rows: string[][], hasHeader: boolean): Record<string, string>[] {
  if (rows.length === 0) return []
  const headers = hasHeader
    ? rows[0].map((h, i) => h.trim() || `欄位${i + 1}`)
    : rows[0].map((_, i) => `欄位${i + 1}`)
  const body = hasHeader ? rows.slice(1) : rows
  return body.map((r) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => {
      obj[h] = r[i] ?? ''
    })
    return obj
  })
}

/** 單一欄位轉成安全的 CSV 字串(必要時加引號) */
function escapeField(v: unknown, delimiter: string): string {
  let s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
  if (s.includes('"') || s.includes(delimiter) || s.includes('\n') || s.includes('\r')) {
    s = '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

/** 物件陣列 → CSV 文字(自動蒐集所有出現過的鍵作為表頭) */
export function objectsToCSV(data: Record<string, unknown>[], delimiter = ','): string {
  if (data.length === 0) return ''
  const headers: string[] = []
  const seen = new Set<string>()
  for (const obj of data) {
    for (const k of Object.keys(obj)) {
      if (!seen.has(k)) {
        seen.add(k)
        headers.push(k)
      }
    }
  }
  const lines: string[] = []
  lines.push(headers.map((h) => escapeField(h, delimiter)).join(delimiter))
  for (const obj of data) {
    lines.push(headers.map((h) => escapeField(obj[h], delimiter)).join(delimiter))
  }
  return lines.join('\r\n')
}

/** 二維陣列(無物件化)→ CSV 文字 */
export function rowsToCSV(rows: string[][], delimiter = ','): string {
  return rows.map((r) => r.map((f) => escapeField(f, delimiter)).join(delimiter)).join('\r\n')
}
