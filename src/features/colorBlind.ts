/*
  色盲 / 色弱模擬引擎 —— 把一張圖「換成色覺障礙者看到的樣子」。

  這裡只放與環境無關的純像素運算(色彩矩陣轉換),操作在 RGBA 陣列上、不碰 DOM,
  方便用 Node 跑回歸測試;讀檔、畫 Canvas、輸出 PNG 那段留在 .vue 元件。

  用途:做簡報、圖表、網頁、地圖配色時,檢查「紅綠用色」對色盲使用者是否還分得出來
  (台灣約每 12 位男性就有 1 位紅綠色覺異常)。全程在瀏覽器處理,圖片不上傳。

  方法:採用 Machado, Oliveira & Fielding (2009) 提出、廣為網頁/設計工具採用的
  sRGB 色彩矩陣(重度 severity=1.0),直接作用在 gamma 編碼的 sRGB 值上(實務常見近似)。
  achromatopsia(全色盲)以 Rec. 601 luma 轉灰階。severity 0–100 以「原色↔全模擬」線性混合。
*/

export type CvdType = 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia'

export interface Pixels {
  data: Uint8ClampedArray | Uint8Array
  width: number
  height: number
}

// Machado et al. 2009,severity = 1.0,row-major 3×3,作用於 [R,G,B]
const MATRICES: Record<Exclude<CvdType, 'achromatopsia'>, number[]> = {
  // 紅色盲(L 視錐缺失)
  protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  // 綠色盲(M 視錐缺失,最常見)
  deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  // 藍色盲(S 視錐缺失,罕見)
  tritanopia: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
}

export const CVD_LABELS: Record<CvdType, string> = {
  deuteranopia: '綠色盲(Deuteranopia,最常見)',
  protanopia: '紅色盲(Protanopia)',
  tritanopia: '藍色盲(Tritanopia,罕見)',
  achromatopsia: '全色盲(灰階,極罕見)',
}

/** 夾到 0–255 整數。 */
export function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v)
}

/** Rec. 601 luma,回 0–255(未取整,供內部使用)。 */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

/**
 * 模擬單一顏色在某類色覺障礙下看到的樣子。
 * severity 0–100:0 = 原色,100 = 完整模擬;中間為兩者線性混合(模擬輕度色弱)。
 */
export function simulateColor(
  r: number,
  g: number,
  b: number,
  type: CvdType,
  severity = 100,
): [number, number, number] {
  const s = Math.max(0, Math.min(100, severity)) / 100
  let sr: number
  let sg: number
  let sb: number
  if (type === 'achromatopsia') {
    const y = luma(r, g, b)
    sr = sg = sb = y
  } else {
    const m = MATRICES[type]
    sr = m[0] * r + m[1] * g + m[2] * b
    sg = m[3] * r + m[4] * g + m[5] * b
    sb = m[6] * r + m[7] * g + m[8] * b
  }
  return [clamp255(r + (sr - r) * s), clamp255(g + (sg - g) * s), clamp255(b + (sb - b) * s)]
}

/**
 * 把整張 RGBA 影像轉成模擬後的像素(不更動輸入,回新陣列)。alpha 原樣保留。
 */
export function simulatePixels(px: Pixels, type: CvdType, severity = 100): Uint8ClampedArray {
  const { data, width, height } = px
  const n = width * height
  const out = new Uint8ClampedArray(n * 4)
  for (let i = 0; i < n * 4; i += 4) {
    const [r, g, b] = simulateColor(data[i], data[i + 1], data[i + 2], type, severity)
    out[i] = r
    out[i + 1] = g
    out[i + 2] = b
    out[i + 3] = data[i + 3]
  }
  return out
}

/** 兩色在 sRGB 空間的歐氏距離(粗略「能不能分辨」指標,0 = 完全相同)。 */
export function colorDistance(
  a: [number, number, number],
  b: [number, number, number],
): number {
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return Math.sqrt(dr * dr + dg * dg + db * db)
}
