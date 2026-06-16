/*
  檔案分割 / 合併引擎 —— 純函式、無 DOM 依賴(故可在 Node 測)。
  分割只計算「切點」,實際切片在元件用 Blob.slice 做(惰性、省記憶體);
  合併在元件用 new Blob([...parts]) 串接(不需把整檔讀進 JS 陣列)。
  這裡放可獨立驗證的邏輯:切點規劃、分割檔命名、檔名排序、位元組串接(供測試驗證來回一致)。
*/

export interface ChunkPlan {
  index: number // 1-based 第幾份
  start: number // 起始位元組(含)
  end: number // 結束位元組(不含)
  size: number // 此份大小
}

// 分割檔最多份數:命名用三碼起跳(.001),上限取 999 以維持與 cat/copy 萬用字元排序相容
export const MAX_PARTS = 999

/**
 * 依總大小與每份大小,算出每一份的切點。
 * @param totalSize 原始檔總位元組數(需 > 0)
 * @param partSize  每份位元組數(需 > 0)
 */
export function planChunks(totalSize: number, partSize: number): ChunkPlan[] {
  if (!Number.isFinite(totalSize) || totalSize <= 0) throw new Error('檔案大小必須大於 0')
  if (!Number.isFinite(partSize) || partSize <= 0) throw new Error('每份大小必須大於 0')
  const count = Math.ceil(totalSize / partSize)
  if (count > MAX_PARTS) {
    throw new Error(`會切成 ${count} 份,超過上限 ${MAX_PARTS} 份;請把「每份大小」調大一點`)
  }
  const plans: ChunkPlan[] = []
  for (let i = 0; i < count; i++) {
    const start = i * partSize
    const end = Math.min(start + partSize, totalSize)
    plans.push({ index: i + 1, start, end, size: end - start })
  }
  return plans
}

// 命名所需的補零寬度(至少 3 碼,份數更多時自動加寬)
export function padWidth(total: number): number {
  return Math.max(3, String(total).length)
}

/**
 * 分割檔命名:原名後接 .001 .002 …(零補齊),與 HJSplit / 7-Zip 慣例一致,
 * 也讓 `cat file.* ` / `copy /b file.*` 依檔名排序剛好就是正確順序。
 */
export function partName(baseName: string, index: number, total: number): string {
  const w = padWidth(total)
  return `${baseName}.${String(index).padStart(w, '0')}`
}

/**
 * 取出檔名結尾的分割序號(.001 → 1),非分割檔回傳 null。
 * 用於合併時把使用者選的多個分割檔依序號排好。
 */
export function partIndexOf(name: string): number | null {
  const m = /\.(\d{2,})$/.exec(name)
  if (!m) return null
  return parseInt(m[1], 10)
}

// 去掉分割序號副檔名,還原原始檔名(report.pdf.003 → report.pdf)
export function baseNameOf(name: string): string {
  return name.replace(/\.\d{2,}$/, '')
}

export interface OrderResult<T> {
  ordered: T[] // 依序號排好的項目
  indices: number[] // 對應序號
  hasIndex: boolean // 是否每個都帶序號
  missing: number[] // 從 1 到最大序號中缺少的序號(序列不完整時非空)
  duplicates: number[] // 重複出現的序號
}

/**
 * 把使用者隨意選取/拖入的分割檔,依檔名序號排序並檢查序列是否完整。
 * 全部都不帶序號(hasIndex=false)時維持原順序,讓使用者可手動排序後合併。
 */
export function orderParts<T>(items: T[], nameOf: (t: T) => string): OrderResult<T> {
  const tagged = items.map((it) => ({ it, idx: partIndexOf(nameOf(it)) }))
  const hasIndex = tagged.length > 0 && tagged.every((t) => t.idx !== null)
  if (!hasIndex) {
    return { ordered: items.slice(), indices: [], hasIndex: false, missing: [], duplicates: [] }
  }
  const sorted = tagged.slice().sort((a, b) => (a.idx! - b.idx!))
  const indices = sorted.map((t) => t.idx!)
  const seen = new Set<number>()
  const duplicates: number[] = []
  for (const i of indices) {
    if (seen.has(i)) duplicates.push(i)
    seen.add(i)
  }
  const max = Math.max(...indices)
  const missing: number[] = []
  for (let i = 1; i <= max; i++) if (!seen.has(i)) missing.push(i)
  return { ordered: sorted.map((t) => t.it), indices, hasIndex: true, missing, duplicates }
}

// 串接多段位元組為一段(供測試驗證來回一致;元件改用 new Blob 省記憶體)
export function joinBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const p of parts) {
    out.set(p, off)
    off += p.length
  }
  return out
}

// 人類可讀檔案大小
export function fmtSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return v.toFixed(v < 10 ? 2 : 1) + ' ' + units[i]
}
