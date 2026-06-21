/*
  Unicode 花式字 / 字體產生器 —— 純函式、無 DOM,可在 Node 直接測試。
  把一般英數字轉成各種 Unicode「字體」變體(數學粗體/斜體/花體/哥德體/雙線體、
  圈圈字、全形、刪除線/底線、上下顛倒……),用於 IG / Threads / Discord 個人簡介、
  暱稱、貼文標題 —— 這些都是真正的 Unicode 字元,不是圖片,可直接貼上。
  原理:對 A–Z / a–z / 0–9 依各變體在 Unicode 的固定碼位偏移對應,並處理
  「數學字母符號」區塊中少數被挪到 Letterlike Symbols 的保留字母。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

export interface AlphaStyle {
  id: string
  name: string
  upper?: number // 'A' 對應碼位
  lower?: number // 'a' 對應碼位
  digit?: number // '0' 對應碼位
  // 以原字元為鍵的例外碼位(保留字母 / 不連續的數字)
  exceptions?: Record<string, number>
}

// 數學字母符號區塊中,部分字母被挪到 Letterlike Symbols 的保留碼位
const SCRIPT_EXC: Record<string, number> = {
  B: 0x212c, E: 0x2130, F: 0x2131, H: 0x210b, I: 0x2110, L: 0x2112,
  M: 0x2133, R: 0x211b, e: 0x212f, g: 0x210a, o: 0x2134,
}
const FRAKTUR_EXC: Record<string, number> = {
  C: 0x212d, H: 0x210c, I: 0x2111, R: 0x211c, Z: 0x2128,
}
const DBL_EXC: Record<string, number> = {
  C: 0x2102, H: 0x210d, N: 0x2115, P: 0x2119, Q: 0x211a, R: 0x211d, Z: 0x2124,
}
const ITALIC_EXC: Record<string, number> = { h: 0x210e }

// 圈圈字:0 與 1–9 碼位不連續,整組以例外處理
const CIRCLED_DIGITS: Record<string, number> = {
  '0': 0x24ea, '1': 0x2460, '2': 0x2461, '3': 0x2462, '4': 0x2463,
  '5': 0x2464, '6': 0x2465, '7': 0x2466, '8': 0x2467, '9': 0x2468,
}

export const ALPHA_STYLES: AlphaStyle[] = [
  { id: 'bold', name: '數學粗體', upper: 0x1d400, lower: 0x1d41a, digit: 0x1d7ce },
  { id: 'italic', name: '數學斜體', upper: 0x1d434, lower: 0x1d44e, exceptions: ITALIC_EXC },
  { id: 'bold-italic', name: '粗斜體', upper: 0x1d468, lower: 0x1d482 },
  { id: 'script', name: '花體 / 草寫', upper: 0x1d49c, lower: 0x1d4b6, exceptions: SCRIPT_EXC },
  { id: 'bold-script', name: '粗花體', upper: 0x1d4d0, lower: 0x1d4ea },
  { id: 'fraktur', name: '哥德體 / 古典', upper: 0x1d504, lower: 0x1d51e, exceptions: FRAKTUR_EXC },
  { id: 'bold-fraktur', name: '粗哥德體', upper: 0x1d56c, lower: 0x1d586 },
  { id: 'double-struck', name: '雙線體(黑板體)', upper: 0x1d538, lower: 0x1d552, digit: 0x1d7d8, exceptions: DBL_EXC },
  { id: 'sans', name: '無襯線', upper: 0x1d5a0, lower: 0x1d5ba, digit: 0x1d7e2 },
  { id: 'sans-bold', name: '無襯線粗體', upper: 0x1d5d4, lower: 0x1d5ee, digit: 0x1d7ec },
  { id: 'sans-italic', name: '無襯線斜體', upper: 0x1d608, lower: 0x1d622 },
  { id: 'sans-bold-italic', name: '無襯線粗斜', upper: 0x1d63c, lower: 0x1d656 },
  { id: 'monospace', name: '等寬', upper: 0x1d670, lower: 0x1d68a, digit: 0x1d7f6 },
  { id: 'circled', name: '圈圈字', upper: 0x24b6, lower: 0x24d0, exceptions: CIRCLED_DIGITS },
  { id: 'fullwidth', name: '全形', upper: 0xff21, lower: 0xff41, digit: 0xff10 },
]

/** 依字母樣式轉換文字(非英數字維持原樣)。 */
export function styleText(text: string, style: AlphaStyle): string {
  let out = ''
  for (const ch of text) {
    if (style.exceptions && Object.prototype.hasOwnProperty.call(style.exceptions, ch)) {
      out += String.fromCodePoint(style.exceptions[ch])
      continue
    }
    const cp = ch.codePointAt(0) ?? 0
    if (ch >= 'A' && ch <= 'Z' && style.upper !== undefined) {
      out += String.fromCodePoint(style.upper + (cp - 65))
    } else if (ch >= 'a' && ch <= 'z' && style.lower !== undefined) {
      out += String.fromCodePoint(style.lower + (cp - 97))
    } else if (ch >= '0' && ch <= '9' && style.digit !== undefined) {
      out += String.fromCodePoint(style.digit + (cp - 48))
    } else {
      out += ch
    }
  }
  return out
}

// ── 組合附加符號(刪除線 / 底線 / 斜線)─────────────────────────
const COMBINING: Record<string, string> = {
  strike: '̶', // 長刪除線
  underline: '̲', // 底線
  slash: '̸', // 斜線
}

/** 在每個非空白字元後加上組合符號,做出刪除線 / 底線等效果。 */
export function combineText(text: string, kind: keyof typeof COMBINING): string {
  const mark = COMBINING[kind]
  let out = ''
  for (const ch of text) {
    out += ch
    if (ch !== ' ' && ch !== '\n') out += mark
  }
  return out
}

/** 字母間插入空白,做出「寬鬆」效果。 */
export function spaceOut(text: string, gap = ' '): string {
  return [...text].join(gap)
}

// ── 上下顛倒 ───────────────────────────────────────────────
const FLIP_MAP: Record<string, string> = {
  a: 'ɐ', b: 'q', c: 'ɔ', d: 'p', e: 'ǝ', f: 'ɟ', g: 'ƃ', h: 'ɥ', i: 'ᴉ', j: 'ɾ',
  k: 'ʞ', l: 'l', m: 'ɯ', n: 'u', o: 'o', p: 'd', q: 'b', r: 'ɹ', s: 's', t: 'ʇ',
  u: 'n', v: 'ʌ', w: 'ʍ', x: 'x', y: 'ʎ', z: 'z',
  A: '∀', B: 'ᗺ', C: 'Ɔ', D: '◖', E: 'Ǝ', F: 'Ⅎ', G: '⅁', H: 'H', I: 'I', J: 'ſ',
  K: 'ʞ', L: '˥', M: 'W', N: 'N', O: 'O', P: 'Ԁ', Q: 'Ò', R: 'ᴚ', S: 'S', T: '⊥',
  U: '∩', V: 'Λ', W: 'M', X: 'X', Y: '⅄', Z: 'Z',
  '0': '0', '1': 'Ɩ', '2': 'ᄅ', '3': 'Ɛ', '4': 'ㄣ', '5': 'ϛ', '6': '9', '7': 'ㄥ', '8': '8', '9': '6',
  '.': '˙', ',': "'", "'": ',', '"': '„', '`': ',', '?': '¿', '!': '¡',
  '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<',
  '&': '⅋', '_': '‾',
}

/** 把文字上下顛倒(字元替換後整串反轉)。 */
export function flipText(text: string): string {
  const flipped = [...text].map((ch) => FLIP_MAP[ch] ?? ch)
  return flipped.reverse().join('')
}

export interface FancyVariant {
  id: string
  name: string
  text: string
}

/** 一次產生所有變體,給 UI 列出。 */
export function allVariants(text: string): FancyVariant[] {
  const out: FancyVariant[] = ALPHA_STYLES.map((s) => ({
    id: s.id,
    name: s.name,
    text: styleText(text, s),
  }))
  out.push({ id: 'strike', name: '刪除線', text: combineText(text, 'strike') })
  out.push({ id: 'underline', name: '底線', text: combineText(text, 'underline') })
  out.push({ id: 'spaced', name: '寬鬆間距', text: spaceOut(text) })
  out.push({ id: 'flip', name: '上下顛倒', text: flipText(text) })
  return out
}
