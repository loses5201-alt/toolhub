/*
  OKLCH / OKLab 色彩轉換引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  OKLab(Björn Ottosson, 2020)是感知均勻、明度與色相不互相干擾的現代色彩空間;
  OKLCH 是它的極座標版(明度 L、彩度 C、色相 H),即 CSS Color 4 的 oklch()。
  比 HSL 更符合人眼:同 L 的不同色相亮度一致、調 C 不會偏色,做漸層/色階特別自然。
  sRGB(gamma)↔ 線性 sRGB ↔ OKLab ↔ OKLCH。矩陣常數取自 Ottosson 公布值。
  全程在你的瀏覽器,不連網、不上傳。
*/

export interface Rgb {
  r: number // 0–255
  g: number
  b: number
}

export interface OkLab {
  L: number // 0–1
  a: number
  b: number
}

export interface OkLch {
  L: number // 0–1
  C: number // 彩度,≥0
  H: number // 色相角 0–360(C≈0 時無意義)
}

const DEG = 180 / Math.PI

function srgbToLinear(c: number): number {
  const cs = c / 255
  return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4)
}

function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
  return v * 255
}

/** sRGB(0–255)→ OKLab。 */
export function rgbToOklab({ r, g, b }: Rgb): OkLab {
  const rl = srgbToLinear(r)
  const gl = srgbToLinear(g)
  const bl = srgbToLinear(b)

  const l = 0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl
  const m = 0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl
  const s = 0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl

  const l_ = Math.cbrt(l)
  const m_ = Math.cbrt(m)
  const s_ = Math.cbrt(s)

  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  }
}

/** OKLab → sRGB(0–255,未夾鉗)。回傳的 r/g/b 可能超出 0–255(代表超出 sRGB 色域)。 */
export function oklabToRgbRaw({ L, a, b }: OkLab): Rgb {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b

  const l = l_ * l_ * l_
  const m = m_ * m_ * m_
  const s = s_ * s_ * s_

  const rl = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const gl = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s

  return { r: linearToSrgb(rl), g: linearToSrgb(gl), b: linearToSrgb(bl) }
}

export function oklabToOklch({ L, a, b }: OkLab): OkLch {
  const C = Math.hypot(a, b)
  let H = Math.atan2(b, a) * DEG
  if (H < 0) H += 360
  return { L, C, H }
}

export function oklchToOklab({ L, C, H }: OkLch): OkLab {
  const rad = H / DEG
  return { L, a: C * Math.cos(rad), b: C * Math.sin(rad) }
}

export function rgbToOklch(rgb: Rgb): OkLch {
  return oklabToOklch(rgbToOklab(rgb))
}

export interface ToRgbResult {
  rgb: Rgb // 已夾鉗到 0–255 的可顯示值
  inGamut: boolean // 夾鉗前是否落在 sRGB 色域內
}

/** OKLCH → sRGB,並回報是否超出 sRGB 色域(超出時夾鉗到最近的可顯示色)。 */
export function oklchToRgb(lch: OkLch): ToRgbResult {
  const raw = oklabToRgbRaw(oklchToOklab(lch))
  const eps = 0.5 // 容許半個量化階,避免邊界誤判
  const inGamut =
    raw.r >= -eps && raw.r <= 255 + eps && raw.g >= -eps && raw.g <= 255 + eps && raw.b >= -eps && raw.b <= 255 + eps
  const clamp = (n: number) => Math.min(255, Math.max(0, Math.round(n)))
  return { rgb: { r: clamp(raw.r), g: clamp(raw.g), b: clamp(raw.b) }, inGamut }
}

export function rgbToHex({ r, g, b }: Rgb): string {
  return '#' + [r, g, b].map((n) => Math.round(n).toString(16).padStart(2, '0')).join('').toUpperCase()
}

/** 組成 CSS oklch() 字串,例:oklch(62.8% 0.258 29.2)。 */
export function formatOklch({ L, C, H }: OkLch, alpha = 1): string {
  const l = (L * 100).toFixed(1) + '%'
  const c = C.toFixed(3)
  const h = (C < 1e-4 ? 0 : H).toFixed(1)
  return alpha >= 1 ? `oklch(${l} ${c} ${h})` : `oklch(${l} ${c} ${h} / ${alpha})`
}
