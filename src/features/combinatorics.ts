/*
  排列組合 / 機率引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  全部以 BigInt 精確計算,不會因階乘過大而失準(一般計算機算到 ~170! 就溢位)。
   - factorial:n!
   - permutations:P(n,r) = n! / (n−r)!(排列,有順序)
   - combinations:C(n,r) = n! /(r!(n−r)!)(組合,無順序),以乘除遞推避免巨大中間值。
   - permutationsWithRep:n^r(可重複的排列)
   - combinationsWithRep:C(n+r−1, r)(可重複的組合)
   - lotteryOdds:樂透中獎機率(1 / C(總號碼, 選幾個)),回傳分母與機率字串。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

/** n!;n 為非負整數,否則回 null。 */
export function factorial(n: number): bigint | null {
  if (!Number.isInteger(n) || n < 0) return null
  let r = 1n
  for (let i = 2n; i <= BigInt(n); i++) r *= i
  return r
}

/** P(n,r) = n!/(n−r)!;0 ≤ r ≤ n 的整數,否則回 null。 */
export function permutations(n: number, r: number): bigint | null {
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || r > n) return null
  let result = 1n
  for (let i = 0; i < r; i++) result *= BigInt(n - i)
  return result
}

/** C(n,r) = n!/(r!(n−r)!);以遞推 C(n,k)=C(n,k−1)·(n−k+1)/k 保持整數。 */
export function combinations(n: number, r: number): bigint | null {
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || r > n) return null
  const k = Math.min(r, n - r)
  let c = 1n
  for (let i = 1; i <= k; i++) {
    c = (c * BigInt(n - i + 1)) / BigInt(i)
  }
  return c
}

/** 可重複的排列:n^r。 */
export function permutationsWithRep(n: number, r: number): bigint | null {
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0) return null
  return BigInt(n) ** BigInt(r)
}

/** 可重複的組合:C(n+r−1, r)。 */
export function combinationsWithRep(n: number, r: number): bigint | null {
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0) return null
  if (n === 0) return r === 0 ? 1n : 0n
  return combinations(n + r - 1, r)
}

export interface LotteryOdds {
  total: bigint // 所有可能組合數 = C(pool, pick)
  oddsText: string // 「1 / N」字串
  probability: number // 機率(浮點近似)
  percent: string // 百分比字串
}

/**
 * 樂透中頭獎機率:從 pool 個號碼選 pick 個(不計順序)。
 * 例:台灣大樂透 pool=49, pick=6 → C(49,6)=13,983,816。
 */
export function lotteryOdds(pool: number, pick: number): LotteryOdds | null {
  const total = combinations(pool, pick)
  if (total === null || total === 0n) return null
  // 浮點機率(用於百分比顯示)
  const probability = 1 / Number(total)
  return {
    total,
    oddsText: `1 / ${groupDigits(total)}`,
    probability,
    percent: formatPercent(probability),
  }
}

/** 把 BigInt 加上千分位。 */
export function groupDigits(n: bigint): string {
  const s = n.toString()
  const neg = s.startsWith('-')
  const digits = neg ? s.slice(1) : s
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return (neg ? '-' : '') + grouped
}

function formatPercent(p: number): string {
  if (p === 0) return '0%'
  if (p >= 0.0001) return (p * 100).toFixed(4) + '%'
  return (p * 100).toExponential(3) + '%'
}
