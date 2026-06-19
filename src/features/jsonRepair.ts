/*
  JSON 修復 / 寬鬆解析核心 —— 容忍常見的「不嚴謹 JSON」並還原成標準 JSON:
  單引號、未加引號的物件鍵、結尾多餘逗號、// 與 /* *​/ 註解、Python 風格 None/True/False、
  NaN/Infinity(轉 null)。以小型遞迴下降解析器處理,純函式、無 DOM,可在 Node 測。
  全程瀏覽器、不連網、不上傳。
*/

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [k: string]: JsonValue }

class Parser {
  private s: string
  private i = 0
  constructor(input: string) {
    this.s = input
  }

  parse(): JsonValue {
    this.skip()
    const v = this.value()
    this.skip()
    if (this.i < this.s.length) {
      throw new Error(`第 ${this.i} 個字元後有多餘內容:${JSON.stringify(this.s.slice(this.i, this.i + 16))}`)
    }
    return v
  }

  private skip(): void {
    for (;;) {
      const c = this.s[this.i]
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f' || c === '\v' || c === '﻿') {
        this.i++
      } else if (c === '/' && this.s[this.i + 1] === '/') {
        this.i += 2
        while (this.i < this.s.length && this.s[this.i] !== '\n') this.i++
      } else if (c === '/' && this.s[this.i + 1] === '*') {
        this.i += 2
        while (this.i < this.s.length && !(this.s[this.i] === '*' && this.s[this.i + 1] === '/')) this.i++
        if (this.i < this.s.length) this.i += 2
      } else {
        break
      }
    }
  }

  private value(): JsonValue {
    const c = this.s[this.i]
    if (c === undefined) throw new Error('內容意外結束。')
    if (c === '{') return this.object()
    if (c === '[') return this.array()
    if (c === '"' || c === "'") return this.string(c)
    if (c === '-' || c === '+' || (c >= '0' && c <= '9') || c === '.') return this.number()
    return this.literal()
  }

  private object(): { [k: string]: JsonValue } {
    this.i++ // {
    const obj: { [k: string]: JsonValue } = {}
    this.skip()
    if (this.s[this.i] === '}') {
      this.i++
      return obj
    }
    for (;;) {
      this.skip()
      const key = this.key()
      this.skip()
      if (this.s[this.i] !== ':') throw new Error(`物件鍵 "${key}" 後缺少冒號(位置 ${this.i})。`)
      this.i++ // :
      this.skip()
      obj[key] = this.value()
      this.skip()
      const ch = this.s[this.i]
      if (ch === ',') {
        this.i++
        this.skip()
        if (this.s[this.i] === '}') {
          // 結尾多餘逗號
          this.i++
          return obj
        }
        continue
      }
      if (ch === '}') {
        this.i++
        return obj
      }
      throw new Error(`物件內容格式錯誤(位置 ${this.i}),預期 , 或 }。`)
    }
  }

  private key(): string {
    const c = this.s[this.i]
    if (c === '"' || c === "'") return this.string(c)
    // 未加引號的鍵:讀到冒號/空白/結束前的識別字
    const start = this.i
    while (this.i < this.s.length && /[^\s:,{}[\]"']/.test(this.s[this.i])) this.i++
    if (this.i === start) throw new Error(`位置 ${this.i} 預期物件鍵。`)
    return this.s.slice(start, this.i)
  }

  private array(): JsonValue[] {
    this.i++ // [
    const arr: JsonValue[] = []
    this.skip()
    if (this.s[this.i] === ']') {
      this.i++
      return arr
    }
    for (;;) {
      this.skip()
      arr.push(this.value())
      this.skip()
      const ch = this.s[this.i]
      if (ch === ',') {
        this.i++
        this.skip()
        if (this.s[this.i] === ']') {
          this.i++
          return arr
        }
        continue
      }
      if (ch === ']') {
        this.i++
        return arr
      }
      throw new Error(`陣列內容格式錯誤(位置 ${this.i}),預期 , 或 ]。`)
    }
  }

  private string(quote: string): string {
    this.i++ // 開頭引號
    let out = ''
    while (this.i < this.s.length) {
      const c = this.s[this.i]
      if (c === quote) {
        this.i++
        return out
      }
      if (c === '\\') {
        const n = this.s[this.i + 1]
        switch (n) {
          case 'n': out += '\n'; break
          case 't': out += '\t'; break
          case 'r': out += '\r'; break
          case 'b': out += '\b'; break
          case 'f': out += '\f'; break
          case 'v': out += '\v'; break
          case '0': out += '\0'; break
          case '/': out += '/'; break
          case '\\': out += '\\'; break
          case '"': out += '"'; break
          case "'": out += "'"; break
          case '`': out += '`'; break
          case 'u': {
            const hex = this.s.slice(this.i + 2, this.i + 6)
            if (/^[0-9a-fA-F]{4}$/.test(hex)) {
              out += String.fromCharCode(parseInt(hex, 16))
              this.i += 6
              continue
            }
            out += 'u'
            break
          }
          case 'x': {
            const hex = this.s.slice(this.i + 2, this.i + 4)
            if (/^[0-9a-fA-F]{2}$/.test(hex)) {
              out += String.fromCharCode(parseInt(hex, 16))
              this.i += 4
              continue
            }
            out += 'x'
            break
          }
          case undefined:
            throw new Error('字串在跳脫字元後意外結束。')
          default:
            out += n // 未知跳脫:保留其後字元
        }
        this.i += 2
        continue
      }
      out += c
      this.i++
    }
    throw new Error('字串沒有結尾引號。')
  }

  private number(): number {
    const start = this.i
    if (this.s[this.i] === '+' || this.s[this.i] === '-') this.i++
    // Infinity(可帶正負號)
    if (this.s.slice(this.i, this.i + 8) === 'Infinity') {
      this.i += 8
      return this.s[start] === '-' ? -Infinity : Infinity
    }
    while (this.i < this.s.length && /[0-9a-fA-FxX.+eE_]/.test(this.s[this.i])) this.i++
    const raw = this.s.slice(start, this.i).replace(/_/g, '')
    let n: number
    if (/^[+-]?0[xX][0-9a-fA-F]+$/.test(raw)) n = parseInt(raw, 16)
    else n = Number(raw)
    if (!Number.isFinite(n) && !/Infinity/.test(raw)) {
      throw new Error(`無法解析的數字:${JSON.stringify(raw)}`)
    }
    return n
  }

  private literal(): JsonValue {
    const start = this.i
    while (this.i < this.s.length && /[A-Za-z]/.test(this.s[this.i])) this.i++
    const word = this.s.slice(start, this.i)
    switch (word) {
      case 'true':
      case 'True':
        return true
      case 'false':
      case 'False':
        return false
      case 'null':
      case 'None':
      case 'undefined':
        return null
      case 'NaN':
        return null // JSON 無 NaN,轉 null
      case 'Infinity':
        return Infinity
      default:
        throw new Error(`無法辨識的字詞:${JSON.stringify(word || this.s[this.i] || '(結束)')}(位置 ${start})。`)
    }
  }
}

/** 把非有限數(NaN/Infinity)替換成 null,讓 JSON.stringify 不丟出 null 以外的非法值。 */
function sanitize(v: JsonValue): JsonValue {
  if (typeof v === 'number' && !Number.isFinite(v)) return null
  if (Array.isArray(v)) return v.map(sanitize)
  if (v && typeof v === 'object') {
    const out: { [k: string]: JsonValue } = {}
    for (const k of Object.keys(v)) out[k] = sanitize((v as Record<string, JsonValue>)[k])
    return out
  }
  return v
}

export interface RepairResult {
  ok: boolean
  value?: JsonValue
  json?: string // 格式化後的標準 JSON
  minified?: string
  error?: string
}

/** 寬鬆解析並輸出標準 JSON。indent 為縮排空格數(預設 2)。 */
export function repairJson(input: string, indent = 2): RepairResult {
  if (input.trim() === '') return { ok: false, error: '輸入為空。' }
  try {
    const value = sanitize(new Parser(input).parse())
    return {
      ok: true,
      value,
      json: JSON.stringify(value, null, indent),
      minified: JSON.stringify(value),
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
