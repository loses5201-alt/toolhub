/*
  摩斯密碼(Morse code)轉換引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  採 ITU-R M.1677-1 國際摩斯電碼標準:A–Z、0–9、常用標點與少數重音字母。
  編碼:字母內以空白分隔點劃,字母間以單一空白,單字間以「/」分隔(常見慣例)。
  解碼:容錯多重空白,「/」或多個空白皆視為單字邊界。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

// ITU 國際摩斯電碼對照表(鍵為大寫)
export const MORSE_MAP: Record<string, string> = {
  A: '.-',
  B: '-...',
  C: '-.-.',
  D: '-..',
  E: '.',
  F: '..-.',
  G: '--.',
  H: '....',
  I: '..',
  J: '.---',
  K: '-.-',
  L: '.-..',
  M: '--',
  N: '-.',
  O: '---',
  P: '.--.',
  Q: '--.-',
  R: '.-.',
  S: '...',
  T: '-',
  U: '..-',
  V: '...-',
  W: '.--',
  X: '-..-',
  Y: '-.--',
  Z: '--..',
  '0': '-----',
  '1': '.----',
  '2': '..---',
  '3': '...--',
  '4': '....-',
  '5': '.....',
  '6': '-....',
  '7': '--...',
  '8': '---..',
  '9': '----.',
  '.': '.-.-.-',
  ',': '--..--',
  '?': '..--..',
  "'": '.----.',
  '!': '-.-.--',
  '/': '-..-.',
  '(': '-.--.',
  ')': '-.--.-',
  '&': '.-...',
  ':': '---...',
  ';': '-.-.-.',
  '=': '-...-',
  '+': '.-.-.',
  '-': '-....-',
  _: '..--.-',
  '"': '.-..-.',
  $: '...-..-',
  '@': '.--.-.',
  // 重音字母(ITU 附錄常見)
  À: '.--.-',
  Ä: '.-.-',
  È: '.-..-',
  É: '..-..',
  Ñ: '--.--',
  Ö: '---.',
  Ü: '..--',
}

// 反查表(摩斯 → 字元)。重複碼僅取第一個,確保解碼穩定。
const REVERSE: Record<string, string> = {}
for (const [ch, code] of Object.entries(MORSE_MAP)) {
  if (!(code in REVERSE)) REVERSE[code] = ch
}

export interface EncodeResult {
  morse: string
  unsupported: string[] // 無法編碼的字元(去重)
}

/**
 * 文字 → 摩斯。字母間以單一空白、單字間以「/」分隔。
 * 無法對應的字元(非空白)會被略過並回報。
 */
export function encodeMorse(text: string): EncodeResult {
  const unsupported = new Set<string>()
  const words = (text || '').trim().toUpperCase().split(/\s+/).filter(Boolean)
  const encodedWords = words.map((word) => {
    const codes: string[] = []
    for (const ch of word) {
      const code = MORSE_MAP[ch]
      if (code) codes.push(code)
      else unsupported.add(ch)
    }
    return codes.join(' ')
  })
  return {
    morse: encodedWords.filter((w) => w.length > 0).join(' / '),
    unsupported: [...unsupported],
  }
}

export interface DecodeResult {
  text: string
  unsupported: string[] // 無法解碼的摩斯符號(去重)
}

/**
 * 摩斯 → 文字。容錯:「/」或 3+ 個空白視為單字邊界,點劃以「.」「-」(或全形・−)表示。
 * 無法對應的碼會以「�」佔位並回報。
 */
export function decodeMorse(morse: string): DecodeResult {
  const unsupported = new Set<string>()
  // 正規化常見變體符號
  const normalized = (morse || '')
    .replace(/[·•・]/g, '.')
    .replace(/[—–−]/g, '-')
    .trim()
  if (!normalized) return { text: '', unsupported: [] }
  // 以「/」或連續空白(2+)切單字;單一空白切字母
  const words = normalized.split(/\s*\/\s*|\s{2,}/)
  const decodedWords = words.map((word) => {
    const letters = word.trim().split(/\s+/).filter(Boolean)
    return letters
      .map((code) => {
        const ch = REVERSE[code]
        if (ch) return ch
        unsupported.add(code)
        return '�'
      })
      .join('')
  })
  return {
    text: decodedWords.filter(Boolean).join(' '),
    unsupported: [...unsupported],
  }
}

/** 判斷字串看起來像摩斯碼(只含點劃、空白、斜線)還是一般文字。 */
export function looksLikeMorse(s: string): boolean {
  const t = (s || '').trim()
  if (!t) return false
  return /^[.\-/\s·•・—–−]+$/.test(t)
}

export interface Tone {
  on: boolean // true=發聲(嗶),false=靜音(間隔)
  units: number // 時間單位數(1 單位 = 一點)
}

/**
 * 把摩斯字串展開成播放時序(以「時間單位」為基準):
 *   點=1、劃=3、同字母內點劃間隔=1、字母間=3、單字間=7。
 */
export function morseToTones(morse: string): Tone[] {
  const tones: Tone[] = []
  const words = (morse || '').trim().split(/\s*\/\s*|\s{2,}/).filter(Boolean)
  words.forEach((word, wi) => {
    if (wi > 0) tones.push({ on: false, units: 7 })
    const letters = word.trim().split(/\s+/).filter(Boolean)
    letters.forEach((code, li) => {
      if (li > 0) tones.push({ on: false, units: 3 })
      const symbols = [...code].filter((c) => c === '.' || c === '-')
      symbols.forEach((sym, si) => {
        if (si > 0) tones.push({ on: false, units: 1 })
        tones.push({ on: true, units: sym === '-' ? 3 : 1 })
      })
    })
  })
  return tones
}
