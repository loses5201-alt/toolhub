/*
  隱形字元 / Unicode 檢視器引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  把一段文字逐「字元」(以 Unicode 碼位計,正確處理 emoji 與代理對)拆開,標出:
    · 看不見的字元:零寬字元、控制字元、格式字元(複製貼上常夾帶,害字串比對失敗)
    · 不一樣的空白:不斷行空格(NBSP)、全形空格等「看起來是空白、其實不是半形空格」
    · 文字方向控制字元(雙向覆寫 RLO/LRO 等,可被用來偽造檔名/訊息)
    · 形近字(confusable):長得像 ASCII 但其實是西里爾/希臘等字母 —— 釣魚網域與假冒帳號常見手法
  既能除錯(為什麼這兩個字串看起來一樣卻不相等),也能防詐(揪出冒名用的形近字)。
  全程在你的瀏覽器,不連網、不上傳。
*/

// 常見「看起來像 ASCII、其實是別套字母」的形近字 → 它在模仿哪個 ASCII 字元。
// 用於揪出釣魚網域、假冒帳號(例:用西里爾 а 取代拉丁 a)。
const CONFUSABLES: Record<string, string> = {
  // 西里爾(Cyrillic)
  а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', у: 'y', х: 'x', ѕ: 's', і: 'i', ј: 'j',
  А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', Х: 'X',
  // 希臘(Greek)
  ο: 'o', Ο: 'O', Α: 'A', Β: 'B', Ε: 'E', Ζ: 'Z', Η: 'H', Ι: 'I', Κ: 'K', Μ: 'M',
  Ν: 'N', Ρ: 'P', Τ: 'T', Υ: 'Y', Χ: 'X', ν: 'v', ρ: 'p', τ: 't',
  // 全形拉丁與數字(常見於假冒)
  ａ: 'a', ｅ: 'e', ｏ: 'o', ｐ: 'p', ｃ: 'c', '０': '0', '１': '1', '５': '5',
  // 其他常見
  Ⅼ: 'L', ӏ: 'l', '×': 'x',
}

// 文字方向控制字元(雙向 / 隔離),可被用來視覺上倒置字串以偽造副檔名等
const BIDI_CONTROLS = new Set([
  0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069,
])

// 看起來是空白、卻不是一般半形空格(0x20)的字元
const ODD_SPACES = new Set([
  0x00a0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008,
  0x2009, 0x200a, 0x202f, 0x205f, 0x3000, 0x00a0,
])

// 零寬 / 格式類看不見字元
const ZERO_WIDTH = new Set([0x200b, 0x200c, 0x200d, 0x2060, 0xfeff, 0x00ad, 0x180e])

export type CharRisk = 'normal' | 'invisible' | 'odd-space' | 'bidi' | 'confusable' | 'control'

export interface CharInfo {
  char: string // 原字元(代理對合併為一個)
  codePoint: number // Unicode 碼位
  hex: string // 例:U+200B
  name: string // 簡短描述/區塊
  risk: CharRisk
  note?: string // 風險說明(例:形近字模仿的對象)
  ascii?: string // 若為形近字,它模仿的 ASCII 字元
}

function blockName(cp: number): string {
  if (cp <= 0x7f) return 'ASCII / 基本拉丁'
  if (cp <= 0xff) return '拉丁 Latin-1'
  if (cp >= 0x100 && cp <= 0x24f) return '拉丁擴充'
  if (cp >= 0x370 && cp <= 0x3ff) return '希臘 Greek'
  if (cp >= 0x400 && cp <= 0x4ff) return '西里爾 Cyrillic'
  if (cp >= 0x3000 && cp <= 0x303f) return 'CJK 標點'
  if (cp >= 0x3040 && cp <= 0x30ff) return '日文假名'
  if (cp >= 0x4e00 && cp <= 0x9fff) return '中日韓漢字'
  if (cp >= 0xff00 && cp <= 0xffef) return '全形/半形'
  if (cp >= 0x1f000 && cp <= 0x1ffff) return 'Emoji / 符號'
  if (cp >= 0x2000 && cp <= 0x206f) return '一般標點'
  return `U+${cp.toString(16).toUpperCase()} 區`
}

function classify(cp: number, char: string): { risk: CharRisk; name: string; note?: string; ascii?: string } {
  if (ZERO_WIDTH.has(cp)) {
    return { risk: 'invisible', name: '零寬/格式字元', note: '看不見,但會讓字串比對失敗 —— 建議刪除。' }
  }
  if (BIDI_CONTROLS.has(cp)) {
    return { risk: 'bidi', name: '文字方向控制字元', note: '可改變字元顯示順序,曾被用來偽造副檔名/訊息 —— 多數情況應刪除。' }
  }
  // 一般控制字元(除了常見的 \t \n \r)
  if ((cp <= 0x1f || (cp >= 0x7f && cp <= 0x9f)) && cp !== 0x09 && cp !== 0x0a && cp !== 0x0d) {
    return { risk: 'control', name: '控制字元', note: '不可列印的控制碼,通常是雜訊。' }
  }
  if (ODD_SPACES.has(cp)) {
    return { risk: 'odd-space', name: '非半形空白', note: '看起來是空格,實際不是一般空白(0x20)—— 常造成對齊/比對問題。' }
  }
  if (CONFUSABLES[char]) {
    return {
      risk: 'confusable',
      name: '形近字(易混淆)',
      note: `這個字長得像「${CONFUSABLES[char]}」但其實不是 —— 釣魚網址、假冒帳號常用此手法。`,
      ascii: CONFUSABLES[char],
    }
  }
  return { risk: 'normal', name: blockName(cp) }
}

export interface InspectResult {
  chars: CharInfo[]
  charCount: number // 碼位數(使用者感知的字元數較接近此值)
  codeUnitCount: number // UTF-16 長度(.length)
  byteCount: number // UTF-8 位元組數
  counts: Record<CharRisk, number>
  hasIssues: boolean
}

export function inspect(text: string): InspectResult {
  const chars: CharInfo[] = []
  const counts: Record<CharRisk, number> = {
    normal: 0, invisible: 0, 'odd-space': 0, bidi: 0, confusable: 0, control: 0,
  }
  for (const char of text) {
    const cp = char.codePointAt(0)!
    const c = classify(cp, char)
    counts[c.risk]++
    chars.push({
      char,
      codePoint: cp,
      hex: 'U+' + cp.toString(16).toUpperCase().padStart(4, '0'),
      name: c.name,
      risk: c.risk,
      note: c.note,
      ascii: c.ascii,
    })
  }
  const byteCount = new TextEncoder().encode(text).length
  const hasIssues =
    counts.invisible + counts.bidi + counts.confusable + counts.control + counts['odd-space'] > 0
  return {
    chars,
    charCount: chars.length,
    codeUnitCount: text.length,
    byteCount,
    counts,
    hasIssues,
  }
}

// 一鍵清理:刪掉零寬/控制/方向字元、把非半形空白換成一般空格、把形近字還原成它模仿的 ASCII。
export interface CleanOptions {
  removeInvisible?: boolean // 零寬/格式/控制/方向
  normalizeSpaces?: boolean // 非半形空白 → 0x20
  fixConfusables?: boolean // 形近字 → ASCII
}

export function clean(text: string, opts: CleanOptions = {}): string {
  let out = ''
  for (const char of text) {
    const cp = char.codePointAt(0)!
    if (opts.removeInvisible && (ZERO_WIDTH.has(cp) || BIDI_CONTROLS.has(cp))) continue
    if (
      opts.removeInvisible &&
      (cp <= 0x1f || (cp >= 0x7f && cp <= 0x9f)) &&
      cp !== 0x09 && cp !== 0x0a && cp !== 0x0d
    ) {
      continue
    }
    if (opts.normalizeSpaces && ODD_SPACES.has(cp)) {
      out += ' '
      continue
    }
    if (opts.fixConfusables && CONFUSABLES[char]) {
      out += CONFUSABLES[char]
      continue
    }
    out += char
  }
  return out
}
