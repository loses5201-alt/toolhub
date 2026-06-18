/*
  清單加工引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  把貼上的一欄資料(每行一筆,常從 Excel/試算表複製)加工成可直接貼用的清單:
    · SQL IN 清單:'a', 'b', 'c'  →  WHERE col IN ('a','b','c')
    · 逗號清單 / JSON 字串陣列 / Markdown 清單 / 編號清單
  支援:逐行去空白、刪空白行、去重(保留首次)、每行加引號(自動逸出)、
        加前後綴、加編號、自訂連接字元、整體外框((...) [...] 等)。
  用途:工程師/小編/行政把一欄值快速變成能貼進 SQL、程式、表單的清單;
  全程在你的瀏覽器,不連網、不上傳(線上「逗號清單產生器」常滿廣告又要你貼上內部資料)。
*/

export type QuoteStyle = 'none' | 'single' | 'double' | 'backtick'

export interface LineToolsOptions {
  trimEach: boolean // 逐行去頭尾空白
  removeEmpty: boolean // 刪除空白行
  dedupe: boolean // 去重(保留首次出現)
  quote: QuoteStyle // 每行加引號(內部相同引號自動逸出)
  prefix: string // 每行前綴(在引號內?否:在引號外)
  suffix: string // 每行後綴
  numbering: boolean // 每行加編號
  numberStart: number // 編號起始值
  numberSep: string // 編號與內容之間,如 '. '
  joiner: string // 行之間的連接字串,如 '\n'、', '
  outerPrefix: string // 整體前綴,如 '('
  outerSuffix: string // 整體後綴,如 ')'
}

export const DEFAULT_OPTIONS: LineToolsOptions = {
  trimEach: true,
  removeEmpty: true,
  dedupe: false,
  quote: 'none',
  prefix: '',
  suffix: '',
  numbering: false,
  numberStart: 1,
  numberSep: '. ',
  joiner: '\n',
  outerPrefix: '',
  outerSuffix: '',
}

const QUOTE_CHAR: Record<QuoteStyle, string> = {
  none: '',
  single: "'",
  double: '"',
  backtick: '`',
}

// 依引號樣式包裹單行,並逸出內部相同引號:
//   single 用 SQL 慣例把 ' 變成 ''(兩個單引號);double/backtick 用反斜線逸出。
function applyQuote(line: string, style: QuoteStyle): string {
  if (style === 'none') return line
  const q = QUOTE_CHAR[style]
  let body = line
  if (style === 'single') body = line.replace(/'/g, "''")
  else body = line.replace(new RegExp('\\\\', 'g'), '\\\\').replace(new RegExp(q, 'g'), '\\' + q)
  return q + body + q
}

export function processLines(text: string, opts: Partial<LineToolsOptions> = {}): string {
  const o: LineToolsOptions = { ...DEFAULT_OPTIONS, ...opts }
  let lines = (text ?? '').split(/\r?\n/)

  if (o.trimEach) lines = lines.map((l) => l.trim())
  if (o.removeEmpty) lines = lines.filter((l) => l.trim() !== '')
  if (o.dedupe) {
    const seen = new Set<string>()
    lines = lines.filter((l) => (seen.has(l) ? false : (seen.add(l), true)))
  }

  if (lines.length === 0) return ''

  const parts = lines.map((line, i) => {
    let s = o.prefix + applyQuote(line, o.quote) + o.suffix
    if (o.numbering) s = `${o.numberStart + i}${o.numberSep}${s}`
    return s
  })

  return o.outerPrefix + parts.join(o.joiner) + o.outerSuffix
}

// 預設範本:一鍵帶入常見輸出格式的選項(UI 用)。
export interface Preset {
  id: string
  label: string
  hint: string
  options: Partial<LineToolsOptions>
}

export const PRESETS: Preset[] = [
  {
    id: 'sql-in',
    label: 'SQL IN 清單',
    hint: "('a', 'b', 'c')",
    options: { quote: 'single', joiner: ', ', outerPrefix: '(', outerSuffix: ')', dedupe: true },
  },
  {
    id: 'comma',
    label: '逗號清單',
    hint: 'a, b, c',
    options: { quote: 'none', joiner: ', ', outerPrefix: '', outerSuffix: '' },
  },
  {
    id: 'json-array',
    label: 'JSON 字串陣列',
    hint: '["a", "b", "c"]',
    options: { quote: 'double', joiner: ', ', outerPrefix: '[', outerSuffix: ']' },
  },
  {
    id: 'markdown',
    label: 'Markdown 清單',
    hint: '- a\\n- b',
    options: { quote: 'none', prefix: '- ', joiner: '\n', outerPrefix: '', outerSuffix: '' },
  },
  {
    id: 'numbered',
    label: '編號清單',
    hint: '1. a\\n2. b',
    options: { quote: 'none', numbering: true, numberSep: '. ', joiner: '\n' },
  },
  {
    id: 'lines',
    label: '純換行(去空白/去重)',
    hint: '一行一筆',
    options: { quote: 'none', joiner: '\n', dedupe: true },
  },
]
