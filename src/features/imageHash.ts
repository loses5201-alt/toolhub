/*
  感知雜湊(perceptual hash)引擎 —— 用 dHash 找相似/重複圖片。純函式、無 DOM,可在 Node 測。
  dHash:把圖縮成 (W+1)×H 灰階,比較每列相鄰像素亮度,得 W×H 個位元;
  縮放後仍穩定,故改尺寸、重新存檔、輕微壓縮的同張照片雜湊接近(漢明距離小)。
*/
export const HASH_W = 9 // 取樣寬(會產生 W-1=8 個比較)
export const HASH_H = 8 // 取樣高

// RGBA 像素 → 灰階亮度陣列(Rec. 601 luma)
export function toGray(rgba: Uint8ClampedArray | number[]): number[] {
  const out: number[] = []
  for (let i = 0; i < rgba.length; i += 4) {
    out.push(0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2])
  }
  return out
}

// 灰階格(row-major,長度 = w*h)→ dHash 位元陣列(長度 (w-1)*h)
export function dHash(gray: number[], w = HASH_W, h = HASH_H): number[] {
  const bits: number[] = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i = y * w + x
      bits.push(gray[i] < gray[i + 1] ? 1 : 0)
    }
  }
  return bits
}

// 漢明距離:不同位元的數量(0 = 完全相同)
export function hamming(a: number[], b: number[]): number {
  let d = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) d++
  return d + Math.abs(a.length - b.length)
}

export function bitsToHex(bits: number[]): string {
  let hex = ''
  for (let i = 0; i < bits.length; i += 4) {
    const nib = (bits[i] << 3) | (bits[i + 1] << 2) | (bits[i + 2] << 1) | (bits[i + 3] || 0)
    hex += nib.toString(16)
  }
  return hex
}

export interface HashItem {
  id: number
  hash: number[]
}

/*
  以漢明距離 ≤ threshold 將圖片分群(貪婪:逐張與既有群代表比對,夠近就併入,否則自成一群)。
  回傳每群的成員 id 陣列;只含一張的群代表沒有相似對象。
*/
export function clusterByHash(items: HashItem[], threshold: number): number[][] {
  const groups: { rep: number[]; ids: number[] }[] = []
  for (const it of items) {
    let placed = false
    for (const g of groups) {
      if (hamming(it.hash, g.rep) <= threshold) {
        g.ids.push(it.id)
        placed = true
        break
      }
    }
    if (!placed) groups.push({ rep: it.hash, ids: [it.id] })
  }
  return groups.map((g) => g.ids)
}
