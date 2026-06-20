/*
  佔位圖(placeholder)產生引擎(純函式、無 DOM,可在 Node 直接測)。
  做網頁 / 簡報 / 排版 mockup 時的灰色示意圖,線上 placeholder 服務要連網又可能追蹤;
  這支在本機產生 SVG(可下載或轉 PNG),不連網、不上傳。
*/

export interface PlaceholderOptions {
  width: number
  height: number
  bg: string // 背景色(任意 CSS 顏色字串)
  fg: string // 文字 / 線條色
  text?: string // 預設為「寬×高」
  fontSize?: number // 預設依尺寸自動
  cross?: boolean // 是否畫對角交叉線(經典示意圖樣式)
}

/** XML 文字跳脫 */
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** 依寬高自動決定字級:取較短邊的 1/8,夾在 12–160 之間 */
export function autoFontSize(width: number, height: number): number {
  const base = Math.min(width, height) / 8
  return Math.max(12, Math.min(160, Math.round(base)))
}

/** 解析 "640x480" / "640×480" / "640 480" → {width,height};失敗回 null */
export function parseSize(s: string): { width: number; height: number } | null {
  const m = s.trim().match(/^(\d+)\s*[x×*\s]\s*(\d+)$/i)
  if (!m) return null
  const width = parseInt(m[1], 10)
  const height = parseInt(m[2], 10)
  if (width <= 0 || height <= 0) return null
  return { width, height }
}

/** 解析出最終要顯示的文字(預設「寬×高」) */
export function placeholderText(opts: PlaceholderOptions): string {
  const t = opts.text?.trim()
  return t && t.length > 0 ? t : `${opts.width}×${opts.height}`
}

/** 產生 SVG 字串 */
export function buildSvg(opts: PlaceholderOptions): string {
  const { width, height, bg, fg } = opts
  const fontSize = opts.fontSize && opts.fontSize > 0 ? opts.fontSize : autoFontSize(width, height)
  const label = placeholderText(opts)
  const cross = opts.cross
    ? `<line x1="0" y1="0" x2="${width}" y2="${height}" stroke="${escapeXml(fg)}" stroke-width="1" opacity="0.35"/>` +
      `<line x1="${width}" y1="0" x2="0" y2="${height}" stroke="${escapeXml(fg)}" stroke-width="1" opacity="0.35"/>`
    : ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="${escapeXml(bg)}"/>` +
    cross +
    `<text x="50%" y="50%" fill="${escapeXml(fg)}" font-family="system-ui, sans-serif" ` +
    `font-size="${fontSize}" font-weight="600" text-anchor="middle" dominant-baseline="central">` +
    `${escapeXml(label)}</text>` +
    `</svg>`
  )
}

/** SVG → data URI(供 <img> 或下載) */
export function svgToDataUri(svg: string): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}
