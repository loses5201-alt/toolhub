/*
  「把照片壓到指定大小(KB)」核心邏輯 —— 純函式、不碰 DOM,方便 Node 跑回歸測試。

  痛點:台灣各種報名/考試/上傳系統常限制照片「不得超過 ○○ KB」且要指定尺寸,
  一般工具只有「品質滑桿」要自己反覆試。這裡用二分搜尋自動找出「在大小上限內、品質最高」的設定。

  實際的 JPEG 編碼(canvas.toBlob)在 .vue 元件做,透過 measure 回呼注入,
  讓搜尋演算法本身與瀏覽器無關、可測。
*/

/** 人類可讀的檔案大小。 */
export function fmtSize(n: number): string {
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10 * 1024 ? 1 : 0) + ' KB'
  return (n / 1024 / 1024).toFixed(2) + ' MB'
}

/** 算出讓最長邊不超過 maxEdge 的縮放比例(≤1;maxEdge 為 0/負/null 表示不縮)。 */
export function fitScale(w: number, h: number, maxEdge: number | null): number {
  if (!maxEdge || maxEdge <= 0) return 1
  const longest = Math.max(w, h)
  return longest <= maxEdge ? 1 : maxEdge / longest
}

export interface QualityResult {
  /** 找到的最佳品質(整數 1–100)。 */
  quality: number
  /** 該品質下的位元組大小。 */
  size: number
  /** 是否真的壓進了目標(false = 連最低品質都還超過)。 */
  underTarget: boolean
}

export interface SearchOptions {
  minQ?: number
  maxQ?: number
  /** 二分搜尋迭代次數(越多越精準,但編碼次數越多)。 */
  iters?: number
}

/**
 * 二分搜尋:在 [minQ, maxQ] 找出「編碼後 ≤ targetBytes 且品質最高」的整數品質。
 * measure(q) 回傳該品質編碼後的位元組大小(假設大小隨品質單調遞增)。
 *
 * - 若連 minQ 都超過目標 → 回 minQ 的結果,underTarget=false。
 * - 若 maxQ 就已達標 → 直接回 maxQ(最佳)。
 */
export async function searchQuality(
  measure: (q: number) => Promise<number> | number,
  targetBytes: number,
  opts: SearchOptions = {},
): Promise<QualityResult> {
  const minQ = Math.max(1, Math.round(opts.minQ ?? 20))
  const maxQ = Math.min(100, Math.round(opts.maxQ ?? 95))
  const iters = Math.max(1, opts.iters ?? 8)

  // 先看最高品質是否就已達標
  const sizeAtMax = await measure(maxQ)
  if (sizeAtMax <= targetBytes) {
    return { quality: maxQ, size: sizeAtMax, underTarget: true }
  }
  // 看最低品質是否仍超過(壓不下去)
  const sizeAtMin = await measure(minQ)
  if (sizeAtMin > targetBytes) {
    return { quality: minQ, size: sizeAtMin, underTarget: false }
  }

  // 二分搜尋最高的達標品質
  let lo = minQ // 已知達標
  let hi = maxQ // 已知超標
  let best: QualityResult = { quality: minQ, size: sizeAtMin, underTarget: true }
  for (let i = 0; i < iters && hi - lo > 1; i++) {
    const mid = Math.floor((lo + hi) / 2)
    const size = await measure(mid)
    if (size <= targetBytes) {
      best = { quality: mid, size, underTarget: true }
      lo = mid
    } else {
      hi = mid
    }
  }
  return best
}
