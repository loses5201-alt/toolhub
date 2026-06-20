/*
  CSS 單位換算引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  把 px / rem / em / pt / pc / in / cm / mm / % 互轉。
  CSS 規範:1in = 96px(參考像素)、1pt = 1/72in = 96/72 px、1pc = 12pt = 16px、
  rem 相對於根字級(預設 16px)、em 與 % 相對於「目前文字脈絡」字級。
  做網頁/印刷排版常要在這些單位間換算,且 px↔pt↔mm 的 96dpi 換算容易記錯。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

/** 每個單位等於幾 px(em/rem/% 需依字級脈絡計算)。 */
export function pxPerUnit(unit: string, rootFontSize = 16, contextFontSize = 16): number {
  switch (unit) {
    case 'px':
      return 1
    case 'pt':
      return 96 / 72 // 1pt = 1/72 in,1in = 96px
    case 'pc':
      return 16 // 1pc = 12pt = 16px
    case 'in':
      return 96
    case 'cm':
      return 96 / 2.54
    case 'mm':
      return 96 / 25.4
    case 'rem':
      return rootFontSize
    case 'em':
      return contextFontSize
    case '%':
      return contextFontSize / 100
    default:
      return NaN
  }
}

export const UNITS = ['px', 'rem', 'em', 'pt', 'pc', 'in', 'cm', 'mm', '%'] as const
export type CssUnit = (typeof UNITS)[number]

/** 把 value + unit 換算成 px。回傳 NaN 表示單位不合法。 */
export function toPx(value: number, unit: string, rootFontSize = 16, contextFontSize = 16): number {
  const f = pxPerUnit(unit, rootFontSize, contextFontSize)
  if (isNaN(f)) return NaN
  return value * f
}

/** 把 px 換算成目標單位。 */
export function fromPx(px: number, unit: string, rootFontSize = 16, contextFontSize = 16): number {
  const f = pxPerUnit(unit, rootFontSize, contextFontSize)
  if (isNaN(f) || f === 0) return NaN
  return px / f
}

export interface ConvertResult {
  valid: boolean
  px: number
  values: { unit: string; value: number }[]
  error: string
}

/**
 * 把一個 value+unit 換算成所有單位。
 * rootFontSize 供 rem 用;contextFontSize 供 em / % 用。
 */
export function convertAll(
  value: number,
  unit: string,
  rootFontSize = 16,
  contextFontSize = 16,
): ConvertResult {
  const base: ConvertResult = { valid: false, px: 0, values: [], error: '' }
  if (!isFinite(value)) return { ...base, error: '請輸入數值' }
  if (isNaN(pxPerUnit(unit, rootFontSize, contextFontSize))) {
    return { ...base, error: `不支援的單位:${unit}` }
  }
  if (rootFontSize <= 0 || contextFontSize <= 0) {
    return { ...base, error: '字級需大於 0' }
  }
  const px = toPx(value, unit, rootFontSize, contextFontSize)
  return {
    valid: true,
    px,
    values: UNITS.map((u) => ({ unit: u, value: fromPx(px, u, rootFontSize, contextFontSize) })),
    error: '',
  }
}

/** 四捨五入到指定小數位,去掉多餘的零。 */
export function round(n: number, digits = 4): number {
  if (!isFinite(n)) return n
  const f = 10 ** digits
  return Math.round(n * f) / f
}
