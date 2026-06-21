/*
  Bencode 解碼引擎(BitTorrent .torrent / DHT 用的編碼)—— 純函式、無 DOM 依賴(只用標準 TextDecoder),
  可在 Node 直接測試。把 bencode(原始文字 / hex / base64)拆成可讀的結構樹:整數、字串(二進位字串顯示為
  bytes)、清單、字典。看一個 .torrent 到底包含哪些檔案、連去哪些 tracker,不必開 BT 軟體;全程在你瀏覽器
  解析,不連網、不上傳。

  文法:整數 i<數字>e、字串 <長度>:<位元組>、清單 l…e、字典 d<鍵><值>…e。
*/
import { hexToBytes } from './baseEncode'
import { base64ToBytes } from './encodedWord'

export interface BencodeNode {
  type: 'int' | 'string' | 'bytes' | 'list' | 'dict'
  value: string
  offset: number // 在緩衝區中的起始位移
  byteLength: number
  children?: BencodeNode[] // list
  entries?: { key: string; value: BencodeNode }[] // dict
  error?: string
}

function bytesToHex(b: Uint8Array, start: number, end: number): string {
  let s = ''
  for (let i = start; i < end; i++) s += b[i].toString(16).padStart(2, '0')
  return s
}

class BenError extends Error {}
interface Reader { b: Uint8Array; pos: number }

const DIGIT0 = 0x30
const DIGIT9 = 0x39

/** 嘗試把位元組解成可讀文字;含控制字元或非法 UTF-8 回 null(視為二進位)。 */
function tryText(b: Uint8Array, start: number, end: number): string | null {
  if (start === end) return ''
  let str: string
  try {
    str = new TextDecoder('utf-8', { fatal: true }).decode(b.subarray(start, end))
  } catch {
    return null
  }
  for (const ch of str) {
    const c = ch.codePointAt(0) as number
    if (c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) return null
  }
  return str
}

/** 讀一個 bencode 字串,回起訖(供 key 與 value 共用)。 */
function readString(r: Reader): { start: number; end: number } {
  const numStart = r.pos
  while (r.pos < r.b.length && r.b[r.pos] >= DIGIT0 && r.b[r.pos] <= DIGIT9) r.pos++
  if (r.pos === numStart) throw new BenError('字串缺少長度數字')
  if (r.pos >= r.b.length || r.b[r.pos] !== 0x3a) throw new BenError("字串長度後缺少 ':'")
  const lenStr = new TextDecoder().decode(r.b.subarray(numStart, r.pos))
  // 不允許前導零(除 "0")
  if (lenStr.length > 1 && lenStr[0] === '0') throw new BenError('字串長度不可有前導零')
  r.pos++ // 跳過 ':'
  const len = Number(lenStr)
  if (r.pos + len > r.b.length) throw new BenError('字串長度超出資料範圍')
  const start = r.pos
  r.pos += len
  return { start, end: r.pos }
}

function readValue(r: Reader, depth: number): BencodeNode {
  if (depth > 64) throw new BenError('巢狀過深')
  if (r.pos >= r.b.length) throw new BenError('資料提早結束')
  const offset = r.pos
  const c = r.b[r.pos]

  if (c === 0x69) { // 'i' 整數
    r.pos++
    const s = r.pos
    while (r.pos < r.b.length && r.b[r.pos] !== 0x65) r.pos++
    if (r.pos >= r.b.length) throw new BenError("整數缺少結尾 'e'")
    const text = new TextDecoder().decode(r.b.subarray(s, r.pos))
    r.pos++ // 'e'
    if (!/^-?\d+$/.test(text)) throw new BenError(`整數格式非法:${text}`)
    if (text === '-0' || (text.length > 1 && text[0] === '0') || (text.length > 2 && text.startsWith('-0')))
      throw new BenError(`整數格式非法(前導零):${text}`)
    return { type: 'int', value: BigInt(text).toString(), offset, byteLength: r.pos - offset }
  }

  if (c >= DIGIT0 && c <= DIGIT9) { // 字串
    const { start, end } = readString(r)
    const text = tryText(r.b, start, end)
    const len = end - start
    if (text !== null) return { type: 'string', value: `"${text}"`, offset, byteLength: r.pos - offset }
    const preview = bytesToHex(r.b, start, Math.min(end, start + 20))
    return { type: 'bytes', value: `(${len} 位元組二進位)0x${preview}${len > 20 ? '…' : ''}`, offset, byteLength: r.pos - offset }
  }

  if (c === 0x6c) { // 'l' 清單
    r.pos++
    const children: BencodeNode[] = []
    while (r.pos < r.b.length && r.b[r.pos] !== 0x65) children.push(readValue(r, depth + 1))
    if (r.pos >= r.b.length) throw new BenError("清單缺少結尾 'e'")
    r.pos++ // 'e'
    return { type: 'list', value: `清單(${children.length} 項)`, offset, byteLength: r.pos - offset, children }
  }

  if (c === 0x64) { // 'd' 字典
    r.pos++
    const entries: { key: string; value: BencodeNode }[] = []
    while (r.pos < r.b.length && r.b[r.pos] !== 0x65) {
      const kc = r.b[r.pos]
      if (kc < DIGIT0 || kc > DIGIT9) throw new BenError('字典的鍵必須是字串')
      const ks = readString(r)
      const key = new TextDecoder('utf-8', { fatal: false }).decode(r.b.subarray(ks.start, ks.end))
      const value = readValue(r, depth + 1)
      entries.push({ key, value })
    }
    if (r.pos >= r.b.length) throw new BenError("字典缺少結尾 'e'")
    r.pos++ // 'e'
    return { type: 'dict', value: `字典(${entries.length} 個鍵)`, offset, byteLength: r.pos - offset, entries }
  }

  throw new BenError(`未預期的位元組 0x${c.toString(16)}('${String.fromCharCode(c)}')`)
}

/** 解碼 bencode 位元組;回頂層值。尾端有多餘位元組會在 error 標示(但仍回已解析節點)。 */
export function decodeBencode(bytes: Uint8Array): { node: BencodeNode | null; error?: string; trailing: number } {
  if (!bytes || bytes.length === 0) return { node: null, error: '沒有位元組可解析', trailing: 0 }
  const r: Reader = { b: bytes, pos: 0 }
  let node: BencodeNode
  try {
    node = readValue(r, 0)
  } catch (e) {
    return { node: null, error: e instanceof BenError ? e.message : '解析失敗', trailing: 0 }
  }
  const trailing = bytes.length - r.pos
  return { node, error: trailing > 0 ? `尾端有 ${trailing} 個多餘位元組` : undefined, trailing }
}

/** 把原始 bencode 文字 / hex / base64 轉成位元組;以「能否乾淨解析」挑選格式。 */
export function parseBencodeInput(text: string): { bytes: Uint8Array | null; format: string; error?: string } {
  const raw = (text || '').trim()
  if (!raw) return { bytes: null, format: '', error: '請貼上 bencode 文字、hex 或 base64' }
  const candidates: { bytes: Uint8Array; format: string }[] = []
  // 1) 原始 bencode 文字(UTF-8 位元組)
  candidates.push({ bytes: new TextEncoder().encode(raw), format: 'bencode 文字' })
  // 2) hex
  if (/^(0x)?[0-9a-f\s]+$/i.test(raw)) {
    const h = hexToBytes(raw)
    if (h && h.length) candidates.push({ bytes: h, format: 'hex' })
  }
  // 3) base64
  if (/^[A-Za-z0-9+/_=-\s]+$/.test(raw)) {
    const b = base64ToBytes(raw.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, ''))
    if (b.length) candidates.push({ bytes: b, format: 'base64' })
  }
  // 挑第一個能乾淨(無 error、無尾端多餘)解析的;否則挑第一個無 error;再否則第一個
  for (const c of candidates) {
    const r = decodeBencode(c.bytes)
    if (r.node && !r.error) return { bytes: c.bytes, format: c.format }
  }
  for (const c of candidates) {
    const r = decodeBencode(c.bytes)
    if (r.node) return { bytes: c.bytes, format: c.format }
  }
  return { bytes: candidates[0].bytes, format: candidates[0].format }
}
