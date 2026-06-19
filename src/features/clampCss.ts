/*
  CSS clamp() 流體尺寸引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  給定「小螢幕寬度 + 對應尺寸」與「大螢幕寬度 + 對應尺寸」,算出一條線性內插,
  產生 clamp(最小, 偏好值, 最大) 讓字級/間距隨視窗寬度平滑縮放(中間用 vw,兩端夾住)。
  這是 utopia.fyi 等流體排版工具的標準公式,純數學、可離線。

  公式:
    斜率 slope = (大尺寸 − 小尺寸) / (大寬度 − 小寬度)  (px / px)
    截距 intercept = 小尺寸 − slope × 小寬度  (px)
    偏好值 = intercept(換成 rem) + slope × 100 (vw)
  全程在你的瀏覽器,不連網、不上傳。
*/

export type ClampUnit = 'rem' | 'px'

export interface ClampInput {
  minViewport: number // 小螢幕寬度 px
  maxViewport: number // 大螢幕寬度 px
  minSize: number // 小螢幕對應尺寸 px
  maxSize: number // 大螢幕對應尺寸 px
  rootFontSize?: number // 1rem = ? px,預設 16
  unit?: ClampUnit // 兩端輸出單位,預設 rem
}

export interface ClampResult {
  css: string // 如 clamp(1rem, 0.8333rem + 0.8333vw, 1.5rem)
  declaration: string // font-size: ...;
  slopeVw: number // vw 係數
  interceptRem: number // 截距(rem)
  minOut: string // 最小端字串(含單位)
  maxOut: string // 最大端字串(含單位)
  warnings: string[]
}

/** 四捨五入到指定小數位並去除尾端 0,如 1.0→"1"、1.5000→"1.5"。 */
export function fmt(n: number, digits = 4): string {
  if (!Number.isFinite(n)) return '0'
  const p = Math.pow(10, digits)
  const r = Math.round(n * p) / p
  // 避免 -0
  const v = Object.is(r, -0) ? 0 : r
  return String(v)
}

/** px 轉 rem(以 root 為基準)。 */
export function pxToRem(px: number, root = 16): number {
  const r = root || 16
  return px / r
}

export function buildClamp(input: ClampInput): ClampResult {
  const root = input.rootFontSize && input.rootFontSize > 0 ? input.rootFontSize : 16
  const unit: ClampUnit = input.unit === 'px' ? 'px' : 'rem'
  const { minViewport, maxViewport, minSize, maxSize } = input
  const warnings: string[] = []

  // 兩端輸出
  const sizeOut = (px: number) => (unit === 'px' ? `${fmt(px)}px` : `${fmt(pxToRem(px, root))}rem`)
  const minOut = sizeOut(minSize)
  const maxOut = sizeOut(maxSize)

  if (maxViewport === minViewport) {
    warnings.push('兩個視窗寬度相同,無法內插;請設定不同的小/大螢幕寬度。')
    const css = `clamp(${minOut}, ${minOut}, ${maxOut})`
    return {
      css,
      declaration: `font-size: ${css};`,
      slopeVw: 0,
      interceptRem: pxToRem(minSize, root),
      minOut,
      maxOut,
      warnings,
    }
  }

  if (minSize > maxSize) {
    warnings.push('小螢幕尺寸大於大螢幕尺寸(隨寬度縮小),clamp 仍有效但較少見,請確認是否刻意。')
  }
  if (minViewport > maxViewport) {
    warnings.push('小螢幕寬度大於大螢幕寬度,建議對調以符合慣例。')
  }

  const slope = (maxSize - minSize) / (maxViewport - minViewport) // px per px
  const interceptPx = minSize - slope * minViewport // px
  const slopeVw = slope * 100 // vw 係數(1vw = 視窗/100 px)
  const interceptRem = pxToRem(interceptPx, root)

  // 偏好值:截距(rem 或 px) + 斜率(vw)
  const interceptOut = unit === 'px' ? `${fmt(interceptPx)}px` : `${fmt(interceptRem)}rem`
  const vwTerm = `${fmt(slopeVw)}vw`
  // 截距為 0 時省略
  const preferred =
    fmt(unit === 'px' ? interceptPx : interceptRem) === '0' ? vwTerm : `${interceptOut} + ${vwTerm}`

  // clamp 需要 min <= max;若 minSize>maxSize 則對調兩端以維持語意正確
  const lo = Math.min(minSize, maxSize)
  const hi = Math.max(minSize, maxSize)
  const loOut = sizeOut(lo)
  const hiOut = sizeOut(hi)

  const css = `clamp(${loOut}, ${preferred}, ${hiOut})`
  return {
    css,
    declaration: `font-size: ${css};`,
    slopeVw,
    interceptRem,
    minOut,
    maxOut,
    warnings,
  }
}

/** 給定視窗寬度 px,回傳此 clamp 實際解析出的尺寸 px(供預覽/驗證)。 */
export function resolveAt(input: ClampInput, viewportPx: number): number {
  const { minViewport, maxViewport, minSize, maxSize } = input
  const lo = Math.min(minSize, maxSize)
  const hi = Math.max(minSize, maxSize)
  if (maxViewport === minViewport) return lo
  const slope = (maxSize - minSize) / (maxViewport - minViewport)
  const interceptPx = minSize - slope * minViewport
  const preferred = interceptPx + slope * viewportPx
  return Math.min(hi, Math.max(lo, preferred))
}
