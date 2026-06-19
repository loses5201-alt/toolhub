/*
  .env ↔ JSON / shell 轉換引擎(純函式、無 DOM,可在 Node 測)。
  解析寬鬆但合理:支援 # 註解、空白行、選用 export 前綴、單/雙引號值與跳脫,
  無引號值會去除行內 # 註解;序列化時必要才加引號。
*/
export interface EnvPair {
  key: string
  value: string
}
export interface ParseResult {
  pairs: EnvPair[]
  errors: { line: number; message: string }[]
}

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/

// 雙引號值:處理 \n \t \r \\ \" 跳脫
function unescapeDouble(s: string): string {
  return s.replace(/\\(["\\nrt])/g, (_, c) => {
    if (c === 'n') return '\n'
    if (c === 'r') return '\r'
    if (c === 't') return '\t'
    return c // " 或 \
  })
}

export function parseDotenv(text: string): ParseResult {
  const pairs: EnvPair[] = []
  const errors: { line: number; message: string }[] = []
  const lines = text.split(/\r?\n/)
  lines.forEach((raw, idx) => {
    const lineNo = idx + 1
    let line = raw.trim()
    if (!line || line.startsWith('#')) return
    if (line.startsWith('export ')) line = line.slice(7).trim()
    const eq = line.indexOf('=')
    if (eq < 0) {
      errors.push({ line: lineNo, message: `第 ${lineNo} 行沒有 "=",已略過:${raw.trim().slice(0, 40)}` })
      return
    }
    const key = line.slice(0, eq).trim()
    if (!KEY_RE.test(key)) {
      errors.push({ line: lineNo, message: `第 ${lineNo} 行的名稱「${key}」不合法(需英文/底線開頭),已略過` })
      return
    }
    let rest = line.slice(eq + 1).trim()
    let value: string
    if (rest.startsWith('"')) {
      const end = findClosing(rest, '"')
      if (end < 0) {
        errors.push({ line: lineNo, message: `第 ${lineNo} 行的雙引號未結束,已略過` })
        return
      }
      value = unescapeDouble(rest.slice(1, end))
    } else if (rest.startsWith("'")) {
      const end = rest.indexOf("'", 1) // 單引號內不處理跳脫
      if (end < 0) {
        errors.push({ line: lineNo, message: `第 ${lineNo} 行的單引號未結束,已略過` })
        return
      }
      value = rest.slice(1, end)
    } else {
      // 無引號:去除行內 # 註解(前面需有空白或位於開頭)
      const hash = rest.search(/\s#/)
      if (hash >= 0) rest = rest.slice(0, hash)
      value = rest.trim()
    }
    // 同名後者覆蓋前者
    const existing = pairs.find((p) => p.key === key)
    if (existing) existing.value = value
    else pairs.push({ key, value })
  })
  return { pairs, errors }
}

// 找出從 0 開始的引號對應結束位置(考慮 \" 跳脫),回傳結束引號索引或 -1
function findClosing(s: string, q: string): number {
  for (let i = 1; i < s.length; i++) {
    if (s[i] === '\\') {
      i++
      continue
    }
    if (s[i] === q) return i
  }
  return -1
}

// 序列化成 .env:含空白/#/引號/換行才用雙引號並跳脫
export function stringifyDotenv(pairs: EnvPair[]): string {
  return pairs
    .map(({ key, value }) => {
      if (/[\s#"'\\]/.test(value) || value === '') {
        const esc = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
        return `${key}="${esc}"`
      }
      return `${key}=${value}`
    })
    .join('\n')
}

// 序列化成 shell export(單引號最安全,內部 ' 以 '\'' 處理)
export function stringifyShell(pairs: EnvPair[]): string {
  return pairs
    .map(({ key, value }) => `export ${key}='${value.replace(/'/g, "'\\''")}'`)
    .join('\n')
}

export function pairsToJson(pairs: EnvPair[]): string {
  const obj: Record<string, string> = {}
  for (const { key, value } of pairs) obj[key] = value
  return JSON.stringify(obj, null, 2)
}

export function jsonToPairs(text: string): { pairs: EnvPair[]; error: string } {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { pairs: [], error: 'JSON 格式錯誤,請檢查語法。' }
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { pairs: [], error: '需要一個 JSON 物件(鍵值對),例如 { "PORT": "3000" }。' }
  }
  const pairs: EnvPair[] = []
  for (const [key, v] of Object.entries(data as Record<string, unknown>)) {
    if (!KEY_RE.test(key)) return { pairs: [], error: `名稱「${key}」不合法(需英文/底線開頭、不含空白)。` }
    if (v !== null && typeof v === 'object') return { pairs: [], error: `「${key}」的值是物件/陣列,.env 只能放單純文字。` }
    pairs.push({ key, value: v === null ? '' : String(v) })
  }
  return { pairs, error: '' }
}
