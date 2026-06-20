/*
  古典密碼引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  收錄常見教學 / 解謎 / 密室逃脫 / CTF 會遇到的古典替換式密碼:
    凱撒位移、ROT13、ROT47、Atbash、Vigenère、A1Z26。
  全程在你的瀏覽器計算,不連網、不上傳。僅供學習與娛樂,非安全加密。
*/

const A = 'A'.charCodeAt(0)
const Z = 'Z'.charCodeAt(0)
const a = 'a'.charCodeAt(0)
const z = 'z'.charCodeAt(0)

function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}

/** 凱撒位移:對 A–Z / a–z 位移 shift,保留大小寫與非字母。decode=true 為反向。 */
export function caesar(text: string, shift: number, decode = false): string {
  const s = mod(decode ? -shift : shift, 26)
  let out = ''
  for (const ch of text) {
    const c = ch.charCodeAt(0)
    if (c >= A && c <= Z) out += String.fromCharCode(((c - A + s) % 26) + A)
    else if (c >= a && c <= z) out += String.fromCharCode(((c - a + s) % 26) + a)
    else out += ch
  }
  return out
}

/** ROT13(凱撒 13,自反)。 */
export function rot13(text: string): string {
  return caesar(text, 13)
}

/** ROT47:對可見 ASCII(33–126,共 94 字)位移 47,自反。 */
export function rot47(text: string): string {
  let out = ''
  for (const ch of text) {
    const c = ch.charCodeAt(0)
    if (c >= 33 && c <= 126) out += String.fromCharCode(33 + ((c - 33 + 47) % 94))
    else out += ch
  }
  return out
}

/** Atbash:字母表頭尾對調(A↔Z、B↔Y…),自反,保留大小寫。 */
export function atbash(text: string): string {
  let out = ''
  for (const ch of text) {
    const c = ch.charCodeAt(0)
    if (c >= A && c <= Z) out += String.fromCharCode(Z - (c - A))
    else if (c >= a && c <= z) out += String.fromCharCode(z - (c - a))
    else out += ch
  }
  return out
}

/**
 * Vigenère:以金鑰逐字母位移。只有英文字母會消耗金鑰字元,
 * 非字母原樣保留;金鑰中的非字母會被忽略。decode=true 為解密。
 */
export function vigenere(text: string, key: string, decode = false): string {
  const k = (key || '').replace(/[^A-Za-z]/g, '').toUpperCase()
  if (!k) return text
  let out = ''
  let ki = 0
  for (const ch of text) {
    const c = ch.charCodeAt(0)
    const isUpper = c >= A && c <= Z
    const isLower = c >= a && c <= z
    if (isUpper || isLower) {
      const shift = k.charCodeAt(ki % k.length) - A
      const base = isUpper ? A : a
      const off = c - base
      const res = decode ? mod(off - shift, 26) : (off + shift) % 26
      out += String.fromCharCode(res + base)
      ki++
    } else {
      out += ch
    }
  }
  return out
}

/** A1Z26 編碼:字母轉 1–26,以分隔符連接(預設空白),非字母原樣(空白以原樣呈現)。 */
export function a1z26Encode(text: string, sep = ' '): string {
  const tokens: string[] = []
  for (const ch of text) {
    const c = ch.charCodeAt(0)
    if (c >= A && c <= Z) tokens.push(String(c - A + 1))
    else if (c >= a && c <= z) tokens.push(String(c - a + 1))
    else if (/\s/.test(ch)) tokens.push('/')
    else tokens.push(ch)
  }
  return tokens.join(sep)
}

/** A1Z26 解碼:把 1–26 數字轉回大寫字母,「/」轉空白,其餘原樣。 */
export function a1z26Decode(text: string): string {
  const tokens = (text || '').trim().split(/[\s,]+/).filter(Boolean)
  let out = ''
  for (const t of tokens) {
    if (t === '/') {
      out += ' '
      continue
    }
    if (/^\d+$/.test(t)) {
      const n = Number(t)
      if (n >= 1 && n <= 26) out += String.fromCharCode(A + n - 1)
      else out += `?`
    } else {
      out += t
    }
  }
  return out
}

export interface BruteRow {
  shift: number
  text: string
}

/** 凱撒暴力破解:列出 1–25 全部位移結果(shift 0 即原文,略過)。 */
export function caesarBruteForce(text: string): BruteRow[] {
  const rows: BruteRow[] = []
  for (let s = 1; s < 26; s++) rows.push({ shift: s, text: caesar(text, s, true) })
  return rows
}
