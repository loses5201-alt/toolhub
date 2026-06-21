/*
  Apple Property List(plist)解析引擎 —— 純函式、無 DOM 依賴(只用標準 TextDecoder / DataView),
  可在 Node 直接測試。支援兩種格式:

  1. 二進位 plist(bplist00):iOS / macOS 的 App 偏好設定(*.plist)、iCloud 備份、NSKeyedArchiver
     封存、描述檔(.mobileconfig 的內層)常用二進位編碼,文字編輯器打開只會看到亂碼。
  2. XML plist(<?xml … <!DOCTYPE plist …):較舊或可讀的設定檔。

  把任一種拆成可讀的結構樹(dict / array / string / int / real / bool / data / date / uid),
  並能一鍵轉乾淨 JSON。plist 常含帳號、權杖、裝置識別碼等隱私,線上解碼器卻要你上傳 ——
  本工具全程在你瀏覽器解析,不連網、不上傳。
*/
import { hexToBytes, bytesToHex } from './baseEncode'
import { base64ToBytes } from './encodedWord'

export interface PlistNode {
  type: string // dict / array / string / int / real / bool / data / date / uid / null
  value: string // 主要可讀值
  children?: PlistNode[] // array / set
  entries?: { key: string; value: PlistNode }[] // dict
  raw?: unknown // 供 plistToJson 使用的原值
  error?: string
}

// 2001-01-01T00:00:00Z 相對 Unix epoch 的秒數(Apple 絕對時間基準)
const APPLE_EPOCH = 978307200

class PlistError extends Error {}

/* ---------- 二進位 plist(bplist00) ---------- */

function readUintBE(b: Uint8Array, pos: number, n: number): number {
  let v = 0
  for (let i = 0; i < n; i++) v = v * 256 + b[pos + i]
  return v
}

function dataPreview(b: Uint8Array, start: number, len: number): string {
  const cap = Math.min(len, 32)
  const hex = bytesToHex(b.subarray(start, start + cap))
  return `${len} 位元組${hex ? ` h'${hex}${len > cap ? '…' : ''}'` : ''}`
}

/** 解碼二進位 plist 位元組,回頂層節點。 */
export function decodeBinaryPlist(bytes: Uint8Array): { root: PlistNode | null; error?: string } {
  if (!bytes || bytes.length < 40) return { root: null, error: '資料太短,不像二進位 plist' }
  const header = String.fromCharCode(...bytes.subarray(0, 6))
  if (header !== 'bplist') return { root: null, error: '缺少 bplist 標頭,不是二進位 plist' }

  const trailer = bytes.length - 32
  const offsetIntSize = bytes[trailer + 6]
  const objectRefSize = bytes[trailer + 7]
  const numObjects = readUintBE(bytes, trailer + 8, 8)
  const topObject = readUintBE(bytes, trailer + 16, 8)
  const offsetTableOffset = readUintBE(bytes, trailer + 24, 8)
  if (!offsetIntSize || !objectRefSize) return { root: null, error: 'trailer 欄位異常(整數寬度為 0)' }
  if (numObjects <= 0 || numObjects > 5_000_000) return { root: null, error: `物件數量異常(${numObjects})` }

  // 讀偏移表
  const offsets: number[] = []
  for (let i = 0; i < numObjects; i++) {
    const p = offsetTableOffset + i * offsetIntSize
    if (p + offsetIntSize > trailer) return { root: null, error: '偏移表超出資料範圍' }
    offsets.push(readUintBE(bytes, p, offsetIntSize))
  }

  const seen = new Set<number>()

  function readSized(low: number, pos: number): { count: number; dataPos: number } {
    if (low !== 0xf) return { count: low, dataPos: pos }
    // 0xf:下一個物件是 int 標記,給出真正長度
    const marker = bytes[pos]
    if (marker >> 4 !== 0x1) throw new PlistError('長度欄位格式錯誤')
    const intLen = 1 << (marker & 0xf)
    const count = readUintBE(bytes, pos + 1, intLen)
    return { count, dataPos: pos + 1 + intLen }
  }

  function parseObject(index: number, depth: number): PlistNode {
    if (depth > 100) throw new PlistError('巢狀過深')
    if (index < 0 || index >= numObjects) throw new PlistError(`物件索引超出範圍(${index})`)
    if (seen.has(index)) return { type: 'ref', value: `↺ 重複參照物件 #${index}` }
    seen.add(index)
    let pos = offsets[index]
    if (pos >= trailer) throw new PlistError('物件偏移超出資料範圍')
    const marker = bytes[pos]
    const high = marker >> 4
    const low = marker & 0xf
    pos++

    let node: PlistNode
    switch (high) {
      case 0x0: { // 特殊值
        if (low === 0x0) node = { type: 'null', value: 'null', raw: null }
        else if (low === 0x8) node = { type: 'bool', value: 'false', raw: false }
        else if (low === 0x9) node = { type: 'bool', value: 'true', raw: true }
        else if (low === 0xf) node = { type: 'null', value: '(fill)', raw: null }
        else node = { type: 'simple', value: `保留值 0x${marker.toString(16)}` }
        break
      }
      case 0x1: { // int,1<<low 位元組
        const n = 1 << low
        let v = 0n
        for (let i = 0; i < n; i++) v = (v << 8n) | BigInt(bytes[pos + i])
        if (n >= 8) v = BigInt.asIntN(n * 8, v) // 8 / 16 位元組為帶號
        node = { type: 'int', value: v.toString(), raw: v }
        break
      }
      case 0x2: { // real,4 或 8 位元組
        const n = 1 << low
        const dv = new DataView(bytes.buffer, bytes.byteOffset + pos, n)
        const f = n === 4 ? dv.getFloat32(0, false) : dv.getFloat64(0, false)
        node = { type: 'real', value: String(f), raw: f }
        break
      }
      case 0x3: { // date,8 位元組 float64(Apple 絕對時間)
        const dv = new DataView(bytes.buffer, bytes.byteOffset + pos, 8)
        const sec = dv.getFloat64(0, false)
        const iso = new Date((sec + APPLE_EPOCH) * 1000).toISOString()
        node = { type: 'date', value: iso, raw: iso }
        break
      }
      case 0x4: { // data
        const { count, dataPos } = readSized(low, pos)
        node = { type: 'data', value: dataPreview(bytes, dataPos, count), raw: bytesToHex(bytes.subarray(dataPos, dataPos + count)) }
        break
      }
      case 0x5: { // ASCII string
        const { count, dataPos } = readSized(low, pos)
        let s = ''
        for (let i = 0; i < count; i++) s += String.fromCharCode(bytes[dataPos + i])
        node = { type: 'string', value: `"${s}"`, raw: s }
        break
      }
      case 0x6: { // UTF-16BE string,count = 碼元數
        const { count, dataPos } = readSized(low, pos)
        const s = new TextDecoder('utf-16be').decode(bytes.subarray(dataPos, dataPos + count * 2))
        node = { type: 'string', value: `"${s}"`, raw: s }
        break
      }
      case 0x8: { // UID(NSKeyedArchiver 的 CF$UID)
        const n = low + 1
        const v = readUintBE(bytes, pos, n)
        node = { type: 'uid', value: `UID(${v})`, raw: { 'CF$UID': v } }
        break
      }
      case 0xa: // array
      case 0xc: { // set
        const { count, dataPos } = readSized(low, pos)
        const children: PlistNode[] = []
        const arr: unknown[] = []
        for (let i = 0; i < count; i++) {
          const ref = readUintBE(bytes, dataPos + i * objectRefSize, objectRefSize)
          const child = parseObject(ref, depth + 1)
          children.push(child)
          arr.push(child.raw)
        }
        const label = high === 0xc ? 'set' : 'array'
        node = { type: 'array', value: `${label}(${count} 項)`, children, raw: arr }
        break
      }
      case 0xd: { // dict
        const { count, dataPos } = readSized(low, pos)
        const entries: { key: string; value: PlistNode }[] = []
        const obj: Record<string, unknown> = {}
        const keyBase = dataPos
        const valBase = dataPos + count * objectRefSize
        for (let i = 0; i < count; i++) {
          const keyRef = readUintBE(bytes, keyBase + i * objectRefSize, objectRefSize)
          const valRef = readUintBE(bytes, valBase + i * objectRefSize, objectRefSize)
          const keyNode = parseObject(keyRef, depth + 1)
          const keyStr = keyNode.type === 'string' ? String(keyNode.raw) : keyNode.value
          const valNode = parseObject(valRef, depth + 1)
          entries.push({ key: keyStr, value: valNode })
          obj[keyStr] = valNode.raw
        }
        node = { type: 'dict', value: `dict(${count} 對)`, entries, raw: obj }
        break
      }
      default:
        node = { type: 'unknown', value: `未知標記 0x${marker.toString(16)}` }
    }
    seen.delete(index)
    return node
  }

  try {
    const root = parseObject(topObject, 0)
    return { root }
  } catch (e) {
    return { root: null, error: e instanceof PlistError ? e.message : '解析失敗' }
  }
}

/* ---------- XML plist ---------- */

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

interface XmlTok { kind: 'open' | 'close' | 'self' | 'text'; name?: string; text?: string }

function tokenizeXml(s: string): XmlTok[] {
  const toks: XmlTok[] = []
  let i = 0
  while (i < s.length) {
    if (s[i] === '<') {
      if (s.startsWith('<!--', i)) { const e = s.indexOf('-->', i); i = e < 0 ? s.length : e + 3; continue }
      if (s.startsWith('<?', i)) { const e = s.indexOf('?>', i); i = e < 0 ? s.length : e + 2; continue }
      if (s.startsWith('<!', i)) { const e = s.indexOf('>', i); i = e < 0 ? s.length : e + 1; continue }
      const e = s.indexOf('>', i)
      if (e < 0) break
      let inner = s.slice(i + 1, e).trim()
      const self = inner.endsWith('/')
      if (self) inner = inner.slice(0, -1).trim()
      const closing = inner.startsWith('/')
      if (closing) inner = inner.slice(1).trim()
      const name = inner.split(/[\s]/)[0].toLowerCase()
      toks.push({ kind: closing ? 'close' : self ? 'self' : 'open', name })
      i = e + 1
    } else {
      const e = s.indexOf('<', i)
      const text = s.slice(i, e < 0 ? s.length : e)
      if (text.trim()) toks.push({ kind: 'text', text })
      i = e < 0 ? s.length : e
    }
  }
  return toks
}

/** 解析 XML plist 文字,回頂層節點。 */
export function parseXmlPlist(text: string): { root: PlistNode | null; error?: string } {
  const toks = tokenizeXml(text)
  let p = 0
  const SCALAR = new Set(['string', 'integer', 'real', 'data', 'date', 'true', 'false', 'key'])

  function parseValue(): PlistNode {
    if (p >= toks.length) throw new PlistError('內容提前結束')
    const t = toks[p]
    if (t.kind === 'self') {
      p++
      if (t.name === 'true') return { type: 'bool', value: 'true', raw: true }
      if (t.name === 'false') return { type: 'bool', value: 'false', raw: false }
      if (t.name === 'dict') return { type: 'dict', value: 'dict(0 對)', entries: [], raw: {} }
      if (t.name === 'array') return { type: 'array', value: 'array(0 項)', children: [], raw: [] }
      if (t.name === 'string') return { type: 'string', value: '""', raw: '' }
      throw new PlistError(`未預期的自閉合 <${t.name}/>`)
    }
    if (t.kind !== 'open') throw new PlistError(`未預期的標記 ${t.name || ''}`)
    const name = t.name!
    p++
    if (name === 'dict') {
      const entries: { key: string; value: PlistNode }[] = []
      const obj: Record<string, unknown> = {}
      while (p < toks.length && !(toks[p].kind === 'close' && toks[p].name === 'dict')) {
        const k = readScalar('key')
        const v = parseValue()
        entries.push({ key: k, value: v })
        obj[k] = v.raw
      }
      p++ // </dict>
      return { type: 'dict', value: `dict(${entries.length} 對)`, entries, raw: obj }
    }
    if (name === 'array') {
      const children: PlistNode[] = []
      const arr: unknown[] = []
      while (p < toks.length && !(toks[p].kind === 'close' && toks[p].name === 'array')) {
        const v = parseValue()
        children.push(v)
        arr.push(v.raw)
      }
      p++ // </array>
      return { type: 'array', value: `array(${children.length} 項)`, children, raw: arr }
    }
    if (SCALAR.has(name)) {
      p-- // 退回給 readScalar 統一處理
      const raw = readScalar(name)
      switch (name) {
        case 'string': return { type: 'string', value: `"${raw}"`, raw }
        case 'integer': { const v = BigInt(raw.trim() || '0'); return { type: 'int', value: v.toString(), raw: v } }
        case 'real': { const f = Number(raw.trim()); return { type: 'real', value: String(f), raw: f } }
        case 'date': return { type: 'date', value: raw.trim(), raw: raw.trim() }
        case 'data': { const hex = bytesToHex(base64ToBytes(raw.replace(/\s+/g, ''))); return { type: 'data', value: dataHexLabel(hex), raw: hex } }
      }
    }
    throw new PlistError(`未知的 plist 元素 <${name}>`)
  }

  // 讀取純量元素的文字內容;expect 為預期標籤名
  function readScalar(expect: string): string {
    const open = toks[p]
    if (!open || open.kind === 'close') throw new PlistError(`預期 <${expect}> 但未出現`)
    if (open.kind === 'self') { p++; return '' }
    if (open.kind !== 'open' || open.name !== expect) throw new PlistError(`預期 <${expect}> 但遇到 <${open.name}>`)
    p++
    let txt = ''
    while (p < toks.length && toks[p].kind === 'text') { txt += toks[p].text; p++ }
    if (p < toks.length && toks[p].kind === 'close' && toks[p].name === expect) p++
    else throw new PlistError(`<${expect}> 未正確結束`)
    return decodeEntities(txt)
  }

  try {
    // 找到 <plist> 內的第一個值
    while (p < toks.length && !(toks[p].kind === 'open' && toks[p].name === 'plist')) p++
    if (p >= toks.length) throw new PlistError('找不到 <plist> 根元素')
    p++
    const root = parseValue()
    return { root }
  } catch (e) {
    return { root: null, error: e instanceof PlistError ? e.message : '解析失敗' }
  }
}

function dataHexLabel(hex: string): string {
  const bytes = hex.length / 2
  const cap = 64
  return `${bytes} 位元組${hex ? ` h'${hex.slice(0, cap)}${hex.length > cap ? '…' : ''}'` : ''}`
}

/* ---------- 統一入口 ---------- */

/** 從貼上的文字判斷格式並解析(XML 文字、或二進位 plist 的 hex / base64)。 */
export function parsePlistText(text: string): { root: PlistNode | null; format: string; error?: string } {
  const raw = (text || '').trim()
  if (!raw) return { root: null, format: '', error: '請貼上 plist 內容' }
  if (raw.includes('<plist') || raw.includes('<?xml')) {
    const r = parseXmlPlist(raw)
    return { root: r.root, format: 'XML plist', error: r.error }
  }
  // 嘗試 hex
  if (/^(0x)?[0-9a-f\s]+$/i.test(raw)) {
    const h = hexToBytes(raw)
    if (h && h.length) { const r = decodeBinaryPlist(h); return { root: r.root, format: '二進位 plist', error: r.error } }
  }
  // 嘗試 base64
  if (/^[A-Za-z0-9+/_=\s]+$/.test(raw)) {
    const b = base64ToBytes(raw.replace(/\s+/g, ''))
    if (b.length) { const r = decodeBinaryPlist(b); return { root: r.root, format: '二進位 plist', error: r.error } }
  }
  return { root: null, format: '', error: '無法辨識內容(請貼 XML plist 文字,或二進位 plist 的 hex / base64)' }
}

/** 從檔案位元組解析(自動判斷二進位 / XML)。 */
export function parsePlistBytes(bytes: Uint8Array): { root: PlistNode | null; format: string; error?: string } {
  if (bytes.length >= 6 && String.fromCharCode(...bytes.subarray(0, 6)) === 'bplist') {
    const r = decodeBinaryPlist(bytes)
    return { root: r.root, format: '二進位 plist', error: r.error }
  }
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  const r = parseXmlPlist(text)
  return { root: r.root, format: 'XML plist', error: r.error }
}

/** 把解析結果轉成可序列化的乾淨 JSON 值。 */
export function plistToJson(node: PlistNode): unknown {
  return node.raw
}
