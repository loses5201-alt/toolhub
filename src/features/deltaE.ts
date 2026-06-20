/*
  色差(Delta E)引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  把兩個顏色換到感知均勻的 CIE L*a*b* 空間,算出「人眼覺得差多少」。
  提供三種公式:
   - ΔE*ab(CIE76):最早、最單純的 Lab 歐氏距離。
   - ΔE*94(CIE94,graphics 圖形業參數):加入彩度/色相權重,比 76 貼近人眼。
   - ΔE00(CIEDE2000):目前業界標準,最貼近人眼,但公式最複雜、最難正確實作。
  sRGB → 線性 → XYZ(D65)→ Lab。全程在你的瀏覽器,不連網、不上傳。
  參考:CIE 15:2004、Sharma, Wu, Dalal (2005) "The CIEDE2000 Color-Difference Formula"。
*/

export interface Rgb {
  r: number // 0–255
  g: number
  b: number
}

export interface Lab {
  L: number // 0–100
  a: number
  b: number
}

const DEG = Math.PI / 180
const POW25_7 = Math.pow(25, 7)

// sRGB 通道(0–255)→ 線性光(0–1),含 sRGB 轉換曲線
function srgbToLinear(c: number): number {
  const cs = c / 255
  return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4)
}

// Lab 的 f() 函式(含線性段,避免接近 0 時不穩)
function fLab(t: number): number {
  const d = 6 / 29
  return t > d * d * d ? Math.cbrt(t) : t / (3 * d * d) + 4 / 29
}

/** sRGB(0–255)→ CIE L*a*b*(D65 標準光源、2° 觀察者)。 */
export function rgbToLab({ r, g, b }: Rgb): Lab {
  const rl = srgbToLinear(r)
  const gl = srgbToLinear(g)
  const bl = srgbToLinear(b)
  // sRGB(線性)→ XYZ,D65;白點即 (0.95047, 1, 1.08883)
  const X = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375
  const Y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175
  const Z = rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041
  const fx = fLab(X / 0.95047)
  const fy = fLab(Y / 1.0)
  const fz = fLab(Z / 1.08883)
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) }
}

/** ΔE*ab(CIE76):Lab 空間直線距離。 */
export function deltaE76(lab1: Lab, lab2: Lab): number {
  return Math.sqrt(
    (lab1.L - lab2.L) ** 2 + (lab1.a - lab2.a) ** 2 + (lab1.b - lab2.b) ** 2,
  )
}

/**
 * ΔE*94(CIE94,graphic arts 參數 kL=kC=kH=1, K1=0.045, K2=0.015)。
 * 注意:CIE94 不對稱,以 lab1 為「參考色」計算 SC/SH。
 */
export function deltaE94(lab1: Lab, lab2: Lab): number {
  const C1 = Math.hypot(lab1.a, lab1.b)
  const C2 = Math.hypot(lab2.a, lab2.b)
  const dL = lab1.L - lab2.L
  const dC = C1 - C2
  const da = lab1.a - lab2.a
  const db = lab1.b - lab2.b
  const dH2 = da * da + db * db - dC * dC // 可能因浮點為微負
  const dH = Math.sqrt(Math.max(0, dH2))
  const SL = 1
  const SC = 1 + 0.045 * C1
  const SH = 1 + 0.015 * C1
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2)
}

// 由 (b, a') 求色相角(度),範圍 [0, 360);a'=b=0 時定義為 0
function hueAngle(b: number, ap: number): number {
  if (b === 0 && ap === 0) return 0
  let h = Math.atan2(b, ap) / DEG
  if (h < 0) h += 360
  return h
}

/**
 * ΔE00(CIEDE2000),kL=kC=kH=1。
 * 依 Sharma, Wu, Dalal (2005) 的標準式,含 G 補償、色相旋轉 RT。
 */
export function deltaE2000(lab1: Lab, lab2: Lab, kL = 1, kC = 1, kH = 1): number {
  const { L: L1, a: a1, b: b1 } = lab1
  const { L: L2, a: a2, b: b2 } = lab2

  const C1 = Math.hypot(a1, b1)
  const C2 = Math.hypot(a2, b2)
  const Cbar = (C1 + C2) / 2
  const Cbar7 = Math.pow(Cbar, 7)
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + POW25_7)))

  const a1p = (1 + G) * a1
  const a2p = (1 + G) * a2
  const C1p = Math.hypot(a1p, b1)
  const C2p = Math.hypot(a2p, b2)
  const h1p = hueAngle(b1, a1p)
  const h2p = hueAngle(b2, a2p)

  const dLp = L2 - L1
  const dCp = C2p - C1p

  let dhp = 0
  if (C1p * C2p !== 0) {
    let diff = h2p - h1p
    if (diff > 180) diff -= 360
    else if (diff < -180) diff += 360
    dhp = diff
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * DEG) / 2)

  const Lbarp = (L1 + L2) / 2
  const Cbarp = (C1p + C2p) / 2

  let hbarp: number
  if (C1p * C2p === 0) {
    hbarp = h1p + h2p
  } else if (Math.abs(h1p - h2p) <= 180) {
    hbarp = (h1p + h2p) / 2
  } else {
    hbarp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2
  }

  const T =
    1 -
    0.17 * Math.cos((hbarp - 30) * DEG) +
    0.24 * Math.cos(2 * hbarp * DEG) +
    0.32 * Math.cos((3 * hbarp + 6) * DEG) -
    0.2 * Math.cos((4 * hbarp - 63) * DEG)

  const dTheta = 30 * Math.exp(-(((hbarp - 275) / 25) ** 2))
  const Cbarp7 = Math.pow(Cbarp, 7)
  const RC = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + POW25_7))
  const SL = 1 + (0.015 * (Lbarp - 50) ** 2) / Math.sqrt(20 + (Lbarp - 50) ** 2)
  const SC = 1 + 0.045 * Cbarp
  const SH = 1 + 0.015 * Cbarp * T
  const RT = -Math.sin(2 * dTheta * DEG) * RC

  const lTerm = dLp / (kL * SL)
  const cTerm = dCp / (kC * SC)
  const hTerm = dHp / (kH * SH)
  return Math.sqrt(lTerm * lTerm + cTerm * cTerm + hTerm * hTerm + RT * cTerm * hTerm)
}

export interface DeltaResult {
  lab1: Lab
  lab2: Lab
  de76: number
  de94: number
  de2000: number
}

/** 一次算出兩色的 Lab 與三種 ΔE。 */
export function compareColors(rgb1: Rgb, rgb2: Rgb): DeltaResult {
  const lab1 = rgbToLab(rgb1)
  const lab2 = rgbToLab(rgb2)
  return {
    lab1,
    lab2,
    de76: deltaE76(lab1, lab2),
    de94: deltaE94(lab1, lab2),
    de2000: deltaE2000(lab1, lab2),
  }
}

/** 把 ΔE00 數值翻成白話的可辨識程度。 */
export function interpretDeltaE(de: number): { label: string; note: string } {
  if (de < 1) return { label: '幾乎無法分辨', note: '一般人肉眼看不出差異(< 1.0,低於可察覺門檻)' }
  if (de < 2) return { label: '極相近', note: '要仔細對照才看得出來(1–2)' }
  if (de <= 3.5) return { label: '可察覺差異', note: '留意的話看得出不一樣(2–3.5)' }
  if (de <= 5) return { label: '明顯差異', note: '一眼就看得出不同(3.5–5)' }
  return { label: '兩個不同的顏色', note: '差距很大,屬於不同色(> 5)' }
}
