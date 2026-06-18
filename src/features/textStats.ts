/*
  文字統計引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  針對「中文(CJK)」正確計數:很多線上字數統計把「你好世界」算成 0 字或 1 字,
  因為它們用空白切詞(英文邏輯)。這裡分項算清楚:
    · 中文字數(漢字,逐字計)
    · 英文單字數(以字母組成、可含 ' 與 - 的詞)
    · 數字串、標點符號
    · 字元(含/不含空白)、行數、非空行、段落、句數(估算)、UTF-8 位元組
    · 預估閱讀/朗讀時間
  用途:作文/自傳/書審資料/報告/社群貼文的字數限制檢查;敏感草稿不上傳。
  全程在你的瀏覽器,不連網、不上傳。
*/

export interface TextStats {
  chars: number // 字元數(含空白,以 Unicode 碼位計)
  charsNoSpaces: number // 字元數(不含任何空白)
  cjkChars: number // 中文字數(漢字)
  latinWords: number // 英文單字數
  numbers: number // 數字串個數(如 3.14、1,000 各算 1)
  punctuation: number // 標點符號數
  totalWords: number // 總字數 = 中文字數 + 英文單字數(作文/書審常見計法)
  lines: number // 行數
  nonEmptyLines: number // 非空行數
  paragraphs: number // 段落數(以空白行分隔)
  sentences: number // 句數(以句末標點估算)
  bytes: number // UTF-8 位元組數
  readingSeconds: number // 預估默讀秒數
  speakingSeconds: number // 預估朗讀(唸出聲)秒數
}

// 漢字(中文字):Unicode Script=Han,涵蓋常用字與擴展區。
const HAN_RE = /\p{Script=Han}/u
// 英文單字:以字母開頭,中間可夾 ' 或 - 連接更多字母/數字的一段。
const LATIN_WORD_RE = /[A-Za-z][A-Za-z0-9]*(?:[’'\-][A-Za-z0-9]+)*/g
// 數字串:連續數字,可含小數點或千分位逗號。
const NUMBER_RE = /\d+(?:[.,]\d+)*/g
// 句末標點(估算句數):中文。!?…、英文 . ! ?(小數點不算,用 lookaround 排除數字間的點)。
const SENTENCE_RE = /[。！？!?…]+|(?<![0-9])\.+(?![0-9])/gu

const enc = new TextEncoder()

export function analyzeText(input: string): TextStats {
  const text = input ?? ''
  const cps = Array.from(text) // 以碼位拆,正確處理 emoji / 代理對

  let chars = 0
  let charsNoSpaces = 0
  let cjkChars = 0
  let punctuation = 0
  for (const ch of cps) {
    chars++
    if (!/\s/u.test(ch)) charsNoSpaces++
    if (HAN_RE.test(ch)) cjkChars++
    else if (/\p{P}/u.test(ch)) punctuation++
  }

  const latinWords = (text.match(LATIN_WORD_RE) || []).length
  const numbers = (text.match(NUMBER_RE) || []).length
  const sentences = (text.match(SENTENCE_RE) || []).length

  const lines = text === '' ? 0 : text.split('\n').length
  const nonEmptyLines =
    text === '' ? 0 : text.split('\n').filter((l) => l.trim() !== '').length
  const paragraphs =
    text.trim() === ''
      ? 0
      : text
          .split(/\n[ \t　]*\n/)
          .filter((p) => p.trim() !== '').length

  const totalWords = cjkChars + latinWords
  const bytes = enc.encode(text).length

  // 閱讀速度估算:默讀 中文 ~5 字/秒(300字/分)、英文 ~3.3 詞/秒(200詞/分)
  const readingSeconds = Math.round(cjkChars / 5 + latinWords / 3.33)
  // 朗讀較慢:中文 ~4 字/秒(240字/分)、英文 ~2.5 詞/秒(150詞/分)
  const speakingSeconds = Math.round(cjkChars / 4 + latinWords / 2.5)

  return {
    chars,
    charsNoSpaces,
    cjkChars,
    latinWords,
    numbers,
    punctuation,
    totalWords,
    lines,
    nonEmptyLines,
    paragraphs,
    sentences,
    bytes,
    readingSeconds,
    speakingSeconds,
  }
}

// 把秒數轉成「X 分 Y 秒 / Y 秒」可讀字串(UI 用,純函式)。
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  if (s < 60) return `${s} 秒`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem === 0 ? `${m} 分` : `${m} 分 ${rem} 秒`
}
