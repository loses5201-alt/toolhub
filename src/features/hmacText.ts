/*
  HMAC(金鑰雜湊訊息鑑別碼)核心 —— 用一把密鑰對訊息簽章,常用於驗證 webhook 來源
  (GitHub X-Hub-Signature、Stripe、LINE Messaging API 等)。HMAC 用 Web Crypto(crypto.subtle),
  base64 / 比對為純函式。全程瀏覽器、不連網、不上傳;密鑰只留在本機。
*/
import { bytesToHex, utf8Bytes } from './hashText'

export type HmacAlgo = 'SHA-1' | 'SHA-256' | 'SHA-512'

/** 位元組轉標準 base64(不依賴 btoa,Node 也可跑)。 */
export function bytesToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let out = ''
  let i = 0
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]
    out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63] + chars[(n >> 6) & 63] + chars[n & 63]
  }
  const rem = bytes.length - i
  if (rem === 1) {
    const n = bytes[i] << 16
    out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63] + '=='
  } else if (rem === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8)
    out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63] + chars[(n >> 6) & 63] + '='
  }
  return out
}

/** 計算 HMAC,回原始位元組。 */
export async function hmacBytes(
  message: string,
  key: string,
  algo: HmacAlgo,
): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    utf8Bytes(key) as BufferSource,
    { name: 'HMAC', hash: algo },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, utf8Bytes(message) as BufferSource)
  return new Uint8Array(sig)
}

export async function hmacHex(message: string, key: string, algo: HmacAlgo): Promise<string> {
  return bytesToHex(await hmacBytes(message, key, algo))
}

export async function hmacBase64(message: string, key: string, algo: HmacAlgo): Promise<string> {
  return bytesToBase64(await hmacBytes(message, key, algo))
}

/**
 * 定時(constant-time)比對兩個十六進位簽章字串,避免時序側通道。
 * 長度不同直接 false;大小寫不敏感。
 */
export function safeEqualHex(a: string, b: string): boolean {
  const x = a.trim().toLowerCase()
  const y = b.trim().toLowerCase()
  if (x.length !== y.length) return false
  let diff = 0
  for (let i = 0; i < x.length; i++) {
    diff |= x.charCodeAt(i) ^ y.charCodeAt(i)
  }
  return diff === 0
}
