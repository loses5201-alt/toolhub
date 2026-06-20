/*
  JWT 解碼 / 檢視引擎 —— 純函式、無框架依賴,可在 Node 直接測試。
  把 JSON Web Token 解開成標頭(header)與內容(payload),整理註冊宣告(exp/iat/nbf…)、
  判斷是否已過期或尚未生效,並可用你輸入的密鑰在本機驗證 HMAC(HS256/384/512)簽章。
  全程在你的瀏覽器:很多人習慣把「真的」存取權杖貼進 jwt.io 之類的線上網站,
  那等於把可登入系統的憑證交給第三方;這支工具不連網、不上傳。
*/

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// --- Base64Url ---
export function base64UrlToBytes(input: string): Uint8Array {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
  const bin = atob(b64 + pad) // 非法字元會丟出例外,由呼叫端攔截
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export function base64UrlToString(input: string): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(base64UrlToBytes(input))
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// --- 解碼 ---
export interface DecodedJwt {
  ok: boolean
  error?: string
  isJwe?: boolean
  header?: Record<string, unknown>
  payload?: Record<string, unknown>
  headerJson?: string
  payloadJson?: string
  signature?: string
  alg?: string
  typ?: string
}

export function decodeJwt(token: string): DecodedJwt {
  const t = (token || '').trim().replace(/^Bearer\s+/i, '')
  if (!t) return { ok: false, error: '請貼上 JWT。' }
  if (/\s/.test(t)) return { ok: false, error: 'Token 內含空白字元,請確認沒有換行或多餘空格。' }
  const parts = t.split('.')
  if (parts.length === 5) {
    return {
      ok: false,
      isJwe: true,
      error: '這是加密的 JWE(五段式),內容本身已被加密,沒有金鑰無法解讀。',
    }
  }
  if (parts.length < 2 || parts.length > 3) {
    return { ok: false, error: `格式不符:JWT 應為三段(以 . 分隔),這裡有 ${parts.length} 段。` }
  }

  let headerJson: string
  try {
    headerJson = base64UrlToString(parts[0])
  } catch {
    return { ok: false, error: '第一段(標頭)不是有效的 Base64Url 編碼。' }
  }
  let header: unknown
  try {
    header = JSON.parse(headerJson)
  } catch {
    return { ok: false, error: '標頭(header)不是有效的 JSON。' }
  }
  if (!isPlainObject(header)) return { ok: false, error: '標頭不是 JSON 物件。' }

  let payloadJson: string
  try {
    payloadJson = base64UrlToString(parts[1])
  } catch {
    return { ok: false, error: '第二段(內容)不是有效的 Base64Url 編碼。' }
  }
  let payload: unknown
  try {
    payload = JSON.parse(payloadJson)
  } catch {
    return { ok: false, error: '內容(payload)不是有效的 JSON。' }
  }
  if (!isPlainObject(payload)) return { ok: false, error: '內容不是 JSON 物件。' }

  return {
    ok: true,
    header,
    payload,
    headerJson: JSON.stringify(header, null, 2),
    payloadJson: JSON.stringify(payload, null, 2),
    signature: parts[2] ?? '',
    alg: typeof header.alg === 'string' ? header.alg : undefined,
    typ: typeof header.typ === 'string' ? header.typ : undefined,
  }
}

// --- 註冊宣告(RFC 7519)友善說明 ---
export const REGISTERED_CLAIMS: Record<string, string> = {
  iss: '簽發者 (iss · issuer)',
  sub: '主體 (sub · subject)',
  aud: '接收對象 (aud · audience)',
  exp: '到期時間 (exp · expiration)',
  nbf: '生效時間 (nbf · not before)',
  iat: '簽發時間 (iat · issued at)',
  jti: '識別碼 (jti · JWT ID)',
}

const TIME_CLAIMS = new Set(['exp', 'nbf', 'iat'])

export function isTimeClaim(key: string): boolean {
  return TIME_CLAIMS.has(key)
}

// 把 Unix 秒數轉成本地與 UTC 兩種可讀字串
export function formatUnix(sec: number): { local: string; utc: string } | null {
  if (typeof sec !== 'number' || !Number.isFinite(sec)) return null
  const d = new Date(sec * 1000)
  if (Number.isNaN(d.getTime())) return null
  return { local: d.toLocaleString(), utc: d.toISOString() }
}

// 把秒數差距轉成白話(如「3 天 4 小時」)
export function humanizeDuration(totalSec: number): string {
  let s = Math.abs(Math.floor(totalSec))
  if (s < 1) return '不到 1 秒'
  const d = Math.floor(s / 86400)
  s -= d * 86400
  const h = Math.floor(s / 3600)
  s -= h * 3600
  const m = Math.floor(s / 60)
  s -= m * 60
  const parts: string[] = []
  if (d) parts.push(`${d} 天`)
  if (h) parts.push(`${h} 小時`)
  if (m) parts.push(`${m} 分`)
  if (!d && !h && s) parts.push(`${s} 秒`)
  return parts.slice(0, 2).join(' ') || '0 秒'
}

// --- 有效期判斷 ---
export type TokenState = 'valid' | 'expired' | 'not-yet' | 'unknown'
export interface TokenStatus {
  state: TokenState
  message: string
}

export function tokenStatus(
  payload: Record<string, unknown> | undefined,
  nowSec: number = Math.floor(Date.now() / 1000),
): TokenStatus {
  if (!payload) return { state: 'unknown', message: '無內容可判斷。' }
  const exp = typeof payload.exp === 'number' ? payload.exp : undefined
  const nbf = typeof payload.nbf === 'number' ? payload.nbf : undefined

  if (nbf !== undefined && nowSec < nbf) {
    return { state: 'not-yet', message: `尚未生效,還要 ${humanizeDuration(nbf - nowSec)} 才開始有效。` }
  }
  if (exp !== undefined) {
    if (nowSec >= exp) {
      return { state: 'expired', message: `已過期 ${humanizeDuration(nowSec - exp)}。` }
    }
    return { state: 'valid', message: `有效,還有 ${humanizeDuration(exp - nowSec)} 到期。` }
  }
  return { state: 'unknown', message: '此 Token 未設定到期時間(exp),無法判斷是否過期。' }
}

// --- HMAC 簽章驗證(HS256 / HS384 / HS512) ---
export interface VerifyResult {
  supported: boolean
  valid?: boolean
  alg?: string
  error?: string
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function verifyHmac(token: string, secret: string): Promise<VerifyResult> {
  const t = (token || '').trim().replace(/^Bearer\s+/i, '')
  const parts = t.split('.')
  if (parts.length !== 3 || !parts[2]) {
    return { supported: false, error: '需要含簽章的三段式 JWT。' }
  }
  let alg = ''
  try {
    const header = JSON.parse(base64UrlToString(parts[0]))
    alg = typeof header?.alg === 'string' ? header.alg : ''
  } catch {
    return { supported: false, error: '無法讀取標頭中的演算法。' }
  }
  const hashMap: Record<string, string> = { HS256: 'SHA-256', HS384: 'SHA-384', HS512: 'SHA-512' }
  const hash = hashMap[alg]
  if (!hash) {
    return {
      supported: false,
      alg,
      error: alg
        ? `此工具僅能用密鑰驗證 HMAC(HS256/384/512);本 Token 為 ${alg},屬非對稱簽章(需公鑰)或不支援。`
        : '標頭未指定演算法。',
    }
  }
  if (!secret) return { supported: true, alg, error: '請輸入用來簽章的密鑰(secret)。' }
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash }, false, ['sign'])
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(`${parts[0]}.${parts[1]}`))
  const computed = bytesToBase64Url(new Uint8Array(sigBuf))
  return { supported: true, alg, valid: timingSafeEqual(computed, parts[2]) }
}

// --- JWT 簽發 / 產生(HS256 / HS384 / HS512) ---
// 用密鑰在本機簽發 JWT。crypto.subtle 在瀏覽器與 Node 皆可用,全程不連網、不上傳。
export type SignAlg = 'HS256' | 'HS384' | 'HS512'
const SIGN_HASH: Record<SignAlg, string> = { HS256: 'SHA-256', HS384: 'SHA-384', HS512: 'SHA-512' }

function utf8Encode(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

/** 把任意值序列化成 JSON 後做 Base64Url(JWT 的一段)。 */
export function encodeSegment(value: unknown): string {
  return bytesToBase64Url(utf8Encode(JSON.stringify(value)))
}

/** 組出標準 JWT 標頭。 */
export function buildHeader(alg: SignAlg): Record<string, unknown> {
  return { alg, typ: 'JWT' }
}

/** 標頭與內容組成「待簽字串」(header.payload),簽章前的輸入。 */
export function signingInput(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
): string {
  return `${encodeSegment(header)}.${encodeSegment(payload)}`
}

export interface TimeClaimOptions {
  iat?: boolean // 加入簽發時間(iat = 現在)
  nbf?: boolean // 加入生效時間(nbf = 現在)
  expSeconds?: number // 多少秒後到期(> 0 才加 exp)
}

/**
 * 依選項把 iat / exp / nbf 時間宣告併入 payload(秒級 Unix)。
 * 回傳新物件,不更動原物件;exp = now + expSeconds。
 */
export function applyTimeClaims(
  payload: Record<string, unknown>,
  opts: TimeClaimOptions,
  nowSec: number = Math.floor(Date.now() / 1000),
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...payload }
  if (opts.iat) out.iat = nowSec
  if (opts.nbf) out.nbf = nowSec
  if (typeof opts.expSeconds === 'number' && opts.expSeconds > 0) {
    out.exp = nowSec + Math.floor(opts.expSeconds)
  }
  return out
}

/**
 * 在本機用密鑰簽發 JWT,回完整三段 token(header.payload.signature)。
 * 與本檔的 verifyHmac 互為逆運算。
 */
export async function signJwt(
  payload: Record<string, unknown>,
  secret: string,
  alg: SignAlg = 'HS256',
): Promise<string> {
  const input = signingInput(buildHeader(alg), payload)
  const key = await crypto.subtle.importKey(
    'raw',
    utf8Encode(secret) as BufferSource,
    { name: 'HMAC', hash: SIGN_HASH[alg] },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, utf8Encode(input) as BufferSource)
  return `${input}.${bytesToBase64Url(new Uint8Array(sig))}`
}
