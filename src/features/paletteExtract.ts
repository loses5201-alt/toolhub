// 圖片調色盤萃取 —— 用 median cut(中位數切割)量化演算法,從一張圖的像素中
// 取出最具代表性的 N 個主色。純函式、無 DOM,可在 Node 測試(像素陣列進、色票出)。

export type RGB = [number, number, number]

export interface Swatch {
  rgb: RGB
  hex: string
  count: number // 落在此色塊的像素數
  ratio: number // 佔比 0–1
}

export function clamp255(n: number): number {
  return n < 0 ? 0 : n > 255 ? 255 : Math.round(n)
}

export function rgbToHex(rgb: RGB): string {
  return (
    '#' +
    rgb
      .map((c) => clamp255(c).toString(16).padStart(2, '0'))
      .join('')
  )
}

// 相對亮度(WCAG),供前端決定色票上的文字用黑或白
export function luminance(rgb: RGB): number {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// 從 RGBA 像素資料抽出不透明像素的 [r,g,b] 清單(可跳格抽樣降量)
export function extractPixels(
  data: ArrayLike<number>,
  options: { alphaThreshold?: number; stride?: number } = {},
): RGB[] {
  const alphaThreshold = options.alphaThreshold ?? 8
  const stride = Math.max(1, Math.floor(options.stride ?? 1))
  const out: RGB[] = []
  for (let i = 0; i + 3 < data.length; i += 4 * stride) {
    if (data[i + 3] <= alphaThreshold) continue
    out.push([data[i], data[i + 1], data[i + 2]])
  }
  return out
}

function channelRange(box: RGB[]): RGB {
  const mins: RGB = [255, 255, 255]
  const maxs: RGB = [0, 0, 0]
  for (const p of box) {
    for (let c = 0; c < 3; c++) {
      if (p[c] < mins[c]) mins[c] = p[c]
      if (p[c] > maxs[c]) maxs[c] = p[c]
    }
  }
  return [maxs[0] - mins[0], maxs[1] - mins[1], maxs[2] - mins[2]]
}

function averageColor(box: RGB[]): RGB {
  const sum = [0, 0, 0]
  for (const p of box) {
    sum[0] += p[0]
    sum[1] += p[1]
    sum[2] += p[2]
  }
  const n = box.length
  return [clamp255(sum[0] / n), clamp255(sum[1] / n), clamp255(sum[2] / n)]
}

// median cut:反覆挑「單一通道色差最大」的色塊,沿最長通道在中位數切兩半,直到湊滿 count 個。
export function medianCut(pixels: RGB[], count: number): Swatch[] {
  const total = pixels.length
  if (total === 0 || count < 1) return []
  let boxes: RGB[][] = [pixels.slice()]

  while (boxes.length < count) {
    let target = -1
    let widest = -1
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].length < 2) continue
      const r = channelRange(boxes[i])
      const m = Math.max(r[0], r[1], r[2])
      if (m > widest) {
        widest = m
        target = i
      }
    }
    if (target < 0 || widest <= 0) break // 無法再切(色塊皆單色或單像素)
    const box = boxes[target]
    const r = channelRange(box)
    const ch = r[0] >= r[1] && r[0] >= r[2] ? 0 : r[1] >= r[2] ? 1 : 2
    box.sort((a, b) => a[ch] - b[ch])
    const mid = box.length >> 1
    boxes.splice(target, 1, box.slice(0, mid), box.slice(mid))
  }

  return boxes
    .map((box) => {
      const rgb = averageColor(box)
      return { rgb, hex: rgbToHex(rgb), count: box.length, ratio: box.length / total }
    })
    .sort((a, b) => b.count - a.count)
}

// 把色票輸出成各種貼上即用的格式
export function formatSwatches(swatches: Swatch[], mode: 'hex' | 'css' | 'json' | 'rgb'): string {
  if (mode === 'hex') return swatches.map((s) => s.hex).join('\n')
  if (mode === 'rgb') return swatches.map((s) => `rgb(${s.rgb[0]}, ${s.rgb[1]}, ${s.rgb[2]})`).join('\n')
  if (mode === 'css')
    return ':root {\n' + swatches.map((s, i) => `  --color-${i + 1}: ${s.hex};`).join('\n') + '\n}'
  return JSON.stringify(swatches.map((s) => s.hex))
}
