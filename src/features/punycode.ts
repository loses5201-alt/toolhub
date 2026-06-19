/*
  Punycode / IDN 網域核心 —— 純函式、無 DOM,可在 Node 測。
  把 xn-- 開頭的國際化網域(IDN)解回真正的 Unicode,揪出「長得像但不是」的釣魚網域。
  自行實作 RFC 3492 Punycode(瀏覽器無內建),並做混合文字/形近字風險分析。
  全程瀏覽器、不連網、不上傳。
*/

const BASE = 36
const TMIN = 1
const TMAX = 26
const SKEW = 38
const DAMP = 700
const INITIAL_BIAS = 72
const INITIAL_N = 128
const DELIMITER = '-'
const MAX_INT = 0x7fffffff

function adapt(delta: number, numPoints: number, firstTime: boolean): number {
  delta = firstTime ? Math.floor(delta / DAMP) : delta >> 1
  delta += Math.floor(delta / numPoints)
  let k = 0
  for (; delta > ((BASE - TMIN) * TMAX) >> 1; k += BASE) {
    delta = Math.floor(delta / (BASE - TMIN))
  }
  return Math.floor(k + ((BASE - TMIN + 1) * delta) / (delta + SKEW))
}

/** ASCII 碼點 → 數字(a-z/A-Z=0..25、0-9=26..35),非法回 BASE。 */
function basicToDigit(cp: number): number {
  if (cp - 48 < 10) return cp - 22
  if (cp - 65 < 26) return cp - 65
  if (cp - 97 < 26) return cp - 97
  return BASE
}

/** 數字 → ASCII 碼點(0..25→a-z、26..35→0-9)。 */
function digitToBasic(digit: number): number {
  return digit + 22 + 75 * (digit < 26 ? 1 : 0)
}

/** Punycode 解碼(input 不含 xn-- 前綴)。失敗丟例外。 */
export function punyDecode(input: string): string {
  const output: number[] = []
  let i = 0
  let n = INITIAL_N
  let bias = INITIAL_BIAS

  let basic = input.lastIndexOf(DELIMITER)
  if (basic < 0) basic = 0

  for (let j = 0; j < basic; j++) {
    const cp = input.charCodeAt(j)
    if (cp >= 0x80) throw new Error('基本碼段出現非 ASCII 字元')
    output.push(cp)
  }

  let index = basic > 0 ? basic + 1 : 0
  while (index < input.length) {
    const oldi = i
    let w = 1
    for (let k = BASE; ; k += BASE) {
      if (index >= input.length) throw new Error('Punycode 字串不完整')
      const digit = basicToDigit(input.charCodeAt(index++))
      if (digit >= BASE) throw new Error('無效的 Punycode 數字')
      if (digit > Math.floor((MAX_INT - i) / w)) throw new Error('數值溢位')
      i += digit * w
      const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias
      if (digit < t) break
      const baseMinusT = BASE - t
      if (w > Math.floor(MAX_INT / baseMinusT)) throw new Error('數值溢位')
      w *= baseMinusT
    }
    const outLen = output.length + 1
    bias = adapt(i - oldi, outLen, oldi === 0)
    if (Math.floor(i / outLen) > MAX_INT - n) throw new Error('數值溢位')
    n += Math.floor(i / outLen)
    i %= outLen
    output.splice(i++, 0, n)
  }
  return String.fromCodePoint(...output)
}

/** Punycode 編碼(input 為 Unicode 標籤,回傳不含 xn-- 前綴)。 */
export function punyEncode(input: string): string {
  const output: number[] = []
  const codePoints = Array.from(input, (c) => c.codePointAt(0) as number)
  const inputLength = codePoints.length
  let n = INITIAL_N
  let delta = 0
  let bias = INITIAL_BIAS

  for (const cp of codePoints) {
    if (cp < 0x80) output.push(cp)
  }
  const basicLength = output.length
  let handled = basicLength
  if (basicLength > 0) output.push(DELIMITER.charCodeAt(0))

  while (handled < inputLength) {
    let m = MAX_INT
    for (const cp of codePoints) {
      if (cp >= n && cp < m) m = cp
    }
    if (m - n > Math.floor((MAX_INT - delta) / (handled + 1))) throw new Error('數值溢位')
    delta += (m - n) * (handled + 1)
    n = m
    for (const cp of codePoints) {
      if (cp < n && ++delta > MAX_INT) throw new Error('數值溢位')
      if (cp === n) {
        let q = delta
        for (let k = BASE; ; k += BASE) {
          const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias
          if (q < t) break
          const qMinusT = q - t
          const baseMinusT = BASE - t
          output.push(digitToBasic(t + (qMinusT % baseMinusT)))
          q = Math.floor(qMinusT / baseMinusT)
        }
        output.push(digitToBasic(q))
        bias = adapt(delta, handled + 1, handled === basicLength)
        delta = 0
        handled++
      }
    }
    delta++
    n++
  }
  return String.fromCharCode(...output)
}

/** 單一標籤:xn-- 開頭就解碼成 Unicode,否則原樣回傳(解碼失敗也原樣回傳)。 */
export function labelToUnicode(label: string): string {
  if (/^xn--/i.test(label)) {
    try {
      return punyDecode(label.slice(4))
    } catch {
      return label
    }
  }
  return label
}

/** 單一標籤:含非 ASCII 就編成 xn--,純 ASCII 原樣回傳。 */
export function labelToAscii(label: string): string {
  if (/[^\u0000-\u007f]/.test(label)) return 'xn--' + punyEncode(label)
  return label
}

export function domainToUnicode(domain: string): string {
  return domain.split('.').map(labelToUnicode).join('.')
}

export function domainToAscii(domain: string): string {
  return domain.split('.').map(labelToAscii).join('.')
}

// ---- 風險分析 ----

export type ScriptTag =
  | 'latin'
  | 'cyrillic'
  | 'greek'
  | 'han'
  | 'kana'
  | 'hangul'
  | 'arabic'
  | 'hebrew'
  | 'digit'
  | 'other'

function scriptOf(cp: number): ScriptTag | null {
  if ((cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a)) return 'latin'
  if (cp >= 0x30 && cp <= 0x39) return 'digit'
  if (cp >= 0x0400 && cp <= 0x04ff) return 'cyrillic'
  if (cp >= 0x0370 && cp <= 0x03ff) return 'greek'
  if (cp >= 0x0600 && cp <= 0x06ff) return 'arabic'
  if (cp >= 0x0590 && cp <= 0x05ff) return 'hebrew'
  if ((cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0x3400 && cp <= 0x4dbf)) return 'han'
  if ((cp >= 0x3040 && cp <= 0x30ff)) return 'kana'
  if (cp >= 0xac00 && cp <= 0xd7a3) return 'hangul'
  if (cp < 0x80) return null // 其他 ASCII(連字號等)不計入文字系統
  return 'other'
}

/** 偵測一段文字用到哪些文字系統(不含純符號)。 */
export function detectScripts(s: string): ScriptTag[] {
  const set = new Set<ScriptTag>()
  for (const ch of s) {
    const t = scriptOf(ch.codePointAt(0) as number)
    if (t) set.add(t)
  }
  return [...set]
}

export interface LabelAnalysis {
  original: string
  unicode: string
  isPunycode: boolean
  scripts: ScriptTag[]
  /** 拉丁字母與西里爾/希臘字母混用(典型形近字釣魚)。 */
  mixedConfusable: boolean
}

export interface DomainAnalysis {
  input: string
  unicode: string
  ascii: string
  labels: LabelAnalysis[]
  hasPunycode: boolean
  /** 整體有混合形近字風險。 */
  risky: boolean
}

const LATINLIKE: ScriptTag[] = ['cyrillic', 'greek']

export function analyzeDomain(domain: string): DomainAnalysis {
  const clean = domain.trim().replace(/^https?:\/\//i, '').split('/')[0]
  const labels = clean.split('.').map((label): LabelAnalysis => {
    const unicode = labelToUnicode(label)
    const scripts = detectScripts(unicode)
    const hasLatin = scripts.includes('latin')
    const mixedConfusable =
      hasLatin && LATINLIKE.some((t) => scripts.includes(t))
    return {
      original: label,
      unicode,
      isPunycode: /^xn--/i.test(label),
      scripts,
      mixedConfusable,
    }
  })
  return {
    input: clean,
    unicode: labels.map((l) => l.unicode).join('.'),
    ascii: labels.map((l) => labelToAscii(l.unicode)).join('.'),
    labels,
    hasPunycode: labels.some((l) => l.isPunycode),
    risky: labels.some((l) => l.mixedConfusable),
  }
}
