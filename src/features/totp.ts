/*
  TOTP / HOTP 兩步驟驗證碼核心(RFC 4226 / RFC 6238)。
  base32 解碼與計數器編碼為純函式;HMAC 用 Web Crypto(crypto.subtle),
  瀏覽器與 Node 22 皆有。全程在本機計算 —— 你的 2FA 密鑰絕不該貼到網站,本工具不連網、不上傳。
*/

const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** RFC 4648 base32 解碼;忽略空白與底線、不分大小寫、去尾端 '=';非法字元回 null。 */
export function base32Decode(input: string): Uint8Array | null {
  const clean = input
    .toUpperCase()
    .replace(/[\s_-]+/g, '')
    .replace(/=+$/, '')
  if (clean === '') return new Uint8Array(0)
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of clean) {
    const idx = B32_ALPHABET.indexOf(ch)
    if (idx < 0) return null
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Uint8Array.from(out)
}

/** 把計數器(整數)轉成 8 位元組大端序(HOTP 規格)。 */
export function counterToBytes(counter: number): Uint8Array {
  const bytes = new Uint8Array(8)
  let hi = Math.floor(counter / 0x100000000)
  let lo = counter % 0x100000000
  for (let i = 7; i >= 4; i--) {
    bytes[i] = lo & 0xff
    lo = Math.floor(lo / 256)
  }
  for (let i = 3; i >= 0; i--) {
    bytes[i] = hi & 0xff
    hi = Math.floor(hi / 256)
  }
  return bytes
}

/** HOTP 截斷:由 HMAC 結果取出 digits 位數字(RFC 4226 §5.3)。 */
export function truncate(hmac: Uint8Array, digits: number): string {
  const offset = hmac[hmac.length - 1] & 0x0f
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3]
  const mod = bin % 10 ** digits
  return mod.toString().padStart(digits, '0')
}

export type HashAlgo = 'SHA-1' | 'SHA-256' | 'SHA-512'

async function hmac(key: Uint8Array, msg: Uint8Array, algo: HashAlgo): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as BufferSource,
    { name: 'HMAC', hash: algo },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, msg as BufferSource)
  return new Uint8Array(sig)
}

/** HOTP:給金鑰位元組與計數器,算出驗證碼。 */
export async function hotp(
  key: Uint8Array,
  counter: number,
  digits = 6,
  algo: HashAlgo = 'SHA-1',
): Promise<string> {
  const h = await hmac(key, counterToBytes(counter), algo)
  return truncate(h, digits)
}

export interface TotpOptions {
  step?: number // 週期秒數(預設 30)
  t0?: number // 起始時間(預設 0)
  digits?: number // 位數(預設 6)
  algo?: HashAlgo // 雜湊演算法(預設 SHA-1)
}

export interface TotpResult {
  code: string
  remaining: number // 此碼還有幾秒過期
  counter: number
}

/** TOTP:給金鑰位元組與「秒級時間」,算出當下驗證碼與剩餘秒數。 */
export async function totp(
  key: Uint8Array,
  timeSeconds: number,
  options: TotpOptions = {},
): Promise<TotpResult> {
  const step = options.step ?? 30
  const t0 = options.t0 ?? 0
  const digits = options.digits ?? 6
  const algo = options.algo ?? 'SHA-1'
  const elapsed = timeSeconds - t0
  const counter = Math.floor(elapsed / step)
  const code = await hotp(key, counter, digits, algo)
  const remaining = step - (((elapsed % step) + step) % step)
  return { code, remaining, counter }
}

export interface ParsedOtpauth {
  ok: boolean
  secret?: string // base32
  label?: string
  issuer?: string
  digits: number
  period: number
  algo: HashAlgo
  error?: string
}

const DEFAULTS = { digits: 6, period: 30, algo: 'SHA-1' as HashAlgo }

/** 解析 otpauth://totp/Label?secret=...&issuer=...&digits=...&period=...&algorithm=... */
export function parseOtpauth(uri: string): ParsedOtpauth {
  const text = uri.trim()
  if (!/^otpauth:\/\//i.test(text)) {
    return { ok: false, ...DEFAULTS, error: '不是 otpauth:// 連結。' }
  }
  let url: URL
  try {
    url = new URL(text)
  } catch {
    return { ok: false, ...DEFAULTS, error: 'otpauth 連結格式不正確。' }
  }
  if (url.host.toLowerCase() !== 'totp') {
    return { ok: false, ...DEFAULTS, error: '目前只支援 TOTP(不支援 HOTP 計數型)。' }
  }
  const secret = url.searchParams.get('secret') || undefined
  if (!secret) return { ok: false, ...DEFAULTS, error: 'otpauth 連結缺少 secret。' }
  const label = decodeURIComponent(url.pathname.replace(/^\//, '')) || undefined
  const issuer = url.searchParams.get('issuer') || undefined
  const digits = Number(url.searchParams.get('digits')) || DEFAULTS.digits
  const period = Number(url.searchParams.get('period')) || DEFAULTS.period
  const algoRaw = (url.searchParams.get('algorithm') || 'SHA1').toUpperCase()
  const algo: HashAlgo =
    algoRaw === 'SHA256' ? 'SHA-256' : algoRaw === 'SHA512' ? 'SHA-512' : 'SHA-1'
  return { ok: true, secret, label, issuer, digits, period, algo }
}
