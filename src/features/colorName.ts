/*
  CSS 命名顏色查詢引擎(純函式、無 DOM,可在 Node 直接測)。
  目標:輸入任何 HEX / rgb() / hsl() / 顏色英文名,找出「這個顏色叫什麼」——
  完全相符就給名稱,否則用感知距離(redmean 近似)列出最接近的 CSS 標準命名顏色。
  反向也行:輸入名稱看它的 HEX / RGB / HSL。資料為 CSS Color Module Level 4 的 148 個
  標準命名色(含 gray/grey 等同義拼法)。全程在使用者瀏覽器執行、不連網。
*/

// CSS 標準命名顏色(name → #rrggbb)
export const CSS_COLORS: Record<string, string> = {
  aliceblue: '#f0f8ff', antiquewhite: '#faebd7', aqua: '#00ffff', aquamarine: '#7fffd4',
  azure: '#f0ffff', beige: '#f5f5dc', bisque: '#ffe4c4', black: '#000000',
  blanchedalmond: '#ffebcd', blue: '#0000ff', blueviolet: '#8a2be2', brown: '#a52a2a',
  burlywood: '#deb887', cadetblue: '#5f9ea0', chartreuse: '#7fff00', chocolate: '#d2691e',
  coral: '#ff7f50', cornflowerblue: '#6495ed', cornsilk: '#fff8dc', crimson: '#dc143c',
  cyan: '#00ffff', darkblue: '#00008b', darkcyan: '#008b8b', darkgoldenrod: '#b8860b',
  darkgray: '#a9a9a9', darkgreen: '#006400', darkgrey: '#a9a9a9', darkkhaki: '#bdb76b',
  darkmagenta: '#8b008b', darkolivegreen: '#556b2f', darkorange: '#ff8c00', darkorchid: '#9932cc',
  darkred: '#8b0000', darksalmon: '#e9967a', darkseagreen: '#8fbc8f', darkslateblue: '#483d8b',
  darkslategray: '#2f4f4f', darkslategrey: '#2f4f4f', darkturquoise: '#00ced1', darkviolet: '#9400d3',
  deeppink: '#ff1493', deepskyblue: '#00bfff', dimgray: '#696969', dimgrey: '#696969',
  dodgerblue: '#1e90ff', firebrick: '#b22222', floralwhite: '#fffaf0', forestgreen: '#228b22',
  fuchsia: '#ff00ff', gainsboro: '#dcdcdc', ghostwhite: '#f8f8ff', gold: '#ffd700',
  goldenrod: '#daa520', gray: '#808080', green: '#008000', greenyellow: '#adff2f',
  grey: '#808080', honeydew: '#f0fff0', hotpink: '#ff69b4', indianred: '#cd5c5c',
  indigo: '#4b0082', ivory: '#fffff0', khaki: '#f0e68c', lavender: '#e6e6fa',
  lavenderblush: '#fff0f5', lawngreen: '#7cfc00', lemonchiffon: '#fffacd', lightblue: '#add8e6',
  lightcoral: '#f08080', lightcyan: '#e0ffff', lightgoldenrodyellow: '#fafad2', lightgray: '#d3d3d3',
  lightgreen: '#90ee90', lightgrey: '#d3d3d3', lightpink: '#ffb6c1', lightsalmon: '#ffa07a',
  lightseagreen: '#20b2aa', lightskyblue: '#87cefa', lightslategray: '#778899', lightslategrey: '#778899',
  lightsteelblue: '#b0c4de', lightyellow: '#ffffe0', lime: '#00ff00', limegreen: '#32cd32',
  linen: '#faf0e6', magenta: '#ff00ff', maroon: '#800000', mediumaquamarine: '#66cdaa',
  mediumblue: '#0000cd', mediumorchid: '#ba55d3', mediumpurple: '#9370db', mediumseagreen: '#3cb371',
  mediumslateblue: '#7b68ee', mediumspringgreen: '#00fa9a', mediumturquoise: '#48d1cc', mediumvioletred: '#c71585',
  midnightblue: '#191970', mintcream: '#f5fffa', mistyrose: '#ffe4e1', moccasin: '#ffe4b5',
  navajowhite: '#ffdead', navy: '#000080', oldlace: '#fdf5e6', olive: '#808000',
  olivedrab: '#6b8e23', orange: '#ffa500', orangered: '#ff4500', orchid: '#da70d6',
  palegoldenrod: '#eee8aa', palegreen: '#98fb98', paleturquoise: '#afeeee', palevioletred: '#db7093',
  papayawhip: '#ffefd5', peachpuff: '#ffdab9', peru: '#cd853f', pink: '#ffc0cb',
  plum: '#dda0dd', powderblue: '#b0e0e6', purple: '#800080', rebeccapurple: '#663399',
  red: '#ff0000', rosybrown: '#bc8f8f', royalblue: '#4169e1', saddlebrown: '#8b4513',
  salmon: '#fa8072', sandybrown: '#f4a460', seagreen: '#2e8b57', seashell: '#fff5ee',
  sienna: '#a0522d', silver: '#c0c0c0', skyblue: '#87ceeb', slateblue: '#6a5acd',
  slategray: '#708090', slategrey: '#708090', snow: '#fffafa', springgreen: '#00ff7f',
  steelblue: '#4682b4', tan: '#d2b48c', teal: '#008080', thistle: '#d8bfd8',
  tomato: '#ff6347', turquoise: '#40e0d0', violet: '#ee82ee', wheat: '#f5deb3',
  white: '#ffffff', whitesmoke: '#f5f5f5', yellow: '#ffff00', yellowgreen: '#9acd32',
}

export interface Rgb {
  r: number
  g: number
  b: number
  a: number // 0..1
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

function hexToRgb(hex: string): Rgb | null {
  let h = hex.replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map((c) => c + c).join('')
  else if (/^[0-9a-f]{4}$/i.test(h)) h = h.split('').map((c) => c + c).join('')
  if (/^[0-9a-f]{6}$/i.test(h)) {
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 }
  }
  if (/^[0-9a-f]{8}$/i.test(h)) {
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: Math.round((parseInt(h.slice(6, 8), 16) / 255) * 1000) / 1000,
    }
  }
  return null
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h = ((h % 360) + 360) % 360
  s = clamp(s, 0, 100) / 100
  l = clamp(l, 0, 100) / 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) }
}

function parseNumOrPct(s: string, max: number): number {
  s = s.trim()
  if (s.endsWith('%')) return Math.round((parseFloat(s) / 100) * max)
  return Math.round(parseFloat(s))
}

// 解析 HEX / rgb()/rgba() / hsl()/hsla() / 命名色
export function parseColor(input: string): Rgb | null {
  const s = input.trim().toLowerCase()
  if (!s) return null
  if (s.startsWith('#')) return hexToRgb(s)
  const named = CSS_COLORS[s]
  if (named) return hexToRgb(named)
  let m = /^rgba?\(([^)]+)\)$/.exec(s)
  if (m) {
    const parts = m[1].split(/[,/]/).map((x) => x.trim()).filter((x) => x !== '')
    if (parts.length < 3) return null
    const r = clamp(parseNumOrPct(parts[0], 255), 0, 255)
    const g = clamp(parseNumOrPct(parts[1], 255), 0, 255)
    const b = clamp(parseNumOrPct(parts[2], 255), 0, 255)
    let a = 1
    if (parts[3] !== undefined) a = clamp(parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]), 0, 1)
    if ([r, g, b].some((v) => Number.isNaN(v))) return null
    return { r, g, b, a }
  }
  m = /^hsla?\(([^)]+)\)$/.exec(s)
  if (m) {
    const parts = m[1].split(/[,/]/).map((x) => x.trim()).filter((x) => x !== '')
    if (parts.length < 3) return null
    const h = parseFloat(parts[0])
    const sat = parseFloat(parts[1])
    const lig = parseFloat(parts[2])
    if ([h, sat, lig].some((v) => Number.isNaN(v))) return null
    const { r, g, b } = hslToRgb(h, sat, lig)
    let a = 1
    if (parts[3] !== undefined) a = clamp(parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]), 0, 1)
    return { r, g, b, a }
  }
  return null
}

export function rgbToHex({ r, g, b }: Rgb): string {
  return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')
}

export function rgbToHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  let h = 0, s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0)
    else if (max === gn) h = (bn - rn) / d + 2
    else h = (rn - gn) / d + 4
    h *= 60
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) }
}

// redmean:對人眼較準的低成本 RGB 距離近似
export function colorDistance(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number {
  const rbar = (a.r + b.r) / 2
  const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b
  return Math.sqrt((2 + rbar / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rbar) / 256) * db * db)
}

export interface NamedMatch {
  name: string
  hex: string
  distance: number
}

// 找最接近的命名色(distance 0 = 完全相符)。同 hex 的同義名只保留第一個。
export function nearestNamed(rgb: { r: number; g: number; b: number }, limit = 8): NamedMatch[] {
  const seenHex = new Set<string>()
  const list: NamedMatch[] = []
  for (const [name, hex] of Object.entries(CSS_COLORS)) {
    if (seenHex.has(hex)) continue
    seenHex.add(hex)
    const c = hexToRgb(hex)!
    list.push({ name, hex, distance: Math.round(colorDistance(rgb, c) * 100) / 100 })
  }
  list.sort((x, y) => x.distance - y.distance)
  return list.slice(0, limit)
}

export interface ColorInfo {
  ok: boolean
  error?: string
  rgb?: Rgb
  hex?: string
  rgbString?: string
  hslString?: string
  exactName?: string // 完全相符的命名色(若有)
  nearest?: NamedMatch[]
}

export function describeColor(input: string): ColorInfo {
  const rgb = parseColor(input)
  if (!rgb) return { ok: false, error: '看不懂這個顏色。試試 #3498db、rgb(52,152,219)、hsl(204,70%,53%) 或 teal。' }
  const hex = rgbToHex(rgb)
  const hsl = rgbToHsl(rgb)
  const nearest = nearestNamed(rgb)
  const exact = nearest.length && nearest[0].distance === 0 ? nearest[0].name : undefined
  return {
    ok: true,
    rgb,
    hex,
    rgbString: rgb.a < 1 ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${rgb.a})` : `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
    hslString: rgb.a < 1 ? `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${rgb.a})` : `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
    exactName: exact,
    nearest,
  }
}
