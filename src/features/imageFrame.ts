/*
  照片加邊框 / 改長寬比版面計算引擎(純函式、無 DOM,可在 Node 直接測)。
  常見需求:把長方形照片加白邊變成正方形(或 4:5、9:16)以利 IG / 限動上傳,不被裁切。
  作法:保留原圖原始像素(不放大、不失真),依目標比例在四周補上等寬邊框,圖置中。
  真正的繪製(canvas)在 Vue 端;此處只算「畫布尺寸與圖片擺放位置」。全程在使用者瀏覽器執行。
*/

export type FrameAspect = 'original' | 'square' | '4:5' | '5:4' | '16:9' | '9:16' | '3:2' | '2:3'

// 比例字串 → 寬高比數值(width/height)
const ASPECT_RATIO: Record<Exclude<FrameAspect, 'original'>, number> = {
  square: 1,
  '4:5': 4 / 5,
  '5:4': 5 / 4,
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '3:2': 3 / 2,
  '2:3': 2 / 3,
}

export interface FrameOptions {
  srcW: number
  srcH: number
  aspect: FrameAspect
  marginPercent: number // 邊框寬度 = 原圖較長邊 × 此百分比(0–50)
}

export interface FrameLayout {
  canvasW: number
  canvasH: number
  drawX: number
  drawY: number
  drawW: number
  drawH: number
  margin: number
}

/**
 * 計算加框後的畫布尺寸與圖片擺放位置。
 * 圖片維持原始像素大小置中,四周至少有 margin 的邊框;畫布外形符合目標比例。
 */
export function computeFrame(opts: FrameOptions): FrameLayout {
  const srcW = Math.max(1, Math.round(opts.srcW))
  const srcH = Math.max(1, Math.round(opts.srcH))
  const mp = Math.max(0, Math.min(50, opts.marginPercent)) / 100
  const margin = Math.round(Math.max(srcW, srcH) * mp)

  const minW = srcW + 2 * margin
  const minH = srcH + 2 * margin

  let canvasW = minW
  let canvasH = minH

  if (opts.aspect !== 'original') {
    const r = ASPECT_RATIO[opts.aspect] // 目標 寬/高
    if (minW / minH >= r) {
      // 目前太寬 → 以寬為準,補高
      canvasW = minW
      canvasH = Math.round(canvasW / r)
    } else {
      // 目前太高 → 以高為準,補寬
      canvasH = minH
      canvasW = Math.round(canvasH * r)
    }
  }

  const drawW = srcW
  const drawH = srcH
  const drawX = Math.round((canvasW - drawW) / 2)
  const drawY = Math.round((canvasH - drawH) / 2)

  return { canvasW, canvasH, drawX, drawY, drawW, drawH, margin }
}

/** 取得比例的近似 寬:高 數值(供顯示),original 回 null */
export function aspectValue(a: FrameAspect): number | null {
  return a === 'original' ? null : ASPECT_RATIO[a]
}
