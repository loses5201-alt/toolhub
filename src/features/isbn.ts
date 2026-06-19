/*
  ISBN 檢核 / 轉換核心 —— 驗證 ISBN-10 / ISBN-13 檢查碼、互相轉換。
  純函式、無 DOM,可在 Node 測;全程瀏覽器、不連網、不上傳。
  依據:ISBN-10 採 mod 11 加權(11-…,餘數 10 寫成 X);ISBN-13 採 EAN-13 mod 10(交替 1,3 權重)。
*/

/** 去掉連字號、空白,並把結尾 x 統一成大寫 X。 */
export function normalizeIsbn(input: string): string {
  return input.replace(/[\s-]+/g, '').toUpperCase()
}

/** 計算 ISBN-10 檢查碼(輸入前 9 碼數字字串);回 '0'–'9' 或 'X'。 */
export function isbn10CheckDigit(first9: string): string {
  let sum = 0
  for (let i = 0; i < 9; i++) sum += (10 - i) * (first9.charCodeAt(i) - 48)
  const r = (11 - (sum % 11)) % 11
  return r === 10 ? 'X' : String(r)
}

/** 計算 ISBN-13 檢查碼(輸入前 12 碼數字字串);回 '0'–'9'。 */
export function isbn13CheckDigit(first12: string): string {
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const d = first12.charCodeAt(i) - 48
    sum += i % 2 === 0 ? d : d * 3
  }
  return String((10 - (sum % 10)) % 10)
}

/** 驗證 ISBN-10(允許連字號/空白、末位 X)。 */
export function isValidIsbn10(input: string): boolean {
  const s = normalizeIsbn(input)
  if (!/^\d{9}[\dX]$/.test(s)) return false
  return isbn10CheckDigit(s.slice(0, 9)) === s[9]
}

/** 驗證 ISBN-13(允許連字號/空白)。 */
export function isValidIsbn13(input: string): boolean {
  const s = normalizeIsbn(input)
  if (!/^\d{13}$/.test(s)) return false
  return isbn13CheckDigit(s.slice(0, 12)) === s[12]
}

/** ISBN-10 → ISBN-13(前綴 978 後重算檢查碼);輸入非合法 ISBN-10 回 null。 */
export function isbn10to13(input: string): string | null {
  if (!isValidIsbn10(input)) return null
  const core = '978' + normalizeIsbn(input).slice(0, 9)
  return core + isbn13CheckDigit(core)
}

/** ISBN-13 → ISBN-10(僅 978 開頭可轉,979 無對應);輸入非合法或非 978 回 null。 */
export function isbn13to10(input: string): string | null {
  if (!isValidIsbn13(input)) return null
  const s = normalizeIsbn(input)
  if (!s.startsWith('978')) return null
  const core = s.slice(3, 12) // 取中間 9 碼
  return core + isbn10CheckDigit(core)
}

export type IsbnKind = 'isbn10' | 'isbn13' | 'invalid'

export interface IsbnInfo {
  kind: IsbnKind
  normalized: string
  valid: boolean
  isbn10?: string
  isbn13?: string
  prefix?: string // 978 / 979(EAN bookland)
  note?: string
}

/** 綜合分析:判斷類型、是否合法,並給出兩種格式。 */
export function analyzeIsbn(input: string): IsbnInfo {
  const s = normalizeIsbn(input)
  if (/^\d{9}[\dX]$/.test(s)) {
    const valid = isValidIsbn10(s)
    const info: IsbnInfo = { kind: 'isbn10', normalized: s, valid }
    if (valid) {
      info.isbn10 = s
      info.isbn13 = isbn10to13(s)!
      info.prefix = '978'
    } else {
      info.note = `檢查碼錯誤,正確應為 ${isbn10CheckDigit(s.slice(0, 9))}。`
    }
    return info
  }
  if (/^\d{13}$/.test(s)) {
    const valid = isValidIsbn13(s)
    const info: IsbnInfo = { kind: 'isbn13', normalized: s, valid }
    if (valid) {
      info.isbn13 = s
      info.prefix = s.slice(0, 3)
      const ten = isbn13to10(s)
      if (ten) info.isbn10 = ten
      else info.note = '979 開頭的 ISBN-13 沒有對應的 ISBN-10。'
    } else {
      info.note = `檢查碼錯誤,正確應為 ${isbn13CheckDigit(s.slice(0, 12))}。`
    }
    return info
  }
  return {
    kind: 'invalid',
    normalized: s,
    valid: false,
    note: '長度不對 —— ISBN 應為 10 碼(末位可為 X)或 13 碼數字。',
  }
}
