/*
  色彩混合引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  兩件事:
   1) 混色:把兩個顏色依比例在 sRGB 線性內插(等同 CSS color-mix(in srgb, ...))。
   2) 疊色:把帶透明度的前景色疊在背景色上,算出最終看到的實色(alpha compositing)。
  解析 #RGB / #RGBA / #RRGGBB / #RRGGBBAA 與 rgb()/rgba()。
  全程在你的瀏覽器,不連網、不上傳。
*/

export interface RGBA {
  r: number // 0–255
  g: number
  b: number
  a: number // 0–1
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const round = (n: number) => Math.round(n)

/** 解析顏色字串成 RGBA;失敗回 null。 */
export function parseColor(input: string): RGBA | null {
  const s = (input || '').trim().toLowerCase()
  if (!s) return null

  // hex
  const hex = /^#?([0-9a-f]{3,8})$/.exec(s)
  if (hex) {
    const h = hex[1]
    if (h.length === 3 || h.length === 4) {
      const r = parseInt(h[0] + h[0], 16)
      const g = parseInt(h[1] + h[1], 16)
      const b = parseInt(h[2] + h[2], 16)
      const a = h.length === 4 ? parseInt(h[3] + h[3], 16) / 255 : 1
      return { r, g, b, a }
    }
    if (h.length === 6 || h.length === 8) {
      const r = parseInt(h.slice(0, 2), 16)
      const g = parseInt(h.slice(2, 4), 16)
      const b = parseInt(h.slice(4, 6), 16)
      const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
      return { r, g, b, a }
    }
    return null
  }

  // rgb() / rgba()
  const rgb = /^rgba?\(([^)]+)\)$/.exec(s)
  if (rgb) {
    const parts = rgb[1].split(/[,/]/).map((p) => p.trim()).filter(Boolean)
    if (parts.length < 3 || parts.length > 4) return null
    const ch = (p: string) => {
      if (p.endsWith('%')) return clamp((parseFloat(p) / 100) * 255, 0, 255)
      return clamp(parseFloat(p), 0, 255)
    }
    const r = ch(parts[0])
    const g = ch(parts[1])
    const b = ch(parts[2])
    if ([r, g, b].some((n) => Number.isNaN(n))) return null
    let a = 1
    if (parts.length === 4) {
      const p = parts[3]
      a = p.endsWith('%') ? parseFloat(p) / 100 : parseFloat(p)
      if (Number.isNaN(a)) return null
      a = clamp(a, 0, 1)
    }
    return { r: round(r), g: round(g), b: round(b), a }
  }

  return null
}

const hex2 = (n: number) => clamp(round(n), 0, 255).toString(16).padStart(2, '0')

/** RGBA → hex 字串。alpha < 1 時輸出 8 位(#RRGGBBAA)。 */
export function toHex(c: RGBA): string {
  const base = '#' + hex2(c.r) + hex2(c.g) + hex2(c.b)
  if (c.a >= 1) return base
  return base + hex2(c.a * 255)
}

/** RGBA → CSS rgb()/rgba() 字串。 */
export function toRgbString(c: RGBA): string {
  const r = clamp(round(c.r), 0, 255)
  const g = clamp(round(c.g), 0, 255)
  const b = clamp(round(c.b), 0, 255)
  if (c.a >= 1) return `rgb(${r}, ${g}, ${b})`
  return `rgba(${r}, ${g}, ${b}, ${Math.round(c.a * 1000) / 1000})`
}

/**
 * 混色:在 sRGB 空間線性內插。ratio 為第二個顏色 c2 的比例(0 = 全 c1,1 = 全 c2)。
 * 連同 alpha 一起內插。
 */
export function mix(c1: RGBA, c2: RGBA, ratio: number): RGBA {
  const t = clamp(Number.isFinite(ratio) ? ratio : 0.5, 0, 1)
  return {
    r: round(c1.r * (1 - t) + c2.r * t),
    g: round(c1.g * (1 - t) + c2.g * t),
    b: round(c1.b * (1 - t) + c2.b * t),
    a: c1.a * (1 - t) + c2.a * t,
  }
}

/**
 * 疊色:把前景 fg(可帶透明度)疊在背景 bg 上(Porter-Duff source-over)。
 * 回傳最終看到的顏色。若背景不透明則結果不透明。
 */
export function alphaComposite(fg: RGBA, bg: RGBA): RGBA {
  const outA = fg.a + bg.a * (1 - fg.a)
  if (outA === 0) return { r: 0, g: 0, b: 0, a: 0 }
  const ch = (f: number, b: number) => (f * fg.a + b * bg.a * (1 - fg.a)) / outA
  return {
    r: round(ch(fg.r, bg.r)),
    g: round(ch(fg.g, bg.g)),
    b: round(ch(fg.b, bg.b)),
    a: outA,
  }
}

/** 取多段等距混色(色階),steps 為總段數(含頭尾)。 */
export function gradientSteps(c1: RGBA, c2: RGBA, steps: number): RGBA[] {
  const n = Math.max(2, Math.floor(steps))
  const out: RGBA[] = []
  for (let i = 0; i < n; i++) out.push(mix(c1, c2, i / (n - 1)))
  return out
}
