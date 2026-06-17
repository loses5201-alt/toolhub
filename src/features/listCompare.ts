/*
  名單比對 / 去重引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  解決日常「對帳、整名單」的痛點:
    - 去重:一份名單裡哪些重複了、各出現幾次,留下不重複的一份。
    - 比對兩份:兩份名單的交集(都有)、只在 A、只在 B、聯集。
  例:核對「已繳費名單」與「全體名單」找出誰還沒繳;比對新舊 email 清單找差異。
  線上同類工具常要把可能含個資的名單貼到別人伺服器;本引擎全程本機運算、不上傳。

  設計:比對時用「正規化後的鍵」判斷是否相同(可選去空白、不分大小寫、全形轉半形),
  但輸出一律保留「第一次出現的原始樣子」,不破壞使用者資料。
*/

export interface NormalizeOptions {
  trim: boolean // 去頭尾空白
  ignoreCase: boolean // 不分大小寫(英文)
  ignoreWidth: boolean // 全形英數字 / 空白轉半形後再比
  collapseSpace: boolean // 把字中間連續空白縮成一個
}

export const defaultOptions: NormalizeOptions = {
  trim: true,
  ignoreCase: false,
  ignoreWidth: false,
  collapseSpace: false,
}

/** 全形 ASCII(！-～,U+FF01–FF5E)轉半形,全形空格(U+3000)轉一般空格。 */
function toHalfWidth(s: string): string {
  let out = ''
  for (const ch of s) {
    const code = ch.codePointAt(0)!
    if (code >= 0xff01 && code <= 0xff5e) out += String.fromCodePoint(code - 0xfee0)
    else if (code === 0x3000) out += ' '
    else out += ch
  }
  return out
}

/** 依設定算出用來比對的鍵(不影響輸出顯示)。 */
export function normalizeKey(raw: string, opts: NormalizeOptions): string {
  let s = raw
  if (opts.ignoreWidth) s = toHalfWidth(s)
  if (opts.trim) s = s.trim()
  if (opts.collapseSpace) s = s.replace(/\s+/g, ' ')
  if (opts.ignoreCase) s = s.toLowerCase()
  return s
}

/**
 * 把多行文字切成項目陣列。每行一筆,捨棄(經正規化後)為空白的行。
 * 回傳保留原始(僅依 trim 設定去頭尾空白)的顯示字串。
 */
export function parseList(text: string, opts: NormalizeOptions): string[] {
  const out: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const display = opts.trim ? line.trim() : line
    if (normalizeKey(line, opts) === '') continue
    out.push(display)
  }
  return out
}

export interface DuplicateRow {
  value: string // 第一次出現的顯示樣子
  count: number // 共出現幾次
}

export interface DedupeResult {
  total: number // 原始(非空)筆數
  uniqueCount: number // 不重複筆數
  duplicateGroups: number // 有重複的鍵數(出現 ≥ 2 次)
  removed: number // 因重複被移除的筆數 = total - uniqueCount
  unique: string[] // 去重後名單(保留首次出現順序與樣子)
  duplicates: DuplicateRow[] // 出現 ≥ 2 次者,依次數多到少
}

/** 對單一名單去重並統計重複狀況。 */
export function dedupe(text: string, opts: NormalizeOptions = defaultOptions): DedupeResult {
  const items = parseList(text, opts)
  const firstSeen = new Map<string, string>()
  const counts = new Map<string, number>()
  for (const item of items) {
    const key = normalizeKey(item, opts)
    if (!firstSeen.has(key)) firstSeen.set(key, item)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const unique = [...firstSeen.values()]
  const duplicates: DuplicateRow[] = []
  for (const [key, count] of counts) {
    if (count >= 2) duplicates.push({ value: firstSeen.get(key)!, count })
  }
  duplicates.sort((a, b) => b.count - a.count)
  return {
    total: items.length,
    uniqueCount: unique.length,
    duplicateGroups: duplicates.length,
    removed: items.length - unique.length,
    unique,
    duplicates,
  }
}

export interface CompareResult {
  both: string[] // 交集:兩份都有(顯示用 A 的樣子)
  onlyA: string[] // 只在 A
  onlyB: string[] // 只在 B
  union: string[] // 聯集:任一份有的全部(去重,A 優先樣子)
  countA: number // A 不重複筆數
  countB: number // B 不重複筆數
}

/**
 * 比對兩份名單(各自先去重),算出交集 / 只在 A / 只在 B / 聯集。
 * 顯示樣子:both 與 union 重疊處用 A 的樣子(A 先掃)。
 */
export function compare(
  textA: string,
  textB: string,
  opts: NormalizeOptions = defaultOptions,
): CompareResult {
  const mapA = new Map<string, string>()
  for (const item of parseList(textA, opts)) {
    const key = normalizeKey(item, opts)
    if (!mapA.has(key)) mapA.set(key, item)
  }
  const mapB = new Map<string, string>()
  for (const item of parseList(textB, opts)) {
    const key = normalizeKey(item, opts)
    if (!mapB.has(key)) mapB.set(key, item)
  }
  const both: string[] = []
  const onlyA: string[] = []
  for (const [key, display] of mapA) {
    if (mapB.has(key)) both.push(display)
    else onlyA.push(display)
  }
  const onlyB: string[] = []
  for (const [key, display] of mapB) {
    if (!mapA.has(key)) onlyB.push(display)
  }
  // 聯集 = A 全部 + B 中 A 沒有的
  const union = [...mapA.values(), ...onlyB]
  return {
    both,
    onlyA,
    onlyB,
    union,
    countA: mapA.size,
    countB: mapB.size,
  }
}
