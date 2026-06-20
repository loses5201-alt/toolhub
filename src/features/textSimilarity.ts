/*
  文字相似度比對引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  算兩段文字有多像:Levenshtein 編輯距離(要改幾步)、相似度百分比,
  以及以「詞」為單位的 Jaccard / Dice 係數與共同詞。
  比對姓名是否同一人、找近似重複的標題、抓抄襲/改寫、清名單去重時的相似度門檻都好用。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

/** Levenshtein 編輯距離:把 a 改成 b 所需的最少「增/刪/改一個字元」次數。 */
export function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  // 滾動陣列,記憶體 O(min)
  let prev = new Array(n + 1)
  let cur = new Array(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j
  for (let i = 1; i <= m; i++) {
    cur[0] = i
    const ca = a.charCodeAt(i - 1)
    for (let j = 1; j <= n; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, cur] = [cur, prev]
  }
  return prev[n]
}

/** 以編輯距離換算的相似度(0~1):1 - 距離 / 較長字串長度。兩者皆空回 1。 */
export function similarityRatio(a: string, b: string): number {
  const max = Math.max(a.length, b.length)
  if (max === 0) return 1
  return 1 - levenshtein(a, b) / max
}

/** 把文字切成詞(以空白與標點為界,轉小寫);中文無空白時退化為逐字。 */
export function tokenize(s: string): string[] {
  const cleaned = s.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, ' ').trim()
  if (!cleaned) return []
  const parts = cleaned.split(' ')
  // 若整體沒有空白分詞效果(例純中文連寫),退化為逐字(去空白)
  if (parts.length === 1 && /[一-鿿]/.test(parts[0]) && parts[0].length > 1) {
    return [...parts[0]]
  }
  return parts
}

/** Jaccard 係數:交集 / 聯集(0~1)。兩者皆空回 1。 */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  const union = a.size + b.size - inter
  return union === 0 ? 1 : inter / union
}

/** Sørensen–Dice 係數:2×交集 /(|A|+|B|)(0~1)。兩者皆空回 1。 */
export function dice(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  const total = a.size + b.size
  return total === 0 ? 1 : (2 * inter) / total
}

export interface SimilarityReport {
  distance: number
  ratio: number // 字元級相似度 0~1
  jaccardWords: number
  diceWords: number
  commonWords: string[]
  onlyA: string[]
  onlyB: string[]
}

/** 綜合比對兩段文字,回傳各項相似度指標與詞集差異。 */
export function compare(a: string, b: string): SimilarityReport {
  const sa = new Set(tokenize(a))
  const sb = new Set(tokenize(b))
  const common: string[] = []
  const onlyA: string[] = []
  const onlyB: string[] = []
  for (const x of sa) (sb.has(x) ? common : onlyA).push(x)
  for (const x of sb) if (!sa.has(x)) onlyB.push(x)
  return {
    distance: levenshtein(a, b),
    ratio: similarityRatio(a, b),
    jaccardWords: jaccard(sa, sb),
    diceWords: dice(sa, sb),
    commonWords: common,
    onlyA,
    onlyB,
  }
}
