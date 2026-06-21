/*
  Protobuf 二進位(wire format)解碼引擎 —— 純函式、無 DOM 依賴(只用標準 TextDecoder / DataView),
  可在 Node 直接測試。把沒有 .proto schema 的 protobuf 位元組(hex / base64),依 wire format 拆成
  「欄位編號 + wire type + 值」的結構樹,等同 `protoc --decode_raw`,但全程在你瀏覽器、不上傳。

  wire type:0=varint、1=64-bit(fixed64/double)、2=length-delimited(字串/bytes/巢狀訊息)、
  5=32-bit(fixed32/float)。length-delimited 會嘗試遞迴解成巢狀訊息,失敗則當字串 / bytes。
*/
import { hexToBytes } from './baseEncode'
import { base64ToBytes } from './encodedWord'

export interface ProtoNode {
  fieldNumber: number
  wireType: number
  wireTypeName: string
  offset: number // tag 起始位移
  byteLength: number // 整個欄位(tag+payload)位元組數
  value: string // 主要可讀值
  alt?: string[] // 其他可能的詮釋(有號 / zigzag / float…)
  asString?: string // length-delimited 同時可當字串時的字串詮釋
  children?: ProtoNode[] // 巢狀訊息
  error?: string
}

const WIRE_NAMES: Record<number, string> = {
  0: 'varint', 1: '64-bit', 2: 'len', 3: 'start group', 4: 'end group', 5: '32-bit',
}

const MAX_DEPTH = 24
const U64 = (1n << 64n) - 1n

/** 把 hex / base64 文字轉成 protobuf 位元組。 */
export function parseProtoInput(text: string): { bytes: Uint8Array | null; format: string; error?: string } {
  const raw = (text || '').trim()
  if (!raw) return { bytes: null, format: '', error: '請貼上 hex 或 base64 的 protobuf 位元組' }
  // hex:只含 hex 字元(允許空白與 0x)。優先,因 hex 也合於 base64 字元集。
  if (/^(0x)?[0-9a-f\s]+$/i.test(raw)) {
    const h = hexToBytes(raw)
    if (h && h.length) return { bytes: h, format: 'hex' }
  }
  // base64 / base64url
  if (/^[A-Za-z0-9+/_=-\s]+$/.test(raw)) {
    const b = base64ToBytes(raw.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, ''))
    if (b.length) return { bytes: b, format: 'base64' }
  }
  return { bytes: null, format: '', error: '無法辨識輸入格式(請用 hex 或 base64)' }
}

/** 讀一個 varint(最多 10 位元組),回 64 位元無號值與下一個位移;截斷或過長回 null。 */
function readVarint(b: Uint8Array, pos: number): { value: bigint; next: number } | null {
  let shift = 0n
  let result = 0n
  let p = pos
  for (let i = 0; i < 10; i++) {
    if (p >= b.length) return null
    const byte = b[p++]
    result |= BigInt(byte & 0x7f) << shift
    shift += 7n
    if ((byte & 0x80) === 0) return { value: result & U64, next: p }
  }
  return null
}

function bytesToHex(b: Uint8Array, start: number, end: number): string {
  let s = ''
  for (let i = start; i < end; i++) s += b[i].toString(16).padStart(2, '0')
  return s
}

/** 無號 64 位元 → 二補數有號。 */
function toSigned64(u: bigint): bigint {
  return u >= 1n << 63n ? u - (1n << 64n) : u
}

/** zigzag 解碼(sint32/sint64 用)。 */
function zigzag(u: bigint): bigint {
  return (u >> 1n) ^ -(u & 1n)
}

/** 判斷一段位元組是否「看起來像」可讀文字(供 length-delimited 詮釋)。 */
function tryUtf8(b: Uint8Array, start: number, end: number): string | null {
  if (start === end) return ''
  let str: string
  try {
    str = new TextDecoder('utf-8', { fatal: true }).decode(b.subarray(start, end))
  } catch {
    return null
  }
  // 含控制字元(除常見空白)就不視為純文字
  for (const ch of str) {
    const c = ch.codePointAt(0) as number
    if (c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) return null
  }
  return str
}

interface ParseResult { nodes: ProtoNode[]; ok: boolean; error?: string }

/** 解析一段位元組為 protobuf 訊息;ok=false 表示這段不是合法 protobuf。 */
function parseMessage(b: Uint8Array, start: number, end: number, depth: number): ParseResult {
  const nodes: ProtoNode[] = []
  let pos = start
  while (pos < end) {
    const offset = pos
    const tag = readVarint(b, pos)
    if (!tag) return { nodes, ok: false, error: '欄位標頭(tag)不完整' }
    const fieldNumber = Number(tag.value >> 3n)
    const wireType = Number(tag.value & 7n)
    if (fieldNumber < 1) return { nodes, ok: false, error: `非法欄位編號 ${fieldNumber}` }
    pos = tag.next
    const node: ProtoNode = {
      fieldNumber, wireType, wireTypeName: WIRE_NAMES[wireType] || `未知(${wireType})`,
      offset, byteLength: 0, value: '',
    }
    if (wireType === 0) {
      const v = readVarint(b, pos)
      if (!v) return { nodes, ok: false, error: 'varint 值不完整' }
      const u = v.value
      node.value = u.toString()
      const alt: string[] = []
      const s = toSigned64(u)
      if (s !== u) alt.push(`有號 int64:${s}`)
      const zz = zigzag(u)
      if (zz.toString() !== u.toString()) alt.push(`sint(zigzag):${zz}`)
      if (u === 0n || u === 1n) alt.push(`bool:${u === 1n ? 'true' : 'false'}`)
      if (alt.length) node.alt = alt
      pos = v.next
    } else if (wireType === 1) {
      if (pos + 8 > end) return { nodes, ok: false, error: '64-bit 值不足 8 位元組' }
      const dv = new DataView(b.buffer, b.byteOffset + pos, 8)
      const u = dv.getBigUint64(0, true)
      node.value = `0x${bytesToHex(b, pos, pos + 8)}`
      node.alt = [
        `uint64:${u}`,
        `int64:${BigInt.asIntN(64, u)}`,
        `double:${dv.getFloat64(0, true)}`,
      ]
      pos += 8
    } else if (wireType === 2) {
      const len = readVarint(b, pos)
      if (!len) return { nodes, ok: false, error: 'length-delimited 長度不完整' }
      const L = Number(len.value)
      const dataStart = len.next
      if (L < 0 || dataStart + L > end) return { nodes, ok: false, error: 'length-delimited 內容超出範圍' }
      const dataEnd = dataStart + L
      // 嘗試遞迴解成巢狀訊息
      let nested: ParseResult | null = null
      if (L > 0 && depth < MAX_DEPTH) {
        const r = parseMessage(b, dataStart, dataEnd, depth + 1)
        if (r.ok && r.nodes.length > 0) nested = r
      }
      const str = tryUtf8(b, dataStart, dataEnd)
      if (nested) {
        node.children = nested.nodes
        node.value = `訊息(${L} 位元組)`
        if (str !== null && str !== '') node.asString = str
      } else if (str !== null) {
        node.value = L === 0 ? '空字串' : `"${str}"`
      } else {
        node.value = `${L} 位元組:0x${bytesToHex(b, dataStart, Math.min(dataEnd, dataStart + 16))}${L > 16 ? '…' : ''}`
      }
      pos = dataEnd
    } else if (wireType === 5) {
      if (pos + 4 > end) return { nodes, ok: false, error: '32-bit 值不足 4 位元組' }
      const dv = new DataView(b.buffer, b.byteOffset + pos, 4)
      const u = dv.getUint32(0, true)
      node.value = `0x${bytesToHex(b, pos, pos + 4)}`
      node.alt = [
        `uint32:${u}`,
        `int32:${dv.getInt32(0, true)}`,
        `float:${dv.getFloat32(0, true)}`,
      ]
      pos += 4
    } else {
      // wire type 3/4(已棄用的 group)或非法 → 視為無法解析
      return { nodes, ok: false, error: `不支援的 wire type ${wireType}(group 已棄用)` }
    }
    node.byteLength = pos - offset
    nodes.push(node)
  }
  return { nodes, ok: true }
}

/** 解碼整段 protobuf 位元組。部分解析失敗會回已解析節點 + error(類似 asn1)。 */
export function decodeProto(bytes: Uint8Array): { nodes: ProtoNode[]; error?: string } {
  if (!bytes || bytes.length === 0) return { nodes: [], error: '沒有位元組可解析' }
  const r = parseMessage(bytes, 0, bytes.length, 0)
  return { nodes: r.nodes, error: r.ok ? undefined : r.error }
}
