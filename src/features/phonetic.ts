/*
  拼讀 / 電話報號引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  把英數字串拆成「一個字一個字怎麼念」,方便在電話裡報帳號、確認碼、訂單號給對方聽,
  避免 B/D、M/N、1/7 聽錯。支援:
   - 國際 NATO 拼讀字母(A=Alpha、B=Bravo…)
   - 台灣電話報號數字口語(0=洞、1=么、7=拐、9=勾…軍用 / 客服常用念法)
  並可反向把「Alpha Bravo」這類拼讀還原回字串。全程在你的瀏覽器處理,不連網、不上傳。
*/

export const NATO: Record<string, string> = {
  A: 'Alpha', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot',
  G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliett', K: 'Kilo', L: 'Lima',
  M: 'Mike', N: 'November', O: 'Oscar', P: 'Papa', Q: 'Quebec', R: 'Romeo',
  S: 'Sierra', T: 'Tango', U: 'Uniform', V: 'Victor', W: 'Whiskey',
  X: 'X-ray', Y: 'Yankee', Z: 'Zulu',
}

export const DIGIT_EN: Record<string, string> = {
  '0': 'Zero', '1': 'One', '2': 'Two', '3': 'Three', '4': 'Four',
  '5': 'Five', '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine',
}

// 台灣 / 華語電話報號常用口語(軍中、客服、報門牌帳號)
export const DIGIT_TW: Record<string, string> = {
  '0': '洞', '1': '么', '2': '兩', '3': '三', '4': '四',
  '5': '五', '6': '六', '7': '拐', '8': '八', '9': '勾',
}

const PUNCT: Record<string, string> = {
  '-': '槓', '_': '底線', '.': '點', '@': '小老鼠', '/': '斜線', '\\': '反斜線',
  '#': '井字號', '*': '星號', '+': '加號', ':': '冒號', ',': '逗號', '(': '左括號',
  ')': '右括號', '=': '等號', '&': 'and', ' ': '(空格)',
}

export type SpellStyle = 'nato' | 'tw'

export interface SpellSegment {
  char: string
  label: string
  kind: 'letter' | 'digit' | 'punct' | 'other'
  note?: string // 例:大寫 / 小寫
}

/** 把字串逐字轉成拼讀片段。 */
export function spell(text: string, style: SpellStyle = 'nato'): SpellSegment[] {
  const segs: SpellSegment[] = []
  for (const ch of text || '') {
    if (/[A-Za-z]/.test(ch)) {
      const upper = ch.toUpperCase()
      segs.push({
        char: ch,
        label: NATO[upper] || ch,
        kind: 'letter',
        note: ch === upper ? '大寫' : '小寫',
      })
    } else if (/[0-9]/.test(ch)) {
      segs.push({ char: ch, label: (style === 'tw' ? DIGIT_TW : DIGIT_EN)[ch], kind: 'digit' })
    } else if (PUNCT[ch]) {
      segs.push({ char: ch, label: PUNCT[ch], kind: 'punct' })
    } else {
      segs.push({ char: ch, label: ch, kind: 'other' })
    }
  }
  return segs
}

/** 拼讀片段組成一行可朗讀文字。 */
export function spellLine(text: string, style: SpellStyle = 'nato'): string {
  return spell(text, style)
    .map((s) => s.label)
    .join(style === 'tw' ? ' ' : ' ')
    .trim()
}

// 反向查表(小寫 word → 結果)
const NATO_REV: Record<string, string> = {}
for (const [k, v] of Object.entries(NATO)) NATO_REV[v.toLowerCase().replace(/-/g, '')] = k
const DIGIT_REV: Record<string, string> = {}
for (const [k, v] of Object.entries(DIGIT_EN)) DIGIT_REV[v.toLowerCase()] = k
for (const [k, v] of Object.entries(DIGIT_TW)) DIGIT_REV[v] = k

/** 反向:把「Alpha Bravo 7」這類拼讀還原回字串;無法辨識的詞用 ? 標示。 */
export function unspell(spoken: string): string {
  const tokens = (spoken || '').trim().split(/[\s,]+/).filter(Boolean)
  let out = ''
  for (const t of tokens) {
    const key = t.toLowerCase().replace(/-/g, '')
    if (NATO_REV[key]) out += NATO_REV[key]
    else if (DIGIT_REV[t] !== undefined) out += DIGIT_REV[t] // 中文數字直接比對原字
    else if (DIGIT_REV[key] !== undefined) out += DIGIT_REV[key]
    else if (/^[0-9]$/.test(t)) out += t
    else if (t.length === 1 && /[A-Za-z]/.test(t)) out += t.toUpperCase()
    else out += '?'
  }
  return out
}
