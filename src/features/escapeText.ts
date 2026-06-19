/*
  文字跳脫 / 還原核心 —— 純函式、無 DOM,可在 Node 測。
  把文字轉成可貼進 JSON / 程式碼的跳脫字串,或把跳脫字串還原成原文。
  常見場景:把多行文字塞進 JSON 字串、讀懂含 \n \uXXXX 的 log/設定值。
  全程瀏覽器、不連網、不上傳。
*/

/** 文字 → JSON 字串(含外層雙引號,等同 JSON.stringify)。 */
export function toJsonString(s: string): string {
  return JSON.stringify(s)
}

/** 文字 → 跳脫內容(不含外層引號,可自選引號樣式做最小必要跳脫)。 */
export function escapeForQuote(s: string, quote: '"' | "'" | '`' = '"'): string {
  let out = ''
  for (const ch of s) {
    switch (ch) {
      case '\\':
        out += '\\\\'
        break
      case '\n':
        out += '\\n'
        break
      case '\r':
        out += '\\r'
        break
      case '\t':
        out += '\\t'
        break
      case '\b':
        out += '\\b'
        break
      case '\f':
        out += '\\f'
        break
      case '\v':
        out += '\\v'
        break
      case '\0':
        out += '\\0'
        break
      default:
        out += ch === quote ? '\\' + ch : ch
    }
  }
  return out
}

/** 文字 → 全部非 ASCII 轉 \uXXXX(逐 UTF-16 碼元,代理對自然成兩個 \u)。 */
export function escapeUnicode(s: string): string {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i)
    if (s[i] === '\\') {
      // 反斜線本身要跳脫,否則還原時會被誤判為跳脫序列
      out += '\\\\'
    } else if (code < 0x20) {
      // 控制字元也轉 \uXXXX,確保可逆且可見
      out += '\\u' + code.toString(16).padStart(4, '0')
    } else if (code > 0x7e) {
      out += '\\u' + code.toString(16).padStart(4, '0')
    } else {
      out += s[i]
    }
  }
  return out
}

export interface UnescapeResult {
  ok: boolean
  value?: string
  error?: string
}

/**
 * 跳脫字串 → 原文。支援 \n \r \t \b \f \v \0 \\ \" \' \` \/,
 * \xXX(2 位十六進位)、\uXXXX(4 位)、\u{...}(ES6 變長)。
 * 若外層被引號包住會自動去掉一層成對引號。未知跳脫(如 \q)保留其後字元。
 */
export function unescapeString(input: string): UnescapeResult {
  let s = input
  // 去掉成對外層引號
  if (
    s.length >= 2 &&
    (s[0] === '"' || s[0] === "'" || s[0] === '`') &&
    s[s.length - 1] === s[0]
  ) {
    s = s.slice(1, -1)
  }

  let out = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch !== '\\') {
      out += ch
      continue
    }
    if (i + 1 >= s.length) return { ok: false, error: '結尾有單獨的反斜線 \\' }
    const next = s[++i]
    switch (next) {
      case 'n':
        out += '\n'
        break
      case 'r':
        out += '\r'
        break
      case 't':
        out += '\t'
        break
      case 'b':
        out += '\b'
        break
      case 'f':
        out += '\f'
        break
      case 'v':
        out += '\v'
        break
      case '0':
        out += '\0'
        break
      case '\\':
        out += '\\'
        break
      case '"':
        out += '"'
        break
      case "'":
        out += "'"
        break
      case '`':
        out += '`'
        break
      case '/':
        out += '/'
        break
      case 'x': {
        const hex = s.slice(i + 1, i + 3)
        if (!/^[0-9a-fA-F]{2}$/.test(hex)) return { ok: false, error: `\\x 後需要 2 位十六進位,但讀到「${hex}」` }
        out += String.fromCharCode(parseInt(hex, 16))
        i += 2
        break
      }
      case 'u': {
        if (s[i + 1] === '{') {
          const end = s.indexOf('}', i + 2)
          if (end === -1) return { ok: false, error: '\\u{ 缺少結尾的 }' }
          const hex = s.slice(i + 2, end)
          if (!/^[0-9a-fA-F]+$/.test(hex)) return { ok: false, error: `\\u{} 內需為十六進位,但讀到「${hex}」` }
          const cp = parseInt(hex, 16)
          if (cp > 0x10ffff) return { ok: false, error: `碼位 U+${hex} 超出 Unicode 範圍` }
          out += String.fromCodePoint(cp)
          i = end
        } else {
          const hex = s.slice(i + 1, i + 5)
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) return { ok: false, error: `\\u 後需要 4 位十六進位,但讀到「${hex}」` }
          out += String.fromCharCode(parseInt(hex, 16))
          i += 4
        }
        break
      }
      default:
        // 未知跳脫:保留其後字元(如 \q → q)
        out += next
    }
  }
  return { ok: true, value: out }
}
