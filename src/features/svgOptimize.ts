/*
  SVG 最佳化 / 壓縮引擎 —— 純函式、無 DOM,可在 Node 測試。
  專做「不會改變畫面的安全瘦身」:移除編輯器(Inkscape / Illustrator)匯出時夾帶的
  註解、metadata、編輯器專屬命名空間與屬性、XML 宣告 / DOCTYPE、排版用的縮排空白,
  並可選擇把幾何屬性裡的小數四捨五入到指定位數。
  刻意「不」做有風險的轉換(例如合併路徑、刪除被認為多餘的屬性),確保輸出與原圖視覺一致。
*/

export interface SvgOptimizeOptions {
  removeComments?: boolean // 移除 <!-- 註解 -->
  removeMetadata?: boolean // 移除 <metadata> 與編輯器命名空間 / 屬性
  removeXmlDecl?: boolean // 移除 <?xml ...?> 宣告、其他 PI 與 <!DOCTYPE>
  removeTitleDesc?: boolean // 移除 <title> / <desc>(預設保留,顧及無障礙)
  collapseWhitespace?: boolean // 移除標籤之間排版用的縮排換行
  roundNumbers?: boolean // 幾何屬性小數四捨五入
  precision?: number // 小數位數(roundNumbers 開啟時)
}

const DEFAULTS: Required<SvgOptimizeOptions> = {
  removeComments: true,
  removeMetadata: true,
  removeXmlDecl: true,
  removeTitleDesc: false,
  collapseWhitespace: true,
  roundNumbers: false,
  precision: 2,
}

// 編輯器專屬命名空間前綴(這些元素 / 屬性純屬編輯軟體狀態,刪了不影響畫面)
const EDITOR_PREFIXES = ['inkscape', 'sodipodi', 'dc', 'cc', 'rdf']

// 會出現幾何 / 樣式數值、適合四捨五入的屬性
const NUMERIC_ATTRS = new Set([
  'd', 'points', 'transform', 'gradientTransform', 'viewBox',
  'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'fx', 'fy',
  'width', 'height', 'offset', 'opacity', 'fill-opacity', 'stroke-opacity',
  'stroke-width', 'stroke-dashoffset', 'stroke-dasharray', 'stop-opacity',
  'font-size', 'letter-spacing', 'word-spacing', 'dx', 'dy',
])

/** 計算字串的 UTF-8 位元組長度(用於顯示壓縮前後大小)。 */
export function byteLength(s: string): number {
  return new TextEncoder().encode(s).length
}

export function removeComments(s: string): string {
  return s.replace(/<!--[\s\S]*?-->/g, '')
}

/** 移除 XML 宣告、其他處理指令(<? ... ?>)與 DOCTYPE。 */
export function removeProlog(s: string): string {
  return s
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[^>[]*(\[[^\]]*\])?[^>]*>/gi, '')
}

/** 移除 <metadata>、編輯器專屬元素 / 屬性 / 命名空間宣告。 */
export function removeEditorCruft(s: string): string {
  let out = s
    // <metadata>...</metadata> 與自閉合
    .replace(/<metadata\b[\s\S]*?<\/metadata>/gi, '')
    .replace(/<metadata\b[^>]*\/>/gi, '')
  for (const p of EDITOR_PREFIXES) {
    // 成對:<sodipodi:namedview ...>...</sodipodi:namedview>
    out = out.replace(new RegExp(`<${p}:([\\w-]+)\\b[\\s\\S]*?</${p}:\\1>`, 'gi'), '')
    // 自閉合:<sodipodi:namedview ... />
    out = out.replace(new RegExp(`<${p}:[\\w-]+\\b[^>]*/>`, 'gi'), '')
  }
  // 編輯器屬性 inkscape:foo="..." / sodipodi:bar='...'
  const prefixGroup = EDITOR_PREFIXES.join('|')
  out = out.replace(new RegExp(`\\s+(?:${prefixGroup}):[\\w-]+\\s*=\\s*"[^"]*"`, 'gi'), '')
  out = out.replace(new RegExp(`\\s+(?:${prefixGroup}):[\\w-]+\\s*=\\s*'[^']*'`, 'gi'), '')
  // 編輯器命名空間宣告 xmlns:inkscape="..."
  out = out.replace(new RegExp(`\\s+xmlns:(?:${prefixGroup})\\s*=\\s*"[^"]*"`, 'gi'), '')
  out = out.replace(new RegExp(`\\s+xmlns:(?:${prefixGroup})\\s*=\\s*'[^']*'`, 'gi'), '')
  return out
}

export function removeTitleDesc(s: string): string {
  return s
    .replace(/<title\b[\s\S]*?<\/title>/gi, '')
    .replace(/<desc\b[\s\S]*?<\/desc>/gi, '')
}

/** 移除標籤之間「含換行」的排版縮排空白(不動標籤內或文字節點裡有意義的空白)。 */
export function collapseWhitespace(s: string): string {
  return s.replace(/>\s*[\r\n]\s*</g, '><').trim()
}

/** 把單一數字四捨五入到 precision 位並去除多餘的零。 */
function roundNumber(num: string, precision: number): string {
  const n = Number(num)
  if (!Number.isFinite(n)) return num
  const r = Number(n.toFixed(precision))
  return Object.is(r, -0) ? '0' : String(r)
}

/** 只在「數值型屬性」的值裡四捨五入小數(指數記號保持原樣以策安全)。 */
export function roundNumbers(s: string, precision = 2): string {
  return s.replace(/([:\w-]+)\s*=\s*"([^"]*)"/g, (full, name: string, value: string) => {
    if (!NUMERIC_ATTRS.has(name)) return full
    const rounded = value.replace(/-?\d*\.\d+(?![eE])/g, (m) => roundNumber(m, precision))
    return `${name}="${rounded}"`
  })
}

export interface SvgOptimizeResult {
  output: string
  originalBytes: number
  optimizedBytes: number
  savedBytes: number
  savedPercent: number // 0–100,四捨五入到小數 1 位
}

/** 主流程:依選項套用各項安全瘦身,回傳結果與壓縮統計。 */
export function optimizeSvg(input: string, options: SvgOptimizeOptions = {}): SvgOptimizeResult {
  const opts = { ...DEFAULTS, ...options }
  let out = input
  if (opts.removeComments) out = removeComments(out)
  if (opts.removeXmlDecl) out = removeProlog(out)
  if (opts.removeMetadata) out = removeEditorCruft(out)
  if (opts.removeTitleDesc) out = removeTitleDesc(out)
  if (opts.roundNumbers) out = roundNumbers(out, opts.precision)
  if (opts.collapseWhitespace) out = collapseWhitespace(out)
  else out = out.trim()

  const originalBytes = byteLength(input)
  const optimizedBytes = byteLength(out)
  const savedBytes = originalBytes - optimizedBytes
  const savedPercent = originalBytes > 0 ? Math.round((savedBytes / originalBytes) * 1000) / 10 : 0
  return { output: out, originalBytes, optimizedBytes, savedBytes, savedPercent }
}
