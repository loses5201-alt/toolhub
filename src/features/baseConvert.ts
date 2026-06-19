/*
  進位轉換核心 —— 純函式、無 DOM,可在 Node 測。
  任意 2–36 進位互轉,用 BigInt 處理超大整數(不會像 parseInt 失準)。
  全程瀏覽器、不連網、不上傳。
*/

export const MIN_BASE = 2
export const MAX_BASE = 36

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz'

/** 取得單一字元在 36 進位下的數值;非法字元回 -1。 */
export function digitValue(ch: string): number {
  const i = DIGITS.indexOf(ch.toLowerCase())
  return i
}

export interface ParseResult {
  ok: boolean
  value?: bigint
  error?: string
}

/**
 * 把某進位的字串解析成 BigInt。
 * - 允許開頭正負號、字串中的空白與底線(常見分組,如 1010_1100)。
 * - 當 base 為 2/8/16 時,容許對應的 0b/0o/0x 前綴。
 * - 任一字元超出該進位範圍即報錯。
 */
export function parseInBase(input: string, base: number): ParseResult {
  if (base < MIN_BASE || base > MAX_BASE) {
    return { ok: false, error: `進位必須在 ${MIN_BASE}–${MAX_BASE} 之間` }
  }
  let s = input.trim()
  if (s === '') return { ok: false, error: '請輸入數字' }

  let negative = false
  if (s[0] === '+' || s[0] === '-') {
    negative = s[0] === '-'
    s = s.slice(1)
  }

  // 移除分組用的空白與底線
  s = s.replace(/[\s_]/g, '')

  // 容許與該進位相符的前綴
  const lower = s.toLowerCase()
  if (base === 16 && lower.startsWith('0x')) s = s.slice(2)
  else if (base === 8 && lower.startsWith('0o')) s = s.slice(2)
  else if (base === 2 && lower.startsWith('0b')) s = s.slice(2)

  if (s === '') return { ok: false, error: '請輸入數字' }

  const big = BigInt(base)
  let value = 0n
  for (const ch of s) {
    const d = digitValue(ch)
    if (d < 0 || d >= base) {
      return { ok: false, error: `「${ch}」不是 ${base} 進位的有效數字` }
    }
    value = value * big + BigInt(d)
  }
  return { ok: true, value: negative ? -value : value }
}

/** 把 BigInt 轉成指定進位的字串(小寫)。 */
export function toBase(value: bigint, base: number): string {
  if (base < MIN_BASE || base > MAX_BASE) {
    throw new RangeError(`進位必須在 ${MIN_BASE}–${MAX_BASE} 之間`)
  }
  if (value === 0n) return '0'
  const negative = value < 0n
  let v = negative ? -value : value
  const big = BigInt(base)
  let out = ''
  while (v > 0n) {
    const rem = Number(v % big)
    out = DIGITS[rem] + out
    v = v / big
  }
  return negative ? '-' + out : out
}

export interface ConvertView {
  bin: string
  oct: string
  dec: string
  hex: string
}

/** 常見四種進位的呈現(十六進位用大寫,較易讀)。 */
export function convertViews(value: bigint): ConvertView {
  return {
    bin: toBase(value, 2),
    oct: toBase(value, 8),
    dec: toBase(value, 10),
    hex: toBase(value, 16).toUpperCase(),
  }
}

/** 把二進位字串每 4 位由右往左分組,方便閱讀(負號保留在最前)。 */
export function groupBinary(bin: string): string {
  let sign = ''
  let s = bin
  if (s[0] === '-') {
    sign = '-'
    s = s.slice(1)
  }
  const parts: string[] = []
  for (let i = s.length; i > 0; i -= 4) {
    parts.unshift(s.slice(Math.max(0, i - 4), i))
  }
  return sign + parts.join(' ')
}

/** 整數的位元長度(不含負號;0 回 0)。 */
export function bitLength(value: bigint): number {
  const v = value < 0n ? -value : value
  return v === 0n ? 0 : toBase(v, 2).length
}
