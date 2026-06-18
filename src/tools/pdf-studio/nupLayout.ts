/*
  N-up 併頁的版面計算 —— 純函式、無 pdf-lib、無 DOM,方便回歸測試。
  座標採 PDF 慣例:原點在左下角,y 往上為正。
  把每張輸出紙切成 cols×rows 個格子,格子由左到右、由上到下編號(0 起算),
  再把來源頁面等比例縮放、置中塞進格子。
*/
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface NupLayout {
  sheetW: number
  sheetH: number
  cols: number
  rows: number
  perSheet: number // = cols * rows
}

// A4 尺寸(points,1pt = 1/72 inch)
export const A4 = { w: 595.28, h: 841.89 }

// 每張紙的頁數 → 格線與紙張方向(2-up 用橫式,其餘直式)
export const NUP_PRESETS: Record<number, { cols: number; rows: number; landscape: boolean }> = {
  2: { cols: 2, rows: 1, landscape: true },
  4: { cols: 2, rows: 2, landscape: false },
  6: { cols: 2, rows: 3, landscape: false },
  9: { cols: 3, rows: 3, landscape: false },
}

/** 取得指定「每張頁數」的版面;不支援的值退回 2-up */
export function sheetLayout(perSheet: number): NupLayout {
  const p = NUP_PRESETS[perSheet] ?? NUP_PRESETS[2]
  return {
    sheetW: p.landscape ? A4.h : A4.w,
    sheetH: p.landscape ? A4.w : A4.h,
    cols: p.cols,
    rows: p.rows,
    perSheet: p.cols * p.rows,
  }
}

/**
 * 第 index 個格子的方框(PDF 座標,左下原點)。
 * index 0 = 左上角,往右填滿一列再換下一列。
 */
export function cellBox(index: number, lay: NupLayout, margin: number, gap: number): Rect {
  const { cols, rows, sheetW, sheetH } = lay
  const usableW = sheetW - 2 * margin - gap * (cols - 1)
  const usableH = sheetH - 2 * margin - gap * (rows - 1)
  const cw = usableW / cols
  const ch = usableH / rows
  const col = index % cols
  const row = Math.floor(index / cols)
  const x = margin + col * (cw + gap)
  // 第 0 列在最上面:從紙頂往下推
  const yTop = sheetH - margin - row * (ch + gap)
  return { x, y: yTop - ch, w: cw, h: ch }
}

/** 把 srcW×srcH 等比例縮放、置中塞進 box,回傳實際繪製方框 */
export function fitInto(srcW: number, srcH: number, box: Rect): Rect {
  if (srcW <= 0 || srcH <= 0) return { x: box.x, y: box.y, w: 0, h: 0 }
  const scale = Math.min(box.w / srcW, box.h / srcH)
  const w = srcW * scale
  const h = srcH * scale
  return {
    x: box.x + (box.w - w) / 2,
    y: box.y + (box.h - h) / 2,
    w,
    h,
  }
}
