/*
  數論工具箱引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試,全程 BigInt 精確計算。
   - parseBigInt:把輸入字串解析成非負 BigInt(容許千分位逗號/空白),失敗回 null。
   - isPrime:Miller–Rabin 質數判定。對 n < 3.3×10²⁴ 用前 12 個質數當見證者為「確定性」判定;
     更大的數退化為高機率判定(40 個隨機回合,實務上錯誤率可忽略)。
   - factorize:質因數分解(小因數試除 + Pollard's rho 處理大因數),回 [{prime, exp}] 由小到大。
   - divisors:由分解枚舉所有正因數(數量過多時只回前段並標記截斷)。
   - gcd / lcm / gcdMany / lcmMany、eulerTotient、sigma(因數和)、tau(因數個數)、
     nextPrime / prevPrime、classifyNumber(虧/完美/盈)。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

/** 解析非負整數字串(容許逗號/底線/空白分隔),失敗或負數回 null。 */
export function parseBigInt(input: string): bigint | null {
  const s = (input ?? '').trim().replace(/[,_\s]/g, '')
  if (!/^\d+$/.test(s)) return null
  try {
    return BigInt(s)
  } catch {
    return null
  }
}

function abs(a: bigint): bigint {
  return a < 0n ? -a : a
}

export function gcd(a: bigint, b: bigint): bigint {
  a = abs(a)
  b = abs(b)
  while (b) {
    ;[a, b] = [b, a % b]
  }
  return a
}

export function lcm(a: bigint, b: bigint): bigint {
  a = abs(a)
  b = abs(b)
  if (a === 0n || b === 0n) return 0n
  return (a / gcd(a, b)) * b
}

export function gcdMany(nums: bigint[]): bigint {
  return nums.reduce((g, n) => gcd(g, n), 0n)
}

export function lcmMany(nums: bigint[]): bigint {
  if (nums.length === 0) return 0n
  return nums.reduce((l, n) => lcm(l, n))
}

/** 模冪:base^exp mod m,全程 BigInt,不溢位。 */
function modPow(base: bigint, exp: bigint, m: bigint): bigint {
  if (m === 1n) return 0n
  let result = 1n
  base %= m
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % m
    exp >>= 1n
    base = (base * base) % m
  }
  return result
}

// 前 12 個質數,對 n < 3.317×10²⁴ 的 Miller–Rabin 確定性見證者足夠。
const SMALL_PRIMES = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]
const DETERMINISTIC_LIMIT = 3317044064679887385961981n // 3.317×10²⁴

function millerRabinWitness(n: bigint, a: bigint, d: bigint, r: number): boolean {
  let x = modPow(a, d, n)
  if (x === 1n || x === n - 1n) return false // 可能為質數
  for (let i = 0; i < r - 1; i++) {
    x = (x * x) % n
    if (x === n - 1n) return false
  }
  return true // 確定為合數
}

/** Miller–Rabin 質數判定。 */
export function isPrime(n: bigint): boolean {
  if (n < 2n) return false
  for (const p of SMALL_PRIMES) {
    if (n === p) return true
    if (n % p === 0n) return false
  }
  // n - 1 = d · 2^r
  let d = n - 1n
  let r = 0
  while ((d & 1n) === 0n) {
    d >>= 1n
    r++
  }
  let bases: bigint[]
  if (n < DETERMINISTIC_LIMIT) {
    bases = SMALL_PRIMES
  } else {
    bases = []
    for (let i = 0; i < 40; i++) bases.push(2n + randomBelow(n - 3n))
  }
  for (const a of bases) {
    if (a % n === 0n) continue
    if (millerRabinWitness(n, a, d, r)) return false
  }
  return true
}

/** 回傳 [0, max) 的偽隨機 BigInt(僅用於大數機率判定,不需密碼學強度)。 */
function randomBelow(max: bigint): bigint {
  const bits = max.toString(2).length
  let result: bigint
  do {
    result = 0n
    for (let i = 0; i < bits; i += 30) {
      result = (result << 30n) | BigInt(Math.floor(Math.random() * (1 << 30)))
    }
    result %= max
  } while (result < 0n)
  return result
}

/** Pollard's rho:回傳 n 的一個非平凡因數(n 為合數且不為偶數時)。 */
function pollardRho(n: bigint): bigint {
  if (n % 2n === 0n) return 2n
  while (true) {
    const c = 1n + randomBelow(n - 1n)
    const f = (x: bigint) => (x * x + c) % n
    let x = 2n
    let y = 2n
    let d = 1n
    while (d === 1n) {
      x = f(x)
      y = f(f(y))
      d = gcd(abs(x - y), n)
    }
    if (d !== n) return d
  }
}

export interface PrimePower {
  prime: bigint
  exp: number
}

/** 質因數分解,回 [{prime, exp}] 由小到大。0 與 1 回空陣列。 */
export function factorize(n: bigint): PrimePower[] {
  n = abs(n)
  if (n < 2n) return []
  const counts = new Map<string, number>()
  const add = (p: bigint) => counts.set(p.toString(), (counts.get(p.toString()) ?? 0) + 1)

  // 先用小質數試除,快速剝掉常見因數
  for (const p of SMALL_PRIMES) {
    while (n % p === 0n) {
      add(p)
      n /= p
    }
  }
  // 再用 Pollard's rho 遞迴分解剩餘部分
  const stack: bigint[] = []
  if (n > 1n) stack.push(n)
  while (stack.length) {
    const m = stack.pop() as bigint
    if (m === 1n) continue
    if (isPrime(m)) {
      add(m)
      continue
    }
    const f = pollardRho(m)
    stack.push(f, m / f)
  }
  return [...counts.entries()]
    .map(([p, exp]) => ({ prime: BigInt(p), exp }))
    .sort((a, b) => (a.prime < b.prime ? -1 : a.prime > b.prime ? 1 : 0))
}

/** 因數個數 τ(n) = ∏(eᵢ+1)。 */
export function tau(factors: PrimePower[]): bigint {
  return factors.reduce((acc, f) => acc * BigInt(f.exp + 1), 1n)
}

/** 因數和 σ(n) = ∏ (pᵢ^(eᵢ+1) − 1)/(pᵢ − 1)。 */
export function sigma(factors: PrimePower[]): bigint {
  return factors.reduce((acc, { prime, exp }) => {
    let term = 1n
    let pk = 1n
    for (let i = 0; i < exp; i++) {
      pk *= prime
      term += pk
    }
    return acc * term
  }, 1n)
}

/** 歐拉函數 φ(n) = n · ∏(1 − 1/pᵢ)。 */
export function eulerTotient(n: bigint, factors?: PrimePower[]): bigint {
  n = abs(n)
  if (n === 0n) return 0n
  if (n === 1n) return 1n
  const fs = factors ?? factorize(n)
  let result = n
  for (const { prime } of fs) {
    result = (result / prime) * (prime - 1n)
  }
  return result
}

export interface DivisorsResult {
  divisors: bigint[]
  truncated: boolean
  total: bigint
}

/** 由分解枚舉所有正因數(由小到大)。數量超過 limit 時截斷並標記。 */
export function divisors(factors: PrimePower[], limit = 4096): DivisorsResult {
  const total = tau(factors)
  let list: bigint[] = [1n]
  for (const { prime, exp } of factors) {
    const next: bigint[] = []
    let pk = 1n
    const powers: bigint[] = [1n]
    for (let i = 0; i < exp; i++) {
      pk *= prime
      powers.push(pk)
    }
    for (const d of list) for (const p of powers) next.push(d * p)
    list = next
    if (list.length > limit * 4) break // 防爆記憶體
  }
  list.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const truncated = list.length > limit
  return { divisors: truncated ? list.slice(0, limit) : list, truncated, total }
}

/** 下一個質數(> n)。 */
export function nextPrime(n: bigint): bigint {
  if (n < 2n) return 2n
  let c = n + 1n
  if (c % 2n === 0n) c += c === 2n ? 0n : 1n
  while (!isPrime(c)) c += c === 2n ? 1n : 2n
  return c
}

/** 上一個質數(< n),不存在回 null。 */
export function prevPrime(n: bigint): bigint | null {
  if (n <= 2n) return null
  let c = n - 1n
  while (c >= 2n) {
    if (isPrime(c)) return c
    c -= 1n
  }
  return null
}

export type NumberClass = 'deficient' | 'perfect' | 'abundant'

/** 依「真因數和」分類:虧數 / 完美數 / 盈數。 */
export function classifyNumber(n: bigint, factors?: PrimePower[]): NumberClass | null {
  n = abs(n)
  if (n < 1n) return null
  if (n === 1n) return 'deficient'
  const s = sigma(factors ?? factorize(n)) - n // 真因數和
  if (s === n) return 'perfect'
  return s < n ? 'deficient' : 'abundant'
}

/** 把分解組成可讀字串,例:[{2,3},{3,2},{5,1}] → "2³ × 3² × 5"。 */
const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
}
function superscript(n: number): string {
  return String(n).split('').map((c) => SUPERSCRIPT[c] ?? c).join('')
}
export function formatFactorization(factors: PrimePower[]): string {
  if (factors.length === 0) return ''
  return factors
    .map(({ prime, exp }) => (exp === 1 ? prime.toString() : `${prime}${superscript(exp)}`))
    .join(' × ')
}

/** 千分位分組,給大數顯示。 */
export function groupDigits(n: bigint): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
