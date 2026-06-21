/*
  PHP serialize() 解碼引擎 —— 純函式、無 DOM 依賴(只用標準 TextEncoder / TextDecoder),可在 Node 直接測試。
  把 PHP serialize() 產生的字串(WordPress wp_options / postmeta、Laravel / Drupal 的資料庫欄位常見)
  依官方格式拆成可讀的結構樹,並可轉成乾淨 JSON。全程在你瀏覽器解析,不連網、不上傳。

  PHP serialize 文法(以位元組長度計算字串,故以 UTF-8 位元組解析):
    N;                      null
    b:0; / b:1;             boolean
    i:123;                  integer
    d:1.5; / d:INF;…        float(double)
    s:<位元組長度>:"<bytes>";   string
    a:<筆數>:{ k v k v … }     array(有序鍵值對)
    O:<長度>:"<類別名>":<筆數>:{ … }   object
    C:<長度>:"<類別名>":<長度>:{ <raw> }  自訂(Serializable)
    R:<n>; / r:<n>;         reference
*/
import { base64ToBytes } from './encodedWord'

export interface PhpNode {
  type: 'null' | 'bool' | 'int' | 'float' | 'string' | 'array' | 'object' | 'custom' | 'ref'
  value: string // 顯示值(字串為內容本身、bool 為 true/false)
  offset: number
  byteLength: number
  className?: string
  entries?: { key: PhpNode; value: PhpNode; visibility?: string }[]
  error?: string
}

const dec = new TextDecoder('utf-8', { fatal: false })
const TAG = /^[NbidsaOCRr][:;]/

/** 辨識輸入是純 serialize 文字還是 base64 包裝,回傳要解析的位元組。 */
export function parsePhpInput(text: string): { bytes: Uint8Array; source: 'text' | 'base64' } {
  const raw = (text || '').trim()
  const enc = new TextEncoder()
  if (TAG.test(raw)) return { bytes: enc.encode(raw), source: 'text' }
  // 嘗試 base64(Laravel session、序列化後再 base64 的情況)
  if (raw.length >= 8 && /^[A-Za-z0-9+/=\s]+$/.test(raw)) {
    try {
      const b = base64ToBytes(raw.replace(/\s+/g, ''))
      if (b.length && TAG.test(dec.decode(b.subarray(0, 4)))) return { bytes: b, source: 'base64' }
    } catch {
      /* 不是合法 base64,當純文字 */
    }
  }
  return { bytes: enc.encode(raw), source: 'text' }
}

class PhpError extends Error {}
interface R { b: Uint8Array; pos: number }

function expect(r: R, ch: string): void {
  if (r.b[r.pos] !== ch.charCodeAt(0)) {
    throw new PhpError(`位置 ${r.pos} 預期 '${ch}',實際 '${r.pos < r.b.length ? String.fromCharCode(r.b[r.pos]) : 'EOF'}'`)
  }
  r.pos++
}

function readUntil(r: R, ch: string): string {
  const c = ch.charCodeAt(0)
  const start = r.pos
  while (r.pos < r.b.length && r.b[r.pos] !== c) r.pos++
  if (r.pos >= r.b.length) throw new PhpError(`找不到結束字元 '${ch}'`)
  const s = dec.decode(r.b.subarray(start, r.pos))
  r.pos++ // 吃掉 ch
  return s
}

function readIntField(r: R, end: string): number {
  const s = readUntil(r, end)
  if (!/^-?\d+$/.test(s)) throw new PhpError(`預期整數,得到 "${s}"`)
  return parseInt(s, 10)
}

function readStringBytes(r: R, len: number): string {
  if (len < 0 || r.pos + len > r.b.length) throw new PhpError('字串長度超出資料範圍')
  const s = dec.decode(r.b.subarray(r.pos, r.pos + len))
  r.pos += len
  return s
}

/** 物件屬性鍵的可見性:private = \0Class\0name、protected = \0*\0name。會就地把鍵改為乾淨名稱。 */
function classifyKey(key: PhpNode): string | undefined {
  if (key.type !== 'string') return undefined
  const v = key.value
  if (v.startsWith('\u0000*\u0000')) { key.value = v.slice(3); return 'protected' }
  const m = /^\u0000([^\u0000]+)\u0000(.*)$/.exec(v)
  if (m) { key.value = m[2]; return `private(${m[1]})` }
  return undefined
}

function readEntries(r: R, count: number, node: PhpNode): void {
  node.entries = []
  for (let i = 0; i < count; i++) {
    let key: PhpNode
    try {
      key = readValue(r)
    } catch (e) {
      node.error = `第 ${i + 1} 筆的鍵解析失敗:${(e as Error).message}`
      return
    }
    let value: PhpNode
    try {
      value = readValue(r)
    } catch (e) {
      node.error = `鍵 "${key.value}" 的值解析失敗:${(e as Error).message}`
      node.entries.push({ key, value: { type: 'null', value: '(解析中止)', offset: r.pos, byteLength: 0, error: (e as Error).message } })
      return
    }
    const visibility = node.type === 'object' ? classifyKey(key) : undefined
    node.entries.push({ key, value, visibility })
  }
  expect(r, '}')
}

function readValue(r: R): PhpNode {
  const offset = r.pos
  if (r.pos >= r.b.length) throw new PhpError('資料提早結束')
  const tag = String.fromCharCode(r.b[r.pos])
  const fin = (n: PhpNode): PhpNode => { n.byteLength = r.pos - offset; return n }
  switch (tag) {
    case 'N':
      r.pos++; expect(r, ';')
      return fin({ type: 'null', value: 'null', offset, byteLength: 0 })
    case 'b': {
      r.pos++; expect(r, ':')
      const v = readUntil(r, ';')
      if (v !== '0' && v !== '1') throw new PhpError(`bool 應為 0/1,得到 "${v}"`)
      return fin({ type: 'bool', value: v === '1' ? 'true' : 'false', offset, byteLength: 0 })
    }
    case 'i': {
      r.pos++; expect(r, ':')
      const v = readUntil(r, ';')
      if (!/^-?\d+$/.test(v)) throw new PhpError(`integer 格式錯誤:"${v}"`)
      return fin({ type: 'int', value: v, offset, byteLength: 0 })
    }
    case 'd': {
      r.pos++; expect(r, ':')
      const v = readUntil(r, ';')
      return fin({ type: 'float', value: v, offset, byteLength: 0 })
    }
    case 's': {
      r.pos++; expect(r, ':')
      const len = readIntField(r, ':')
      expect(r, '"')
      const s = readStringBytes(r, len)
      expect(r, '"'); expect(r, ';')
      return fin({ type: 'string', value: s, offset, byteLength: 0 })
    }
    case 'a': {
      r.pos++; expect(r, ':')
      const count = readIntField(r, ':')
      expect(r, '{')
      const node: PhpNode = { type: 'array', value: `array(${count})`, offset, byteLength: 0 }
      readEntries(r, count, node)
      return fin(node)
    }
    case 'O': {
      r.pos++; expect(r, ':')
      const nameLen = readIntField(r, ':')
      expect(r, '"')
      const name = readStringBytes(r, nameLen)
      expect(r, '"'); expect(r, ':')
      const count = readIntField(r, ':')
      expect(r, '{')
      const node: PhpNode = { type: 'object', value: `${name}`, className: name, offset, byteLength: 0 }
      readEntries(r, count, node)
      return fin(node)
    }
    case 'C': {
      r.pos++; expect(r, ':')
      const nameLen = readIntField(r, ':')
      expect(r, '"')
      const name = readStringBytes(r, nameLen)
      expect(r, '"'); expect(r, ':')
      const dataLen = readIntField(r, ':')
      expect(r, '{')
      const raw = readStringBytes(r, dataLen)
      expect(r, '}')
      return fin({ type: 'custom', value: raw, className: name, offset, byteLength: 0 })
    }
    case 'R':
    case 'r': {
      r.pos++; expect(r, ':')
      const n = readUntil(r, ';')
      return fin({ type: 'ref', value: `→ #${n}${tag === 'R' ? '(物件參照)' : '(值參照)'}`, offset, byteLength: 0 })
    }
    default:
      throw new PhpError(`未知的型別標記 '${tag}'(0x${r.b[r.pos].toString(16)})`)
  }
}

export function decodePhp(bytes: Uint8Array): { node: PhpNode | null; error?: string; trailing: number } {
  const r: R = { b: bytes, pos: 0 }
  let node: PhpNode | null = null
  try {
    node = readValue(r)
  } catch (e) {
    return { node, error: e instanceof PhpError ? e.message : String(e), trailing: 0 }
  }
  const trailing = bytes.length - r.pos
  return { node, trailing: trailing > 0 ? trailing : 0 }
}

/** 把解析後的結構轉成乾淨 JS 值(供顯示為 JSON)。array 全為連續整數鍵時轉陣列,否則轉物件。 */
export function phpToJson(node: PhpNode | null): unknown {
  if (!node) return null
  switch (node.type) {
    case 'null': return null
    case 'bool': return node.value === 'true'
    case 'int': return Number(node.value)
    case 'float':
      return /^-?(INF|NAN)$/.test(node.value) ? node.value : Number(node.value)
    case 'string': return node.value
    case 'ref': return node.value
    case 'custom': return { __class__: node.className, __serialized__: node.value }
    case 'array': {
      const ents = node.entries || []
      const seq = ents.length > 0 && ents.every((e, i) => e.key.type === 'int' && Number(e.key.value) === i)
      if (seq) return ents.map((e) => phpToJson(e.value))
      const o: Record<string, unknown> = {}
      for (const e of ents) o[String(e.key.value)] = phpToJson(e.value)
      return o
    }
    case 'object': {
      const o: Record<string, unknown> = { __class__: node.className }
      for (const e of node.entries || []) {
        const label = e.visibility ? `${e.key.value} [${e.visibility}]` : String(e.key.value)
        o[label] = phpToJson(e.value)
      }
      return o
    }
  }
  return null
}
