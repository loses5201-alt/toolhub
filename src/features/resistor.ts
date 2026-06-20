/*
  電阻色環 / SMD 碼計算引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
   - decodeBands:4 / 5 / 6 環色碼 → 電阻值、誤差、溫度係數。
   - encodeValue:電阻值 + 環數 + 誤差 → 對應色環。
   - parseSmd:SMD 表面黏著電阻數字碼(3 碼、4 碼、R 表小數)→ 電阻值。
   - formatOhms:阻值 → 人類可讀(Ω / kΩ / MΩ)。
  採 IEC 60062 標準色碼。全程在你的瀏覽器計算,不連網、不上傳。
*/

export interface BandColor {
  key: string
  name: string // 中文色名
  digit: number | null // 數字環值(黑 0…白 9);金/銀無數字
  multiplier: number // 倍率(10^digit;金 0.1、銀 0.01)
  tolerance: number | null // 誤差 %(無則 null)
  tempco: number | null // 溫度係數 ppm/K(無則 null)
  hex: string // 顯示色
}

// 標準色碼表(數字、倍率、誤差、溫度係數)
export const COLORS: BandColor[] = [
  { key: 'black', name: '黑', digit: 0, multiplier: 1, tolerance: null, tempco: 250, hex: '#1a1a1a' },
  { key: 'brown', name: '棕', digit: 1, multiplier: 10, tolerance: 1, tempco: 100, hex: '#7b3f00' },
  { key: 'red', name: '紅', digit: 2, multiplier: 100, tolerance: 2, tempco: 50, hex: '#d32f2f' },
  { key: 'orange', name: '橙', digit: 3, multiplier: 1_000, tolerance: 0.05, tempco: 15, hex: '#ef6c00' },
  { key: 'yellow', name: '黃', digit: 4, multiplier: 10_000, tolerance: 0.02, tempco: 25, hex: '#fbc02d' },
  { key: 'green', name: '綠', digit: 5, multiplier: 100_000, tolerance: 0.5, tempco: 20, hex: '#388e3c' },
  { key: 'blue', name: '藍', digit: 6, multiplier: 1_000_000, tolerance: 0.25, tempco: 10, hex: '#1976d2' },
  { key: 'violet', name: '紫', digit: 7, multiplier: 10_000_000, tolerance: 0.1, tempco: 5, hex: '#7b1fa2' },
  { key: 'grey', name: '灰', digit: 8, multiplier: 100_000_000, tolerance: 0.01, tempco: 1, hex: '#757575' },
  { key: 'white', name: '白', digit: 9, multiplier: 1_000_000_000, tolerance: null, tempco: null, hex: '#fafafa' },
  { key: 'gold', name: '金', digit: null, multiplier: 0.1, tolerance: 5, tempco: null, hex: '#c9a227' },
  { key: 'silver', name: '銀', digit: null, multiplier: 0.01, tolerance: 10, tempco: null, hex: '#bdbdbd' },
]

export const COLOR_MAP: Record<string, BandColor> = Object.fromEntries(COLORS.map((c) => [c.key, c]))

export interface DecodeResult {
  ohms: number
  tolerance: number | null
  tempco: number | null
  display: string // 含誤差的可讀字串
}

/**
 * 解碼色環。bands 為色 key 陣列:
 *  4 環 = [數字, 數字, 倍率, 誤差]
 *  5 環 = [數字, 數字, 數字, 倍率, 誤差]
 *  6 環 = [數字, 數字, 數字, 倍率, 誤差, 溫度係數]
 */
export function decodeBands(bands: string[]): DecodeResult | { error: string } {
  const n = bands.length
  if (n < 4 || n > 6) return { error: '只支援 4、5 或 6 環電阻' }
  const cols = bands.map((b) => COLOR_MAP[b])
  if (cols.some((c) => !c)) return { error: '有看不懂的顏色' }

  const digitCount = n === 4 ? 2 : 3
  let sig = 0
  for (let i = 0; i < digitCount; i++) {
    const d = cols[i].digit
    if (d === null) return { error: `第 ${i + 1} 環必須是有數字的顏色(不可金/銀)` }
    sig = sig * 10 + d
  }
  const mult = cols[digitCount].multiplier
  const ohms = sig * mult
  const tolerance = cols[digitCount + 1].tolerance
  const tempco = n === 6 ? cols[5].tempco : null

  return {
    ohms,
    tolerance,
    tempco,
    display: `${formatOhms(ohms)}${tolerance !== null ? ` ±${tolerance}%` : ''}${tempco !== null ? ` · ${tempco} ppm/K` : ''}`,
  }
}

/**
 * 由阻值產生色環。bandCount = 4 / 5 / 6;tolerancePct 須對應某個誤差色。
 * 回傳色 key 陣列;無法表示時回 { error }。
 */
export function encodeValue(
  ohms: number,
  bandCount: 4 | 5 | 6,
  tolerancePct = 5,
  tempcoPpm = 100,
): string[] | { error: string } {
  if (!(ohms > 0)) return { error: '阻值須大於 0' }
  const sigCount = bandCount === 4 ? 2 : 3

  // 取出 sigCount 位有效數字與倍率指數
  let exp = Math.floor(Math.log10(ohms)) - (sigCount - 1)
  let mantissa = Math.round(ohms / Math.pow(10, exp))
  // 四捨五入可能讓位數溢位(如 99.6→100),需進位調整
  if (mantissa >= Math.pow(10, sigCount)) {
    mantissa = Math.round(mantissa / 10)
    exp += 1
  }
  if (mantissa < Math.pow(10, sigCount - 1)) {
    // 數字不足位數(理論上不會,保險)
    mantissa *= 10
    exp -= 1
  }
  // 還原檢查:能否精確表示(避免顯示錯值)
  const reconstructed = mantissa * Math.pow(10, exp)
  if (Math.abs(reconstructed - ohms) > ohms * 1e-9 + 1e-9) {
    return { error: `${formatOhms(ohms)} 無法用 ${sigCount} 位有效數字精確表示;最接近為 ${formatOhms(reconstructed)}` }
  }

  // 倍率色:10^exp,並涵蓋金(-1)銀(-2)
  const multColor = COLORS.find((c) => Math.abs(c.multiplier - Math.pow(10, exp)) < c.multiplier * 1e-9)
  if (!multColor) return { error: `倍率超出色環可表示範圍(10^${exp})` }

  const digits = String(mantissa).padStart(sigCount, '0').split('').map(Number)
  const digitColors = digits.map((d) => COLORS.find((c) => c.digit === d)!.key)

  const tolColor = COLORS.find((c) => c.tolerance === tolerancePct)
  if (!tolColor) return { error: `誤差 ±${tolerancePct}% 沒有對應色環` }

  const bands = [...digitColors, multColor.key, tolColor.key]
  if (bandCount === 6) {
    const tcColor = COLORS.find((c) => c.tempco === tempcoPpm && c.digit !== null)
    if (!tcColor) return { error: `溫度係數 ${tempcoPpm} ppm/K 沒有對應色環` }
    bands.push(tcColor.key)
  }
  return bands
}

/** SMD 表面黏著電阻數字碼 → 阻值(Ω);無法解析回 null。 */
export function parseSmd(code: string): number | null {
  const s = code.trim().toUpperCase()
  if (!s) return null
  // R 表小數點:4R7 = 4.7、R47 = 0.47
  if (s.includes('R')) {
    const t = s.replace('R', '.')
    const v = Number(t)
    return Number.isFinite(v) ? v : null
  }
  // 3 碼:前兩位有效數字 + 第三位倍率指數(472 = 47×10² = 4700)
  if (/^\d{3}$/.test(s)) {
    return parseInt(s.slice(0, 2), 10) * Math.pow(10, parseInt(s[2], 10))
  }
  // 4 碼:前三位有效數字 + 第四位倍率指數(4702 = 470×10² = 47000)
  if (/^\d{4}$/.test(s)) {
    return parseInt(s.slice(0, 3), 10) * Math.pow(10, parseInt(s[3], 10))
  }
  return null
}

/** 阻值 → 可讀字串(Ω / kΩ / MΩ / GΩ)。 */
export function formatOhms(ohms: number): string {
  const units: [number, string][] = [
    [1e9, 'GΩ'],
    [1e6, 'MΩ'],
    [1e3, 'kΩ'],
    [1, 'Ω'],
  ]
  for (const [factor, unit] of units) {
    if (ohms >= factor) {
      const v = ohms / factor
      const str = Number.isInteger(v) ? String(v) : String(parseFloat(v.toFixed(3)))
      return `${str} ${unit}`
    }
  }
  return `${parseFloat(ohms.toFixed(3))} Ω`
}
