/*
  MessagePack 解碼引擎 —— 純函式、無 DOM 依賴(只用標準 TextDecoder / DataView),可在 Node 直接測試。
  把 MessagePack 二進位(hex / base64)依官方 spec 拆成可讀的結構樹:整數、float、字串、bin、陣列、map、
  ext(含 timestamp 擴充)。Redis、msgpack-rpc、許多 API 用 MessagePack;全程在你瀏覽器解析,不連網、不上傳。
*/
import { hexToBytes } from './baseEncode'
import { base64ToBytes } from './encodedWord'

export interface MsgpackNode {
  type: string // uint / int / float / str / bin / array / map / nil / bool / ext / timestamp
  value: string
  offset: number
  byteLength: number
  children?: MsgpackNode[] // array
  entries?: { key: MsgpackNode; value: MsgpackNode }[] // map
  error?: string
}

/** 把 hex / base64 文字轉成 MessagePack 位元組。 */
export function parseMsgpackInput(text: string): { bytes: Uint8Array | null; format: string; error?: string } {
  const raw = (text || '').trim()
  if (!raw) return { bytes: null, format: '', error: '請貼上 hex 或 base64 的 MessagePack 位元組' }
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

class MpError extends Error {}
interface Reader { b: Uint8Array; pos: number }

function need(r: Reader, n: number): number {
  if (r.pos + n > r.b.length) throw new MpError('資料提早結束')
  const s = r.pos
  r.pos += n
  return s
}

/** 讀 n 位元組大端 → BigInt。 */
function readUintBE(r: Reader, n: number): bigint {
  const s = need(r, n)
  let v = 0n
  for (let i = 0; i < n; i++) v = (v << 8n) | BigInt(r.b[s + i])
  return v
}

function readStr(r: Reader, len: number, offset: number): MsgpackNode {
  const s = need(r, len)
  const str = new TextDecoder('utf-8', { fatal: false }).decode(r.b.subarray(s, s + len))
  return { type: 'str', value: `"${str}"`, offset, byteLength: r.pos - offset }
}
function readBin(r: Reader, len: number, offset: number): MsgpackNode {
  const s = need(r, len)
  return { type: 'bin', value: `(${len} 位元組)0x${bytesToHex(r.b, s, s + len)}`, offset, byteLength: r.pos - offset }
}
function readArray(r: Reader, n: number, offset: number, depth: number): MsgpackNode {
  const children: MsgpackNode[] = []
  for (let i = 0; i < n; i++) children.push(readItem(r, depth + 1))
  return { type: 'array', value: `陣列(${n} 項)`, offset, byteLength: r.pos - offset, children }
}
function readMap(r: Reader, n: number, offset: number, depth: number): MsgpackNode {
  const entries: { key: MsgpackNode; value: MsgpackNode }[] = []
  for (let i = 0; i < n; i++) {
    const key = readItem(r, depth + 1)
    const value = readItem(r, depth + 1)
    entries.push({ key, value })
  }
  return { type: 'map', value: `map(${n} 對)`, offset, byteLength: r.pos - offset, entries }
}

/** 解 ext:type 為有號 int8;type === -1 為 timestamp 擴充。 */
function readExt(r: Reader, len: number, offset: number): MsgpackNode {
  const ts = need(r, 1)
  const extType = (r.b[ts] << 24) >> 24 // int8
  const s = need(r, len)
  if (extType === -1) {
    let sec: bigint
    let nsec = 0n
    if (len === 4) {
      sec = 0n
      for (let i = 0; i < 4; i++) sec = (sec << 8n) | BigInt(r.b[s + i])
    } else if (len === 8) {
      let v = 0n
      for (let i = 0; i < 8; i++) v = (v << 8n) | BigInt(r.b[s + i])
      nsec = v >> 34n
      sec = v & 0x3ffffffffn
    } else if (len === 12) {
      let n = 0n
      for (let i = 0; i < 4; i++) n = (n << 8n) | BigInt(r.b[s + i])
      nsec = n
      let v = 0n
      for (let i = 4; i < 12; i++) v = (v << 8n) | BigInt(r.b[s + i])
      sec = BigInt.asIntN(64, v)
    } else {
      return { type: 'ext', value: `ext type -1 但長度 ${len} 非法`, offset, byteLength: r.pos - offset, error: 'timestamp 長度非法' }
    }
    const ms = Number(sec) * 1000 + Number(nsec) / 1e6
    const iso = Number.isFinite(ms) ? new Date(ms).toISOString() : '(超出範圍)'
    return { type: 'timestamp', value: `${sec}.${nsec.toString().padStart(9, '0')} 秒 → ${iso}`, offset, byteLength: r.pos - offset }
  }
  return { type: 'ext', value: `ext type ${extType}(${len} 位元組)0x${bytesToHex(r.b, s, s + len)}`, offset, byteLength: r.pos - offset }
}

function readItem(r: Reader, depth: number): MsgpackNode {
  if (depth > 64) throw new MpError('巢狀過深')
  const offset = r.pos
  if (r.pos >= r.b.length) throw new MpError('資料提早結束')
  const c = r.b[r.pos++]

  if (c <= 0x7f) return { type: 'uint', value: String(c), offset, byteLength: 1 } // positive fixint
  if (c >= 0xe0) return { type: 'int', value: String(c - 256), offset, byteLength: 1 } // negative fixint
  if (c >= 0x80 && c <= 0x8f) return readMap(r, c & 0x0f, offset, depth) // fixmap
  if (c >= 0x90 && c <= 0x9f) return readArray(r, c & 0x0f, offset, depth) // fixarray
  if (c >= 0xa0 && c <= 0xbf) return readStr(r, c & 0x1f, offset) // fixstr

  switch (c) {
    case 0xc0: return { type: 'nil', value: 'nil', offset, byteLength: 1 }
    case 0xc1: throw new MpError('0xc1 為保留值(未使用)')
    case 0xc2: return { type: 'bool', value: 'false', offset, byteLength: 1 }
    case 0xc3: return { type: 'bool', value: 'true', offset, byteLength: 1 }
    case 0xc4: return readBin(r, Number(readUintBE(r, 1)), offset)
    case 0xc5: return readBin(r, Number(readUintBE(r, 2)), offset)
    case 0xc6: return readBin(r, Number(readUintBE(r, 4)), offset)
    case 0xc7: return readExt(r, Number(readUintBE(r, 1)), offset)
    case 0xc8: return readExt(r, Number(readUintBE(r, 2)), offset)
    case 0xc9: return readExt(r, Number(readUintBE(r, 4)), offset)
    case 0xca: { const s = need(r, 4); const f = new DataView(r.b.buffer, r.b.byteOffset + s, 4).getFloat32(0, false); return { type: 'float', value: String(f), offset, byteLength: r.pos - offset } }
    case 0xcb: { const s = need(r, 8); const f = new DataView(r.b.buffer, r.b.byteOffset + s, 8).getFloat64(0, false); return { type: 'float', value: String(f), offset, byteLength: r.pos - offset } }
    case 0xcc: return { type: 'uint', value: readUintBE(r, 1).toString(), offset, byteLength: r.pos - offset }
    case 0xcd: return { type: 'uint', value: readUintBE(r, 2).toString(), offset, byteLength: r.pos - offset }
    case 0xce: return { type: 'uint', value: readUintBE(r, 4).toString(), offset, byteLength: r.pos - offset }
    case 0xcf: return { type: 'uint', value: readUintBE(r, 8).toString(), offset, byteLength: r.pos - offset }
    case 0xd0: return { type: 'int', value: BigInt.asIntN(8, readUintBE(r, 1)).toString(), offset, byteLength: r.pos - offset }
    case 0xd1: return { type: 'int', value: BigInt.asIntN(16, readUintBE(r, 2)).toString(), offset, byteLength: r.pos - offset }
    case 0xd2: return { type: 'int', value: BigInt.asIntN(32, readUintBE(r, 4)).toString(), offset, byteLength: r.pos - offset }
    case 0xd3: return { type: 'int', value: BigInt.asIntN(64, readUintBE(r, 8)).toString(), offset, byteLength: r.pos - offset }
    case 0xd4: return readExt(r, 1, offset)
    case 0xd5: return readExt(r, 2, offset)
    case 0xd6: return readExt(r, 4, offset)
    case 0xd7: return readExt(r, 8, offset)
    case 0xd8: return readExt(r, 16, offset)
    case 0xd9: return readStr(r, Number(readUintBE(r, 1)), offset)
    case 0xda: return readStr(r, Number(readUintBE(r, 2)), offset)
    case 0xdb: return readStr(r, Number(readUintBE(r, 4)), offset)
    case 0xdc: return readArray(r, Number(readUintBE(r, 2)), offset, depth)
    case 0xdd: return readArray(r, Number(readUintBE(r, 4)), offset, depth)
    case 0xde: return readMap(r, Number(readUintBE(r, 2)), offset, depth)
    case 0xdf: return readMap(r, Number(readUintBE(r, 4)), offset, depth)
    default: throw new MpError(`未知的前置位元組 0x${c.toString(16)}`)
  }
}

/** 解碼 MessagePack 位元組;回頂層項目陣列(可含多個串接物件)。部分失敗回已解析 + error。 */
export function decodeMsgpack(bytes: Uint8Array): { items: MsgpackNode[]; error?: string } {
  if (!bytes || bytes.length === 0) return { items: [], error: '沒有位元組可解析' }
  const r: Reader = { b: bytes, pos: 0 }
  const items: MsgpackNode[] = []
  try {
    while (r.pos < bytes.length) items.push(readItem(r, 0))
  } catch (e) {
    return { items, error: e instanceof MpError ? e.message : '解析失敗' }
  }
  return { items }
}
