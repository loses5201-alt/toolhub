/*
  隨機 ID 產生核心 —— 純函式,用 crypto 安全亂數(Node 與瀏覽器皆有 globalThis.crypto)。
  產生 UUID v4、ULID(可排序、含時間)、Nano ID。全程在本機產生,不連網、不上傳。
*/

function randomBytes(n: number): Uint8Array {
  const a = new Uint8Array(n)
  globalThis.crypto.getRandomValues(a)
  return a
}

// ---- UUID v4 ----

/** 產生符合 RFC 4122 的 UUID v4(version=4、variant=10xx)。 */
export function uuidV4(): string {
  const b = randomBytes(16)
  b[6] = (b[6] & 0x0f) | 0x40 // version 4
  b[8] = (b[8] & 0x3f) | 0x80 // variant 10xx
  const h: string[] = []
  for (let i = 0; i < 16; i++) h.push(b[i].toString(16).padStart(2, '0'))
  return (
    h.slice(0, 4).join('') +
    '-' +
    h.slice(4, 6).join('') +
    '-' +
    h.slice(6, 8).join('') +
    '-' +
    h.slice(8, 10).join('') +
    '-' +
    h.slice(10, 16).join('')
  )
}

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidUuidV4(s: string): boolean {
  return UUID_V4_RE.test(s)
}

// ---- ULID ----
// Crockford Base32(不含 I L O U,避免混淆)
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** 把毫秒時間戳記編成 len 字元的 Crockford Base32(高位在前,可字典序排序)。 */
export function encodeTimeBase32(ms: number, len = 10): string {
  let n = Math.floor(ms)
  let s = ''
  for (let i = 0; i < len; i++) {
    s = CROCKFORD[n % 32] + s
    n = Math.floor(n / 32)
  }
  return s
}

function encodeRandomBase32(len: number): string {
  // 256 可被 32 整除 → byte % 32 無取模偏差
  const bytes = randomBytes(len)
  let s = ''
  for (let i = 0; i < len; i++) s += CROCKFORD[bytes[i] % 32]
  return s
}

/** 產生 ULID(26 字元:前 10 為時間、後 16 為亂數;同毫秒下大致可排序)。 */
export function ulid(time: number = Date.now()): string {
  return encodeTimeBase32(time, 10) + encodeRandomBase32(16)
}

const ULID_RE = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{26}$/

export function isValidUlid(s: string): boolean {
  return ULID_RE.test(s)
}

// ---- Nano ID ----
export const NANO_URLSAFE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'

/** 產生 Nano ID,預設 21 字元 URL-safe;用拒絕取樣避免取模偏差。 */
export function nanoid(size = 21, alphabet: string = NANO_URLSAFE): string {
  const len = alphabet.length
  if (len < 2 || len > 256) throw new RangeError('字元集長度需在 2–256 之間')
  if (size < 1) return ''
  const limit = 256 - (256 % len) // 只接受落在此範圍的位元組,確保均勻
  let id = ''
  while (id.length < size) {
    const bytes = randomBytes(size)
    for (let i = 0; i < bytes.length && id.length < size; i++) {
      const x = bytes[i]
      if (x < limit) id += alphabet[x % len]
    }
  }
  return id
}

export type IdKind = 'uuid' | 'ulid' | 'nanoid'

/** 一次產生多個。 */
export function generate(kind: IdKind, count: number, opts?: { size?: number }): string[] {
  const n = Math.max(1, Math.min(10000, Math.floor(count)))
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    if (kind === 'uuid') out.push(uuidV4())
    else if (kind === 'ulid') out.push(ulid())
    else out.push(nanoid(opts?.size ?? 21))
  }
  return out
}
