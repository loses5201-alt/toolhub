/*
  顏色可讀性(對比)檢測引擎 —— 純函式、與 DOM 無關,故可在 Node 跑回歸測試。
  依 WCAG 2.1 的相對亮度與對比公式,算出兩色的對比比值,並判斷文字是否
  在背景上「看得清楚」(AA / AAA、一般字 / 大字)。做簡報、海報、網頁、
  長輩友善文件選色時很有用 —— 人腦很難一眼看出某組配色夠不夠清楚。
*/

export interface RGB {
  r: number
  g: number
  b: number
}

// 解析 #RGB / #RRGGBB / rgb(r,g,b) / 純十六進位;失敗回 null。
export function parseColor(input: string): RGB | null {
  const s = input.trim().toLowerCase()
  const rgbMatch = s.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/)
  if (rgbMatch) {
    const r = Number(rgbMatch[1])
    const g = Number(rgbMatch[2])
    const b = Number(rgbMatch[3])
    if (r > 255 || g > 255 || b > 255) return null
    return { r, g, b }
  }
  let hex = s.startsWith('#') ? s.slice(1) : s
  if (/^[0-9a-f]{3}$/.test(hex)) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('')
  }
  if (/^[0-9a-f]{6}$/.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    }
  }
  return null
}

// 正規化成 #RRGGBB(大寫),供 UI 顯示與 color input 用。
export function toHex({ r, g, b }: RGB): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return ('#' + h(r) + h(g) + h(b)).toUpperCase()
}

// WCAG 相對亮度。
export function relativeLuminance({ r, g, b }: RGB): number {
  const lin = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

// 兩色對比比值,範圍 1(相同)~ 21(黑白)。順序無關。
export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const light = Math.max(la, lb)
  const dark = Math.min(la, lb)
  return (light + 0.05) / (dark + 0.05)
}

export interface Grade {
  ratio: number // 四捨五入到小數兩位
  normalAA: boolean // 一般字(< 18pt)AA:>= 4.5
  normalAAA: boolean // 一般字 AAA:>= 7
  largeAA: boolean // 大字(>= 18pt 或 14pt 粗體)AA:>= 3
  largeAAA: boolean // 大字 AAA:>= 4.5
  uiAA: boolean // 圖示 / 介面元件邊界 AA:>= 3
}

// 依對比比值給出各情境的合格與否。
export function grade(a: RGB, b: RGB): Grade {
  const raw = contrastRatio(a, b)
  return {
    ratio: Math.round(raw * 100) / 100,
    normalAA: raw >= 4.5,
    normalAAA: raw >= 7,
    largeAA: raw >= 3,
    largeAAA: raw >= 4.5,
    uiAA: raw >= 3,
  }
}
