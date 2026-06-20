/*
  TOML ↔ JSON 轉換引擎 —— 純函式、無 DOM,可在 Node 測。
  支援常見 TOML 子集(足以處理 Cargo.toml / pyproject.toml / netlify.toml 等設定):
    註解 #、bare/quoted/dotted 鍵、[table]、[a.b.c] 巢狀、[[array of table]]、
    inline table { x = 1 }、陣列(可跨行、可含註解)、
    字串(基本 "..."、字面 '...'、多行 """...""" / '''...''')、
    整數(含 +/-、底線、0x/0o/0b)、浮點(含 e、inf、nan)、布林、
    日期時間(RFC3339,保留為字串)。
  解析失敗誠實報錯(附行號);序列化把 JSON 物件倒回 TOML。
*/

type Json = unknown

export interface TomlResult {
  data: Record<string, Json>
  error: string
}

const BARE_KEY = /^[A-Za-z0-9_-]+$/
const DATETIME =
  /^\d{4}-\d{2}-\d{2}([Tt ]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})?)?$/
const LOCAL_TIME = /^\d{2}:\d{2}:\d{2}(\.\d+)?$/

class TomlParser {
  text: string
  pos = 0
  constructor(text: string) {
    this.text = text
  }
  private lineAt(pos: number): number {
    let n = 1
    for (let i = 0; i < pos && i < this.text.length; i++) if (this.text[i] === '\n') n++
    return n
  }
  private err(msg: string): never {
    throw new Error(`第 ${this.lineAt(this.pos)} 行:${msg}`)
  }
  private peek(): string {
    return this.text[this.pos] ?? ''
  }
  // 跳過行內空白(不含換行)
  private skipInline() {
    while (this.pos < this.text.length && (this.text[this.pos] === ' ' || this.text[this.pos] === '\t')) this.pos++
  }
  // 跳過空白、換行與註解(value/陣列內用)
  private skipWsAndComments() {
    for (;;) {
      const c = this.text[this.pos]
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') this.pos++
      else if (c === '#') {
        while (this.pos < this.text.length && this.text[this.pos] !== '\n') this.pos++
      } else break
    }
  }

  parse(): Record<string, Json> {
    const root: Record<string, Json> = {}
    let current = root
    for (;;) {
      this.skipWsAndComments()
      if (this.pos >= this.text.length) break
      const c = this.peek()
      if (c === '[') {
        if (this.text[this.pos + 1] === '[') {
          this.pos += 2
          const path = this.parseKeyPath()
          this.skipInline()
          if (this.text.slice(this.pos, this.pos + 2) !== ']]') this.err('陣列表頭缺少 "]]"')
          this.pos += 2
          current = this.pushArrayTable(root, path)
        } else {
          this.pos += 1
          const path = this.parseKeyPath()
          this.skipInline()
          if (this.peek() !== ']') this.err('表頭缺少 "]"')
          this.pos += 1
          current = this.ensureTable(root, path)
        }
        this.expectLineEnd()
      } else {
        const path = this.parseKeyPath()
        this.skipInline()
        if (this.peek() !== '=') this.err('鍵後缺少 "="')
        this.pos += 1
        this.skipInline()
        const value = this.parseValue()
        this.assign(current, path, value)
        this.expectLineEnd()
      }
    }
    return root
  }

  // 解析點分鍵路徑 a.b."c d"
  private parseKeyPath(): string[] {
    const keys: string[] = []
    for (;;) {
      this.skipInline()
      keys.push(this.parseKey())
      this.skipInline()
      if (this.peek() === '.') {
        this.pos++
        continue
      }
      break
    }
    return keys
  }
  private parseKey(): string {
    const c = this.peek()
    if (c === '"' || c === "'") return this.parseQuotedString()
    let s = ''
    while (this.pos < this.text.length && /[A-Za-z0-9_-]/.test(this.text[this.pos])) s += this.text[this.pos++]
    if (!s) this.err('預期一個鍵名')
    return s
  }

  private parseValue(): Json {
    const c = this.peek()
    if (c === '"' || c === "'") return this.parseStringValue()
    if (c === '[') return this.parseArray()
    if (c === '{') return this.parseInlineTable()
    // bare token:讀到分隔符為止(逗號 ] } # 換行)
    let raw = ''
    while (this.pos < this.text.length && !',]}#\n'.includes(this.text[this.pos])) raw += this.text[this.pos++]
    raw = raw.trim()
    if (!raw) this.err('預期一個值')
    return this.parseScalar(raw)
  }

  private parseScalar(raw: string): Json {
    if (raw === 'true') return true
    if (raw === 'false') return false
    if (DATETIME.test(raw) || LOCAL_TIME.test(raw)) return raw // 日期時間保留為字串
    // 數字
    const num = this.parseNumber(raw)
    if (num !== undefined) return num
    this.err(`無法解析的值:${raw.slice(0, 30)}`)
  }

  private parseNumber(raw: string): number | undefined {
    let s = raw
    if (/^[+-]?inf$/.test(s)) return s[0] === '-' ? -Infinity : Infinity
    if (/^[+-]?nan$/.test(s)) return NaN
    // 進位前綴
    if (/^0x[0-9A-Fa-f_]+$/.test(s)) return parseInt(s.slice(2).replace(/_/g, ''), 16)
    if (/^0o[0-7_]+$/.test(s)) return parseInt(s.slice(2).replace(/_/g, ''), 8)
    if (/^0b[01_]+$/.test(s)) return parseInt(s.slice(2).replace(/_/g, ''), 2)
    s = s.replace(/_/g, '')
    if (/^[+-]?(\d+)(\.\d+)?([eE][+-]?\d+)?$/.test(s)) {
      const n = Number(s)
      return Number.isNaN(n) ? undefined : n
    }
    return undefined
  }

  private parseStringValue(): string {
    const c = this.peek()
    const triple = this.text.slice(this.pos, this.pos + 3)
    if (triple === '"""' || triple === "'''") return this.parseMultiline(c)
    return this.parseQuotedString()
  }

  // 單行 "..." 或 '...'
  private parseQuotedString(): string {
    const q = this.text[this.pos++]
    const literal = q === "'"
    let s = ''
    while (this.pos < this.text.length) {
      const ch = this.text[this.pos++]
      if (ch === '\n') this.err('字串未結束')
      if (ch === q) return s
      if (!literal && ch === '\\') {
        s += this.readEscape()
      } else {
        s += ch
      }
    }
    this.err('字串未結束')
  }

  private parseMultiline(q: string): string {
    const literal = q === "'"
    this.pos += 3
    // 緊接的換行去掉
    if (this.text[this.pos] === '\r') this.pos++
    if (this.text[this.pos] === '\n') this.pos++
    const close = q.repeat(3)
    let s = ''
    while (this.pos < this.text.length) {
      if (this.text.slice(this.pos, this.pos + 3) === close) {
        this.pos += 3
        return s
      }
      const ch = this.text[this.pos++]
      if (!literal && ch === '\\') {
        // 行尾反斜線:吃掉後續空白與換行(line-ending backslash)
        let j = this.pos
        while (j < this.text.length && (this.text[j] === ' ' || this.text[j] === '\t' || this.text[j] === '\r')) j++
        if (this.text[j] === '\n') {
          this.pos = j + 1
          while (this.pos < this.text.length && /[ \t\r\n]/.test(this.text[this.pos])) this.pos++
          continue
        }
        s += this.readEscape()
      } else {
        s += ch
      }
    }
    this.err('多行字串未結束')
  }

  private readEscape(): string {
    const e = this.text[this.pos++]
    switch (e) {
      case 'n': return '\n'
      case 't': return '\t'
      case 'r': return '\r'
      case '"': return '"'
      case '\\': return '\\'
      case 'b': return '\b'
      case 'f': return '\f'
      case 'u': {
        const hex = this.text.slice(this.pos, this.pos + 4)
        this.pos += 4
        return String.fromCodePoint(parseInt(hex, 16))
      }
      case 'U': {
        const hex = this.text.slice(this.pos, this.pos + 8)
        this.pos += 8
        return String.fromCodePoint(parseInt(hex, 16))
      }
      default:
        this.err(`未知的跳脫字元 \\${e}`)
    }
  }

  private parseArray(): Json[] {
    this.pos++ // [
    const arr: Json[] = []
    for (;;) {
      this.skipWsAndComments()
      if (this.peek() === ']') {
        this.pos++
        return arr
      }
      arr.push(this.parseValue())
      this.skipWsAndComments()
      if (this.peek() === ',') {
        this.pos++
        continue
      }
      if (this.peek() === ']') {
        this.pos++
        return arr
      }
      this.err('陣列元素之間缺少 "," 或結尾 "]"')
    }
  }

  private parseInlineTable(): Record<string, Json> {
    this.pos++ // {
    const obj: Record<string, Json> = {}
    this.skipInline()
    if (this.peek() === '}') {
      this.pos++
      return obj
    }
    for (;;) {
      this.skipInline()
      const path = this.parseKeyPath()
      this.skipInline()
      if (this.peek() !== '=') this.err('inline table 鍵後缺少 "="')
      this.pos++
      this.skipInline()
      this.assign(obj, path, this.parseValue())
      this.skipInline()
      if (this.peek() === ',') {
        this.pos++
        continue
      }
      if (this.peek() === '}') {
        this.pos++
        return obj
      }
      this.err('inline table 缺少 "," 或 "}"')
    }
  }

  private expectLineEnd() {
    this.skipInline()
    const c = this.peek()
    if (c === '#') {
      while (this.pos < this.text.length && this.text[this.pos] !== '\n') this.pos++
      return
    }
    if (c === '' || c === '\n' || c === '\r') return
    this.err(`一行只能有一個設定,多餘內容:${c}`)
  }

  // 取得/建立巢狀表
  private ensureTable(root: Record<string, Json>, path: string[]): Record<string, Json> {
    let cur = root
    for (const k of path) {
      const existing = cur[k]
      if (existing === undefined) {
        const t: Record<string, Json> = {}
        cur[k] = t
        cur = t
      } else if (Array.isArray(existing)) {
        cur = existing[existing.length - 1] as Record<string, Json>
      } else if (typeof existing === 'object' && existing !== null) {
        cur = existing as Record<string, Json>
      } else {
        this.err(`「${k}」已被定義為非表的值`)
      }
    }
    return cur
  }

  private pushArrayTable(root: Record<string, Json>, path: string[]): Record<string, Json> {
    const parent = this.ensureTable(root, path.slice(0, -1))
    const last = path[path.length - 1]
    let arr = parent[last]
    if (arr === undefined) {
      arr = []
      parent[last] = arr
    }
    if (!Array.isArray(arr)) this.err(`「${last}」不是陣列表`)
    const item: Record<string, Json> = {}
    ;(arr as Json[]).push(item)
    return item
  }

  private assign(target: Record<string, Json>, path: string[], value: Json) {
    let cur = target
    for (let i = 0; i < path.length - 1; i++) {
      const k = path[i]
      const ex = cur[k]
      if (ex === undefined) {
        const t: Record<string, Json> = {}
        cur[k] = t
        cur = t
      } else if (typeof ex === 'object' && ex !== null && !Array.isArray(ex)) {
        cur = ex as Record<string, Json>
      } else {
        this.err(`「${k}」已被定義,無法當作表使用`)
      }
    }
    cur[path[path.length - 1]] = value
  }
}

export function parseToml(text: string): TomlResult {
  try {
    const data = new TomlParser(text).parse()
    return { data, error: '' }
  } catch (e) {
    return { data: {}, error: e instanceof Error ? e.message : '解析失敗' }
  }
}

// ---------- 序列化:JSON 物件 → TOML ----------

function isPlainObject(v: Json): v is Record<string, Json> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
function isArrayOfTables(v: Json): boolean {
  return Array.isArray(v) && v.length > 0 && v.every(isPlainObject)
}
function keyStr(k: string): string {
  return BARE_KEY.test(k) ? k : '"' + k.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
}
function pathStr(path: string[]): string {
  return path.map(keyStr).join('.')
}
function fmtScalar(v: Json): string {
  if (v === null) return '""'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') {
    if (Number.isNaN(v)) return 'nan'
    if (v === Infinity) return 'inf'
    if (v === -Infinity) return '-inf'
    return String(v)
  }
  if (typeof v === 'string') {
    return '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/\r/g, '\\r') + '"'
  }
  if (Array.isArray(v)) return '[' + v.map(fmtScalar).join(', ') + ']'
  if (isPlainObject(v)) {
    const inner = Object.entries(v).map(([k, val]) => `${keyStr(k)} = ${fmtScalar(val)}`)
    return '{ ' + inner.join(', ') + ' }'
  }
  return '""'
}

function emitTable(obj: Record<string, Json>, path: string[], out: string[]) {
  const subTables: [string, Record<string, Json>][] = []
  const arrTables: [string, Json[]][] = []
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue
    if (isPlainObject(v)) subTables.push([k, v])
    else if (isArrayOfTables(v)) arrTables.push([k, v as Json[]])
    else out.push(`${keyStr(k)} = ${fmtScalar(v)}`)
  }
  for (const [k, sub] of subTables) {
    const childPath = [...path, k]
    out.push('', `[${pathStr(childPath)}]`)
    emitTable(sub, childPath, out)
  }
  for (const [k, arr] of arrTables) {
    const childPath = [...path, k]
    for (const item of arr) {
      out.push('', `[[${pathStr(childPath)}]]`)
      emitTable(item as Record<string, Json>, childPath, out)
    }
  }
}

export function stringifyToml(value: Json): { toml: string; error: string } {
  if (!isPlainObject(value)) return { toml: '', error: '需要一個 JSON 物件(TOML 的最外層必須是表)。' }
  const out: string[] = []
  emitTable(value, [], out)
  // 去掉開頭多餘空行
  while (out[0] === '') out.shift()
  return { toml: out.join('\n'), error: '' }
}

export function tomlToJson(text: string): { json: string; error: string } {
  const { data, error } = parseToml(text)
  if (error) return { json: '', error }
  return { json: JSON.stringify(data, null, 2), error: '' }
}

export function jsonToToml(text: string): { toml: string; error: string } {
  let parsed: Json
  try {
    parsed = JSON.parse(text)
  } catch {
    return { toml: '', error: 'JSON 格式錯誤,請檢查語法。' }
  }
  return stringifyToml(parsed)
}
