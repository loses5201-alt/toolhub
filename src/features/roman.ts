/*
  羅馬數字轉換核心 —— 阿拉伯數字(1–3999)↔ 標準羅馬數字(減法記號 IV/IX/XL…)。
  純函式、無 DOM,可在 Node 測;全程瀏覽器、不連網、不上傳。
*/

export const ROMAN_MIN = 1
export const ROMAN_MAX = 3999

const TABLE: Array<[number, string]> = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
]

export interface ToRomanResult {
  ok: boolean
  value?: string
  error?: string
}

/** 阿拉伯數字 → 羅馬數字(限 1–3999)。 */
export function toRoman(n: number): ToRomanResult {
  if (!Number.isInteger(n)) return { ok: false, error: '請輸入整數。' }
  if (n < ROMAN_MIN || n > ROMAN_MAX) {
    return { ok: false, error: `標準羅馬數字只能表示 ${ROMAN_MIN}–${ROMAN_MAX}。` }
  }
  let rest = n
  let out = ''
  for (const [v, sym] of TABLE) {
    while (rest >= v) {
      out += sym
      rest -= v
    }
  }
  return { ok: true, value: out }
}

// 嚴格的標準羅馬數字格式(避免 IIII、VV、IC 等非規範寫法)
const STRICT = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/

export interface FromRomanResult {
  ok: boolean
  value?: number
  error?: string
}

/** 羅馬數字 → 阿拉伯數字(嚴格驗證標準寫法)。 */
export function fromRoman(input: string): FromRomanResult {
  const s = input.trim().toUpperCase()
  if (s === '') return { ok: false, error: '請輸入羅馬數字。' }
  if (!/^[MDCLXVI]+$/.test(s)) {
    return { ok: false, error: '只接受 M D C L X V I 這些字母。' }
  }
  if (!STRICT.test(s)) {
    return { ok: false, error: '不是標準羅馬數字寫法(例如 4 應寫 IV 而非 IIII)。' }
  }
  let i = 0
  let total = 0
  for (const [v, sym] of TABLE) {
    while (s.startsWith(sym, i)) {
      total += v
      i += sym.length
    }
  }
  return { ok: true, value: total }
}
