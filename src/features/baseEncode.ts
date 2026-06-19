/*
  Base32 / Base58 位元組編解碼引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  與 base-convert(數字的 2–36 進位)不同,這裡是「位元組串」的編碼:
   - Base32(RFC 4648):TOTP 金鑰、檔名安全字串常用,含 = 補位。
   - Base58(Bitcoin/IPFS 字母表):去掉易混淆的 0/O/I/l,常用於錢包位址、CID。
  全程在你的瀏覽器,不連網、不上傳。
*/

const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

const enc = new TextEncoder()
const dec = new TextDecoder()

export function utf8ToBytes(s: string): Uint8Array {
  return enc.encode(s)
}
export function bytesToUtf8(b: Uint8Array): string {
  return dec.decode(b)
}

export function bytesToHex(b: Uint8Array): string {
  let s = ''
  for (const x of b) s += x.toString(16).padStart(2, '0')
  return s
}

/** hex 字串 → bytes;非法回 null。允許空白與 0x 前綴。 */
export function hexToBytes(input: string): Uint8Array | null {
  const clean = (input || '').trim().replace(/^0x/i, '').replace(/\s+/g, '')
  if (clean === '') return new Uint8Array(0)
  if (!/^[0-9a-f]+$/i.test(clean) || clean.length % 2 !== 0) return null
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  return out
}

// --- Base32 (RFC 4648) ---

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31]
  while (out.length % 8 !== 0) out += '='
  return out
}

/** Base32 解碼;非法字元回 null。大小寫不敏感,容忍空白與 = 補位。 */
export function base32Decode(input: string): Uint8Array | null {
  const s = (input || '').toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '')
  if (s === '') return new Uint8Array(0)
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of s) {
    const idx = B32_ALPHABET.indexOf(ch)
    if (idx === -1) return null
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Uint8Array.from(out)
}

// --- Base58 (Bitcoin) ---

export function base58Encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return ''
  // 前導零位元組 → '1'
  let zeros = 0
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++

  let num = 0n
  for (const b of bytes) num = (num << 8n) | BigInt(b)

  let out = ''
  while (num > 0n) {
    const rem = Number(num % 58n)
    num = num / 58n
    out = B58_ALPHABET[rem] + out
  }
  return '1'.repeat(zeros) + out
}

/** Base58 解碼;非法字元回 null。 */
export function base58Decode(input: string): Uint8Array | null {
  const s = (input || '').trim()
  if (s === '') return new Uint8Array(0)
  let zeros = 0
  while (zeros < s.length && s[zeros] === '1') zeros++

  let num = 0n
  for (const ch of s) {
    const idx = B58_ALPHABET.indexOf(ch)
    if (idx === -1) return null
    num = num * 58n + BigInt(idx)
  }

  // num → big-endian bytes
  const bytes: number[] = []
  while (num > 0n) {
    bytes.unshift(Number(num & 0xffn))
    num >>= 8n
  }
  const leading = new Array(zeros).fill(0)
  return Uint8Array.from([...leading, ...bytes])
}
