/*
  CSS box-shadow 產生引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  把一層或多層陰影設定組成可直接貼用的 box-shadow CSS 字串。
  支援:外陰影/內陰影(inset)、x/y 位移、模糊、擴散、顏色 + 透明度。
  全程在你的瀏覽器,不連網、不上傳。
*/

export interface ShadowLayer {
  x: number // 水平位移 px
  y: number // 垂直位移 px
  blur: number // 模糊半徑 px(>=0)
  spread: number // 擴散半徑 px
  hex: string // 顏色 #RRGGBB
  alpha: number // 不透明度 0–1
  inset: boolean // 內陰影
}

export function defaultLayer(): ShadowLayer {
  return { x: 0, y: 8, blur: 24, spread: -4, hex: '#1e293b', alpha: 0.25, inset: false }
}

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(n) ? n : 0))

const round = (n: number) => Math.round(n * 1000) / 1000

/** 把 #RGB / #RRGGBB + alpha 轉成 CSS 顏色字串。alpha=1 用 #RRGGBB,否則 rgba()。 */
export function toCssColor(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  let r = 0
  let g = 0
  let b = 0
  let full = '#000000'
  if (m) {
    let h = m[1]
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
    full = '#' + h.toLowerCase()
    r = parseInt(h.slice(0, 2), 16)
    g = parseInt(h.slice(2, 4), 16)
    b = parseInt(h.slice(4, 6), 16)
  }
  const a = clamp(alpha, 0, 1)
  if (a >= 1) return full
  return `rgba(${r}, ${g}, ${b}, ${round(a)})`
}

/** 單層 → CSS 片段,如 "0 8px 24px -4px rgba(30, 41, 59, 0.25)"。 */
export function layerToCss(layer: ShadowLayer): string {
  const parts: string[] = []
  if (layer.inset) parts.push('inset')
  parts.push(`${round(layer.x)}px`)
  parts.push(`${round(layer.y)}px`)
  parts.push(`${round(clamp(layer.blur, 0, Infinity))}px`)
  parts.push(`${round(layer.spread)}px`)
  parts.push(toCssColor(layer.hex, layer.alpha))
  return parts.join(' ')
}

/** 多層 → 完整 box-shadow 值(以 ", " 連接);空陣列回 "none"。 */
export function buildBoxShadow(layers: ShadowLayer[]): string {
  if (!layers || layers.length === 0) return 'none'
  return layers.map(layerToCss).join(', ')
}

/** 完整 CSS 宣告。 */
export function buildCss(layers: ShadowLayer[]): string {
  return `box-shadow: ${buildBoxShadow(layers)};`
}
