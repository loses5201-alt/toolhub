/*
  ULID 解析引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  ULID(Universally Unique Lexicographically Sortable Identifier)是 26 個字元的識別碼,
  用 Crockford Base32 編碼 128 位元 = 前 48 位元毫秒時間戳 + 後 80 位元亂數。
  可由 ULID 反推內嵌的建立時間(可排序的特性就來自時間戳在最前面)。
  與 id-gen(產生)互補,這支專做反查;純位元解析,不查詢任何資料。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

// Crockford Base32 字母表(排除易混淆的 I L O U)
export const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const DECODE: Record<string, number> = {}
for (let i = 0; i < ALPHABET.length; i++) DECODE[ALPHABET[i]] = i
// Crockford 解碼時的寬容對應
DECODE['I'] = 1
DECODE['L'] = 1
DECODE['O'] = 0

export function normalizeUlid(input: string): string {
  return (input || '').trim().toUpperCase()
}

/** 解碼前 10 個字元為 48 位元毫秒時間戳(48 < 53 位元,JS number 可安全表示)。 */
export function decodeTime(first10: string): number {
  let t = 0
  for (const ch of first10) {
    const v = DECODE[ch]
    t = t * 32 + v
  }
  return t
}

/** 把毫秒時間戳編碼為 10 個 Crockford Base32 字元(ULID 時間欄位)。 */
export function encodeTime(ms: number): string {
  let out = ''
  let n = Math.floor(ms)
  for (let i = 0; i < 10; i++) {
    out = ALPHABET[n % 32] + out
    n = Math.floor(n / 32)
  }
  return out
}

export interface UlidInfo {
  valid: boolean
  normalized: string
  timestampMs: number
  iso: string
  randomness: string // 後 16 個字元(80 位元亂數)
  errors: string[]
}

const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/ // 26 碼,排除 I L O U

/** 解析 ULID 字串,還原時間戳與亂數欄位。 */
export function parseUlid(input: string): UlidInfo {
  const normalized = normalizeUlid(input)
  const errors: string[] = []
  const info: UlidInfo = {
    valid: false,
    normalized,
    timestampMs: 0,
    iso: '',
    randomness: '',
    errors,
  }
  if (normalized.length !== 26) {
    errors.push(`長度應為 26 碼,目前 ${normalized.length} 碼`)
    return info
  }
  // 允許 Crockford 寬容字元(I→1, L→1, O→0),先換算再驗證
  const canonical = normalized.replace(/I|L/g, '1').replace(/O/g, '0')
  if (!ULID_RE.test(canonical)) {
    errors.push('含非法字元(Crockford Base32 不含 U,且只允許 26 個合法字元)')
    return info
  }
  // ULID 第一碼最大為 7(48 位元時間戳只用前 10 碼的低 48 位元)
  if (canonical[0] > '7') {
    errors.push('時間戳溢位:第一個字元不可大於 7(超過 48 位元上限)')
    return info
  }
  const timestampMs = decodeTime(canonical.slice(0, 10))
  info.timestampMs = timestampMs
  info.randomness = canonical.slice(10)
  try {
    info.iso = new Date(timestampMs).toISOString()
  } catch {
    info.iso = ''
  }
  info.valid = true
  return info
}
