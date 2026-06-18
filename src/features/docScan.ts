/*
  文件掃描美化引擎 —— 把「拍出來的文件照片」處理成像掃描的乾淨檔。

  這裡只放「與環境無關」的純像素運算(灰階、自動對比、自適應二值化),
  操作在 RGBA 像素陣列上、不碰 DOM,方便用 Node 跑回歸測試;
  讀檔、畫 Canvas、輸出 PNG/PDF 那段留在 .vue 元件。

  三種模式:
   - color:彩色增強(自動拉對比 + 提亮背景,保留印章/螢光筆顏色)
   - gray :灰階(去顏色雜訊,檔案更小)
   - bw   :黑白(自適應門檻把字變純黑、紙變純白,最像掃描、檔案最小)
*/

export type ScanMode = 'color' | 'gray' | 'bw'

export interface Pixels {
  data: Uint8ClampedArray | Uint8Array
  width: number
  height: number
}

export interface ScanOptions {
  mode: ScanMode
  /** 強度 0–100,愈高處理愈強(彩色/灰階=裁切百分比愈大背景愈白;黑白=門檻偏移愈大字愈粗) */
  strength: number
}

/** 取單一像素的亮度(Rec. 601 luma),回傳 0–255。 */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

/** 把 RGBA 像素轉成灰階亮度陣列(長度 = width*height,值 0–255 取整)。 */
export function toGray(px: Pixels): Uint8Array {
  const { data, width, height } = px
  const out = new Uint8Array(width * height)
  for (let i = 0, p = 0; p < out.length; i += 4, p++) {
    out[p] = Math.round(luma(data[i], data[i + 1], data[i + 2]))
  }
  return out
}

/**
 * 由灰階直方圖求出「下、上界」:分別裁掉最暗 clipPct%、最亮 clipPct% 的像素。
 * 拿來做對比拉伸:界內映射到 0–255,界外夾住。
 */
export function percentileBounds(gray: Uint8Array, clipPct: number): { lo: number; hi: number } {
  const total = gray.length
  if (total === 0) return { lo: 0, hi: 255 }
  const hist = new Uint32Array(256)
  for (let p = 0; p < total; p++) hist[gray[p]]++
  const clip = Math.max(0, Math.min(49, clipPct)) / 100
  const cut = Math.floor(total * clip)
  let lo = 0
  let hi = 255
  let acc = 0
  for (let v = 0; v < 256; v++) {
    acc += hist[v]
    if (acc > cut) {
      lo = v
      break
    }
  }
  acc = 0
  for (let v = 255; v >= 0; v--) {
    acc += hist[v]
    if (acc > cut) {
      hi = v
      break
    }
  }
  if (hi <= lo) {
    lo = 0
    hi = 255
  }
  return { lo, hi }
}

/** 依下上界把一個 0–255 的值線性拉伸到 0–255 並夾住。 */
function stretch(v: number, lo: number, hi: number): number {
  if (hi <= lo) return v
  const t = ((v - lo) * 255) / (hi - lo)
  return t < 0 ? 0 : t > 255 ? 255 : t
}

/**
 * 自適應二值化(adaptive threshold):每個像素和「以它為中心的局部平均」比較,
 * 比 (局部平均 − C) 暗者判為黑(0)、否則為白(255)。
 * 用積分圖(integral image)讓局部平均 O(1) 取得,適合相片不均勻光照。
 * @param radius 局部視窗半徑(像素);0 以下會自動取一個與尺寸相關的值
 * @param c      門檻偏移,愈大愈不容易判黑(字較細)、愈小字較粗(可能雜點變多)
 */
export function adaptiveThreshold(
  gray: Uint8Array,
  width: number,
  height: number,
  radius: number,
  c: number,
): Uint8Array {
  const n = width * height
  const out = new Uint8Array(n)
  if (n === 0) return out
  const r = radius > 0 ? Math.floor(radius) : Math.max(8, Math.round(Math.min(width, height) / 16))
  // 積分圖大小 (width+1)*(height+1),首列首行為 0,避免邊界判斷
  const iw = width + 1
  const integral = new Float64Array(iw * (height + 1))
  for (let y = 0; y < height; y++) {
    let rowSum = 0
    for (let x = 0; x < width; x++) {
      rowSum += gray[y * width + x]
      integral[(y + 1) * iw + (x + 1)] = integral[y * iw + (x + 1)] + rowSum
    }
  }
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - r)
    const y1 = Math.min(height - 1, y + r)
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - r)
      const x1 = Math.min(width - 1, x + r)
      const count = (x1 - x0 + 1) * (y1 - y0 + 1)
      // 區域和 = D - B - C + A(積分圖座標需 +1)
      const sum =
        integral[(y1 + 1) * iw + (x1 + 1)] -
        integral[y0 * iw + (x1 + 1)] -
        integral[(y1 + 1) * iw + x0] +
        integral[y0 * iw + x0]
      const mean = sum / count
      const p = y * width + x
      out[p] = gray[p] < mean - c ? 0 : 255
    }
  }
  return out
}

/**
 * 主流程:輸入來源 RGBA,依模式回傳「處理後的新 RGBA 陣列」(不更動輸入,
 * 方便用同一張原圖反覆套不同設定)。
 */
export function applyScan(src: Pixels, opts: ScanOptions): Uint8ClampedArray {
  const { width, height } = src
  const n = width * height
  const out = new Uint8ClampedArray(n * 4)
  const s = Math.max(0, Math.min(100, opts.strength))
  const gray = toGray(src)

  if (opts.mode === 'bw') {
    // 強度 → 門檻偏移 C(4–20):強度愈高字愈粗
    const c = 4 + (s / 100) * 16
    const bw = adaptiveThreshold(gray, width, height, 0, c)
    for (let p = 0, i = 0; p < n; p++, i += 4) {
      const v = bw[p]
      out[i] = out[i + 1] = out[i + 2] = v
      out[i + 3] = 255
    }
    return out
  }

  // color / gray:用灰階直方圖求對比界,裁切百分比 0–8% 隨強度增加(背景更白)
  const clipPct = (s / 100) * 8
  const { lo, hi } = percentileBounds(gray, clipPct)
  if (opts.mode === 'gray') {
    for (let p = 0, i = 0; p < n; p++, i += 4) {
      const v = stretch(gray[p], lo, hi)
      out[i] = out[i + 1] = out[i + 2] = v
      out[i + 3] = 255
    }
    return out
  }
  // color:用同一組界對每個通道拉伸,保留色相但提亮、增對比
  const sd = src.data
  for (let i = 0; i < n * 4; i += 4) {
    out[i] = stretch(sd[i], lo, hi)
    out[i + 1] = stretch(sd[i + 1], lo, hi)
    out[i + 2] = stretch(sd[i + 2], lo, hi)
    out[i + 3] = 255
  }
  return out
}
