/*
  長寬比與尺寸縮放計算引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  做設計、剪影片、印刷、響應式圖片時常要算:這個尺寸是幾比幾?維持比例放大到某個寬度,
  高度該是多少?要塞進某個外框(contain)或填滿外框(cover)會縮放成多大?
  全程在你的瀏覽器計算,不連網、不上傳。
*/

/** 最大公因數(輾轉相除,取絕對值)。 */
export function gcd(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) {
    ;[a, b] = [b, a % b]
  }
  return a
}

/** 取一個數的小數位數(用來把小數尺寸放大成整數再約分)。 */
function decimals(n: number): number {
  if (!isFinite(n)) return 0
  const s = String(n)
  const i = s.indexOf('.')
  return i < 0 ? 0 : s.length - i - 1
}

export interface RatioResult {
  valid: boolean
  /** 約分後的比例分子(寬) */
  w: number
  /** 約分後的比例分母(高) */
  h: number
  /** 例如 "16:9" */
  text: string
  /** 寬/高 的小數值,例如 1.7778 */
  decimal: number
  error: string
}

/**
 * 把寬高約分成最簡整數比。支援小數輸入(會先放大成整數)。
 * 例:1920×1080 → 16:9;1280×1024 → 5:4。
 */
export function simplifyRatio(width: number, height: number): RatioResult {
  const base: RatioResult = { valid: false, w: 0, h: 0, text: '', decimal: 0, error: '' }
  if (!isFinite(width) || !isFinite(height)) {
    return { ...base, error: '寬與高需為數字' }
  }
  if (width <= 0 || height <= 0) {
    return { ...base, error: '寬與高需大於 0' }
  }
  const scale = 10 ** Math.max(decimals(width), decimals(height))
  let iw = Math.round(width * scale)
  let ih = Math.round(height * scale)
  const g = gcd(iw, ih) || 1
  iw /= g
  ih /= g
  return {
    valid: true,
    w: iw,
    h: ih,
    text: `${iw}:${ih}`,
    decimal: width / height,
    error: '',
  }
}

/** 常見比例庫(寬, 高, 名稱),用比值在容差內辨識。 */
const COMMON: { w: number; h: number; name: string }[] = [
  { w: 16, h: 9, name: '寬螢幕 / Full HD・4K' },
  { w: 9, h: 16, name: '直式短影音(Reels / Shorts / TikTok)' },
  { w: 4, h: 3, name: '傳統螢幕 / 相機 4:3' },
  { w: 3, h: 4, name: '直式 4:3' },
  { w: 3, h: 2, name: '單眼相機 3:2 / 沖洗 4×6' },
  { w: 2, h: 3, name: '直式 3:2' },
  { w: 1, h: 1, name: '正方形(IG 貼文)' },
  { w: 21, h: 9, name: '超寬螢幕 21:9' },
  { w: 5, h: 4, name: '5:4(部分螢幕 / 8×10 印刷)' },
  { w: 16, h: 10, name: '16:10(筆電螢幕)' },
  { w: 1.91, h: 1, name: '1.91:1(FB / LINE 連結預覽)' },
  { w: 2.39, h: 1, name: '電影寬銀幕 2.39:1' },
]

/** 辨識最接近的常見比例名稱;容差內才回傳,否則回空字串。 */
export function commonName(width: number, height: number, tolerance = 0.01): string {
  if (width <= 0 || height <= 0) return ''
  const r = width / height
  for (const c of COMMON) {
    const cr = c.w / c.h
    if (Math.abs(r - cr) / cr <= tolerance) return c.name
  }
  return ''
}

/** 橫式 / 直式 / 正方形。 */
export function orientation(width: number, height: number): 'landscape' | 'portrait' | 'square' {
  if (width > height) return 'landscape'
  if (width < height) return 'portrait'
  return 'square'
}

/**
 * 維持比例,給定其中一邊求另一邊。
 * 比例由 ratioW:ratioH 決定。傳入 width 求 height,或傳入 height 求 width。
 */
export function solveDimension(
  ratioW: number,
  ratioH: number,
  opts: { width?: number; height?: number },
): { width: number; height: number } | null {
  if (ratioW <= 0 || ratioH <= 0) return null
  if (opts.width != null && isFinite(opts.width)) {
    return { width: opts.width, height: (opts.width * ratioH) / ratioW }
  }
  if (opts.height != null && isFinite(opts.height)) {
    return { width: (opts.height * ratioW) / ratioH, height: opts.height }
  }
  return null
}

export interface FitResult {
  width: number
  height: number
  scale: number
}

/**
 * 把 src 尺寸縮放到 box 內。
 * mode='contain':完整塞進框內(可能留白),取較小縮放比。
 * mode='cover' :填滿整個框(可能裁切),取較大縮放比。
 */
export function fit(
  srcW: number,
  srcH: number,
  boxW: number,
  boxH: number,
  mode: 'contain' | 'cover' = 'contain',
): FitResult | null {
  if (srcW <= 0 || srcH <= 0 || boxW <= 0 || boxH <= 0) return null
  const sw = boxW / srcW
  const sh = boxH / srcH
  const scale = mode === 'cover' ? Math.max(sw, sh) : Math.min(sw, sh)
  return { width: srcW * scale, height: srcH * scale, scale }
}

/** 百萬像素(megapixels)。 */
export function megapixels(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 0
  return (width * height) / 1_000_000
}

/** 四捨五入到指定小數位,去掉多餘的零。 */
export function round(n: number, digits = 2): number {
  const f = 10 ** digits
  return Math.round(n * f) / f
}
