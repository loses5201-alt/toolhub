/*
  本機加密保險箱引擎 —— 用瀏覽器內建 Web Crypto(crypto.subtle)做 AES-GCM 256 加密,
  金鑰由密碼經 PBKDF2-SHA256 衍生。全程在本機運算,密碼與內容都不離開這台電腦。

  容器格式(位元組):
    magic "THB1"(4) + salt(16) + iv(12) + 密文含 GCM 驗證標籤(其餘)
  AES-GCM 內含驗證標籤:密碼錯誤或檔案被竄改/毀損時解密會直接失敗(不會悄悄給出錯資料)。

  注意:此引擎只用 globalThis.crypto,不依賴任何 DOM API,故可在 Node 直接做回歸測試。
*/

const MAGIC = new Uint8Array([0x54, 0x48, 0x42, 0x31]) // "THB1"
const SALT_LEN = 16
const IV_LEN = 12
const ITERATIONS = 250_000
const HEAD_LEN = MAGIC.length + SALT_LEN + IV_LEN

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** 加密一段位元組,回傳自描述容器(可直接存成檔案)。 */
export async function encryptBytes(plain: Uint8Array, password: string): Promise<Uint8Array> {
  if (!password) throw new Error('需要密碼')
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN))
  const key = await deriveKey(password, salt)
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain as BufferSource),
  )
  const out = new Uint8Array(HEAD_LEN + ct.length)
  out.set(MAGIC, 0)
  out.set(salt, MAGIC.length)
  out.set(iv, MAGIC.length + SALT_LEN)
  out.set(ct, HEAD_LEN)
  return out
}

/** 解密容器,回傳原始位元組;密碼錯誤或檔案毀損會丟出明確錯誤。 */
export async function decryptBytes(container: Uint8Array, password: string): Promise<Uint8Array> {
  if (!password) throw new Error('需要密碼')
  if (container.length <= HEAD_LEN) throw new Error('檔案格式不正確或內容為空')
  for (let i = 0; i < MAGIC.length; i++) {
    if (container[i] !== MAGIC[i]) throw new Error('這不是本工具加密的檔案')
  }
  const salt = container.slice(MAGIC.length, MAGIC.length + SALT_LEN)
  const iv = container.slice(MAGIC.length + SALT_LEN, HEAD_LEN)
  const ct = container.slice(HEAD_LEN)
  const key = await deriveKey(password, salt)
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct as BufferSource)
    return new Uint8Array(pt)
  } catch {
    throw new Error('密碼錯誤,或檔案已被竄改/毀損')
  }
}

/** 把位元組轉成 base64(分段處理,避免大檔超出 call stack) */
export function bytesToBase64(b: Uint8Array): string {
  let s = ''
  const chunk = 0x8000
  for (let i = 0; i < b.length; i += chunk) {
    s += String.fromCharCode(...b.subarray(i, i + chunk))
  }
  return btoa(s)
}

/** 把 base64 轉回位元組(容忍換行/空白) */
export function base64ToBytes(s: string): Uint8Array {
  const bin = atob(s.replace(/\s+/g, ''))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** 加密一段文字,回傳 base64 字串(方便複製貼上傳送)。 */
export async function encryptText(text: string, password: string): Promise<string> {
  return bytesToBase64(await encryptBytes(new TextEncoder().encode(text), password))
}

/** 解密 base64 字串,回傳原始文字。 */
export async function decryptText(b64: string, password: string): Promise<string> {
  return new TextDecoder().decode(await decryptBytes(base64ToBytes(b64), password))
}
