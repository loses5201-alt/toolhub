// 同形字 / 混合文字偵測引擎 —— 貼上任意文字(品牌名、網址、訊息),找出「看起來像英數字、
// 實際是其他語系字元」的偽裝(如西里爾 а 冒充拉丁 a),以及單一詞彙內混用多種語系(典型釣魚手法)。
// 純函式、無 DOM,可在 Node 測試。與 domain-twist(網域)、punycode、char-inspect 互補。

// 明確的同形字對照表(常見冒充拉丁/ASCII 的字元 → 其偽裝目標)
const CONFUSABLES: Record<string, string> = {
  // 西里爾(小寫)
  а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', х: 'x', у: 'y', к: 'k', м: 'm', н: 'h',
  в: 'b', т: 't', і: 'i', ј: 'j', ѕ: 's', ԁ: 'd', ё: 'e', ԍ: 'g', һ: 'h', ӏ: 'l', ո: 'n',
  // 西里爾(大寫)
  А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T',
  Х: 'X', У: 'Y', І: 'I', Ј: 'J', Ѕ: 'S', Ё: 'E', Ԍ: 'G',
  // 希臘(小寫)
  ο: 'o', α: 'a', ν: 'v', ρ: 'p', τ: 't', ι: 'i', κ: 'k', μ: 'u', γ: 'y', χ: 'x', ε: 'e',
  // 希臘(大寫)
  Α: 'A', Β: 'B', Ε: 'E', Ζ: 'Z', Η: 'H', Ι: 'I', Κ: 'K', Μ: 'M', Ν: 'N', Ο: 'O',
  Ρ: 'P', Τ: 'T', Υ: 'Y', Χ: 'X', Ϲ: 'C',
  // 亞美尼亞 / 其他常見
  օ: 'o', ս: 'u', ա: 'w', ց: 'g',
  // 全形數字常見替代(也由程式化範圍處理,此處保險)
}

// Unicode 區段 → 語系名稱
export function scriptOf(cp: number): string {
  if (cp >= 0xff01 && cp <= 0xffee) return 'Fullwidth' // 全形
  if ((cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a) ||
      (cp >= 0xc0 && cp <= 0x24f) || (cp >= 0x1e00 && cp <= 0x1eff)) return 'Latin'
  if (cp >= 0x30 && cp <= 0x39) return 'Common' // 數字
  if (cp >= 0x0400 && cp <= 0x052f) return 'Cyrillic'
  if ((cp >= 0x0370 && cp <= 0x03ff) || (cp >= 0x1f00 && cp <= 0x1fff)) return 'Greek'
  if (cp >= 0x0531 && cp <= 0x058f) return 'Armenian'
  if (cp >= 0x0590 && cp <= 0x05ff) return 'Hebrew'
  if (cp >= 0x0600 && cp <= 0x06ff) return 'Arabic'
  if (cp >= 0x0e00 && cp <= 0x0e7f) return 'Thai'
  if (cp >= 0x3040 && cp <= 0x309f) return 'Hiragana'
  if (cp >= 0x30a0 && cp <= 0x30ff) return 'Katakana'
  if ((cp >= 0xac00 && cp <= 0xd7af) || (cp >= 0x1100 && cp <= 0x11ff) ||
      (cp >= 0x3130 && cp <= 0x318f)) return 'Hangul'
  if ((cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0x3400 && cp <= 0x4dbf) ||
      (cp >= 0xf900 && cp <= 0xfaff)) return 'Han'
  // 標點、空白、符號等視為共通
  if (cp < 0x80) return 'Common'
  if (cp >= 0x2000 && cp <= 0x206f) return 'Common'
  if (cp >= 0x3000 && cp <= 0x303f) return 'Common' // CJK 標點
  return 'Other'
}

// 取得某字元的偽裝目標(ASCII/拉丁),若非同形字則回 null
export function confusableTarget(ch: string): string | null {
  if (Object.prototype.hasOwnProperty.call(CONFUSABLES, ch)) return CONFUSABLES[ch]
  const cp = ch.codePointAt(0) ?? 0
  // 全形 ASCII(！..～ → !..~)
  if (cp >= 0xff01 && cp <= 0xff5e) return String.fromCharCode(cp - 0xfee0)
  return null
}

export interface CharInfo {
  ch: string
  cp: number
  hex: string // 'U+04XX'
  script: string
  target: string | null // 偽裝目標,null 表示非同形字
  suspicious: boolean // 為非拉丁/全形的同形字
}

export interface Token {
  text: string
  scripts: string[] // 此詞含的語系(排除 Common)
  mixed: boolean // 含 >1 種非共通語系
  hasConfusable: boolean
}

export interface Analysis {
  chars: CharInfo[]
  tokens: Token[]
  skeleton: string // 把同形字還原成偽裝目標後的文字(它「想假裝成」的樣子)
  scripts: string[] // 全文出現的非共通語系
  confusableCount: number
  mixedTokenCount: number
  suspicious: boolean
}

function hexOf(cp: number): string {
  return 'U+' + cp.toString(16).toUpperCase().padStart(4, '0')
}

export function analyzeText(text: string): Analysis {
  const chars: CharInfo[] = []
  const allScripts = new Set<string>()
  let confusableCount = 0

  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0
    const script = scriptOf(cp)
    const target = confusableTarget(ch)
    const suspicious = target !== null && script !== 'Latin' && script !== 'Common'
    if (suspicious) confusableCount++
    if (script !== 'Common') allScripts.add(script)
    chars.push({ ch, cp, hex: hexOf(cp), script, target, suspicious })
  }

  // 以空白切詞(其餘標點併入詞中,讓 paypаl.com 視為一詞)
  const tokens: Token[] = []
  let mixedTokenCount = 0
  for (const raw of text.split(/(\s+)/)) {
    if (!raw || /^\s+$/.test(raw)) continue
    const sset = new Set<string>()
    let hasConf = false
    for (const ch of raw) {
      const cp = ch.codePointAt(0) ?? 0
      const s = scriptOf(cp)
      if (s !== 'Common') sset.add(s)
      if (confusableTarget(ch) !== null && s !== 'Latin' && s !== 'Common') hasConf = true
    }
    const mixed = sset.size > 1
    if (mixed) mixedTokenCount++
    tokens.push({ text: raw, scripts: [...sset], mixed, hasConfusable: hasConf })
  }

  const skeleton = [...text].map((ch) => confusableTarget(ch) ?? ch).join('')

  return {
    chars,
    tokens,
    skeleton,
    scripts: [...allScripts],
    confusableCount,
    mixedTokenCount,
    suspicious: confusableCount > 0 || mixedTokenCount > 0,
  }
}
