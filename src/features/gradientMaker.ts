/*
  CSS 漸層產生引擎 —— 純函式、不依賴 DOM,把漸層設定組成 CSS 字串,故可 Node 直接回歸測試。
  被 src/tools/gradient-maker/Index.vue 使用。
*/
export interface Stop {
  color: string
  pos: number // 0–100
}

export type GradientType = 'linear' | 'radial' | 'conic'

export interface GradientOpt {
  type: GradientType
  angle: number // linear / conic 起始角度(deg)
  shape: 'circle' | 'ellipse' // radial 形狀
  position: string // radial / conic 圓心位置(center / top left …)
  stops: Stop[]
}

// 將色標依位置排序後組成 "color pos%, …"
export function stopsToString(stops: Stop[]): string {
  return [...stops]
    .sort((a, b) => a.pos - b.pos)
    .map((s) => `${s.color.trim()} ${clampPos(s.pos)}%`)
    .join(', ')
}

function clampPos(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

// 組出 CSS 的 <gradient> 值(可直接放進 background-image)
export function buildGradient(opt: GradientOpt): string {
  const body = stopsToString(opt.stops)
  if (opt.type === 'radial') {
    return `radial-gradient(${opt.shape} at ${opt.position}, ${body})`
  }
  if (opt.type === 'conic') {
    return `conic-gradient(from ${normAngle(opt.angle)}deg at ${opt.position}, ${body})`
  }
  return `linear-gradient(${normAngle(opt.angle)}deg, ${body})`
}

function normAngle(a: number): number {
  if (!Number.isFinite(a)) return 0
  return ((Math.round(a) % 360) + 360) % 360
}

// 完整的一行 CSS 宣告
export function buildCSS(opt: GradientOpt): string {
  return `background: ${buildGradient(opt)};`
}

// 把每個色標的位置沿 0–100 重新等距分布(均勻化)
export function distributeStops(stops: Stop[]): Stop[] {
  const sorted = [...stops].sort((a, b) => a.pos - b.pos)
  const n = sorted.length
  if (n <= 1) return sorted.map((s) => ({ ...s, pos: 0 }))
  return sorted.map((s, i) => ({ ...s, pos: Math.round((i / (n - 1)) * 100) }))
}

// 反轉:色標順序與位置鏡射(0↔100)
export function reverseStops(stops: Stop[]): Stop[] {
  return [...stops]
    .sort((a, b) => a.pos - b.pos)
    .map((s) => ({ ...s, pos: 100 - clampPos(s.pos) }))
    .sort((a, b) => a.pos - b.pos)
}
