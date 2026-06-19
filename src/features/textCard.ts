/*
  文字卡片排版引擎 —— 純函式、不依賴 DOM/canvas(以注入的 measure 函式量測寬度),
  故可在 Node 直接回歸測試。負責:中英混排自動斷行、超長字硬切、自動字級擇優。
  被 src/tools/text-card/Index.vue 用來把文字排進圖片卡片。
*/

// 是否為 CJK 中日韓表意文字或全形字元(這類可逐字斷行,不像英文單字要整塊)
export function isCJK(ch: string): boolean {
  const c = ch.codePointAt(0)
  if (c === undefined) return false
  return (
    (c >= 0x2e80 && c <= 0x9fff) || // 部首、康熙、CJK 統一表意 + 標點
    (c >= 0x3000 && c <= 0x303f) || // CJK 標點符號
    (c >= 0xff00 && c <= 0xffef) || // 全形 ASCII / 半形片假名
    (c >= 0x3400 && c <= 0x4dbf) || // 擴充 A
    (c >= 0x20000 && c <= 0x2ffff) // 擴充 B 以上
  )
}

// 把一段(不含換行)文字拆成斷行單位:單一 CJK 字、英數單字、或一段空白
export function tokenize(line: string): string[] {
  const chars = Array.from(line)
  const tokens: string[] = []
  let i = 0
  while (i < chars.length) {
    const ch = chars[i]
    if (ch === ' ' || ch === '\t') {
      let s = ''
      while (i < chars.length && (chars[i] === ' ' || chars[i] === '\t')) {
        s += chars[i]
        i++
      }
      tokens.push(s)
    } else if (isCJK(ch)) {
      tokens.push(ch)
      i++
    } else {
      let w = ''
      while (i < chars.length && chars[i] !== ' ' && chars[i] !== '\t' && !isCJK(chars[i])) {
        w += chars[i]
        i++
      }
      tokens.push(w)
    }
  }
  return tokens
}

type Measure = (s: string) => number

// 一個比整行還寬的字串(極長英數),逐字硬切成多段
function hardBreak(word: string, maxWidth: number, measure: Measure): string[] {
  const chars = Array.from(word)
  const out: string[] = []
  let cur = ''
  for (const ch of chars) {
    if (cur !== '' && measure(cur + ch) > maxWidth) {
      out.push(cur)
      cur = ch
    } else {
      cur += ch
    }
  }
  if (cur !== '') out.push(cur)
  return out.length ? out : ['']
}

// 將單一段落貪婪斷行成多行(行首空白會被去除)
export function wrapParagraph(text: string, maxWidth: number, measure: Measure): string[] {
  if (maxWidth <= 0) return [text]
  const tokens = tokenize(text)
  const lines: string[] = []
  let cur = ''
  const flush = () => {
    lines.push(cur.replace(/[ \t]+$/, ''))
    cur = ''
  }
  for (const tok of tokens) {
    const isSpace = tok !== '' && tok.trim() === ''
    if (cur === '' && isSpace) continue // 略過換行後新行的行首空白
    if (measure(cur + tok) <= maxWidth) {
      cur += tok
      continue
    }
    // 放不下
    if (isSpace) {
      flush()
      continue
    }
    if (cur !== '') flush()
    if (measure(tok) <= maxWidth) {
      cur = tok
    } else {
      const broken = hardBreak(tok, maxWidth, measure)
      for (let k = 0; k < broken.length - 1; k++) {
        cur = broken[k]
        flush()
      }
      cur = broken[broken.length - 1]
    }
  }
  flush()
  return lines
}

// 將整段文字(可含換行)斷行
export function wrapText(text: string, maxWidth: number, measure: Measure): string[] {
  const paras = text.replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []
  for (const p of paras) out.push(...wrapParagraph(p, maxWidth, measure))
  return out
}

export interface FitOptions {
  min: number
  max: number
  lineHeight: number // 行高倍率(相對字級)
}

// 二分搜尋:在不超出方框寬高的前提下,找出最大可用字級(整數 px)
export function fitFontSize(
  text: string,
  boxW: number,
  boxH: number,
  opts: FitOptions,
  measureAt: (fontSize: number) => Measure,
): number {
  let lo = opts.min
  let hi = opts.max
  let best = opts.min
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    const measure = measureAt(mid)
    const lines = wrapText(text, boxW, measure)
    const totalH = lines.length * mid * opts.lineHeight
    const fits = totalH <= boxH && lines.every((l) => measure(l) <= boxW)
    if (fits) {
      best = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return best
}
