/*
  螢幕像素密度(PPI / DPI)計算引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  給解析度(寬×高 px)與螢幕對角線英吋,算出每英吋像素(PPI)、點距(dot pitch)、總像素與百萬像素。
  買螢幕/手機、判斷「視網膜等級」清晰度、決定列印解析度時常用,而這套畢氏定理換算容易記錯。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

export interface PpiResult {
  valid: boolean
  /** 對角線像素數 = √(w²+h²) */
  diagonalPixels: number
  /** 每英吋像素 */
  ppi: number
  /** 每公分像素 */
  ppcm: number
  /** 點距(相鄰像素中心距離,mm) */
  dotPitchMm: number
  /** 總像素數 */
  totalPixels: number
  /** 百萬像素 */
  megapixels: number
  /** 實體寬度(英吋) */
  widthInch: number
  /** 實體高度(英吋) */
  heightInch: number
  error: string
}

const EMPTY: PpiResult = {
  valid: false,
  diagonalPixels: 0,
  ppi: 0,
  ppcm: 0,
  dotPitchMm: 0,
  totalPixels: 0,
  megapixels: 0,
  widthInch: 0,
  heightInch: 0,
  error: '',
}

/**
 * 計算像素密度。
 * @param wPx 水平解析度(像素)
 * @param hPx 垂直解析度(像素)
 * @param diagInch 螢幕對角線(英吋)
 */
export function computePpi(wPx: number, hPx: number, diagInch: number): PpiResult {
  if (!isFinite(wPx) || !isFinite(hPx) || !isFinite(diagInch)) {
    return { ...EMPTY, error: '請輸入數值' }
  }
  if (wPx <= 0 || hPx <= 0 || diagInch <= 0) {
    return { ...EMPTY, error: '解析度與尺寸需大於 0' }
  }
  const diagonalPixels = Math.sqrt(wPx * wPx + hPx * hPx)
  const ppi = diagonalPixels / diagInch
  // 實體尺寸:對角線英吋 × (邊像素 / 對角線像素)
  const widthInch = diagInch * (wPx / diagonalPixels)
  const heightInch = diagInch * (hPx / diagonalPixels)
  return {
    valid: true,
    diagonalPixels,
    ppi,
    ppcm: ppi / 2.54,
    dotPitchMm: 25.4 / ppi,
    totalPixels: wPx * hPx,
    megapixels: (wPx * hPx) / 1_000_000,
    widthInch,
    heightInch,
    error: '',
  }
}

/**
 * 給定觀看距離(公分),回傳「人眼剛好分辨不出單一像素」所需的 PPI 門檻(視網膜門檻)。
 * 依 1 弧分視力極限:門檻 PPI = 1 / (2 × distanceInch × tan(0.5′))。
 * 觀看距離越遠,所需 PPI 越低。
 */
export function retinaThreshold(distanceCm: number): number {
  if (!(distanceCm > 0)) return NaN
  const distanceInch = distanceCm / 2.54
  const arcminRad = (1 / 60) * (Math.PI / 180)
  return 1 / (2 * distanceInch * Math.tan(arcminRad / 2))
}

/** 是否達到該觀看距離下的視網膜清晰度。 */
export function isRetina(ppi: number, distanceCm: number): boolean {
  const t = retinaThreshold(distanceCm)
  if (isNaN(t)) return false
  return ppi >= t
}

/** 四捨五入到指定小數位,去掉多餘的零。 */
export function round(n: number, digits = 2): number {
  if (!isFinite(n)) return n
  const f = 10 ** digits
  return Math.round(n * f) / f
}
