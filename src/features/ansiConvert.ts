/*
  ANSI 終端機色碼轉換引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  把含 ANSI 跳脫序列(ECMA-48 SGR,例如 CI log、彩色 console 輸出、git/npm 訊息)
  的文字:
    1) stripAnsi:整段拿掉所有跳脫碼,還原成乾淨純文字(也清掉游標移動、清行等 CSI/OSC)。
    2) ansiToSpans:解析 SGR(顏色/粗體/底線…),切成帶樣式的片段陣列(給 Vue 渲染、給測試)。
    3) ansiToHtml:把片段組成內嵌樣式的 <span> HTML,可貼進部落格/文件/Email 保留顏色。
  支援 16 色 / 256 色(38;5;n、48;5;n)/ 24-bit 真彩(38;2;r;g;b)。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

// 標準 xterm 16 色調色盤(0–7 一般、8–15 高亮)
export const ANSI_16: string[] = [
  '#000000', '#cd0000', '#00cd00', '#cdcd00', '#0000ee', '#cd00cd', '#00cdcd', '#e5e5e5',
  '#7f7f7f', '#ff0000', '#00ff00', '#ffff00', '#5c5cff', '#ff00ff', '#00ffff', '#ffffff',
]

const CUBE_LEVELS = [0, 95, 135, 175, 215, 255]

function hex2(n: number): string {
  return n.toString(16).padStart(2, '0')
}

/** 256 色索引 → #RRGGBB。0–15 用標準盤、16–231 為 6×6×6 色立方、232–255 為灰階。 */
export function color256(n: number): string {
  const i = Math.max(0, Math.min(255, Math.floor(n)))
  if (i < 16) return ANSI_16[i]
  if (i < 232) {
    const c = i - 16
    const r = CUBE_LEVELS[Math.floor(c / 36) % 6]
    const g = CUBE_LEVELS[Math.floor(c / 6) % 6]
    const b = CUBE_LEVELS[c % 6]
    return `#${hex2(r)}${hex2(g)}${hex2(b)}`
  }
  const v = 8 + (i - 232) * 10
  return `#${hex2(v)}${hex2(v)}${hex2(v)}`
}

export interface AnsiStyle {
  fg?: string // #RRGGBB
  bg?: string
  bold?: boolean
  dim?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  inverse?: boolean
}

export interface AnsiSpan {
  text: string
  style: AnsiStyle
}

function emptyStyle(): AnsiStyle {
  return {}
}

function hasStyle(s: AnsiStyle): boolean {
  return !!(s.fg || s.bg || s.bold || s.dim || s.italic || s.underline || s.strike || s.inverse)
}

// ESC / BEL 控制字元(以 fromCharCode 取得,source 保持純 ASCII)
const ESC = String.fromCharCode(27)
const BEL = String.fromCharCode(7)

// 所有 ANSI/VT 跳脫:CSI(ESC [ … 最後字母)、OSC(ESC ] … BEL/ST)、單字元 Fe 跳脫。
// 一律以 ESC 起頭,才不會誤刪正文裡的 [ ] 字元。
const STRIP_RE = new RegExp(
  ESC + '(?:\\[[0-?]*[ -/]*[@-~]|\\][^' + BEL + ']*(?:' + BEL + '|' + ESC + '\\\\)|[@-Z\\\\-_])',
  'g',
)

/** 移除所有 ANSI/VT 跳脫序列,回乾淨純文字。 */
export function stripAnsi(text: string): string {
  return text.replace(STRIP_RE, '')
}

// 先抓 SGR(ESC [ 參數 m,擷取參數),其餘 CSI/OSC/Fe 一併吃掉但不輸出。
const TOKEN_RE = new RegExp(
  ESC +
    '(?:\\[([0-?]*)m|\\[[0-?]*[ -/]*[@-~]|\\][^' +
    BEL +
    ']*(?:' +
    BEL +
    '|' +
    ESC +
    '\\\\)|[@-Z\\\\-_])',
  'g',
)

/** 依一串 SGR 參數碼更新樣式。回傳更新後的樣式(reset 會回新空樣式)。 */
function applySgr(style: AnsiStyle, params: number[]): AnsiStyle {
  if (params.length === 0) return emptyStyle() // 空參數 = reset
  let i = 0
  while (i < params.length) {
    const p = params[i]
    if (p === 0) style = emptyStyle()
    else if (p === 1) style.bold = true
    else if (p === 2) style.dim = true
    else if (p === 3) style.italic = true
    else if (p === 4) style.underline = true
    else if (p === 7) style.inverse = true
    else if (p === 9) style.strike = true
    else if (p === 22) {
      style.bold = false
      style.dim = false
    } else if (p === 23) style.italic = false
    else if (p === 24) style.underline = false
    else if (p === 27) style.inverse = false
    else if (p === 29) style.strike = false
    else if (p >= 30 && p <= 37) style.fg = ANSI_16[p - 30]
    else if (p >= 90 && p <= 97) style.fg = ANSI_16[p - 90 + 8]
    else if (p === 39) style.fg = undefined
    else if (p >= 40 && p <= 47) style.bg = ANSI_16[p - 40]
    else if (p >= 100 && p <= 107) style.bg = ANSI_16[p - 100 + 8]
    else if (p === 49) style.bg = undefined
    else if (p === 38 || p === 48) {
      const target = p === 38 ? 'fg' : 'bg'
      const mode = params[i + 1]
      if (mode === 5) {
        style[target] = color256(params[i + 2] ?? 0)
        i += 2
      } else if (mode === 2) {
        const r = params[i + 2] ?? 0
        const g = params[i + 3] ?? 0
        const b = params[i + 4] ?? 0
        style[target] = `#${hex2(r & 255)}${hex2(g & 255)}${hex2(b & 255)}`
        i += 4
      }
    }
    // 其餘 SGR(閃爍/字型等)忽略
    i++
  }
  return style
}

function sameStyle(a: AnsiStyle, b: AnsiStyle): boolean {
  return (
    a.fg === b.fg &&
    a.bg === b.bg &&
    !!a.bold === !!b.bold &&
    !!a.dim === !!b.dim &&
    !!a.italic === !!b.italic &&
    !!a.underline === !!b.underline &&
    !!a.strike === !!b.strike &&
    !!a.inverse === !!b.inverse
  )
}

/** 把含 ANSI 的文字解析成帶樣式片段。連續同樣式會合併。 */
export function ansiToSpans(text: string): AnsiSpan[] {
  const spans: AnsiSpan[] = []
  let style = emptyStyle()
  let last = 0
  TOKEN_RE.lastIndex = 0
  let m: RegExpExecArray | null

  const push = (chunk: string) => {
    if (!chunk) return
    const prev = spans[spans.length - 1]
    const cur = { ...style }
    if (prev && sameStyle(prev.style, cur)) prev.text += chunk
    else spans.push({ text: chunk, style: cur })
  }

  while ((m = TOKEN_RE.exec(text))) {
    if (m.index > last) push(text.slice(last, m.index))
    last = TOKEN_RE.lastIndex
    if (m[1] !== undefined) {
      // SGR:m[1] 是 ; 分隔的參數,空字串視為 reset
      const params = m[1] === '' ? [] : m[1].split(';').map((x) => parseInt(x, 10) || 0)
      style = applySgr(style, params)
    }
    // 其他 CSI/OSC/Fe:已吃掉,不輸出文字
  }
  if (last < text.length) push(text.slice(last))
  return spans
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface HtmlOptions {
  defaultFg?: string // inverse 時當預設前景
  defaultBg?: string
}

/** 把單一片段的樣式轉成 CSS 宣告字串。 */
export function styleToCss(style: AnsiStyle, opts: HtmlOptions = {}): string {
  const css: string[] = []
  let fg = style.fg
  let bg = style.bg
  if (style.inverse) {
    fg = style.bg ?? opts.defaultBg ?? '#000000'
    bg = style.fg ?? opts.defaultFg ?? '#ffffff'
  }
  if (fg) css.push(`color:${fg}`)
  if (bg) css.push(`background-color:${bg}`)
  if (style.bold) css.push('font-weight:bold')
  if (style.dim) css.push('opacity:0.7')
  if (style.italic) css.push('font-style:italic')
  const deco: string[] = []
  if (style.underline) deco.push('underline')
  if (style.strike) deco.push('line-through')
  if (deco.length) css.push(`text-decoration:${deco.join(' ')}`)
  return css.join(';')
}

/** 把含 ANSI 的文字轉成內嵌樣式的 HTML(不含外層容器)。 */
export function ansiToHtml(text: string, opts: HtmlOptions = {}): string {
  return ansiToSpans(text)
    .map((sp) => {
      const safe = escapeHtml(sp.text)
      if (!hasStyle(sp.style)) return safe
      const css = styleToCss(sp.style, opts)
      return css ? `<span style="${css}">${safe}</span>` : safe
    })
    .join('')
}
