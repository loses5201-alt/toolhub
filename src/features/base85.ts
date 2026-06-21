/*
  Base85 / Ascii85 / Z85 編解碼引擎 —— 純函式、無 DOM,可在 Node 直接測試。
  把二進位資料用 85 個可見字元表示(比 Base64 更省約 7% 體積):
    - Ascii85:Adobe / PostScript / PDF 用,4 bytes → 5 字元,全零組可縮成 'z',
      可選用 <~ ~> 包裹(Adobe 慣例)。
    - Z85:ZeroMQ RFC 32 用,字元集對程式字串更友善,長度須為 4 的倍數。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

// ── 位元組 ↔ 文字 / 十六進位 ───────────────────────────────
export function utf8ToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}
export function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
export function hexToBytes(hex: string): Uint8Array {
  const s = hex.replace(/\s+/g, '')
  if (s.length % 2 !== 0 || /[^0-9a-fA-F]/.test(s)) throw new Error('十六進位格式不正確')
  const out = new Uint8Array(s.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16)
  return out
}

// 由 32 位元數值(可能 < 2^40,double 仍精確)取出 4 個位元組,高位在前
function uint32ToBytes(num: number): [number, number, number, number] {
  return [
    Math.floor(num / 16777216) % 256,
    Math.floor(num / 65536) % 256,
    Math.floor(num / 256) % 256,
    num % 256,
  ]
}

// ── Ascii85 ───────────────────────────────────────────────
export interface Ascii85Options {
  delimiters?: boolean // 以 <~ ... ~> 包裹(Adobe)
}

/** Ascii85 編碼。全零的 4-byte 組會縮寫成 'z'。 */
export function encodeAscii85(bytes: Uint8Array, opts: Ascii85Options = {}): string {
  let out = ''
  const n = bytes.length
  for (let i = 0; i < n; i += 4) {
    const chunkLen = Math.min(4, n - i)
    let num = 0
    for (let j = 0; j < 4; j++) num = num * 256 + (j < chunkLen ? bytes[i + j] : 0)
    if (chunkLen === 4 && num === 0) {
      out += 'z'
      continue
    }
    const digits = [0, 0, 0, 0, 0]
    let v = num
    for (let k = 4; k >= 0; k--) {
      digits[k] = v % 85
      v = Math.floor(v / 85)
    }
    for (let k = 0; k < chunkLen + 1; k++) out += String.fromCharCode(digits[k] + 33)
  }
  return opts.delimiters ? `<~${out}~>` : out
}

/** Ascii85 解碼(容忍空白、<~ ~> 包裹、'z' 縮寫)。 */
export function decodeAscii85(input: string): Uint8Array {
  let s = input.trim()
  if (s.startsWith('<~')) s = s.slice(2)
  if (s.endsWith('~>')) s = s.slice(0, -2)
  s = s.replace(/\s+/g, '')
  const out: number[] = []
  const tuple: number[] = []
  for (const ch of s) {
    if (ch === 'z' && tuple.length === 0) {
      out.push(0, 0, 0, 0)
      continue
    }
    const val = ch.charCodeAt(0) - 33
    if (val < 0 || val > 84) throw new Error(`非法 Ascii85 字元:「${ch}」`)
    tuple.push(val)
    if (tuple.length === 5) {
      let num = 0
      for (const t of tuple) num = num * 85 + t
      out.push(...uint32ToBytes(num))
      tuple.length = 0
    }
  }
  if (tuple.length === 1) throw new Error('Ascii85 長度不合法(最後一組只剩 1 字元)')
  if (tuple.length > 1) {
    const keep = tuple.length - 1
    while (tuple.length < 5) tuple.push(84) // 以最大值 'u' 補滿
    let num = 0
    for (const t of tuple) num = num * 85 + t
    const b = uint32ToBytes(num)
    for (let k = 0; k < keep; k++) out.push(b[k])
  }
  return new Uint8Array(out)
}

// ── Z85(ZeroMQ RFC 32)─────────────────────────────────────
const Z85_ALPHABET =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#'
const Z85_DECODE: Record<string, number> = {}
for (let i = 0; i < Z85_ALPHABET.length; i++) Z85_DECODE[Z85_ALPHABET[i]] = i

/** Z85 編碼。輸入長度必須是 4 的倍數。 */
export function encodeZ85(bytes: Uint8Array): string {
  if (bytes.length % 4 !== 0) throw new Error('Z85 輸入長度必須是 4 的倍數')
  let out = ''
  for (let i = 0; i < bytes.length; i += 4) {
    let num = 0
    for (let j = 0; j < 4; j++) num = num * 256 + bytes[i + j]
    const digits = [0, 0, 0, 0, 0]
    let v = num
    for (let k = 4; k >= 0; k--) {
      digits[k] = v % 85
      v = Math.floor(v / 85)
    }
    for (let k = 0; k < 5; k++) out += Z85_ALPHABET[digits[k]]
  }
  return out
}

/** Z85 解碼。輸入長度必須是 5 的倍數。 */
export function decodeZ85(input: string): Uint8Array {
  const s = input.replace(/\s+/g, '')
  if (s.length % 5 !== 0) throw new Error('Z85 輸入長度必須是 5 的倍數')
  const out: number[] = []
  for (let i = 0; i < s.length; i += 5) {
    let num = 0
    for (let j = 0; j < 5; j++) {
      const ch = s[i + j]
      const val = Z85_DECODE[ch]
      if (val === undefined) throw new Error(`非法 Z85 字元:「${ch}」`)
      num = num * 85 + val
    }
    out.push(...uint32ToBytes(num))
  }
  return new Uint8Array(out)
}
