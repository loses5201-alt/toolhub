/*
  .eml(RFC 5322 / MIME)郵件解析引擎 —— 純函式、無 DOM 依賴(只用標準 TextDecoder),
  可在 Node 直接測試。把存下來的 .eml 信件解析成:標頭(主旨/寄件/收件/日期,含 RFC 2047
  亂碼還原)、MIME 結構樹、各段內文(quoted-printable / base64 解碼)、附件清單(檔名/型別/大小)。
  全程在你的瀏覽器解析,不連網、不上傳。

  輸入約定:傳入的字串視為「位元組字串」—— 每個字元的 charCodeAt 即原始位元組(0–255)。
  Vue 端以 readAsArrayBuffer 讀檔後逐位元組轉成此字串,以保留 8bit / base64 的原始位元組。
*/
import { base64ToBytes, decodeMimeHeader } from './encodedWord'

export interface EmlAddress {
  name: string
  email: string
}

export interface EmlPart {
  contentType: string // 小寫 mime,如 text/plain
  charset: string
  encoding: string // transfer-encoding,小寫
  disposition: string // inline | attachment | ''
  filename: string
  headers: Array<[string, string]>
  isMultipart: boolean
  children: EmlPart[]
  text?: string // text/* 段落的解碼後文字
  bytes?: Uint8Array // 解碼後原始位元組(供下載 / 計大小)
  size: number // 解碼後位元組數
}

export interface ParsedEml {
  headers: Array<[string, string]>
  subject: string
  from: EmlAddress[]
  to: EmlAddress[]
  cc: EmlAddress[]
  date: string
  messageId: string
  root: EmlPart
  text: string // 最佳 text/plain 內文
  html: string // 最佳 text/html 內文
  attachments: EmlPart[]
}

/** 還原折行(續行以空白開頭)並切成 [name, value] 標頭陣列。 */
export function parseHeaders(block: string): Array<[string, string]> {
  const lines = block.split('\n')
  const out: Array<[string, string]> = []
  for (const line of lines) {
    if (/^[ \t]/.test(line) && out.length) {
      out[out.length - 1][1] += ' ' + line.trim()
    } else {
      const i = line.indexOf(':')
      if (i > 0) out.push([line.slice(0, i).trim(), line.slice(i + 1).trim()])
    }
  }
  return out
}

/** 取某標頭第一次出現的值(大小寫不敏感)。 */
export function getHeader(headers: Array<[string, string]>, name: string): string {
  const lc = name.toLowerCase()
  for (const [k, v] of headers) if (k.toLowerCase() === lc) return v
  return ''
}

/** 以「分號」切割,但引號內的分號不切。 */
function splitSemicolons(s: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '"') { inQ = !inQ; cur += ch }
    else if (ch === ';' && !inQ) { out.push(cur); cur = '' }
    else cur += ch
  }
  if (cur.trim()) out.push(cur)
  return out
}

export interface ParamHeader {
  value: string
  params: Record<string, string>
}

/** 解析帶參數的標頭,如 'multipart/mixed; boundary="abc"; charset=utf-8'。 */
export function parseParamHeader(raw: string): ParamHeader {
  const parts = splitSemicolons(raw)
  const value = (parts.shift() || '').trim()
  const params: Record<string, string> = {}
  for (const p of parts) {
    const eq = p.indexOf('=')
    if (eq < 0) continue
    const k = p.slice(0, eq).trim().toLowerCase()
    let v = p.slice(eq + 1).trim()
    if (v.startsWith('"')) {
      v = v.slice(1, v.endsWith('"') ? -1 : undefined).replace(/\\(.)/g, '$1')
    }
    if (k) params[k] = v
  }
  return { value, params }
}

/** 把位元組字串(每字元=一位元組)轉成 Uint8Array。 */
function bytesFromBinaryString(s: string): Uint8Array {
  const b = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff
  return b
}

/** quoted-printable(內文版:底線為字面、=\n 為軟換行)解碼成位元組。 */
function qpBodyToBytes(s: string): Uint8Array {
  const bytes: number[] = []
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '=') {
      if (s[i + 1] === '\n') { i += 1; continue } // 軟換行
      const hex = s.slice(i + 1, i + 3)
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) { bytes.push(parseInt(hex, 16)); i += 2 }
      else bytes.push(0x3d)
    } else {
      bytes.push(ch.charCodeAt(0) & 0xff)
    }
  }
  return new Uint8Array(bytes)
}

/** 依 transfer-encoding 把內文解碼成位元組。 */
function decodeBody(body: string, cte: string): Uint8Array {
  if (cte === 'base64') return base64ToBytes(body)
  if (cte === 'quoted-printable') return qpBodyToBytes(body)
  return bytesFromBinaryString(body) // 7bit / 8bit / binary
}

/** 以指定字元集把位元組解成文字,不支援則退回 UTF-8。 */
function decodeText(bytes: Uint8Array, charset: string): string {
  const cs = (charset || 'utf-8').toLowerCase()
  try {
    return new TextDecoder(cs === 'us-ascii' || cs === 'ascii' ? 'utf-8' : cs, { fatal: false }).decode(bytes)
  } catch {
    try { return new TextDecoder('utf-8', { fatal: false }).decode(bytes) } catch { return '' }
  }
}

/** percent-decode(RFC 2231 參數用),再依字元集解碼。 */
function percentDecode(s: string, charset: string): string {
  const bytes: number[] = []
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '%' && /^[0-9A-Fa-f]{2}$/.test(s.slice(i + 1, i + 3))) {
      bytes.push(parseInt(s.slice(i + 1, i + 3), 16)); i += 2
    } else {
      bytes.push(s.charCodeAt(i) & 0xff)
    }
  }
  return decodeText(new Uint8Array(bytes), charset)
}

/** 解析參數值,支援 RFC 2231 延續(name*0*、name*1)與編碼,以及 RFC 2047 encoded-word。 */
export function resolveParam(params: Record<string, string>, base: string): string {
  // RFC 2231 連續段:base*0 / base*0* / base*1 ...
  const cont: Array<{ v: string; encoded: boolean }> = []
  for (let i = 0; ; i++) {
    const enc = params[`${base}*${i}*`]
    const plain = params[`${base}*${i}`]
    if (enc !== undefined) cont.push({ v: enc, encoded: true })
    else if (plain !== undefined) cont.push({ v: plain, encoded: false })
    else break
  }
  if (cont.length) {
    let charset = 'utf-8'
    let result = ''
    cont.forEach((seg, idx) => {
      if (seg.encoded) {
        let val = seg.v
        if (idx === 0) {
          const mm = val.match(/^([^']*)'([^']*)'(.*)$/)
          if (mm) { charset = mm[1] || 'utf-8'; val = mm[3] }
        }
        result += percentDecode(val, charset)
      } else {
        result += seg.v
      }
    })
    return result
  }
  // 單一延伸:base*=charset'lang'value
  const single = params[`${base}*`]
  if (single !== undefined) {
    const mm = single.match(/^([^']*)'([^']*)'(.*)$/)
    return mm ? percentDecode(mm[3], mm[1] || 'utf-8') : percentDecode(single, 'utf-8')
  }
  const plain = params[base]
  if (plain !== undefined) return plain.includes('=?') ? decodeMimeHeader(plain).text : plain
  return ''
}

/** 把一段 MIME 實體(標頭+空行+內文)切成標頭與內文。 */
function splitHeaderBody(entity: string): { headers: Array<[string, string]>; body: string } {
  const idx = entity.indexOf('\n\n')
  if (idx < 0) return { headers: parseHeaders(entity), body: '' }
  return { headers: parseHeaders(entity.slice(0, idx)), body: entity.slice(idx + 2) }
}

/** 依 boundary 切割 multipart 內文成各子實體(略過 preamble / epilogue)。 */
function splitMultipart(body: string, boundary: string): string[] {
  const lines = body.split('\n')
  const delim = '--' + boundary
  const parts: string[] = []
  let current: string[] | null = null
  for (const line of lines) {
    const t = line.replace(/\r$/, '')
    if (t === delim || t === delim + '--') {
      if (current !== null) parts.push(current.join('\n'))
      if (t === delim + '--') { current = null; break }
      current = []
    } else if (current !== null) {
      current.push(line)
    }
  }
  return parts
}

/** 解析單一 MIME 實體成 EmlPart(multipart 會遞迴)。 */
export function parsePart(entity: string): EmlPart {
  const { headers, body } = splitHeaderBody(entity)
  const ct = parseParamHeader(getHeader(headers, 'content-type') || 'text/plain')
  const mime = (ct.value || 'text/plain').toLowerCase()
  const cte = (getHeader(headers, 'content-transfer-encoding') || '7bit').trim().toLowerCase()
  const cd = parseParamHeader(getHeader(headers, 'content-disposition') || '')
  const filename = resolveParam(cd.params, 'filename') || resolveParam(ct.params, 'name')
  const part: EmlPart = {
    contentType: mime,
    charset: ct.params.charset || '',
    encoding: cte,
    disposition: cd.value.toLowerCase(),
    filename,
    headers,
    isMultipart: false,
    children: [],
    size: 0,
  }
  if (mime.startsWith('multipart/') && ct.params.boundary) {
    part.isMultipart = true
    part.children = splitMultipart(body, ct.params.boundary).map(parsePart)
  } else {
    const bytes = decodeBody(body, cte)
    part.bytes = bytes
    part.size = bytes.length
    if (mime.startsWith('text/')) part.text = decodeText(bytes, part.charset)
  }
  return part
}

/** 走訪結構樹,收集所有葉節點(非 multipart)。 */
export function flattenLeaves(part: EmlPart): EmlPart[] {
  if (!part.isMultipart) return [part]
  return part.children.flatMap(flattenLeaves)
}

function splitAddressList(s: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  let inA = false
  for (const ch of s) {
    if (ch === '"') { inQ = !inQ; cur += ch }
    else if (ch === '<') { inA = true; cur += ch }
    else if (ch === '>') { inA = false; cur += ch }
    else if (ch === ',' && !inQ && !inA) { out.push(cur); cur = '' }
    else cur += ch
  }
  if (cur.trim()) out.push(cur)
  return out
}

/** 解析地址標頭(已先做 encoded-word 還原)成 EmlAddress[]。 */
export function parseAddresses(rawValue: string): EmlAddress[] {
  if (!rawValue.trim()) return []
  const decoded = decodeMimeHeader(rawValue).text
  return splitAddressList(decoded)
    .map((one) => {
      const s = one.trim()
      const m = s.match(/^(.*)<([^>]*)>\s*$/)
      if (m) return { name: m[1].trim().replace(/^"|"$/g, '').trim(), email: m[2].trim() }
      return { name: '', email: s }
    })
    .filter((a) => a.name || a.email)
}

/** 解析整封 .eml 信件。 */
export function parseEml(raw: string): ParsedEml {
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const root = parsePart(text)
  const h = root.headers
  const leaves = flattenLeaves(root)
  const bodyText = leaves.find((p) => p.contentType === 'text/plain' && p.disposition !== 'attachment')
  const bodyHtml = leaves.find((p) => p.contentType === 'text/html' && p.disposition !== 'attachment')
  const attachments = leaves.filter(
    (p) =>
      p !== bodyText &&
      p !== bodyHtml &&
      (p.disposition === 'attachment' || !!p.filename || !p.contentType.startsWith('text/')),
  )
  return {
    headers: h,
    subject: decodeMimeHeader(getHeader(h, 'subject')).text,
    from: parseAddresses(getHeader(h, 'from')),
    to: parseAddresses(getHeader(h, 'to')),
    cc: parseAddresses(getHeader(h, 'cc')),
    date: getHeader(h, 'date'),
    messageId: getHeader(h, 'message-id'),
    root,
    text: bodyText?.text || '',
    html: bodyHtml?.text || '',
    attachments,
  }
}

/** 人類可讀的位元組大小。 */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
