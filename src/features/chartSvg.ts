/*
  資料圖表產生引擎 —— 把表格資料畫成長條圖 / 折線圖 / 圓餅圖,輸出乾淨 SVG 字串。
  純函式、無 DOM,可在 Node 直接測;不依賴任何繪圖套件(自己算座標軸刻度與圓弧)。
  全程在瀏覽器繪製、不上傳資料。SVG 可直接下載,或在前端轉成 PNG。
*/
export type ChartType = 'bar' | 'line' | 'pie'

export interface Series {
  name: string
  values: number[]
}
export interface ChartData {
  labels: string[]
  series: Series[]
}
export interface ChartOpts {
  width?: number
  height?: number
  title?: string
  colors?: string[]
  showValues?: boolean
  showLegend?: boolean
}

export const PALETTE = [
  '#2563eb', '#16a34a', '#ea580c', '#9333ea', '#dc2626',
  '#0891b2', '#ca8a04', '#db2777', '#4f46e5', '#65a30d',
]

/** 把字串解析成數字:去掉千分位逗號、底線、空白、貨幣/百分比符號。無法解析回 NaN。 */
export function parseNumber(s: string | number): number {
  if (typeof s === 'number') return s
  const t = String(s).trim().replace(/[,_\s]/g, '').replace(/[%$￥¥€£]/g, '')
  if (t === '') return NaN
  return Number(t)
}

/** 由表格與選定欄位組出繪圖資料;非數字的值視為 0。 */
export function buildChartData(
  table: { headers: string[]; rows: string[][] },
  labelCol: number,
  valueCols: number[],
): ChartData {
  const labels = table.rows.map((r) => String(r[labelCol] ?? ''))
  const series = valueCols.map((ci) => ({
    name: table.headers[ci] ?? `數列${ci + 1}`,
    values: table.rows.map((r) => {
      const n = parseNumber(r[ci] ?? '')
      return Number.isFinite(n) ? n : 0
    }),
  }))
  return { labels, series }
}

function niceNum(range: number, round: boolean): number {
  const exp = Math.floor(Math.log10(range))
  const frac = range / 10 ** exp
  let nf: number
  if (round) nf = frac < 1.5 ? 1 : frac < 3 ? 2 : frac < 7 ? 5 : 10
  else nf = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10
  return nf * 10 ** exp
}

/** 算出「漂亮」的座標軸刻度(下界、上界、刻度間距、刻度陣列)。 */
export function niceScale(min: number, max: number, maxTicks = 5): { min: number; max: number; step: number; ticks: number[] } {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    const base = Number.isFinite(max) ? max : 0
    const lo = Math.min(0, base)
    const hi = Math.max(0, base) || 1
    return niceScale(lo, hi === lo ? lo + 1 : hi, maxTicks)
  }
  const range = niceNum(max - min, false)
  const step = niceNum(range / (maxTicks - 1), true)
  const niceMin = Math.floor(min / step) * step
  const niceMax = Math.ceil(max / step) * step
  const ticks: number[] = []
  // 用整數步進並乘回 step,避免浮點累積誤差
  const count = Math.round((niceMax - niceMin) / step)
  for (let i = 0; i <= count; i++) ticks.push(Math.round((niceMin + i * step) * 1e9) / 1e9)
  return { min: niceMin, max: niceMax, step, ticks }
}

/** 圓餅切片:負值視為 0;回傳每片的值、比例、起訖角度(度,自 12 點鐘順時針)。 */
export function pieSlices(values: number[]): { value: number; fraction: number; start: number; end: number }[] {
  const pos = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0))
  const total = pos.reduce((a, b) => a + b, 0)
  let acc = 0
  return pos.map((v) => {
    const fraction = total > 0 ? v / total : 0
    const start = acc * 360
    acc += fraction
    return { value: v, fraction, start, end: acc * 360 }
  })
}

/** 極座標:自圓心 (cx,cy)、半徑 r、角度(度,12 點鐘為 0、順時針)算出座標。 */
export function polarPoint(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const a = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

const n2 = (x: number): number => Math.round(x * 100) / 100

/** 一片扇形的 SVG path d。end-start>=360 視為整圓(用兩段弧)。 */
export function arcPath(cx: number, cy: number, r: number, start: number, end: number): string {
  if (end - start >= 360) {
    const a = polarPoint(cx, cy, r, 0)
    const b = polarPoint(cx, cy, r, 180)
    return `M${n2(a.x)},${n2(a.y)} A${r},${r} 0 1 1 ${n2(b.x)},${n2(b.y)} A${r},${r} 0 1 1 ${n2(a.x)},${n2(a.y)} Z`
  }
  const p1 = polarPoint(cx, cy, r, start)
  const p2 = polarPoint(cx, cy, r, end)
  const large = end - start > 180 ? 1 : 0
  return `M${n2(cx)},${n2(cy)} L${n2(p1.x)},${n2(p1.y)} A${r},${r} 0 ${large} 1 ${n2(p2.x)},${n2(p2.y)} Z`
}

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** 數值顯示格式:大數加千分位,其餘保留至多兩位小數。 */
export function fmtNum(x: number): string {
  if (!Number.isFinite(x)) return ''
  const r = Math.round(x * 100) / 100
  return Math.abs(r) >= 1000 ? r.toLocaleString('en-US') : String(r)
}

const FONT = 'system-ui, -apple-system, "Noto Sans TC", "Microsoft JhengHei", sans-serif'

function color(opts: ChartOpts, i: number): string {
  const p = opts.colors && opts.colors.length ? opts.colors : PALETTE
  return p[i % p.length]
}

function legendSvg(items: { name: string; color: string }[], x: number, y: number): string {
  let cx = x
  const parts: string[] = []
  for (const it of items) {
    parts.push(`<rect x="${n2(cx)}" y="${y - 9}" width="11" height="11" rx="2" fill="${it.color}"/>`)
    parts.push(`<text x="${n2(cx + 16)}" y="${y}" font-size="12" fill="#475569">${esc(it.name)}</text>`)
    cx += 30 + it.name.length * 8 + (/[一-鿿]/.test(it.name) ? it.name.length * 6 : 0)
  }
  return parts.join('')
}

function frame(W: number, H: number, title: string | undefined, body: string): string {
  const t = title
    ? `<text x="${W / 2}" y="26" text-anchor="middle" font-size="16" font-weight="600" fill="#1e293b">${esc(title)}</text>`
    : ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family='${FONT}'>` +
    `<rect width="${W}" height="${H}" fill="#ffffff"/>${t}${body}</svg>`
  )
}

function axesChart(type: 'bar' | 'line', data: ChartData, opts: ChartOpts): string {
  const W = opts.width ?? 720
  const H = opts.height ?? 440
  const top = (opts.title ? 44 : 20) + (opts.showLegend && data.series.length > 1 ? 22 : 0)
  const m = { top, right: 24, bottom: 70, left: 64 }
  const pw = W - m.left - m.right
  const ph = H - m.top - m.bottom
  const all = data.series.flatMap((s) => s.values).filter((v) => Number.isFinite(v))
  const dataMin = all.length ? Math.min(...all) : 0
  const dataMax = all.length ? Math.max(...all) : 1
  const lo = type === 'bar' ? Math.min(0, dataMin) : dataMin
  const hi = type === 'bar' ? Math.max(0, dataMax) : dataMax
  const sc = niceScale(lo, hi)
  const yOf = (v: number) => m.top + ph * (1 - (v - sc.min) / (sc.max - sc.min))
  const n = data.labels.length || 1
  const gw = pw / n
  const parts: string[] = []

  // y 軸刻度 + 水平格線
  for (const tk of sc.ticks) {
    const y = yOf(tk)
    parts.push(`<line x1="${m.left}" y1="${n2(y)}" x2="${m.left + pw}" y2="${n2(y)}" stroke="#e2e8f0" stroke-width="1"/>`)
    parts.push(`<text x="${m.left - 8}" y="${n2(y + 4)}" text-anchor="end" font-size="11" fill="#64748b">${fmtNum(tk)}</text>`)
  }
  // 0 基準線(有負值時加深)
  if (sc.min < 0 && sc.max > 0) parts.push(`<line x1="${m.left}" y1="${n2(yOf(0))}" x2="${m.left + pw}" y2="${n2(yOf(0))}" stroke="#94a3b8" stroke-width="1"/>`)

  // x 軸標籤(過多則旋轉)
  const rotate = n > 8 || data.labels.some((l) => l.length > 6)
  data.labels.forEach((lab, i) => {
    const cx = m.left + gw * (i + 0.5)
    const ty = m.top + ph + 16
    parts.push(
      rotate
        ? `<text x="${n2(cx)}" y="${ty}" font-size="11" fill="#475569" transform="rotate(35 ${n2(cx)} ${ty})">${esc(lab)}</text>`
        : `<text x="${n2(cx)}" y="${ty}" text-anchor="middle" font-size="11" fill="#475569">${esc(lab)}</text>`,
    )
  })

  if (type === 'bar') {
    const sn = data.series.length
    const inner = gw * 0.7
    const bw = inner / sn
    const zeroY = yOf(0)
    data.series.forEach((s, j) => {
      s.values.forEach((v, i) => {
        const x = m.left + gw * i + (gw - inner) / 2 + bw * j
        const y = yOf(v)
        const h = Math.abs(y - zeroY)
        parts.push(`<rect x="${n2(x)}" y="${n2(Math.min(y, zeroY))}" width="${n2(Math.max(0.5, bw - 2))}" height="${n2(h)}" fill="${color(opts, j)}" rx="2"/>`)
        if (opts.showValues && sn === 1) parts.push(`<text x="${n2(x + bw / 2)}" y="${n2(Math.min(y, zeroY) - 4)}" text-anchor="middle" font-size="10" fill="#475569">${fmtNum(v)}</text>`)
      })
    })
  } else {
    data.series.forEach((s, j) => {
      const pts = s.values.map((v, i) => `${n2(m.left + gw * (i + 0.5))},${n2(yOf(v))}`)
      parts.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="${color(opts, j)}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`)
      s.values.forEach((v, i) => {
        parts.push(`<circle cx="${n2(m.left + gw * (i + 0.5))}" cy="${n2(yOf(v))}" r="3.5" fill="#ffffff" stroke="${color(opts, j)}" stroke-width="2"/>`)
      })
    })
  }

  if (opts.showLegend && data.series.length > 1) {
    parts.push(legendSvg(data.series.map((s, j) => ({ name: s.name, color: color(opts, j) })), m.left, m.top - 10))
  }
  return frame(W, H, opts.title, parts.join(''))
}

function pieChart(data: ChartData, opts: ChartOpts): string {
  const W = opts.width ?? 720
  const H = opts.height ?? 440
  const top = opts.title ? 44 : 20
  const cx = W * 0.34
  const cy = top + (H - top) / 2
  const r = Math.min(cx - 24, (H - top) / 2 - 20)
  const series = data.series[0] ?? { name: '', values: [] }
  const slices = pieSlices(series.values)
  const parts: string[] = []
  slices.forEach((sl, i) => {
    if (sl.fraction <= 0) return
    parts.push(`<path d="${arcPath(cx, cy, r, sl.start, sl.end)}" fill="${color(opts, i)}" stroke="#ffffff" stroke-width="1.5"/>`)
    if (sl.fraction >= 0.05) {
      const mid = (sl.start + sl.end) / 2
      const p = polarPoint(cx, cy, r * 0.62, mid)
      parts.push(`<text x="${n2(p.x)}" y="${n2(p.y + 4)}" text-anchor="middle" font-size="12" font-weight="600" fill="#ffffff">${Math.round(sl.fraction * 100)}%</text>`)
    }
  })
  // 圖例(右側,含數值與百分比)
  let ly = top + 14
  data.labels.forEach((lab, i) => {
    const sl = slices[i]
    if (!sl) return
    parts.push(`<rect x="${n2(W * 0.66)}" y="${ly - 10}" width="12" height="12" rx="2" fill="${color(opts, i)}"/>`)
    parts.push(`<text x="${n2(W * 0.66 + 18)}" y="${ly}" font-size="12" fill="#334155">${esc(lab)} — ${fmtNum(sl.value)} (${Math.round(sl.fraction * 100)}%)</text>`)
    ly += 22
  })
  return frame(W, H, opts.title, parts.join(''))
}

/** 主入口:依類型畫出 SVG 字串。 */
export function renderChart(type: ChartType, data: ChartData, opts: ChartOpts = {}): string {
  if (type === 'pie') return pieChart(data, opts)
  return axesChart(type, data, opts)
}
