/*
  vCard(.vcf)解析引擎 —— 純函式、無 DOM 依賴(只用標準 TextDecoder),可在 Node 直接測試。
  把 Google 通訊錄 / iCloud / Android 匯出的 .vcf(可能一個檔含上百張名片)解析成一張張聯絡人,
  取出姓名、電話、Email、公司、職稱、地址、生日、備註等。支援 vCard 3.0 / 4.0(UTF-8),
  以及 vCard 2.1 常見的 QUOTED-PRINTABLE 編碼姓名。全程在你的瀏覽器解析,聯絡人不連網、不上傳。
*/

export interface TypedValue { types: string[]; value: string }
export interface VcardContact {
  fn: string
  n: string[] // [family, given, additional, prefix, suffix]
  tels: TypedValue[]
  emails: TypedValue[]
  org: string
  title: string
  adrs: TypedValue[]
  bday: string
  urls: string[]
  note: string
  raw: string
}

/** 還原 RFC 6350 折行:續行以空白/Tab 開頭,移除該單一前導空白後直接接上。 */
export function unfoldLines(text: string): string[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const out: string[] = []
  for (const line of lines) {
    if ((line[0] === ' ' || line[0] === '\t') && out.length) {
      out[out.length - 1] += line.slice(1)
    } else {
      out.push(line)
    }
  }
  return out
}

function qpDecode(s: string, charset: string): string {
  const bytes: number[] = []
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '=') {
      if (s[i + 1] === '\n') { i++; continue }
      const h = s.slice(i + 1, i + 3)
      if (/^[0-9A-Fa-f]{2}$/.test(h)) { bytes.push(parseInt(h, 16)); i += 2 }
      else bytes.push(0x3d)
    } else {
      bytes.push(c.charCodeAt(0) & 0xff)
    }
  }
  try {
    return new TextDecoder((charset || 'utf-8').toLowerCase(), { fatal: false }).decode(new Uint8Array(bytes))
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes))
  }
}

/** vCard TEXT 值跳脫還原(\\n→換行、\\, \\; \\\\ 還原)。 */
export function unescapeText(v: string): string {
  return v.replace(/\\([\\,;nN])/g, (_, c) => (c === 'n' || c === 'N' ? '\n' : c))
}

/** 以未跳脫的分隔字元切割。 */
function splitEscaped(v: string, sep: string): string[] {
  const out: string[] = []
  let cur = ''
  for (let i = 0; i < v.length; i++) {
    if (v[i] === '\\') { cur += v[i] + (v[i + 1] || ''); i++ }
    else if (v[i] === sep) { out.push(cur); cur = '' }
    else cur += v[i]
  }
  out.push(cur)
  return out
}

interface ParsedLine { name: string; types: string[]; params: Record<string, string>; value: string }

export function parseLine(line: string): ParsedLine | null {
  const colon = line.indexOf(':')
  if (colon < 0) return null
  const left = line.slice(0, colon)
  let rawValue = line.slice(colon + 1)
  const segs = left.split(';')
  let name = segs[0]
  if (name.includes('.')) name = name.slice(name.indexOf('.') + 1) // 去掉 group. 前綴
  name = name.toUpperCase()
  const params: Record<string, string> = {}
  const types: string[] = []
  for (let i = 1; i < segs.length; i++) {
    const seg = segs[i]
    const eq = seg.indexOf('=')
    if (eq >= 0) {
      const k = seg.slice(0, eq).toUpperCase()
      const val = seg.slice(eq + 1)
      params[k] = val
      if (k === 'TYPE') for (const t of val.split(',')) if (t) types.push(t.toUpperCase())
    } else if (seg) {
      types.push(seg.toUpperCase()) // vCard 2.1 簡寫,如 TEL;HOME;VOICE
    }
  }
  if ((params.ENCODING || '').toUpperCase().includes('QUOTED-PRINTABLE')) {
    rawValue = qpDecode(rawValue, params.CHARSET || 'utf-8')
  }
  // 過濾掉純編碼/字元集標記,留下真正的類型
  const realTypes = types.filter((t) => t !== 'QUOTED-PRINTABLE' && t !== 'VOICE' && !t.startsWith('CHARSET'))
  return { name, types: realTypes, params, value: rawValue }
}

function structured(value: string): string[] {
  return splitEscaped(value, ';').map(unescapeText)
}

/** 解析整個 .vcf 文字成聯絡人陣列。 */
export function parseVcards(text: string): VcardContact[] {
  const lines = unfoldLines(text)
  const contacts: VcardContact[] = []
  let cur: VcardContact | null = null
  let rawLines: string[] = []
  for (const line of lines) {
    const upper = line.toUpperCase()
    if (upper.startsWith('BEGIN:VCARD')) {
      cur = { fn: '', n: [], tels: [], emails: [], org: '', title: '', adrs: [], bday: '', urls: [], note: '', raw: '' }
      rawLines = [line]
      continue
    }
    if (upper.startsWith('END:VCARD')) {
      if (cur) {
        rawLines.push(line)
        cur.raw = rawLines.join('\n')
        if (!cur.fn && cur.n.length) {
          cur.fn = [cur.n[3], cur.n[1], cur.n[2], cur.n[0], cur.n[4]].filter(Boolean).join(' ').trim()
        }
        contacts.push(cur)
      }
      cur = null
      continue
    }
    if (!cur) continue
    rawLines.push(line)
    const p = parseLine(line)
    if (!p) continue
    switch (p.name) {
      case 'FN': cur.fn = unescapeText(p.value); break
      case 'N': cur.n = structured(p.value); break
      case 'TEL': cur.tels.push({ types: p.types, value: unescapeText(p.value) }); break
      case 'EMAIL': cur.emails.push({ types: p.types, value: unescapeText(p.value) }); break
      case 'ORG': cur.org = structured(p.value).filter(Boolean).join(' · '); break
      case 'TITLE': cur.title = unescapeText(p.value); break
      case 'ADR': cur.adrs.push({ types: p.types, value: structured(p.value).filter(Boolean).join(', ') }); break
      case 'BDAY': cur.bday = p.value.trim(); break
      case 'URL': if (p.value.trim()) cur.urls.push(p.value.trim()); break
      case 'NOTE': cur.note = unescapeText(p.value); break
    }
  }
  return contacts
}
