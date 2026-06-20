// NDJSON / JSON Lines 工具 —— 在「每行一個 JSON」(log、資料匯出、ML 資料集、串流 API)與
// 「JSON 陣列」之間互轉,並逐行回報哪一行壞掉。純函式、無 DOM,可在 Node 測試。

export interface LineError {
  line: number // 1-indexed
  message: string
}

export interface ParseResult {
  values: unknown[]
  errors: LineError[]
  ok: boolean
  lineCount: number // 實際解析的非空行數
}

// 解析 NDJSON 文字:逐行(忽略空白行)JSON.parse,壞掉的行記下行號
export function parseNdjson(text: string): ParseResult {
  const lines = text.split(/\r?\n/)
  const values: unknown[] = []
  const errors: LineError[] = []
  let lineCount = 0
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (raw.trim() === '') continue
    lineCount++
    try {
      values.push(JSON.parse(raw))
    } catch (e) {
      errors.push({ line: i + 1, message: (e as Error).message })
    }
  }
  return { values, errors, ok: errors.length === 0, lineCount }
}

// 逐行驗證(供 UI 標示哪行紅燈)
export interface LineStatus {
  line: number
  ok: boolean
  message?: string
  blank?: boolean
}
export function validateLines(text: string): LineStatus[] {
  const lines = text.split(/\r?\n/)
  const out: LineStatus[] = []
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (raw.trim() === '') {
      out.push({ line: i + 1, ok: true, blank: true })
      continue
    }
    try {
      JSON.parse(raw)
      out.push({ line: i + 1, ok: true })
    } catch (e) {
      out.push({ line: i + 1, ok: false, message: (e as Error).message })
    }
  }
  return out
}

export interface ToArrayResult {
  ok: boolean
  json?: string
  error?: string
  errors: LineError[]
  count: number
}

// NDJSON → JSON 陣列(美化縮排)。有任何壞行則 ok=false 並列出。
export function ndjsonToArray(text: string, indent = 2): ToArrayResult {
  const parsed = parseNdjson(text)
  if (!parsed.ok) {
    return {
      ok: false,
      error: `有 ${parsed.errors.length} 行無法解析`,
      errors: parsed.errors,
      count: parsed.values.length,
    }
  }
  return {
    ok: true,
    json: JSON.stringify(parsed.values, null, indent),
    errors: [],
    count: parsed.values.length,
  }
}

export interface FromArrayResult {
  ok: boolean
  ndjson?: string
  error?: string
  count: number
}

// JSON 陣列 → NDJSON(每個元素一行、各自壓成單行)
export function arrayToNdjson(jsonText: string): FromArrayResult {
  let data: unknown
  try {
    data = JSON.parse(jsonText)
  } catch (e) {
    return { ok: false, error: 'JSON 解析失敗:' + (e as Error).message, count: 0 }
  }
  if (!Array.isArray(data)) {
    return { ok: false, error: '輸入必須是 JSON 陣列(最外層為 [ ... ])才能轉成 NDJSON', count: 0 }
  }
  const lines = data.map((el) => JSON.stringify(el))
  return { ok: true, ndjson: lines.join('\n'), count: lines.length }
}

// 把已是 NDJSON 的內容重新壓成乾淨單行 NDJSON(去空白行、規整每行)
export function tidyNdjson(text: string): ToArrayResult {
  const parsed = parseNdjson(text)
  if (!parsed.ok) {
    return { ok: false, error: `有 ${parsed.errors.length} 行無法解析`, errors: parsed.errors, count: parsed.values.length }
  }
  return {
    ok: true,
    json: parsed.values.map((v) => JSON.stringify(v)).join('\n'),
    errors: [],
    count: parsed.values.length,
  }
}
