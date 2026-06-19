/*
  Unicode 正規化 / 比對核心 —— 解決「兩段文字看起來一樣卻不相等」的常見問題:
  同一個字可能由「單一碼點」或「基底字 + 組合附加符號」組成(é = U+00E9 或 e + U+0301),
  全形/半形、相容字(① ﬁ ㎏)也會讓比對失敗。提供 NFC/NFD/NFKC/NFKD 四種正規化與差異定位。
  純函式、無 DOM,可在 Node 測;全程瀏覽器、不連網、不上傳。
*/

export type NormForm = 'NFC' | 'NFD' | 'NFKC' | 'NFKD'

export interface NormResult {
  form: NormForm
  text: string
  codePoints: number // 碼點數(Array.from 長度)
  codeUnits: number // UTF-16 碼元數(.length)
  changed: boolean // 與原文是否不同
}

const FORMS: NormForm[] = ['NFC', 'NFD', 'NFKC', 'NFKD']

/** 對四種正規化形式各做一次,回各自結果。 */
export function normalizeAll(text: string): NormResult[] {
  return FORMS.map((form) => {
    const out = text.normalize(form)
    return {
      form,
      text: out,
      codePoints: Array.from(out).length,
      codeUnits: out.length,
      changed: out !== text,
    }
  })
}

export interface CodePoint {
  char: string
  cp: number // 碼點值
  hex: string // U+XXXX
  combining: boolean // 是否為組合附加符號(Unicode 標記類 \p{M})
}

const RE_MARK = /\p{M}/u
const RE_ZERO_WIDTH = /[​-‍⁠﻿]/

/** 把字串拆成碼點清單(以碼點而非碼元計,正確處理代理對與 emoji)。 */
export function listCodePoints(text: string): CodePoint[] {
  return Array.from(text).map((ch) => {
    const cp = ch.codePointAt(0) as number
    return {
      char: ch,
      cp,
      hex: 'U+' + cp.toString(16).toUpperCase().padStart(4, '0'),
      combining: RE_MARK.test(ch),
    }
  })
}

export interface TextStats {
  codePoints: number
  codeUnits: number
  combiningMarks: number
  fullWidth: number // 全形字數(碼點落在常見全形區段)
  zeroWidth: number // 零寬/不可見字元數
}

function isFullWidth(cp: number): boolean {
  // 全形 ASCII 變體與 CJK 全形標點等常見區段
  return (cp >= 0xff01 && cp <= 0xff60) || (cp >= 0xffe0 && cp <= 0xffe6)
}

/** 概況統計,幫使用者一眼看出文字裡藏了什麼。 */
export function analyzeText(text: string): TextStats {
  const cps = Array.from(text)
  let combiningMarks = 0
  let fullWidth = 0
  let zeroWidth = 0
  for (const ch of cps) {
    if (RE_MARK.test(ch)) combiningMarks++
    const cp = ch.codePointAt(0) as number
    if (isFullWidth(cp)) fullWidth++
    if (RE_ZERO_WIDTH.test(ch)) zeroWidth++
  }
  return {
    codePoints: cps.length,
    codeUnits: text.length,
    combiningMarks,
    fullWidth,
    zeroWidth,
  }
}

export interface CompareResult {
  rawEqual: boolean
  nfcEqual: boolean
  nfdEqual: boolean
  nfkcEqual: boolean
  firstDiff: number // 第一個不同的碼點索引(rawEqual 時為 -1)
  verdict: string // 白話結論
}

/** 比對兩段文字在各正規化形式下是否相等,並指出第一個差異位置。 */
export function compareStrings(a: string, b: string): CompareResult {
  const rawEqual = a === b
  const nfcEqual = a.normalize('NFC') === b.normalize('NFC')
  const nfdEqual = a.normalize('NFD') === b.normalize('NFD')
  const nfkcEqual = a.normalize('NFKC') === b.normalize('NFKC')

  let firstDiff = -1
  if (!rawEqual) {
    const aa = Array.from(a)
    const bb = Array.from(b)
    const n = Math.min(aa.length, bb.length)
    firstDiff = n // 預設:較短字串結束處
    for (let i = 0; i < n; i++) {
      if (aa[i] !== bb[i]) {
        firstDiff = i
        break
      }
    }
  }

  let verdict: string
  if (rawEqual) verdict = '兩段文字完全相同(連碼點都一樣)。'
  else if (nfcEqual)
    verdict = '看起來不同其實是「組合方式」不同 —— 經 NFC 正規化後完全相同。建議統一用 NFC 再比對。'
  else if (nfkcEqual)
    verdict = '在「相容正規化(NFKC)」下相同 —— 差別在全形/半形或相容字(如 ① 對 1、ﬁ 對 fi)。'
  else verdict = '即使正規化後仍不相同 —— 內容確實有差異(見下方第一個差異點)。'

  return { rawEqual, nfcEqual, nfdEqual, nfkcEqual, firstDiff, verdict }
}
