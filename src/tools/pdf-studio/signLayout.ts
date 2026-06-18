/*
  PDF 簽名/蓋章的版面計算 —— 純函式、無 DOM、無 pdf-lib,可在 Node 直接測。
  座標系說明:
   - Box 用「畫面座標」表示:原點在頁面左上角,nx/ny/nw 皆為佔頁面寬/高的比例(0..1)。
     這與使用者在預覽圖上看到、拖曳的方向一致(往下 ny 變大)。
   - imagePlacement 轉成 pdf-lib 的繪圖座標:原點在頁面左下角,單位為 pt,
     回傳的 (x,y) 是圖片左下角。
  圖片高度由寬度乘上長寬比 imgAspect(= 圖高 / 圖寬)推得,維持原圖比例不變形。
*/

export interface Box {
  nx: number // 左緣佔頁寬比例(左上原點)
  ny: number // 上緣佔頁高比例(左上原點)
  nw: number // 寬度佔頁寬比例
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/** 圖章在此頁面下的高度佔頁高比例(由寬度比例 + 長寬比 + 頁面長寬推得) */
export function heightFrac(box: Box, pw: number, ph: number, imgAspect: number): number {
  if (pw <= 0 || ph <= 0) return 0
  return (box.nw * pw * imgAspect) / ph
}

/** 把圖章框夾在頁面內(寬度先夾,再夾左上座標使整張圖不超出頁面) */
export function clampBox(box: Box, pw: number, ph: number, imgAspect: number): Box {
  const nw = clamp(box.nw, 0.01, 1)
  const hf = heightFrac({ nx: 0, ny: 0, nw }, pw, ph, imgAspect)
  const nx = clamp(box.nx, 0, Math.max(0, 1 - nw))
  const ny = clamp(box.ny, 0, Math.max(0, 1 - hf))
  return { nx, ny, nw }
}

/** 產生一個置中的圖章框(加入新圖章時的預設位置) */
export function centerBox(pw: number, ph: number, nw: number, imgAspect: number): Box {
  const hf = heightFrac({ nx: 0, ny: 0, nw }, pw, ph, imgAspect)
  return { nx: (1 - nw) / 2, ny: (1 - hf) / 2, nw }
}

/**
 * 把畫面座標的圖章框轉成 pdf-lib 的繪圖矩形(左下原點、pt)。
 * width/height 維持圖片原比例;y 由「頁高 − 上緣 − 圖高」得到圖片左下角。
 */
export function imagePlacement(pw: number, ph: number, box: Box, imgAspect: number): Rect {
  const width = box.nw * pw
  const height = width * imgAspect
  const x = box.nx * pw
  const y = ph - box.ny * ph - height
  return { x, y, width, height }
}
