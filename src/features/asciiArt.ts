/*
  圖片轉 ASCII 藝術引擎(純函式、無 DOM,可在 Node 直接測)。
  作法:把圖片縮取成「字元格」網格,每一格取該區塊像素的平均亮度,
  再依字元梯度(由深到淺)挑一個字元;深色像素 → 筆畫密的字元,淺色 → 空白。
  字元在等寬字型下「高比寬」約 2:1,故列數要乘字元長寬比(預設 0.5)以維持原圖比例。
  透明像素先與白底混合,因此去背圖的透明處會變成空白。全程在使用者瀏覽器執行、不連網、不上傳。
*/

// 常用字元梯度:索引 0 = 最深(筆畫最密),最後 = 最淺(空白)
export const RAMPS: Record<string, string> = {
  // 經典 10 階
  standard: '@%#*+=-:. ',
  // 70 階,細節最豐富(Paul Bourke 常用表)
  detailed:
    "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'. ",
  // 方塊(Unicode block)由實到虛
  blocks: '█▓▒░ ',
  // 極簡 5 階
  simple: '#x+-. ',
  // 點陣
  dots: '@:. ',
}

export interface AsciiOptions {
  cols: number // 目標欄數(字元寬度)
  ramp: string // 字元梯度(深→淺)
  invert?: boolean // 反相(深淺對調,適合深底淺字)
  charAspect?: number // 字元寬/高比,預設 0.5(等寬字型約 1:2)
}

export interface AsciiCell {
  char: string
  r: number
  g: number
  b: number
}

export interface AsciiResult {
  cols: number
  rows: number
  lines: string[] // 每列一字串
  cells: AsciiCell[][] // [row][col],含平均顏色(供彩色輸出)
}

/** Rec.601 感知亮度,回傳 0..255 */
export function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

/** 依亮度(0..255)從字元梯度挑字元 */
export function pickChar(lum: number, ramp: string, invert = false): string {
  const len = ramp.length
  if (len === 0) return ' '
  let ratio = Math.max(0, Math.min(1, lum / 255)) // 0=暗 1=亮
  if (invert) ratio = 1 - ratio
  // 亮 → 梯度尾端(空白);暗 → 梯度開頭
  const idx = Math.round(ratio * (len - 1))
  return ramp[idx]
}

/**
 * 把 RGBA 像素資料轉成 ASCII 網格。
 * @param data 長度 width*height*4 的 RGBA 陣列(Uint8ClampedArray 或一般陣列)
 */
export function rgbaToAscii(
  data: ArrayLike<number>,
  width: number,
  height: number,
  opts: AsciiOptions,
): AsciiResult {
  const cols = Math.max(1, Math.floor(opts.cols))
  const charAspect = opts.charAspect && opts.charAspect > 0 ? opts.charAspect : 0.5
  const ramp = opts.ramp && opts.ramp.length > 0 ? opts.ramp : RAMPS.standard
  // 維持原圖比例:列數 = 列高比例 × 欄數 × 字元長寬比
  const rows = Math.max(1, Math.round((height / width) * cols * charAspect))

  const cellW = width / cols
  const cellH = height / rows
  const lines: string[] = []
  const cells: AsciiCell[][] = []

  for (let row = 0; row < rows; row++) {
    let y0 = Math.floor(row * cellH)
    let y1 = Math.floor((row + 1) * cellH)
    if (y1 <= y0) y1 = y0 + 1
    if (y1 > height) y1 = height

    let line = ''
    const cellRow: AsciiCell[] = []
    for (let col = 0; col < cols; col++) {
      let x0 = Math.floor(col * cellW)
      let x1 = Math.floor((col + 1) * cellW)
      if (x1 <= x0) x1 = x0 + 1
      if (x1 > width) x1 = width

      let sumR = 0
      let sumG = 0
      let sumB = 0
      let count = 0
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * width + x) * 4
          const a = data[i + 3] / 255
          // 與白底混合,透明處趨近白
          const r = data[i] * a + 255 * (1 - a)
          const g = data[i + 1] * a + 255 * (1 - a)
          const b = data[i + 2] * a + 255 * (1 - a)
          sumR += r
          sumG += g
          sumB += b
          count++
        }
      }
      const r = count ? sumR / count : 255
      const g = count ? sumG / count : 255
      const b = count ? sumB / count : 255
      const ch = pickChar(luminance(r, g, b), ramp, opts.invert)
      line += ch
      cellRow.push({ char: ch, r: Math.round(r), g: Math.round(g), b: Math.round(b) })
    }
    lines.push(line)
    cells.push(cellRow)
  }

  return { cols, rows, lines, cells }
}

/** 把結果轉純文字(列以換行分隔) */
export function toText(result: AsciiResult): string {
  return result.lines.join('\n')
}
