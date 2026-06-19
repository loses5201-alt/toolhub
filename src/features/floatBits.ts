/*
  IEEE 754 浮點數位元檢視引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  把一個十進位數字拆解成電腦實際儲存的位元:符號 / 指數 / 尾數,
  顯示 16 進位、二進位排列、以及「實際存進去的精確十進位值」(用 BigInt 完整展開,
  因為分母是 2 的次方,十進位一定有限位)—— 這能解釋為何 0.1 + 0.2 ≠ 0.3。

  支援 64 位元(double,JS 的 number)與 32 位元(float)雙向轉換。
  全程在你的瀏覽器,不連網、不上傳。
*/

export type FloatWidth = 32 | 64

export interface FloatSpec {
  width: FloatWidth
  expBits: number
  fracBits: number
  bias: number
}

const SPEC: Record<FloatWidth, FloatSpec> = {
  32: { width: 32, expBits: 8, fracBits: 23, bias: 127 },
  64: { width: 64, expBits: 11, fracBits: 52, bias: 1023 },
}

export interface FloatBreakdown {
  width: FloatWidth
  input: number
  hex: string // 不含 0x,大寫
  bits: string // 完整位元字串(0/1)
  signBit: string
  exponentBits: string
  fractionBits: string
  signValue: 1 | -1
  rawExponent: number // 未去偏移
  unbiasedExponent: number | null // 去偏移(NaN/Inf 為 null)
  classification: 'zero' | 'subnormal' | 'normal' | 'infinity' | 'nan'
  exactValue: string // 精確十進位字串(有限位);Inf/NaN 給文字
  roundTrip: number // 解碼回的數值(驗證用)
}

/** 取得整個浮點數的原始位元(BigInt)。 */
function toRawBits(value: number, width: FloatWidth): bigint {
  const buf = new ArrayBuffer(8)
  const dv = new DataView(buf)
  if (width === 64) {
    dv.setFloat64(0, value, false)
    return dv.getBigUint64(0, false)
  }
  dv.setFloat32(0, value, false)
  return BigInt(dv.getUint32(0, false))
}

/** 由原始位元(BigInt)還原成數值。 */
export function bitsToNumber(raw: bigint, width: FloatWidth): number {
  const buf = new ArrayBuffer(8)
  const dv = new DataView(buf)
  if (width === 64) {
    dv.setBigUint64(0, BigInt.asUintN(64, raw), false)
    return dv.getFloat64(0, false)
  }
  dv.setUint32(0, Number(BigInt.asUintN(32, raw)), false)
  return dv.getFloat32(0, false)
}

const pad = (s: string, n: number) => s.padStart(n, '0')

/** 把整數尾數 M 與 2 的指數 E,精確展開成十進位字串(分母為 2 次方,必有限位)。 */
export function exactDecimal(mantissa: bigint, exp2: number, negative: boolean): string {
  if (mantissa === 0n) return negative ? '-0' : '0'
  const sign = negative ? '-' : ''
  if (exp2 >= 0) {
    const v = mantissa << BigInt(exp2)
    return sign + v.toString()
  }
  // value = mantissa / 2^k = (mantissa * 5^k) / 10^k
  const k = -exp2
  const num = mantissa * 5n ** BigInt(k)
  let s = num.toString()
  if (s.length <= k) s = pad(s, k + 1)
  const intPart = s.slice(0, s.length - k)
  let frac = s.slice(s.length - k)
  frac = frac.replace(/0+$/, '')
  return sign + (frac ? `${intPart}.${frac}` : intPart)
}

/** 把一個數字拆解成 IEEE 754 位元組成。 */
export function breakdown(value: number, width: FloatWidth = 64): FloatBreakdown {
  const spec = SPEC[width]
  const raw = toRawBits(value, width)
  const bits = pad(raw.toString(2), width)
  const hex = pad(raw.toString(16).toUpperCase(), width / 4)

  const signBit = bits[0]
  const exponentBits = bits.slice(1, 1 + spec.expBits)
  const fractionBits = bits.slice(1 + spec.expBits)

  const signValue: 1 | -1 = signBit === '1' ? -1 : 1
  const rawExponent = parseInt(exponentBits, 2)
  const fracInt = fractionBits === '' ? 0n : BigInt('0b' + fractionBits)
  const expAllOnes = rawExponent === (1 << spec.expBits) - 1

  let classification: FloatBreakdown['classification']
  let unbiasedExponent: number | null
  let exactValue: string

  if (expAllOnes) {
    unbiasedExponent = null
    if (fracInt === 0n) {
      classification = 'infinity'
      exactValue = signValue === -1 ? '-Infinity' : 'Infinity'
    } else {
      classification = 'nan'
      exactValue = 'NaN'
    }
  } else if (rawExponent === 0) {
    unbiasedExponent = 1 - spec.bias
    if (fracInt === 0n) {
      classification = 'zero'
      exactValue = signValue === -1 ? '-0' : '0'
    } else {
      classification = 'subnormal'
      // value = frac * 2^(1-bias-fracBits)
      const exp2 = 1 - spec.bias - spec.fracBits
      exactValue = exactDecimal(fracInt, exp2, signValue === -1)
    }
  } else {
    classification = 'normal'
    unbiasedExponent = rawExponent - spec.bias
    // mantissa = (2^fracBits + frac), exp2 = rawExp - bias - fracBits
    const mant = (1n << BigInt(spec.fracBits)) + fracInt
    const exp2 = rawExponent - spec.bias - spec.fracBits
    exactValue = exactDecimal(mant, exp2, signValue === -1)
  }

  return {
    width,
    input: value,
    hex,
    bits,
    signBit,
    exponentBits,
    fractionBits,
    signValue,
    rawExponent,
    unbiasedExponent,
    classification,
    exactValue,
    roundTrip: bitsToNumber(raw, width),
  }
}

/** 解析使用者輸入的 16 進位(可含 0x、空白)成 BigInt;失敗回 null。 */
export function parseHex(input: string, width: FloatWidth): bigint | null {
  if (!input) return null
  const clean = input.trim().replace(/^0x/i, '').replace(/\s+/g, '')
  if (!/^[0-9a-f]+$/i.test(clean)) return null
  const maxLen = width / 4
  if (clean.length > maxLen) return null
  return BigInt('0x' + clean)
}

/** 由 16 進位字串直接拆解(供「反查」模式)。 */
export function breakdownFromHex(input: string, width: FloatWidth = 64): FloatBreakdown | null {
  const raw = parseHex(input, width)
  if (raw == null) return null
  return breakdown(bitsToNumber(raw, width), width)
}
