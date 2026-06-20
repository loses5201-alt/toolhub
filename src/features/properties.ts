/*
  Java .properties ↔ JSON 引擎 —— 純函式、無 DOM,可單獨被回歸測試。
  依 java.util.Properties 的解析規則:
    - # 或 ! 開頭(去前導空白後)為註解整行略過
    - 鍵與值以第一個未跳脫的 '='、':' 或空白分隔;分隔符前後空白略過
    - 行尾為奇數個反斜線時與下一行接續(續行的前導空白丟棄)
    - 跳脫:\t \n \r \f \\ \uXXXX,其餘 \x 視為字面 x(含 \= \: \# \! \空白)
  輸出為「扁平」物件(點號是鍵名的一部分,不展開成巢狀),確保來回轉換穩定。
*/

const WS = new Set([' ', '\t', '\f'])
const isWs = (c: string) => WS.has(c)

// 行尾連續反斜線數量為奇數 → 續行
function endsWithOddBackslash(line: string): boolean {
  let n = 0
  for (let i = line.length - 1; i >= 0 && line[i] === '\\'; i--) n++
  return n % 2 === 1
}

// 把自然行組成邏輯行,跳過註解/空白行並處理續行
export function logicalLines(text: string): string[] {
  const natural = text.split(/\r\n|\r|\n/)
  const out: string[] = []
  let i = 0
  while (i < natural.length) {
    const raw = natural[i]
    const trimmed = raw.replace(/^[ \t\f]+/, '')
    if (trimmed === '' || trimmed[0] === '#' || trimmed[0] === '!') {
      i++
      continue
    }
    let line = raw
    while (endsWithOddBackslash(line) && i + 1 < natural.length) {
      line = line.slice(0, -1)
      i++
      line += natural[i].replace(/^[ \t\f]+/, '')
    }
    out.push(line)
    i++
  }
  return out
}

// 從位置 i(指向 '\\')讀一個跳脫序列,回傳 [解碼字元, 下一個索引]
function readEscape(line: string, i: number): [string, number] {
  if (i + 1 >= line.length) return ['\\', i + 1]
  const c = line[i + 1]
  if (c === 'u') {
    const hex = line.slice(i + 2, i + 6)
    if (/^[0-9a-fA-F]{4}$/.test(hex)) {
      return [String.fromCharCode(parseInt(hex, 16)), i + 6]
    }
    return ['u', i + 2] // 不合法的 \u → 退化成字面 u
  }
  const map: Record<string, string> = { t: '\t', n: '\n', r: '\r', f: '\f' }
  return [map[c] ?? c, i + 2]
}

function parseLogicalLine(line: string): { key: string; val: string } {
  let i = 0
  const n = line.length
  while (i < n && isWs(line[i])) i++
  let key = ''
  while (i < n) {
    const c = line[i]
    if (c === '\\') {
      const [ch, ni] = readEscape(line, i)
      key += ch
      i = ni
      continue
    }
    if (c === '=' || c === ':' || isWs(c)) break
    key += c
    i++
  }
  while (i < n && isWs(line[i])) i++
  if (i < n && (line[i] === '=' || line[i] === ':')) {
    i++
    while (i < n && isWs(line[i])) i++
  }
  let val = ''
  while (i < n) {
    const c = line[i]
    if (c === '\\') {
      const [ch, ni] = readEscape(line, i)
      val += ch
      i = ni
      continue
    }
    val += c
    i++
  }
  return { key, val }
}

export interface ParseResult {
  ok: boolean
  data?: Record<string, string>
  error?: string
}

// .properties 文字 → 扁平鍵值物件(後出現的鍵覆蓋先前的,與 Java 一致)
export function parseProperties(text: string): ParseResult {
  const data: Record<string, string> = {}
  for (const line of logicalLines(text)) {
    const { key, val } = parseLogicalLine(line)
    if (key === '') continue
    data[key] = val
  }
  return { ok: true, data }
}

// 跳脫一個字串以寫回 .properties。escapeAllSpace=true 用於鍵(空白一律跳脫)。
function escape(s: string, escapeAllSpace: boolean): string {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    switch (c) {
      case ' ':
        out += escapeAllSpace || i === 0 ? '\\ ' : ' '
        break
      case '\\':
        out += '\\\\'
        break
      case '\t':
        out += '\\t'
        break
      case '\n':
        out += '\\n'
        break
      case '\r':
        out += '\\r'
        break
      case '\f':
        out += '\\f'
        break
      case '=':
      case ':':
      case '#':
      case '!':
        out += '\\' + c
        break
      default:
        out += c
    }
  }
  return out
}

// 把值強制轉成字串(物件/陣列以 JSON 字串呈現,null 視為空字串)
function valueToString(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') {
    return String(v)
  }
  return JSON.stringify(v)
}

export interface BuildResult {
  ok: boolean
  text?: string
  error?: string
}

// JSON 物件 → .properties 文字
export function jsonToProperties(json: string): BuildResult {
  let obj: unknown
  try {
    obj = JSON.parse(json)
  } catch (e) {
    return { ok: false, error: 'JSON 格式錯誤:' + (e as Error).message }
  }
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, error: '最外層必須是一個 JSON 物件(鍵值對)' }
  }
  const lines: string[] = []
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    lines.push(`${escape(k, true)}=${escape(valueToString(v), false)}`)
  }
  return { ok: true, text: lines.join('\n') }
}

// 解析 → 轉成漂亮 JSON 字串(供 UI 一次完成)
export function propertiesToJson(text: string, indent = 2): BuildResult {
  const r = parseProperties(text)
  if (!r.ok) return { ok: false, error: r.error }
  return { ok: true, text: JSON.stringify(r.data, null, indent) }
}
