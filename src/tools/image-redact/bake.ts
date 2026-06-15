/*
  圖片遮蔽輸出 —— 把使用者畫的遮蔽框燒進圖片,全程在瀏覽器 canvas 處理,不上傳。
  遮蔽框以「相對比例(0..1)」儲存,故與顯示尺寸無關,輸出時用原始解析度套用。
*/
export interface Rect {
  id: number
  x: number // 左上 x,佔圖寬比例 0..1
  y: number // 左上 y,佔圖高比例 0..1
  w: number // 寬比例 0..1
  h: number // 高比例 0..1
  mode: 'black' | 'mosaic'
}

export function fmtSize(n: number): string {
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB'
  return (n / 1024 / 1024).toFixed(2) + ' MB'
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

/** 對 canvas 上某矩形區域做馬賽克(先縮小再放大),block 為馬賽克格子像素大小 */
function pixelate(ctx: CanvasRenderingContext2D, px: number, py: number, pw: number, ph: number, block: number) {
  if (pw < 1 || ph < 1) return
  const cols = Math.max(1, Math.round(pw / block))
  const rows = Math.max(1, Math.round(ph / block))
  const tmp = document.createElement('canvas')
  tmp.width = cols
  tmp.height = rows
  const tctx = tmp.getContext('2d')!
  tctx.imageSmoothingEnabled = true
  // 把該區域畫進極小的暫存 canvas(平均化),再無平滑放大回原區域
  tctx.drawImage(ctx.canvas, px, py, pw, ph, 0, 0, cols, rows)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(tmp, 0, 0, cols, rows, px, py, pw, ph)
  ctx.imageSmoothingEnabled = true
}

/** 把圖片 + 遮蔽框燒成輸出 Blob */
export async function bake(
  srcUrl: string,
  rects: Rect[],
  format: 'image/png' | 'image/jpeg',
  mosaicBlock = 12,
): Promise<Blob> {
  const img = await loadImage(srcUrl)
  const W = img.naturalWidth
  const H = img.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  if (format === 'image/jpeg') {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, W, H)
  }
  ctx.drawImage(img, 0, 0, W, H)
  for (const r of rects) {
    const px = Math.round(r.x * W)
    const py = Math.round(r.y * H)
    const pw = Math.round(r.w * W)
    const ph = Math.round(r.h * H)
    if (r.mode === 'mosaic') {
      pixelate(ctx, px, py, pw, ph, mosaicBlock)
    } else {
      ctx.fillStyle = '#000'
      ctx.fillRect(px, py, pw, ph)
    }
  }
  return await new Promise<Blob>((res) =>
    canvas.toBlob((b) => res(b!), format, 0.92),
  )
}
