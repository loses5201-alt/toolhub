/*
  CSS cubic-bezier 緩動曲線引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  以四個控制參數 (x1, y1, x2, y2) 定義一條從 (0,0) 到 (1,1) 的三次貝茲曲線,
  這正是 CSS transition-timing-function: cubic-bezier(...) 的定義。

  動畫進度 = 給定「時間進度 x」(0→1),求曲線上對應的「動畫完成度 y」。
  由於 x 與參數 t 並非線性對應,需先用 Newton-Raphson(失敗時退回二分法)由 x 解出 t,
  再代入求 y —— 這是瀏覽器實際採用的演算法(WebKit UnitBezier)。

  全程在你的瀏覽器,不連網、不上傳。
*/

export interface BezierParams {
  x1: number
  y1: number
  x2: number
  y2: number
}

const round = (n: number, d = 3) => {
  const p = Math.pow(10, d)
  return Math.round((Number.isFinite(n) ? n : 0) * p) / p
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0))

/**
 * 建立緩動函式。x1/x2 依 CSS 規範夾在 [0,1];y1/y2 不限(可 <0 或 >1 做出回彈/過衝)。
 * 回傳一個函式:給定時間進度 x(0–1),回傳動畫完成度 y。
 */
export function makeEasing(p: BezierParams): (x: number) => number {
  const x1 = clamp01(p.x1)
  const x2 = clamp01(p.x2)
  const y1 = Number.isFinite(p.y1) ? p.y1 : 0
  const y2 = Number.isFinite(p.y2) ? p.y2 : 0

  // 多項式係數(P0=(0,0), P3=(1,1) 隱含)
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t
  const sampleDX = (t: number) => (3 * ax * t + 2 * bx) * t + cx

  const solveT = (x: number): number => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    // Newton-Raphson
    let t = x
    for (let i = 0; i < 8; i++) {
      const xt = sampleX(t) - x
      if (Math.abs(xt) < 1e-7) return t
      const d = sampleDX(t)
      if (Math.abs(d) < 1e-7) break
      t -= xt / d
    }
    // 二分法保底
    let lo = 0
    let hi = 1
    t = x
    while (lo < hi) {
      const xt = sampleX(t)
      if (Math.abs(xt - x) < 1e-7) return t
      if (x > xt) lo = t
      else hi = t
      t = (lo + hi) / 2
      if (hi - lo < 1e-9) break
    }
    return t
  }

  return (x: number) => sampleY(solveT(clamp01(x)))
}

/** 直接求單點:給時間進度 x 回傳完成度 y。 */
export function easeAt(p: BezierParams, x: number): number {
  return makeEasing(p)(x)
}

/** 取曲線在 (時間, 完成度) 空間的取樣點,供畫圖用。steps 為分段數。 */
export function sampleCurve(p: BezierParams, steps = 40): { x: number; y: number }[] {
  const ease = makeEasing(p)
  const out: { x: number; y: number }[] = []
  const n = Math.max(2, Math.floor(steps))
  for (let i = 0; i <= n; i++) {
    const x = i / n
    out.push({ x, y: ease(x) })
  }
  return out
}

/** 是否含過衝/回彈(y 超出 [0,1]),CSS 合法但有些情境不適用。 */
export function hasOvershoot(p: BezierParams): boolean {
  return p.y1 < 0 || p.y1 > 1 || p.y2 < 0 || p.y2 > 1
}

/** cubic-bezier() 函式字串,如 "cubic-bezier(0.25, 0.1, 0.25, 1)"。 */
export function toBezierString(p: BezierParams): string {
  return `cubic-bezier(${round(clamp01(p.x1))}, ${round(p.y1)}, ${round(clamp01(p.x2))}, ${round(p.y2)})`
}

/** 完整 transition 宣告。 */
export function buildTransitionCss(p: BezierParams, prop = 'all', durationMs = 600): string {
  const s = Math.max(0, durationMs) / 1000
  return `transition: ${prop} ${round(s, 3)}s ${toBezierString(p)};`
}

/** 內建範本(含 CSS 關鍵字對應與常見 Material/緩動曲線)。 */
export const PRESETS: { label: string; params: BezierParams }[] = [
  { label: 'ease', params: { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 } },
  { label: 'linear', params: { x1: 0, y1: 0, x2: 1, y2: 1 } },
  { label: 'ease-in', params: { x1: 0.42, y1: 0, x2: 1, y2: 1 } },
  { label: 'ease-out', params: { x1: 0, y1: 0, x2: 0.58, y2: 1 } },
  { label: 'ease-in-out', params: { x1: 0.42, y1: 0, x2: 0.58, y2: 1 } },
  { label: '加速(陡)', params: { x1: 0.55, y1: 0.06, x2: 0.68, y2: 0.19 } },
  { label: '減速(緩出)', params: { x1: 0.16, y1: 1, x2: 0.3, y2: 1 } },
  { label: '回彈過衝', params: { x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 } },
  { label: '彈性進出', params: { x1: 0.68, y1: -0.55, x2: 0.27, y2: 1.55 } },
]

/** 解析使用者貼上的 cubic-bezier(...) 字串;失敗回 null。 */
export function parseBezier(input: string): BezierParams | null {
  if (!input) return null
  const m = /cubic-bezier\s*\(([^)]*)\)/i.exec(input)
  const body = m ? m[1] : input
  const nums = body.split(',').map((s) => Number(s.trim()))
  if (nums.length !== 4 || nums.some((n) => !Number.isFinite(n))) return null
  return { x1: nums[0], y1: nums[1], x2: nums[2], y2: nums[3] }
}
