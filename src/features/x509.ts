/*
  X.509 憑證解讀引擎 —— 純函式、無 DOM 依賴,建立在 asn1.ts 的 DER 解碼之上,可在 Node 直接測試。
  把憑證的 ASN.1 結構翻成白話欄位:版本、序號、簽章演算法、簽發者 / 主體 DN、有效期(到期判斷)、
  公鑰型別與長度 / 曲線、Subject Alternative Name(SAN)、與各擴充(basicConstraints / keyUsage /
  extKeyUsage 等)。全程在你的瀏覽器解析,憑證不連網、不上傳。
*/
import { decodeDer, decodeOid, oidName, type Asn1Node } from './asn1'
import { hexToBytes } from './baseEncode'

export interface DnAttr { oid: string; label: string; value: string }
export interface CertName { text: string; attrs: DnAttr[] }
export interface CertExtension { oid: string; name: string; critical: boolean; detail: string }

export interface CertInfo {
  version: number
  serialHex: string
  signatureAlgorithm: string
  issuer: CertName
  subject: CertName
  selfSigned: boolean
  notBefore: string
  notAfter: string
  notBeforeMs: number
  notAfterMs: number
  publicKeyAlgorithm: string
  publicKeyDetail: string
  sans: string[]
  extensions: CertExtension[]
  error?: string
}

const DN_LABELS: Record<string, string> = {
  '2.5.4.3': 'CN', '2.5.4.6': 'C', '2.5.4.7': 'L', '2.5.4.8': 'ST', '2.5.4.9': 'STREET',
  '2.5.4.10': 'O', '2.5.4.11': 'OU', '2.5.4.5': 'SERIALNUMBER', '2.5.4.4': 'SN',
  '2.5.4.12': 'T', '1.2.840.113549.1.9.1': 'E', '0.9.2342.19200300.100.1.25': 'DC',
}

const KEY_USAGE = [
  'digitalSignature', 'nonRepudiation', 'keyEncipherment', 'dataEncipherment',
  'keyAgreement', 'keyCertSign', 'cRLSign', 'encipherOnly', 'decipherOnly',
]

function oidOf(node: Asn1Node | undefined): string {
  if (!node) return ''
  return decodeOid(hexToBytes(node.valueHex) || new Uint8Array(0), 0, (node.valueHex.length / 2) | 0)
}

function hexToAscii(hex: string): string {
  let s = ''
  for (let i = 0; i < hex.length; i += 2) s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16))
  return s
}

function hexToIp(hex: string): string {
  const b = hexToBytes(hex)
  if (!b) return hex
  if (b.length === 4) return Array.from(b).join('.')
  if (b.length === 16) {
    const parts: string[] = []
    for (let i = 0; i < 16; i += 2) parts.push(((b[i] << 8) | b[i + 1]).toString(16))
    return parts.join(':')
  }
  return hex
}

const pad = (n: number) => String(n).padStart(2, '0')

function parseTime(node: Asn1Node): { ms: number; text: string } {
  const s = (node.value || '').replace(/Z$/, '')
  let y: number, rest: string
  if (node.tagNumber === 0x17) { // UTCTime YY
    const yy = parseInt(s.slice(0, 2), 10)
    y = yy < 50 ? 2000 + yy : 1900 + yy
    rest = s.slice(2)
  } else { // GeneralizedTime YYYY
    y = parseInt(s.slice(0, 4), 10)
    rest = s.slice(4)
  }
  const mo = +rest.slice(0, 2), d = +rest.slice(2, 4), h = +rest.slice(4, 6), mi = +rest.slice(6, 8), se = +rest.slice(8, 10) || 0
  const ms = Date.UTC(y, mo - 1, d, h, mi, se)
  return { ms, text: `${y}-${pad(mo)}-${pad(d)} ${pad(h)}:${pad(mi)}:${pad(se)} UTC` }
}

function parseName(node: Asn1Node | undefined): CertName {
  const attrs: DnAttr[] = []
  for (const rdn of node?.children || []) {
    for (const atv of rdn.children || []) {
      const oid = oidOf(atv.children?.[0])
      const value = atv.children?.[1]?.value || ''
      attrs.push({ oid, label: DN_LABELS[oid] || oidName(oid) || oid, value })
    }
  }
  return { text: attrs.map((a) => `${a.label}=${a.value}`).join(', '), attrs }
}

/** 取某擴充內層 OCTET STRING 的內容(再解一層 DER)。 */
function extInner(extnValue: Asn1Node | undefined): Asn1Node[] {
  if (!extnValue) return []
  const inner = hexToBytes(extnValue.valueHex)
  if (!inner) return []
  return decodeDer(inner).nodes
}

function describeExtension(oid: string, extnValue: Asn1Node | undefined): { detail: string; sans: string[] } {
  const sans: string[] = []
  const inner = extInner(extnValue)
  if (oid === '2.5.29.17') { // subjectAltName
    for (const gn of inner[0]?.children || []) {
      if (gn.tagClass !== 'context') continue
      if (gn.tagNumber === 2) sans.push('DNS:' + hexToAscii(gn.valueHex))
      else if (gn.tagNumber === 1) sans.push('email:' + hexToAscii(gn.valueHex))
      else if (gn.tagNumber === 6) sans.push('URI:' + hexToAscii(gn.valueHex))
      else if (gn.tagNumber === 7) sans.push('IP:' + hexToIp(gn.valueHex))
    }
    return { detail: sans.join(', '), sans }
  }
  if (oid === '2.5.29.19') { // basicConstraints
    let ca = false, pathLen = ''
    for (const c of inner[0]?.children || []) {
      if (c.tagNumber === 0x01) ca = c.value === 'TRUE'
      if (c.tagNumber === 0x02) pathLen = (c.value || '').split(' ')[0]
    }
    return { detail: `CA: ${ca ? '是' : '否'}${pathLen ? ` · pathLen=${pathLen}` : ''}`, sans }
  }
  if (oid === '2.5.29.15') { // keyUsage
    const bs = inner[0]
    const bytes = hexToBytes(bs?.valueHex || '') || new Uint8Array(0)
    const usages: string[] = []
    let bitIndex = 0
    for (let i = 1; i < bytes.length; i++) {
      for (let b = 7; b >= 0; b--) {
        if (bytes[i] & (1 << b)) { if (KEY_USAGE[bitIndex]) usages.push(KEY_USAGE[bitIndex]) }
        bitIndex++
      }
    }
    return { detail: usages.join(', '), sans }
  }
  if (oid === '2.5.29.37') { // extKeyUsage
    const names = (inner[0]?.children || []).map((c) => oidName(oidOf(c)) || oidOf(c))
    return { detail: names.join(', '), sans }
  }
  if (oid === '2.5.29.14' || oid === '2.5.29.35') { // subject/authority key identifier
    return { detail: '', sans }
  }
  return { detail: '', sans }
}

/** 解析一張 X.509 憑證(DER 位元組)。 */
export function parseCertificate(bytes: Uint8Array): CertInfo {
  const empty: CertInfo = {
    version: 0, serialHex: '', signatureAlgorithm: '', issuer: { text: '', attrs: [] },
    subject: { text: '', attrs: [] }, selfSigned: false, notBefore: '', notAfter: '',
    notBeforeMs: NaN, notAfterMs: NaN, publicKeyAlgorithm: '', publicKeyDetail: '',
    sans: [], extensions: [],
  }
  const top = decodeDer(bytes)
  const cert = top.nodes[0]
  if (!cert || cert.tagName !== 'SEQUENCE' || !cert.children) {
    return { ...empty, error: '這不是有效的 X.509 憑證(最外層應為 SEQUENCE)' }
  }
  const tbs = cert.children[0]
  if (!tbs?.children) return { ...empty, error: '找不到 TBSCertificate' }
  const tc = tbs.children
  let i = 0
  let version = 1
  if (tc[0]?.tagClass === 'context' && tc[0].tagNumber === 0) {
    version = (parseInt(tc[0].children?.[0]?.value || '0', 10) || 0) + 1
    i = 1
  }
  const serial = tc[i]
  const issuer = parseName(tc[i + 2])
  const validity = tc[i + 3]
  const subject = parseName(tc[i + 4])
  const spki = tc[i + 5]

  // 公鑰
  const algId = spki?.children?.[0]
  const pkOid = oidOf(algId?.children?.[0])
  const pkName = oidName(pkOid) || pkOid
  let pkDetail = ''
  if (pkOid === '1.2.840.10045.2.1') { // EC
    const curve = oidOf(algId?.children?.[1])
    pkDetail = oidName(curve) || curve
  } else if (pkOid === '1.2.840.113549.1.1.1') { // RSA
    const modHex = spki?.children?.[1]?.children?.[0]?.children?.[0]?.valueHex || ''
    let bytesLen = modHex.length / 2
    if (modHex.startsWith('00')) bytesLen -= 1
    if (bytesLen > 0) pkDetail = `${bytesLen * 8}-bit`
  }

  // 擴充
  const extsHolder = tc.find((c) => c.tagClass === 'context' && c.tagNumber === 3)
  const extensions: CertExtension[] = []
  let sans: string[] = []
  for (const ext of extsHolder?.children?.[0]?.children || []) {
    const ch = ext.children || []
    const oid = oidOf(ch[0])
    const critical = ch[1]?.tagNumber === 0x01 && ch[1]?.value === 'TRUE'
    const extnValue = ch.find((c) => c.tagName === 'OCTET STRING')
    const d = describeExtension(oid, extnValue)
    if (d.sans.length) sans = d.sans
    extensions.push({ oid, name: oidName(oid) || oid, critical, detail: d.detail })
  }

  const nb = validity?.children?.[0] ? parseTime(validity.children[0]) : { ms: NaN, text: '' }
  const na = validity?.children?.[1] ? parseTime(validity.children[1]) : { ms: NaN, text: '' }

  return {
    version,
    serialHex: (serial?.valueHex || '').replace(/^00/, '') || serial?.valueHex || '',
    signatureAlgorithm: (() => { const o = oidOf(cert.children[1]?.children?.[0]); return oidName(o) || o })(),
    issuer,
    subject,
    selfSigned: !!issuer.text && issuer.text === subject.text,
    notBefore: nb.text,
    notAfter: na.text,
    notBeforeMs: nb.ms,
    notAfterMs: na.ms,
    publicKeyAlgorithm: pkName,
    publicKeyDetail: pkDetail,
    sans,
    extensions,
    error: top.error,
  }
}
