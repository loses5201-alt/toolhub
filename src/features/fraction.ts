/*
  分數 / 小數 / 百分比換算引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
   - simplify:約分(最簡分數),分母恆正、符號歸到分子。
   - decimalToFractionExact:把(可含循環節)小數字串「精確」轉成分數,
     例如 0.75→3/4、0.(3)→1/3、0.1(6)→1/6、0.(142857)→1/7。
   - approxFraction:用連分數把任意浮點數近似成最簡分數(限定最大分母),
     例如 π→355/113、0.3333333→1/3。
   - fractionToDecimalString:分數做長除法,終止小數直接給,循環小數以括號標出循環節。
   - toMixed / toPercent / parseFraction。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

export interface Frac {
  n: number // 分子(帶號)
  d: number // 分母(恆 > 0)
}

export function gcd(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) {
    ;[a, b] = [b, a % b]
  }
  return a
}

/** 約分:分母恆正、符號歸分子;分子 0 時回 0/1。 */
export function simplify(n: number, d: number): Frac {
  if (d === 0) throw new Error('分母不可為 0')
  if (n === 0) return { n: 0, d: 1 }
  let sign = 1
  if (n < 0) sign *= -1
  if (d < 0) sign *= -1
  n = Math.abs(n)
  d = Math.abs(d)
  const g = gcd(n, d)
  return { n: (sign * n) / g, d: d / g }
}

/**
 * 把小數字串精確轉成分數。支援循環節以括號或方括號標示:
 *  "0.75"、"2.5"、"0.(3)"、"0.1(6)"、"0.(142857)"、"-1.2(34)"。
 * 解析失敗回 null。
 */
export function decimalToFractionExact(input: string): Frac | null {
  let s = input.trim().replace(/\s+/g, '')
  if (!s) return null
  let sign = 1
  if (s.startsWith('-')) {
    sign = -1
    s = s.slice(1)
  } else if (s.startsWith('+')) {
    s = s.slice(1)
  }
  // 把方括號統一成圓括號
  s = s.replace('[', '(').replace(']', ')')

  const m = s.match(/^(\d*)(?:\.(\d*)(?:\((\d+)\))?)?$/)
  if (!m) return null
  const intPart = m[1] || '0'
  const nonRep = m[2] || ''
  const rep = m[3] || ''
  if (m[1] === '' && nonRep === '' && rep === '') return null

  if (!rep) {
    // 終止小數:intPart.nonRep
    const denom = Math.pow(10, nonRep.length)
    const numer = parseInt(intPart + nonRep || '0', 10)
    return simplify(sign * numer, denom)
  }

  // 循環小數:numerator = (nonRep+rep) - (nonRep);denominator = (9…9)(0…0)
  const a = parseInt((nonRep + rep) || '0', 10)
  const b = parseInt(nonRep || '0', 10)
  const repNines = Math.pow(10, rep.length) - 1
  const denom = repNines * Math.pow(10, nonRep.length)
  const fracNumer = a - b
  // 加上整數部分
  const whole = parseInt(intPart, 10)
  const numer = whole * denom + fracNumer
  return simplify(sign * numer, denom)
}

/** 用連分數把浮點數近似成最簡分數(限定最大分母)。 */
export function approxFraction(x: number, maxDenom = 10000): Frac {
  if (!Number.isFinite(x)) throw new Error('數值無效')
  const sign = x < 0 ? -1 : 1
  x = Math.abs(x)
  let h1 = 1
  let h0 = 0
  let k1 = 0
  let k0 = 1
  let b = x
  let bestN = Math.round(x)
  let bestD = 1
  for (let i = 0; i < 64; i++) {
    const a = Math.floor(b)
    const h2 = a * h1 + h0
    const k2 = a * k1 + k0
    if (k2 > maxDenom) break
    h0 = h1
    h1 = h2
    k0 = k1
    k1 = k2
    bestN = h1
    bestD = k1
    const frac = b - a
    if (frac < 1e-12) break
    b = 1 / frac
  }
  return simplify(sign * bestN, bestD)
}

/** 分數長除法 → 小數字串(循環節以括號標示)。 */
export function fractionToDecimalString({ n, d }: Frac): string {
  if (d === 0) throw new Error('分母不可為 0')
  const sign = n < 0 ? '-' : ''
  let num = Math.abs(n)
  const den = Math.abs(d)
  const intPart = Math.floor(num / den)
  let rem = num % den
  if (rem === 0) return sign + intPart
  const digits: number[] = []
  const seen = new Map<number, number>()
  let repeatStart = -1
  while (rem !== 0) {
    if (seen.has(rem)) {
      repeatStart = seen.get(rem)!
      break
    }
    seen.set(rem, digits.length)
    rem *= 10
    digits.push(Math.floor(rem / den))
    rem %= den
  }
  if (repeatStart === -1) return `${sign}${intPart}.${digits.join('')}`
  const nonRep = digits.slice(0, repeatStart).join('')
  const repPart = digits.slice(repeatStart).join('')
  return `${sign}${intPart}.${nonRep}(${repPart})`
}

export interface Mixed {
  whole: number
  n: number
  d: number
}

/** 假分數 → 帶分數。 */
export function toMixed({ n, d }: Frac): Mixed {
  const sign = n < 0 ? -1 : 1
  const an = Math.abs(n)
  const whole = Math.floor(an / d)
  const rem = an % d
  return { whole: sign * whole, n: rem, d }
}

/** 分數 → 百分比數值(%)。 */
export function toPercent({ n, d }: Frac): number {
  return (n / d) * 100
}

/**
 * 解析使用者輸入的分數:支援
 *  "3/4"、整數 "5"、帶分數 "1 1/2"、小數 "0.75"(終止/循環節)。
 * 失敗回 null。
 */
export function parseFraction(input: string): Frac | null {
  const s = input.trim()
  if (!s) return null
  // 帶分數 a b/c
  let m = s.match(/^(-?\d+)\s+(\d+)\/(\d+)$/)
  if (m) {
    const whole = parseInt(m[1], 10)
    const num = parseInt(m[2], 10)
    const den = parseInt(m[3], 10)
    if (den === 0) return null
    const sign = whole < 0 ? -1 : 1
    return simplify(sign * (Math.abs(whole) * den + num), den)
  }
  // 純分數 a/b
  m = s.match(/^(-?\d+)\/(-?\d+)$/)
  if (m) {
    const den = parseInt(m[2], 10)
    if (den === 0) return null
    return simplify(parseInt(m[1], 10), den)
  }
  // 整數
  if (/^-?\d+$/.test(s)) return { n: parseInt(s, 10), d: 1 }
  // 小數(可含循環節)
  return decimalToFractionExact(s)
}
