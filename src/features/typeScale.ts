/*
  字級比例(Type Scale / Modular Scale)引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  以一個「基準字級」和一個「比例(ratio)」,往上下各推幾階,產生一整套和諧的字級。
  比例沿用音樂音程命名(小三度 1.2、大三度 1.25、完全五度 1.5、黃金比例 1.618…),
  是網頁排版常用的「模組化比例」做法。可輸出 px / rem 與 CSS 自訂屬性。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

export interface Ratio {
  key: string
  name: string // 中文名
  value: number
}

/** 常見比例(由小到大)。 */
export const RATIOS: Ratio[] = [
  { key: 'minor-second', name: '小二度', value: 1.067 },
  { key: 'major-second', name: '大二度', value: 1.125 },
  { key: 'minor-third', name: '小三度', value: 1.2 },
  { key: 'major-third', name: '大三度', value: 1.25 },
  { key: 'perfect-fourth', name: '完全四度', value: 1.333 },
  { key: 'aug-fourth', name: '增四度', value: 1.414 },
  { key: 'perfect-fifth', name: '完全五度', value: 1.5 },
  { key: 'golden', name: '黃金比例', value: 1.618 },
]

export interface ScaleStep {
  step: number // 階(0 = 基準,正為大、負為小)
  px: number // 像素值
  rem: number // 相對 root 字級的 rem 值
}

export interface ScaleOptions {
  base: number // 基準字級(px)
  ratio: number // 比例
  stepsUp: number // 往上推幾階
  stepsDown: number // 往下推幾階
  rootPx?: number // root 字級(換算 rem 用),預設 16
  round?: number // 四捨五入到小數第幾位,預設 3
}

function roundTo(x: number, digits: number): number {
  const f = Math.pow(10, digits)
  return Math.round(x * f) / f
}

/** 產生整套字級(由大階到小階排序)。 */
export function generateScale(opts: ScaleOptions): ScaleStep[] {
  const { base, ratio, stepsUp, stepsDown } = opts
  const rootPx = opts.rootPx ?? 16
  const digits = opts.round ?? 3
  if (!(base > 0)) throw new Error('基準字級須大於 0')
  if (!(ratio > 0)) throw new Error('比例須大於 0')
  const steps: ScaleStep[] = []
  for (let s = stepsUp; s >= -stepsDown; s--) {
    const px = base * Math.pow(ratio, s)
    steps.push({
      step: s,
      px: roundTo(px, digits),
      rem: roundTo(px / rootPx, digits),
    })
  }
  return steps
}

export interface CssOptions {
  unit?: 'rem' | 'px'
  prefix?: string // 自訂屬性名稱前綴,預設 'font-size'
}

/** 把字級輸出成 CSS 自訂屬性(:root { --font-size-2: ... })。 */
export function toCss(scale: ScaleStep[], opts: CssOptions = {}): string {
  const unit = opts.unit ?? 'rem'
  const prefix = opts.prefix ?? 'font-size'
  const lines = scale.map((s) => {
    const name = s.step === 0 ? `--${prefix}-base` : s.step > 0 ? `--${prefix}-${s.step}` : `--${prefix}-n${-s.step}`
    const val = unit === 'rem' ? `${s.rem}rem` : `${s.px}px`
    return `  ${name}: ${val};`
  })
  return `:root {\n${lines.join('\n')}\n}`
}
