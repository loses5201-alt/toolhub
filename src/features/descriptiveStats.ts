/*
  描述統計引擎 —— 純函式、無 DOM。貼上一串數字即算出完整敘述統計。
  全程在使用者瀏覽器計算,不連網、不上傳。

  設計重點:
   - parseNumbers 容忍 Excel 一欄貼上(換行)、逗號/空白/分號/Tab 分隔,
     非數字 token 一律忽略並計數,讓使用者貼髒資料也能用。
   - 百分位數採「線性內插(R-7)」,等同 Excel 的 QUARTILE.INC / PERCENTILE.INC,
     使用者最熟悉、好驗證。四分位數 Q1/Q3 即 25%/75% 百分位。
   - 同時給「母體」(÷n)與「樣本」(÷n−1)兩種變異數/標準差,標清楚以免誤用。
   - 偏度 skewness 採 Excel SKEW(調整後 Fisher–Pearson G1);
     峰度 kurtosis 採 Excel KURT(超額峰度,常態為 0)。
*/

export interface ParseResult {
  values: number[]
  ignored: number // 被忽略的非數字 token 數
}

/** 從任意文字解析出數字陣列(換行/逗號/空白/分號/Tab 分隔)。 */
export function parseNumbers(text: string): ParseResult {
  const tokens = text.split(/[\s,;]+/).filter((t) => t.length > 0)
  const values: number[] = []
  let ignored = 0
  for (const t of tokens) {
    const v = Number(t)
    if (t !== '' && Number.isFinite(v)) values.push(v)
    else ignored++
  }
  return { values, ignored }
}

export function sum(values: number[]): number {
  let s = 0
  for (const v of values) s += v
  return s
}

export function mean(values: number[]): number {
  return values.length ? sum(values) / values.length : NaN
}

/** 由小到大已排序的陣列求中位數。 */
export function median(sortedAsc: number[]): number {
  const n = sortedAsc.length
  if (n === 0) return NaN
  const mid = n >> 1
  return n % 2 ? sortedAsc[mid] : (sortedAsc[mid - 1] + sortedAsc[mid]) / 2
}

/** 眾數:出現次數最多的值(可能多個);若全部只出現一次則無眾數。 */
export function modes(values: number[]): { values: number[]; count: number } {
  const freq = new Map<number, number>()
  for (const v of values) freq.set(v, (freq.get(v) ?? 0) + 1)
  let max = 0
  for (const c of freq.values()) if (c > max) max = c
  if (max <= 1) return { values: [], count: max }
  const out: number[] = []
  for (const [v, c] of freq) if (c === max) out.push(v)
  out.sort((a, b) => a - b)
  return { values: out, count: max }
}

/** 變異數。sample=true 用 n−1(樣本),否則用 n(母體)。 */
export function variance(values: number[], sample: boolean): number {
  const n = values.length
  const denom = sample ? n - 1 : n
  if (denom <= 0) return NaN
  const m = mean(values)
  let acc = 0
  for (const v of values) acc += (v - m) * (v - m)
  return acc / denom
}

export function stdDev(values: number[], sample: boolean): number {
  return Math.sqrt(variance(values, sample))
}

/**
 * 百分位數(線性內插,R-7 / Excel PERCENTILE.INC)。
 * @param sortedAsc 已由小到大排序
 * @param p 0–100
 */
export function percentile(sortedAsc: number[], p: number): number {
  const n = sortedAsc.length
  if (n === 0) return NaN
  if (n === 1) return sortedAsc[0]
  const pos = (p / 100) * (n - 1)
  const lo = Math.floor(pos)
  const frac = pos - lo
  if (lo + 1 >= n) return sortedAsc[n - 1]
  return sortedAsc[lo] + frac * (sortedAsc[lo + 1] - sortedAsc[lo])
}

export function geometricMean(values: number[]): number | null {
  if (!values.length) return null
  let logSum = 0
  for (const v of values) {
    if (v <= 0) return null // 幾何平均只適用於正數
    logSum += Math.log(v)
  }
  return Math.exp(logSum / values.length)
}

export function harmonicMean(values: number[]): number | null {
  if (!values.length) return null
  let acc = 0
  for (const v of values) {
    if (v <= 0) return null
    acc += 1 / v
  }
  return values.length / acc
}

/** 均方根(RMS)。 */
export function rootMeanSquare(values: number[]): number {
  if (!values.length) return NaN
  let acc = 0
  for (const v of values) acc += v * v
  return Math.sqrt(acc / values.length)
}

/** 偏度(Excel SKEW;調整後 Fisher–Pearson G1)。需 n ≥ 3。 */
export function skewness(values: number[]): number | null {
  const n = values.length
  if (n < 3) return null
  const m = mean(values)
  const s = stdDev(values, true)
  if (s === 0) return null
  let acc = 0
  for (const v of values) acc += ((v - m) / s) ** 3
  return (n / ((n - 1) * (n - 2))) * acc
}

/** 超額峰度(Excel KURT)。需 n ≥ 4。常態分布為 0。 */
export function kurtosis(values: number[]): number | null {
  const n = values.length
  if (n < 4) return null
  const m = mean(values)
  const s = stdDev(values, true)
  if (s === 0) return null
  let acc = 0
  for (const v of values) acc += ((v - m) / s) ** 4
  const a = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))
  const b = (3 * (n - 1) * (n - 1)) / ((n - 2) * (n - 3))
  return a * acc - b
}

export interface HistogramBin {
  start: number
  end: number
  count: number
}

/** 直方圖分組。binCount 省略時用 Sturges 公式。 */
export function histogram(values: number[], binCount?: number): HistogramBin[] {
  const n = values.length
  if (n === 0) return []
  let min = Infinity
  let max = -Infinity
  for (const v of values) {
    if (v < min) min = v
    if (v > max) max = v
  }
  if (min === max) return [{ start: min, end: max, count: n }]
  const k = Math.max(1, binCount ?? Math.ceil(Math.log2(n) + 1))
  const width = (max - min) / k
  const bins: HistogramBin[] = []
  for (let i = 0; i < k; i++) bins.push({ start: min + i * width, end: min + (i + 1) * width, count: 0 })
  for (const v of values) {
    let idx = Math.floor((v - min) / width)
    if (idx >= k) idx = k - 1
    if (idx < 0) idx = 0
    bins[idx].count++
  }
  return bins
}

export interface Stats {
  count: number
  sum: number
  min: number
  max: number
  range: number
  mean: number
  median: number
  modes: number[]
  modeCount: number
  popVariance: number
  popStdDev: number
  sampleVariance: number | null
  sampleStdDev: number | null
  coefVariation: number | null // 變異係數 = 樣本標準差 / 平均
  stdError: number | null // 平均數標準誤 = 樣本標準差 / √n
  q1: number
  q3: number
  iqr: number
  lowerFence: number
  upperFence: number
  outliers: number[]
  geometricMean: number | null
  harmonicMean: number | null
  rms: number
  skewness: number | null
  kurtosis: number | null
  sortedAsc: number[]
}

/** 計算完整敘述統計;空陣列回 null。 */
export function summarize(values: number[]): Stats | null {
  const n = values.length
  if (n === 0) return null
  const sortedAsc = [...values].sort((a, b) => a - b)
  const m = mean(values)
  const sVar = n >= 2 ? variance(values, true) : null
  const sSd = sVar === null ? null : Math.sqrt(sVar)
  const q1 = percentile(sortedAsc, 25)
  const q3 = percentile(sortedAsc, 75)
  const iqr = q3 - q1
  const lowerFence = q1 - 1.5 * iqr
  const upperFence = q3 + 1.5 * iqr
  const outliers = sortedAsc.filter((v) => v < lowerFence || v > upperFence)
  const md = modes(values)
  return {
    count: n,
    sum: sum(values),
    min: sortedAsc[0],
    max: sortedAsc[n - 1],
    range: sortedAsc[n - 1] - sortedAsc[0],
    mean: m,
    median: median(sortedAsc),
    modes: md.values,
    modeCount: md.count,
    popVariance: variance(values, false),
    popStdDev: stdDev(values, false),
    sampleVariance: sVar,
    sampleStdDev: sSd,
    coefVariation: sSd !== null && m !== 0 ? sSd / m : null,
    stdError: sSd !== null ? sSd / Math.sqrt(n) : null,
    q1,
    q3,
    iqr,
    lowerFence,
    upperFence,
    outliers,
    geometricMean: geometricMean(values),
    harmonicMean: harmonicMean(values),
    rms: rootMeanSquare(values),
    skewness: skewness(values),
    kurtosis: kurtosis(values),
    sortedAsc,
  }
}
