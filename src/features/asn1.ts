/*
  ASN.1 / DER 解碼引擎 —— 純函式、無 DOM 依賴(只用標準 TextDecoder),可在 Node 直接測試。
  把 X.509 憑證 / 公私鑰 / CSR 等 DER 編碼(PEM、base64 或 hex)解析成可讀的 TLV 結構樹,
  並對常見 OID(簽章演算法、公鑰型別、Distinguished Name 屬性、憑證擴充)標上名稱。
  全程在你的瀏覽器解析,憑證 / 金鑰不連網、不上傳。

  支援 DER 短式/長式長度;不支援 BER 不定長度(0x80)會明確標錯。
*/
import { hexToBytes } from './baseEncode'
import { base64ToBytes } from './encodedWord'

export interface Asn1Node {
  tagClass: 'universal' | 'application' | 'context' | 'private'
  constructed: boolean
  tagNumber: number
  tagName: string
  offset: number // 在緩衝區中的起始位移(tag byte)
  headerLength: number // tag + length 位元組數
  length: number // 內容位元組數
  valueHex: string // 內容 hex(原始基本型別用)
  value?: string // 解碼後可讀值(OID 名稱、整數、字串、布林…)
  children?: Asn1Node[]
  error?: string
}

const UNIVERSAL: Record<number, string> = {
  0x00: 'EOC', 0x01: 'BOOLEAN', 0x02: 'INTEGER', 0x03: 'BIT STRING',
  0x04: 'OCTET STRING', 0x05: 'NULL', 0x06: 'OBJECT IDENTIFIER', 0x07: 'ObjectDescriptor',
  0x09: 'REAL', 0x0a: 'ENUMERATED', 0x0c: 'UTF8String', 0x10: 'SEQUENCE', 0x11: 'SET',
  0x12: 'NumericString', 0x13: 'PrintableString', 0x14: 'T61String', 0x16: 'IA5String',
  0x17: 'UTCTime', 0x18: 'GeneralizedTime', 0x1a: 'VisibleString', 0x1b: 'GeneralString',
  0x1c: 'UniversalString', 0x1e: 'BMPString',
}

const OID_NAMES: Record<string, string> = {
  '1.2.840.113549.1.1.1': 'rsaEncryption',
  '1.2.840.113549.1.1.5': 'sha1WithRSAEncryption',
  '1.2.840.113549.1.1.11': 'sha256WithRSAEncryption',
  '1.2.840.113549.1.1.12': 'sha384WithRSAEncryption',
  '1.2.840.113549.1.1.13': 'sha512WithRSAEncryption',
  '1.2.840.113549.1.1.10': 'rsassaPss',
  '1.2.840.10045.2.1': 'ecPublicKey',
  '1.2.840.10045.4.3.2': 'ecdsaWithSHA256',
  '1.2.840.10045.4.3.3': 'ecdsaWithSHA384',
  '1.2.840.10045.3.1.7': 'prime256v1 (P-256)',
  '1.3.132.0.34': 'secp384r1 (P-384)',
  '1.3.132.0.35': 'secp521r1 (P-521)',
  '1.3.101.112': 'Ed25519',
  '1.3.101.110': 'X25519',
  '2.5.4.3': 'commonName (CN)',
  '2.5.4.4': 'surname',
  '2.5.4.5': 'serialNumber',
  '2.5.4.6': 'countryName (C)',
  '2.5.4.7': 'localityName (L)',
  '2.5.4.8': 'stateOrProvinceName (ST)',
  '2.5.4.9': 'streetAddress',
  '2.5.4.10': 'organizationName (O)',
  '2.5.4.11': 'organizationalUnitName (OU)',
  '2.5.4.12': 'title',
  '1.2.840.113549.1.9.1': 'emailAddress',
  '0.9.2342.19200300.100.1.25': 'domainComponent (DC)',
  '2.5.29.14': 'subjectKeyIdentifier',
  '2.5.29.15': 'keyUsage',
  '2.5.29.17': 'subjectAltName',
  '2.5.29.19': 'basicConstraints',
  '2.5.29.31': 'cRLDistributionPoints',
  '2.5.29.32': 'certificatePolicies',
  '2.5.29.35': 'authorityKeyIdentifier',
  '2.5.29.37': 'extKeyUsage',
  '1.3.6.1.5.5.7.1.1': 'authorityInfoAccess',
  '1.3.6.1.5.5.7.3.1': 'serverAuth',
  '1.3.6.1.5.5.7.3.2': 'clientAuth',
}

export function oidName(oid: string): string {
  return OID_NAMES[oid] || ''
}

/** 把 PEM / base64 / hex 文字轉成 DER 位元組。 */
export function parseDerInput(text: string): { bytes: Uint8Array | null; format: string; error?: string } {
  const raw = (text || '').trim()
  if (!raw) return { bytes: null, format: '', error: '請貼上 PEM / base64 / hex' }
  // PEM:抽出 BEGIN/END 之間的 base64
  const pem = raw.match(/-----BEGIN [^-]+-----([\s\S]*?)-----END [^-]+-----/)
  if (pem) {
    const b = base64ToBytes(pem[1].replace(/\s+/g, ''))
    return b.length ? { bytes: b, format: 'PEM' } : { bytes: null, format: 'PEM', error: 'PEM 內容無法解碼' }
  }
  // hex:只含 hex 字元(允許空白與 0x)
  if (/^(0x)?[0-9a-f\s]+$/i.test(raw)) {
    const h = hexToBytes(raw)
    if (h && h.length) return { bytes: h, format: 'hex' }
  }
  // base64
  if (/^[A-Za-z0-9+/=\s]+$/.test(raw)) {
    const b = base64ToBytes(raw.replace(/\s+/g, ''))
    if (b.length) return { bytes: b, format: 'base64' }
  }
  return { bytes: null, format: '', error: '無法辨識輸入格式(請用 PEM / base64 / hex)' }
}

function bytesToHex(b: Uint8Array, start: number, end: number): string {
  let s = ''
  for (let i = start; i < end; i++) s += b[i].toString(16).padStart(2, '0')
  return s
}

/** 解碼 OID 內容位元組成點分字串。 */
export function decodeOid(b: Uint8Array, start: number, end: number): string {
  if (start >= end) return ''
  const first = b[start]
  const parts = [Math.floor(first / 40), first % 40]
  let val = 0
  for (let i = start + 1; i < end; i++) {
    val = val * 128 + (b[i] & 0x7f)
    if ((b[i] & 0x80) === 0) { parts.push(val); val = 0 }
  }
  return parts.join('.')
}

/** 解碼整數內容為十進位(小數值)或 hex(大數)。 */
function decodeInteger(b: Uint8Array, start: number, end: number): string {
  const len = end - start
  if (len === 0) return '0'
  const hex = bytesToHex(b, start, end)
  if (len <= 6) {
    let v = 0
    const neg = (b[start] & 0x80) !== 0
    for (let i = start; i < end; i++) v = v * 256 + b[i]
    if (neg) v -= Math.pow(2, 8 * len)
    return `${v} (0x${hex})`
  }
  return `0x${hex}`
}

function decodeString(b: Uint8Array, start: number, end: number, tag: number): string {
  const slice = b.subarray(start, end)
  try {
    if (tag === 0x1e) return new TextDecoder('utf-16be', { fatal: false }).decode(slice) // BMPString
    return new TextDecoder('utf-8', { fatal: false }).decode(slice)
  } catch {
    return bytesToHex(b, start, end)
  }
}

const STRING_TAGS = new Set([0x0c, 0x12, 0x13, 0x14, 0x16, 0x17, 0x18, 0x1a, 0x1b, 0x1c, 0x1e])

interface ParseState { error?: string }

function parseNodes(b: Uint8Array, start: number, end: number, state: ParseState, depth: number): Asn1Node[] {
  const out: Asn1Node[] = []
  let pos = start
  while (pos < end) {
    if (depth > 40) { state.error = '巢狀過深'; break }
    const tagByte = b[pos]
    const tagClassBits = (tagByte & 0xc0) >> 6
    const constructed = (tagByte & 0x20) !== 0
    let tagNumber = tagByte & 0x1f
    let p = pos + 1
    if (tagNumber === 0x1f) {
      // 高位 tag number
      tagNumber = 0
      while (p < end && (b[p] & 0x80)) { tagNumber = tagNumber * 128 + (b[p] & 0x7f); p++ }
      if (p < end) { tagNumber = tagNumber * 128 + (b[p] & 0x7f); p++ }
    }
    if (p >= end) { state.error = '長度位元組超出範圍'; break }
    let length = b[p]; p++
    if (length === 0x80) { state.error = '不支援 BER 不定長度(indefinite length)'; break }
    if (length & 0x80) {
      const n = length & 0x7f
      if (n > 4 || p + n > end) { state.error = '長度欄位異常'; break }
      length = 0
      for (let i = 0; i < n; i++) { length = length * 256 + b[p]; p++ }
    }
    const contentStart = p
    const contentEnd = contentStart + length
    if (contentEnd > end) { state.error = '內容長度超出緩衝區'; break }

    const tagClass = (['universal', 'application', 'context', 'private'] as const)[tagClassBits]
    let tagName: string
    if (tagClass === 'universal') tagName = UNIVERSAL[tagNumber] || `[UNIVERSAL ${tagNumber}]`
    else if (tagClass === 'context') tagName = `[${tagNumber}]`
    else tagName = `[${tagClass.toUpperCase()} ${tagNumber}]`

    const node: Asn1Node = {
      tagClass, constructed, tagNumber, tagName,
      offset: pos, headerLength: contentStart - pos, length,
      valueHex: bytesToHex(b, contentStart, contentEnd),
    }

    if (constructed) {
      node.children = parseNodes(b, contentStart, contentEnd, state, depth + 1)
    } else if (tagClass === 'universal') {
      if (tagNumber === 0x06) {
        const oid = decodeOid(b, contentStart, contentEnd)
        const name = oidName(oid)
        node.value = name ? `${oid} — ${name}` : oid
      } else if (tagNumber === 0x02 || tagNumber === 0x0a) {
        node.value = decodeInteger(b, contentStart, contentEnd)
      } else if (tagNumber === 0x01) {
        node.value = b[contentStart] === 0 ? 'FALSE' : 'TRUE'
      } else if (tagNumber === 0x05) {
        node.value = 'NULL'
      } else if (STRING_TAGS.has(tagNumber)) {
        node.value = decodeString(b, contentStart, contentEnd, tagNumber)
      } else if (tagNumber === 0x03 || tagNumber === 0x04) {
        // BIT STRING / OCTET STRING:可能內嵌 DER,嘗試遞迴
        const inner = tagNumber === 0x03 ? contentStart + 1 : contentStart
        const nested = tryNested(b, inner, contentEnd)
        if (nested) node.children = nested
        if (tagNumber === 0x03) node.value = `未使用 ${b[contentStart]} bit`
      }
    }
    out.push(node)
    pos = contentEnd
  }
  return out
}

/** 嘗試把一段內容當作完整 DER 解析;成功(剛好用完且無錯)才回傳,否則 null。 */
function tryNested(b: Uint8Array, start: number, end: number): Asn1Node[] | null {
  if (start >= end) return null
  const tag = b[start] & 0x1f
  const cls = (b[start] & 0xc0) >> 6
  // 只在看起來像 SEQUENCE/SET/context 構造時嘗試,避免把隨機位元組誤判
  if (!((b[start] & 0x20) && (cls === 0 ? tag === 0x10 || tag === 0x11 : true))) return null
  const state: ParseState = {}
  let nodes: Asn1Node[]
  try { nodes = parseNodes(b, start, end, state, 0) } catch { return null }
  if (state.error || !nodes.length) return null
  // 必須剛好用完整段
  const last = nodes[nodes.length - 1]
  const usedEnd = last.offset + last.headerLength + last.length
  return usedEnd === end ? nodes : null
}

export interface DecodeResult {
  nodes: Asn1Node[]
  error?: string
}

/** 解碼整段 DER 位元組。 */
export function decodeDer(bytes: Uint8Array): DecodeResult {
  const state: ParseState = {}
  const nodes = parseNodes(bytes, 0, bytes.length, state, 0)
  return { nodes, error: state.error }
}
