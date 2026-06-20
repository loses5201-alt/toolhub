/*
  紙張尺寸與列印像素引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  收錄 ISO 216 的 A 系列 / B 系列與美規 Letter/Legal/Tabloid,給出 mm / cm / 英吋尺寸,
  並換算「在指定 DPI 下該做幾 × 幾像素」—— 做 A4 海報、印刷稿、證件照常要查「A4 是 210×297mm、
  300dpi 要 2480×3508px」,而這些到處查都不乾淨。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

export interface PaperSpec {
  id: string
  name: string
  series: 'A' | 'B' | 'US'
  /** 直式時的寬(mm) */
  widthMm: number
  /** 直式時的高(mm) */
  heightMm: number
}

// ISO 216 標準值(以官方四捨五入後的整數 mm 定義,非單純對半)
export const PAPERS: PaperSpec[] = [
  { id: 'a0', name: 'A0', series: 'A', widthMm: 841, heightMm: 1189 },
  { id: 'a1', name: 'A1', series: 'A', widthMm: 594, heightMm: 841 },
  { id: 'a2', name: 'A2', series: 'A', widthMm: 420, heightMm: 594 },
  { id: 'a3', name: 'A3', series: 'A', widthMm: 297, heightMm: 420 },
  { id: 'a4', name: 'A4', series: 'A', widthMm: 210, heightMm: 297 },
  { id: 'a5', name: 'A5', series: 'A', widthMm: 148, heightMm: 210 },
  { id: 'a6', name: 'A6', series: 'A', widthMm: 105, heightMm: 148 },
  { id: 'a7', name: 'A7', series: 'A', widthMm: 74, heightMm: 105 },
  { id: 'a8', name: 'A8', series: 'A', widthMm: 52, heightMm: 74 },
  { id: 'b0', name: 'B0', series: 'B', widthMm: 1000, heightMm: 1414 },
  { id: 'b1', name: 'B1', series: 'B', widthMm: 707, heightMm: 1000 },
  { id: 'b2', name: 'B2', series: 'B', widthMm: 500, heightMm: 707 },
  { id: 'b3', name: 'B3', series: 'B', widthMm: 353, heightMm: 500 },
  { id: 'b4', name: 'B4', series: 'B', widthMm: 250, heightMm: 353 },
  { id: 'b5', name: 'B5', series: 'B', widthMm: 176, heightMm: 250 },
  { id: 'b6', name: 'B6', series: 'B', widthMm: 125, heightMm: 176 },
  { id: 'letter', name: 'US Letter', series: 'US', widthMm: 215.9, heightMm: 279.4 },
  { id: 'legal', name: 'US Legal', series: 'US', widthMm: 215.9, heightMm: 355.6 },
  { id: 'tabloid', name: 'US Tabloid', series: 'US', widthMm: 279.4, heightMm: 431.8 },
]

const PAPER_MAP: Record<string, PaperSpec> = Object.fromEntries(PAPERS.map((p) => [p.id, p]))

export function getPaper(id: string): PaperSpec | null {
  return PAPER_MAP[id] || null
}

export type Orientation = 'portrait' | 'landscape'

export interface PaperDimensions {
  widthMm: number
  heightMm: number
  widthCm: number
  heightCm: number
  widthIn: number
  heightIn: number
  widthPx: number
  heightPx: number
}

/** mm → 英吋。 */
export function mmToInch(mm: number): number {
  return mm / 25.4
}

/** mm → 在指定 DPI 下的像素數(四捨五入到整數像素)。 */
export function mmToPx(mm: number, dpi: number): number {
  return Math.round((mm / 25.4) * dpi)
}

/**
 * 取得某紙張在指定方向與 DPI 下的完整尺寸。
 * @param id 紙張 id(如 'a4')
 * @param dpi 解析度(預設 300)
 * @param orientation 'portrait'(直式)或 'landscape'(橫式)
 */
export function dimensions(
  id: string,
  dpi = 300,
  orientation: Orientation = 'portrait',
): PaperDimensions | null {
  const p = getPaper(id)
  if (!p || !(dpi > 0)) return null
  const widthMm = orientation === 'landscape' ? p.heightMm : p.widthMm
  const heightMm = orientation === 'landscape' ? p.widthMm : p.heightMm
  return {
    widthMm,
    heightMm,
    widthCm: widthMm / 10,
    heightCm: heightMm / 10,
    widthIn: mmToInch(widthMm),
    heightIn: mmToInch(heightMm),
    widthPx: mmToPx(widthMm, dpi),
    heightPx: mmToPx(heightMm, dpi),
  }
}

/** 四捨五入到指定小數位,去掉多餘的零。 */
export function round(n: number, digits = 2): number {
  if (!isFinite(n)) return n
  const f = 10 ** digits
  return Math.round(n * f) / f
}
