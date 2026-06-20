/*
  色溫(Color Temperature)引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  把以「克氏溫度(K)」描述的光源色,換算成螢幕可顯示的 sRGB 顏色,反之亦然。
   - kelvinToRgb:採 Tanner Helland 廣為流傳的近似式(適用約 1000–40000K)。
   - kelvinToMired / miredToKelvin:K ↔ 倒數色溫(mired,攝影濾鏡刻度)。
   - rgbToKelvin:在色溫曲線上找最接近的色溫(反查,近似)。
   - LIGHT_SOURCES:常見光源色溫對照(燭光、鎢絲燈、日光、陰天…)。
  低色溫偏紅黃(暖)、高色溫偏藍(冷),與一般「暖色/冷色」直覺相反,這是攝影白平衡的依據。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

export interface Rgb {
  r: number // 0–255
  g: number
  b: number
}

export const MIN_KELVIN = 1000
export const MAX_KELVIN = 40000

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v)
}

/** 克氏色溫(K)→ sRGB(0–255)。採 Tanner Helland 近似式。 */
export function kelvinToRgb(kelvin: number): Rgb {
  const k = Math.min(MAX_KELVIN, Math.max(MIN_KELVIN, kelvin))
  const t = k / 100

  let r: number
  if (t <= 66) r = 255
  else r = 329.698727446 * Math.pow(t - 60, -0.1332047592)

  let g: number
  if (t <= 66) g = 99.4708025861 * Math.log(t) - 161.1195681661
  else g = 288.1221695283 * Math.pow(t - 60, -0.0755148492)

  let b: number
  if (t >= 66) b = 255
  else if (t <= 19) b = 0
  else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307

  return { r: clamp255(r), g: clamp255(g), b: clamp255(b) }
}

/** 色溫(K)→ mired(倒數色溫 ×10⁶,攝影濾鏡刻度)。 */
export function kelvinToMired(kelvin: number): number {
  return 1e6 / kelvin
}

/** mired → 色溫(K)。 */
export function miredToKelvin(mired: number): number {
  return 1e6 / mired
}

/** sRGB → 最接近的色溫(K),在色溫曲線上以正規化色比距離搜尋(反查、近似)。 */
export function rgbToKelvin(rgb: Rgb, step = 50): number {
  // 以「去亮度後的色比」比較,避免亮度差影響判斷
  const norm = (c: Rgb): [number, number, number] => {
    const m = Math.max(c.r, c.g, c.b, 1)
    return [c.r / m, c.g / m, c.b / m]
  }
  const target = norm(rgb)
  let bestK = MIN_KELVIN
  let bestD = Infinity
  for (let k = MIN_KELVIN; k <= MAX_KELVIN; k += step) {
    const cand = norm(kelvinToRgb(k))
    const d =
      (cand[0] - target[0]) ** 2 + (cand[1] - target[1]) ** 2 + (cand[2] - target[2]) ** 2
    if (d < bestD) {
      bestD = d
      bestK = k
    }
  }
  return bestK
}

/** sRGB → #RRGGBB(大寫)。 */
export function rgbToHex({ r, g, b }: Rgb): string {
  return (
    '#' +
    [r, g, b]
      .map((n) => clamp255(n).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  )
}

export interface LightSource {
  kelvin: number
  name: string
}

/** 常見光源色溫對照(由暖到冷)。 */
export const LIGHT_SOURCES: LightSource[] = [
  { kelvin: 1700, name: '火柴火焰' },
  { kelvin: 1850, name: '燭光 / 日出日落' },
  { kelvin: 2400, name: '鎢絲燈泡(調暗)' },
  { kelvin: 2700, name: '暖白光 LED / 白熾燈' },
  { kelvin: 3000, name: '暖白 / 鹵素燈' },
  { kelvin: 3500, name: '自然白螢光燈' },
  { kelvin: 4000, name: '冷白 / 月光' },
  { kelvin: 5000, name: '正午陽光 / 印刷標準光源' },
  { kelvin: 5500, name: '日光 / 閃光燈' },
  { kelvin: 6500, name: 'D65 標準日光 / 晴天正午' },
  { kelvin: 7000, name: '陰天' },
  { kelvin: 8000, name: '陰影下 / 薄霧' },
  { kelvin: 10000, name: '藍天 / 深陰影' },
]

export interface TempInfo {
  kelvin: number
  rgb: Rgb
  hex: string
  mired: number
  /** 白話色調描述 */
  tone: string
}

/** 把一個色溫整理成展示用資訊。 */
export function describeKelvin(kelvin: number): TempInfo {
  const rgb = kelvinToRgb(kelvin)
  let tone: string
  if (kelvin < 2500) tone = '濃郁橙紅,非常暖'
  else if (kelvin < 3500) tone = '溫暖黃光(居家氛圍)'
  else if (kelvin < 5000) tone = '中性偏暖白'
  else if (kelvin < 6000) tone = '接近白色的日光'
  else if (kelvin < 7500) tone = '中性偏冷白'
  else tone = '偏藍冷光'
  return { kelvin, rgb, hex: rgbToHex(rgb), mired: kelvinToMired(kelvin), tone }
}
