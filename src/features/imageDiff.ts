// 圖片像素差異比對 —— 以 YIQ 感知色差(pixelmatch 風格)逐像素比較兩張同尺寸圖,
// 標出不同處並計算變化比例。純函式、無 DOM(吃 RGBA 位元組),可在 Node 測試。

export interface DiffOptions {
  threshold?: number // 0–1,越大越寬容(預設 0.1)
  diffColor?: [number, number, number] // 差異標色(預設紅)
  dimUnchanged?: boolean // 未變動處淡化為灰階底圖(預設 true)
}

export interface DiffResult {
  output: Uint8ClampedArray // RGBA,標好差異的結果圖
  changed: number // 不同的像素數
  total: number // 總像素數
  ratio: number // changed / total
}

function rgb2y(r: number, g: number, b: number): number {
  return r * 0.29889531 + g * 0.58662247 + b * 0.11448223
}
function rgb2i(r: number, g: number, b: number): number {
  return r * 0.59597799 - g * 0.2741761 - b * 0.32180189
}
function rgb2q(r: number, g: number, b: number): number {
  return r * 0.21147017 - g * 0.52261711 + b * 0.31114694
}

// 半透明像素疊到白底
function blend(c: number, a: number): number {
  return 255 + (c - 255) * a
}

// 兩像素的感知色差平方(0=相同),k/m 為各自的位元組起始位置
export function colorDelta(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  k: number,
  m: number,
): number {
  let r1 = a[k],
    g1 = a[k + 1],
    b1 = a[k + 2]
  let r2 = b[m],
    g2 = b[m + 1],
    b2 = b[m + 2]
  const a1 = a[k + 3] ?? 255
  const a2 = b[m + 3] ?? 255
  if (a1 < 255) {
    const f = a1 / 255
    r1 = blend(r1, f)
    g1 = blend(g1, f)
    b1 = blend(b1, f)
  }
  if (a2 < 255) {
    const f = a2 / 255
    r2 = blend(r2, f)
    g2 = blend(g2, f)
    b2 = blend(b2, f)
  }
  const y = rgb2y(r1, g1, b1) - rgb2y(r2, g2, b2)
  const i = rgb2i(r1, g1, b1) - rgb2i(r2, g2, b2)
  const q = rgb2q(r1, g1, b1) - rgb2q(r2, g2, b2)
  return 0.5053 * y * y + 0.299 * i * i + 0.1957 * q * q
}

const MAX_DELTA = 35215 // 兩色相距最遠時的色差平方

export function diffImages(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  width: number,
  height: number,
  options: DiffOptions = {},
): DiffResult {
  const threshold = options.threshold ?? 0.1
  const [dr, dg, db] = options.diffColor ?? [255, 0, 0]
  const dim = options.dimUnchanged ?? true
  const total = width * height
  const output = new Uint8ClampedArray(total * 4)
  const maxDelta = MAX_DELTA * threshold * threshold
  let changed = 0

  for (let i = 0; i < total; i++) {
    const pos = i * 4
    const delta = colorDelta(a, b, pos, pos)
    if (delta > maxDelta) {
      output[pos] = dr
      output[pos + 1] = dg
      output[pos + 2] = db
      output[pos + 3] = 255
      changed++
    } else {
      if (dim) {
        // 灰階 + 提亮,讓差異色更突出
        const gray = blend(rgb2y(a[pos], a[pos + 1], a[pos + 2]), 0.1)
        output[pos] = gray
        output[pos + 1] = gray
        output[pos + 2] = gray
      } else {
        output[pos] = a[pos]
        output[pos + 1] = a[pos + 1]
        output[pos + 2] = a[pos + 2]
      }
      output[pos + 3] = 255
    }
  }

  return { output, changed, total, ratio: total === 0 ? 0 : changed / total }
}
