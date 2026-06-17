/*
  合併列印 / 套印引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  用一份範本(內含 {{欄位}} 佔位符)+ 一份表格資料(第一列為欄位名),
  幫每一筆資料各產生一段「填好姓名等內容」的文字 —— 例如要傳給很多人的年節祝福、開會通知、
  繳費提醒、邀請函,逐一改名字很煩又容易出錯。線上合併列印服務常要你上傳含個資的名單;
  本引擎全程在瀏覽器處理、不上傳。
*/

/** 取出範本中所有 {{欄位}} 佔位符(去重、保留首次出現順序)。 */
export function extractPlaceholders(template: string): string[] {
  const re = /\{\{\s*([^{}]+?)\s*\}\}/g
  const seen = new Set<string>()
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(template)) !== null) {
    const key = m[1].trim()
    if (key && !seen.has(key)) {
      seen.add(key)
      out.push(key)
    }
  }
  return out
}

export interface Table {
  headers: string[]
  rows: string[][]
}

/**
 * 解析表格文字。自動判斷分隔符(有 Tab 用 Tab,否則用逗號),支援以雙引號包住含分隔符/換行的欄位。
 * 第一列為欄位名。略過完全空白的列。
 */
export function parseTable(text: string): Table {
  const delim = text.includes('\t') ? '\t' : ','
  const records = parseDelimited(text, delim)
  // 去除尾端全空白列
  const cleaned = records.filter((r) => r.some((c) => c.trim() !== ''))
  if (cleaned.length === 0) return { headers: [], rows: [] }
  const headers = cleaned[0].map((h) => h.trim())
  const rows = cleaned.slice(1)
  return { headers, rows }
}

/** 最小 CSV/TSV 解析:處理引號、引號內分隔符與換行、跳脫的雙引號("")。 */
function parseDelimited(text: string, delim: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delim) {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  // 收尾最後一個欄位/列
  row.push(field)
  rows.push(row)
  return rows
}

export interface MergeResult {
  ok: boolean
  error?: string
  outputs: string[] // 每筆一段文字
  placeholders: string[] // 範本用到的欄位
  headers: string[] // 資料提供的欄位
  missingFields: string[] // 範本要、但資料沒有的欄位
  count: number // 產生的筆數
}

/**
 * 執行合併。把每列資料依欄位名填入範本佔位符。
 * 缺少的欄位以空字串代入(並在 missingFields 回報);資料多出的欄位忽略。
 */
export function merge(template: string, dataText: string): MergeResult {
  const placeholders = extractPlaceholders(template)
  const { headers, rows } = parseTable(dataText)

  const base: Omit<MergeResult, 'ok' | 'error'> = {
    outputs: [],
    placeholders,
    headers,
    missingFields: placeholders.filter((p) => !headers.includes(p)),
    count: 0,
  }

  if (!template.trim()) return { ...base, ok: false, error: '請輸入範本' }
  if (headers.length === 0) return { ...base, ok: false, error: '請貼上資料(第一列為欄位名)' }

  const idx = new Map<string, number>()
  headers.forEach((h, i) => idx.set(h, i))

  const outputs = rows.map((cells) =>
    template.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_full, rawKey) => {
      const key = String(rawKey).trim()
      const col = idx.get(key)
      return col != null ? (cells[col] ?? '').trim() : ''
    }),
  )

  return { ...base, ok: true, outputs, count: outputs.length }
}
