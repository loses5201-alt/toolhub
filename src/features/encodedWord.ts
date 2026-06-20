/*
  MIME encoded-word(RFC 2047)解碼引擎 —— 純函式、無 DOM 依賴(只用標準 TextDecoder),
  可在 Node 直接測試。把 email 主旨 / 寄件者 / 檔名裡常見的亂碼樣式
  =?charset?B?...?=(Base64)或 =?charset?Q?...?=(Quoted-Printable)還原成可讀文字。
  支援 UTF-8、Big5、ISO-8859-1、Shift_JIS、GBK 等(交給瀏覽器內建 TextDecoder),
  並依 RFC 2047 §6.2 移除兩個相鄰 encoded-word 之間的空白。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function base64ToBytes(s: string): Uint8Array {
  const bytes: number[] = []
  let buffer = 0
  let bits = 0
  for (const ch of s) {
    if (ch === '=') break
    const val = B64.indexOf(ch)
    if (val < 0) continue // 忽略空白與非法字元
    buffer = (buffer << 6) | val
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes.push((buffer >> bits) & 0xff)
    }
  }
  return new Uint8Array(bytes)
}

export function qEncodingToBytes(s: string): Uint8Array {
  const bytes: number[] = []
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '_') {
      bytes.push(0x20) // Q encoding 的底線代表空格
    } else if (ch === '=') {
      const hex = s.slice(i + 1, i + 3)
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16))
        i += 2
      } else {
        bytes.push(0x3d) // 落單的 '=' 視為字面
      }
    } else {
      bytes.push(ch.charCodeAt(0) & 0xff)
    }
  }
  return new Uint8Array(bytes)
}

export interface DecodedWord {
  ok: boolean
  text: string
  charset: string
  encoding: 'B' | 'Q'
  error?: string
}

/** 解一個 encoded-word 的內文(已拆出 charset/encoding/text)。 */
export function decodeWord(charset: string, encoding: string, text: string): DecodedWord {
  const enc = (encoding.toUpperCase() === 'B' ? 'B' : 'Q') as 'B' | 'Q'
  const cs = charset.split('*')[0].trim() // 去除 RFC 2231 的 *language 後綴
  const bytes = enc === 'B' ? base64ToBytes(text) : qEncodingToBytes(text)
  try {
    const dec = new TextDecoder(cs.toLowerCase(), { fatal: false })
    return { ok: true, text: dec.decode(bytes), charset: cs, encoding: enc }
  } catch {
    return { ok: false, text: '', charset: cs, encoding: enc, error: `不支援的字元集:${cs}` }
  }
}

export interface Segment {
  type: 'text' | 'word'
  /** 原始片段 */
  raw: string
  /** 解碼後文字 */
  decoded: string
  charset?: string
  encoding?: 'B' | 'Q'
  error?: string
}

export interface DecodeResult {
  /** 整段解碼後的可讀文字 */
  text: string
  segments: Segment[]
  /** 是否含至少一個 encoded-word */
  hadEncoded: boolean
}

const EW_RE = /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g

/** 解碼含有 encoded-word 的完整標頭字串。 */
export function decodeMimeHeader(input: string): DecodeResult {
  if (typeof input !== 'string') return { text: '', segments: [], hadEncoded: false }
  const segments: Segment[] = []
  let out = ''
  let lastIndex = 0
  let prevWasWord = false
  let hadEncoded = false
  EW_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = EW_RE.exec(input)) !== null) {
    const gap = input.slice(lastIndex, m.index)
    if (gap.length) {
      // RFC 2047 §6.2:兩個相鄰 encoded-word 之間「只有空白」則移除該空白
      if (prevWasWord && gap.trim() === '') {
        // 丟棄空白,不加入輸出
      } else {
        out += gap
        segments.push({ type: 'text', raw: gap, decoded: gap })
      }
    }
    const w = decodeWord(m[1], m[2], m[3])
    out += w.text
    segments.push({
      type: 'word',
      raw: m[0],
      decoded: w.text,
      charset: w.charset,
      encoding: w.encoding,
      error: w.error,
    })
    hadEncoded = true
    prevWasWord = true
    lastIndex = m.index + m[0].length
  }
  const tail = input.slice(lastIndex)
  if (tail.length) {
    out += tail
    segments.push({ type: 'text', raw: tail, decoded: tail })
  }
  return { text: out, segments, hadEncoded }
}
