/*
  CBOR(RFC 8949)解碼引擎 —— 純函式、無 DOM 依賴(只用標準 TextDecoder / DataView),可在 Node 直接測試。
  把 CBOR 二進位(hex / base64)拆成可讀的結構樹:整數、byte/text string、陣列、map、標籤(tag)、
  浮點與簡單值。WebAuthn / passkey 認證、COSE、CTAP、IoT 常用 CBOR;全程在你瀏覽器解析,不連網、不上傳。

  支援定長與不定長(0x1f / break)bytes、text、array、map;float16 / 32 / 64;well-known tag 標名稱;
  bignum(tag 2 / 3)還原為整數。
*/
import { hexToBytes } from './baseEncode'
import { base64ToBytes } from './encodedWord'

export interface CborNode {
  type: string // uint / nint / bytes / text / array / map / tag / float / simple / bool / null / undefined
  value: string // 主要可讀值
  offset: number
  byteLength: number
  children?: CborNode[] // array / tag(含 1 個內層項目)
  entries?: { key: CborNode; value: CborNode }[] // map
  error?: string
}

const TAG_NAMES: Record<string, string> = {
  '0': '標準日期時間字串', '1': 'Unix 時間戳', '2': '正 bignum', '3': '負 bignum',
  '4': '十進位小數', '5': 'bigfloat', '21': 'base64url 提示', '22': 'base64 提示',
  '23': 'base16 提示', '24': '內嵌 CBOR', '32': 'URI', '33': 'base64url', '34': 'base64',
  '35': '正規表達式', '36': 'MIME 訊息', '55799': 'CBOR 自述標記',
}

/** 把 hex / base64 文字轉成 CBOR 位元組。 */
export function parseCborInput(text: string): { bytes: Uint8Array | null; format: string; error?: string } {
  const raw = (text || '').trim()
  if (!raw) return { bytes: null, format: '', error: '請貼上 hex 或 base64 的 CBOR 位元組' }
  if (/^(0x)?[0-9a-f\s]+$/i.test(raw)) {
    const h = hexToBytes(raw)
    if (h && h.length) return { bytes: h, format: 'hex' }
  }
  if (/^[A-Za-z0-9+/_=-\s]+$/.test(raw)) {
    const b = base64ToBytes(raw.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, ''))
    if (b.length) return { bytes: b, format: 'base64' }
  }
  return { bytes: null, format: '', error: '無法辨識輸入格式(請用 hex 或 base64)' }
}

function bytesToHex(b: Uint8Array, start: number, end: number): string {
  let s = ''
  for (let i = start; i < end; i++) s += b[i].toString(16).padStart(2, '0')
  return s
}

function decodeFloat16(hi: number, lo: number): number {
  const half = (hi << 8) | lo
  const exp = (half >> 10) & 0x1f
  const mant = half & 0x3ff
  const sign = half & 0x8000 ? -1 : 1
  if (exp === 0) return sign * mant * Math.pow(2, -24)
  if (exp === 31) return mant ? NaN : sign * Infinity
  return sign * (mant + 1024) * Math.pow(2, exp - 25)
}

class CborError extends Error {}

interface Reader { b: Uint8Array; pos: number }

/** 讀 additional info 對應的引數(數值或長度);回 BigInt,-1n 代表不定長(0x1f)。 */
function readArgument(r: Reader, ai: number): bigint {
  if (ai < 24) return BigInt(ai)
  if (ai === 24) { if (r.pos + 1 > r.b.length) throw new CborError('引數不完整'); return BigInt(r.b[r.pos++]) }
  if (ai === 25) { if (r.pos + 2 > r.b.length) throw new CborError('引數不完整'); const v = (r.b[r.pos] << 8) | r.b[r.pos + 1]; r.pos += 2; return BigInt(v) }
  if (ai === 26) { if (r.pos + 4 > r.b.length) throw new CborError('引數不完整'); let v = 0n; for (let i = 0; i < 4; i++) v = (v << 8n) | BigInt(r.b[r.pos++]); return v }
  if (ai === 27) { if (r.pos + 8 > r.b.length) throw new CborError('引數不完整'); let v = 0n; for (let i = 0; i < 8; i++) v = (v << 8n) | BigInt(r.b[r.pos++]); return v }
  if (ai === 31) return -1n // 不定長
  throw new CborError(`保留的 additional info ${ai}`)
}

function take(r: Reader, n: bigint): number {
  if (n < 0n || r.pos + Number(n) > r.b.length) throw new CborError('長度超出資料範圍')
  const start = r.pos
  r.pos += Number(n)
  return start
}

function readItem(r: Reader, depth: number): CborNode {
  if (depth > 64) throw new CborError('巢狀過深')
  const offset = r.pos
  if (r.pos >= r.b.length) throw new CborError('資料提早結束')
  const ib = r.b[r.pos++]
  const major = ib >> 5
  const ai = ib & 0x1f

  if (major === 0) { // unsigned int
    const v = readArgument(r, ai)
    return { type: 'uint', value: v.toString(), offset, byteLength: r.pos - offset }
  }
  if (major === 1) { // negative int = -1 - n
    const v = readArgument(r, ai)
    return { type: 'nint', value: (-1n - v).toString(), offset, byteLength: r.pos - offset }
  }
  if (major === 2 || major === 3) { // byte / text string
    const isText = major === 3
    if (ai === 31) { // 不定長:串接 chunk 至 break
      let hex = ''
      let text = ''
      for (;;) {
        if (r.pos >= r.b.length) throw new CborError('不定長字串未見 break')
        if (r.b[r.pos] === 0xff) { r.pos++; break }
        const chunk = readItem(r, depth + 1)
        if (chunk.type !== (isText ? 'text' : 'bytes')) throw new CborError('不定長字串內含不相符的片段')
        if (isText) text += chunk.value.replace(/^"|"$/g, '')
        else hex += chunk.value.replace(/^h'|'$/g, '')
      }
      return { type: isText ? 'text' : 'bytes', value: isText ? `"${text}"` : `h'${hex}'`, offset, byteLength: r.pos - offset }
    }
    const len = readArgument(r, ai)
    const start = take(r, len)
    if (isText) {
      const s = new TextDecoder('utf-8', { fatal: false }).decode(r.b.subarray(start, start + Number(len)))
      return { type: 'text', value: `"${s}"`, offset, byteLength: r.pos - offset }
    }
    return { type: 'bytes', value: `h'${bytesToHex(r.b, start, start + Number(len))}'`, offset, byteLength: r.pos - offset }
  }
  if (major === 4) { // array
    const children: CborNode[] = []
    if (ai === 31) {
      for (;;) {
        if (r.pos >= r.b.length) throw new CborError('不定長陣列未見 break')
        if (r.b[r.pos] === 0xff) { r.pos++; break }
        children.push(readItem(r, depth + 1))
      }
    } else {
      const n = readArgument(r, ai)
      for (let i = 0n; i < n; i++) children.push(readItem(r, depth + 1))
    }
    return { type: 'array', value: `陣列(${children.length} 項)`, offset, byteLength: r.pos - offset, children }
  }
  if (major === 5) { // map
    const entries: { key: CborNode; value: CborNode }[] = []
    if (ai === 31) {
      for (;;) {
        if (r.pos >= r.b.length) throw new CborError('不定長 map 未見 break')
        if (r.b[r.pos] === 0xff) { r.pos++; break }
        const key = readItem(r, depth + 1)
        const value = readItem(r, depth + 1)
        entries.push({ key, value })
      }
    } else {
      const n = readArgument(r, ai)
      for (let i = 0n; i < n; i++) {
        const key = readItem(r, depth + 1)
        const value = readItem(r, depth + 1)
        entries.push({ key, value })
      }
    }
    return { type: 'map', value: `map(${entries.length} 對)`, offset, byteLength: r.pos - offset, entries }
  }
  if (major === 6) { // tag
    const tag = readArgument(r, ai)
    const inner = readItem(r, depth + 1)
    const name = TAG_NAMES[tag.toString()]
    let value = `標籤 ${tag}${name ? `(${name})` : ''}`
    // bignum:tag 2 / 3 + byte string → 還原整數
    if ((tag === 2n || tag === 3n) && inner.type === 'bytes') {
      const hex = inner.value.replace(/^h'|'$/g, '')
      let n = hex ? BigInt('0x' + hex) : 0n
      if (tag === 3n) n = -1n - n
      value += ` = ${n}`
    }
    return { type: 'tag', value, offset, byteLength: r.pos - offset, children: [inner] }
  }
  // major === 7:simple / float / break
  if (ai === 20) return { type: 'bool', value: 'false', offset, byteLength: r.pos - offset }
  if (ai === 21) return { type: 'bool', value: 'true', offset, byteLength: r.pos - offset }
  if (ai === 22) return { type: 'null', value: 'null', offset, byteLength: r.pos - offset }
  if (ai === 23) return { type: 'undefined', value: 'undefined', offset, byteLength: r.pos - offset }
  if (ai === 31) throw new CborError('未預期的 break(0xff)')
  if (ai === 25) { if (r.pos + 2 > r.b.length) throw new CborError('float16 不完整'); const f = decodeFloat16(r.b[r.pos], r.b[r.pos + 1]); r.pos += 2; return { type: 'float', value: String(f), offset, byteLength: r.pos - offset } }
  if (ai === 26) { if (r.pos + 4 > r.b.length) throw new CborError('float32 不完整'); const dv = new DataView(r.b.buffer, r.b.byteOffset + r.pos, 4); const f = dv.getFloat32(0, false); r.pos += 4; return { type: 'float', value: String(f), offset, byteLength: r.pos - offset } }
  if (ai === 27) { if (r.pos + 8 > r.b.length) throw new CborError('float64 不完整'); const dv = new DataView(r.b.buffer, r.b.byteOffset + r.pos, 8); const f = dv.getFloat64(0, false); r.pos += 8; return { type: 'float', value: String(f), offset, byteLength: r.pos - offset } }
  // 簡單值(0..19 直接、24 用下一位元組)
  const sv = readArgument(r, ai)
  return { type: 'simple', value: `簡單值 ${sv}`, offset, byteLength: r.pos - offset }
}

/** 解碼 CBOR 位元組;回頂層項目陣列(CBOR 序列)。部分失敗回已解析項目 + error。 */
export function decodeCbor(bytes: Uint8Array): { items: CborNode[]; error?: string } {
  if (!bytes || bytes.length === 0) return { items: [], error: '沒有位元組可解析' }
  const r: Reader = { b: bytes, pos: 0 }
  const items: CborNode[] = []
  try {
    while (r.pos < bytes.length) items.push(readItem(r, 0))
  } catch (e) {
    return { items, error: e instanceof CborError ? e.message : '解析失敗' }
  }
  return { items }
}
