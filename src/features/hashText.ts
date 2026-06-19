/*
  文字雜湊核心 —— MD5 與 CRC32 的純函式實作(瀏覽器 Web Crypto 不含這兩種),
  以及位元組轉十六進位輔助。SHA 家族由呼叫端用 crypto.subtle 計算。
  純函式、無 DOM,故可在 Node 測;全程瀏覽器、不連網、不上傳。
*/

/** 位元組陣列轉小寫十六進位字串。 */
export function bytesToHex(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i].toString(16).padStart(2, '0')
  }
  return s
}

/** 文字以 UTF-8 編碼成位元組。 */
export function utf8Bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

// ── MD5(RFC 1321)─────────────────────────────────────────────
// 以 32 位元無號運算實作,輸入 Uint8Array,輸出 16 位元組。

function rotl(x: number, c: number): number {
  return (x << c) | (x >>> (32 - c))
}

const S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
]

// K[i] = floor(abs(sin(i+1)) * 2^32)
const K = (() => {
  const k = new Uint32Array(64)
  for (let i = 0; i < 64; i++) {
    k[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296)
  }
  return k
})()

export function md5(input: Uint8Array): Uint8Array {
  const origLenBits = input.length * 8
  // padding:加 0x80,補零到 56 mod 64,末 8 位元組放長度(小端)
  const padLen = ((56 - ((input.length + 1) % 64)) + 64) % 64
  const total = input.length + 1 + padLen + 8
  const msg = new Uint8Array(total)
  msg.set(input)
  msg[input.length] = 0x80
  // 64 位元長度(只取低 32 位足夠一般輸入;高位填 0 / 由位元數推)
  const lenLo = origLenBits >>> 0
  const lenHi = Math.floor(origLenBits / 4294967296) >>> 0
  msg[total - 8] = lenLo & 0xff
  msg[total - 7] = (lenLo >>> 8) & 0xff
  msg[total - 6] = (lenLo >>> 16) & 0xff
  msg[total - 5] = (lenLo >>> 24) & 0xff
  msg[total - 4] = lenHi & 0xff
  msg[total - 3] = (lenHi >>> 8) & 0xff
  msg[total - 2] = (lenHi >>> 16) & 0xff
  msg[total - 1] = (lenHi >>> 24) & 0xff

  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476

  const M = new Uint32Array(16)
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) {
      const j = off + i * 4
      M[i] = msg[j] | (msg[j + 1] << 8) | (msg[j + 2] << 16) | (msg[j + 3] << 24)
    }
    let A = a0
    let B = b0
    let C = c0
    let D = d0
    for (let i = 0; i < 64; i++) {
      let F: number
      let g: number
      if (i < 16) {
        F = (B & C) | (~B & D)
        g = i
      } else if (i < 32) {
        F = (D & B) | (~D & C)
        g = (5 * i + 1) % 16
      } else if (i < 48) {
        F = B ^ C ^ D
        g = (3 * i + 5) % 16
      } else {
        F = C ^ (B | ~D)
        g = (7 * i) % 16
      }
      F = (F + A + K[i] + M[g]) >>> 0
      A = D
      D = C
      C = B
      B = (B + rotl(F, S[i])) >>> 0
    }
    a0 = (a0 + A) >>> 0
    b0 = (b0 + B) >>> 0
    c0 = (c0 + C) >>> 0
    d0 = (d0 + D) >>> 0
  }

  const out = new Uint8Array(16)
  const words = [a0, b0, c0, d0]
  for (let i = 0; i < 4; i++) {
    out[i * 4] = words[i] & 0xff
    out[i * 4 + 1] = (words[i] >>> 8) & 0xff
    out[i * 4 + 2] = (words[i] >>> 16) & 0xff
    out[i * 4 + 3] = (words[i] >>> 24) & 0xff
  }
  return out
}

export function md5Hex(text: string): string {
  return bytesToHex(md5(utf8Bytes(text)))
}

// ── CRC32(IEEE 802.3,常用於 zip / png / 完整性快檢)──────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(input: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < input.length; i++) {
    crc = CRC_TABLE[(crc ^ input[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

export function crc32Hex(text: string): string {
  return crc32(utf8Bytes(text)).toString(16).padStart(8, '0')
}
