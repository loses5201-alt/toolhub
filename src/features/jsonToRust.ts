// JSON → Rust 結構 產生引擎 —— 貼上範例 JSON,推斷出對應的 Rust struct
// (可選 serde 衍生與 serde rename)。純函式、無 DOM,可在 Node 測試。
// 與 json-to-ts(TypeScript)、json-to-go(Go)、json-to-python(Python)互補。

export type RustStyle = 'serde' | 'plain'

interface RustField {
  name: string // snake_case 欄位名
  type: string // 型別字串
  rawKey: string // 原始 JSON 鍵(若與 name 不同則 serde rename / 加註解)
}
interface RustStruct {
  name: string
  fields: RustField[]
  sig: string
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// Rust 關鍵字(strict + reserved),撞到就在欄位名後加底線並靠 serde rename 還原
const RUST_KEYWORDS = new Set([
  'as', 'break', 'const', 'continue', 'crate', 'dyn', 'else', 'enum', 'extern', 'false', 'fn',
  'for', 'if', 'impl', 'in', 'let', 'loop', 'match', 'mod', 'move', 'mut', 'pub', 'ref', 'return',
  'self', 'Self', 'static', 'struct', 'super', 'trait', 'true', 'type', 'unsafe', 'use', 'where',
  'while', 'async', 'await', 'abstract', 'become', 'box', 'do', 'final', 'macro', 'override',
  'priv', 'typeof', 'unsized', 'virtual', 'yield', 'try',
])

// 把 JSON 鍵轉成 struct 名稱(PascalCase)
export function structNameFromKey(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (!words.length) return 'Root'
  let name = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('')
  if (/^[0-9]/.test(name)) name = '_' + name
  return name
}

// 把 JSON 鍵轉成 snake_case 欄位名
export function fieldNameFromKey(key: string): string {
  let s = key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2') // camelCase → camel_Case
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2') // HTTPServer → HTTP_Server
    .replace(/[^A-Za-z0-9]+/g, '_')
    .toLowerCase()
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
  if (!s) s = 'field'
  if (/^[0-9]/.test(s)) s = 'n_' + s // Rust 識別字不可數字開頭
  if (RUST_KEYWORDS.has(s)) s = s + '_'
  return s
}

// 粗略單數化(users → user)當作 Vec 元素 struct 名
function singular(name: string): string {
  if (/ies$/.test(name)) return name.replace(/ies$/, 'y')
  if (/sses$/.test(name)) return name.replace(/es$/, '')
  if (/[^s]s$/.test(name)) return name.slice(0, -1)
  return name
}

class Generator {
  structs: RustStruct[] = []
  byName = new Map<string, RustStruct>()

  // 把同名同結構的 struct 重用,否則加序號
  registerStruct(baseName: string, fields: RustField[]): string {
    const sig = JSON.stringify(fields.map((f) => [f.name, f.type, f.rawKey]))
    let candidate = baseName || 'Root'
    let i = 1
    while (this.byName.has(candidate)) {
      if (this.byName.get(candidate)!.sig === sig) return candidate
      candidate = baseName + i++
    }
    const s: RustStruct = { name: candidate, fields, sig }
    this.byName.set(candidate, s)
    this.structs.push(s)
    return candidate
  }

  scalarUnion(values: unknown[]): string {
    const set = new Set<string>()
    for (const v of values) {
      if (typeof v === 'boolean') set.add('bool')
      else if (typeof v === 'number') set.add(Number.isInteger(v) ? 'i64' : 'f64')
      else if (typeof v === 'string') set.add('String')
      else set.add('serde_json::Value')
    }
    if (set.size === 1) return [...set][0]
    if (set.size === 2 && set.has('i64') && set.has('f64')) return 'f64'
    return 'serde_json::Value'
  }

  computeBase(nonNull: unknown[], name: string): string {
    if (nonNull.every(isPlainObject)) return this.makeStruct(nonNull as Record<string, unknown>[], name)
    if (nonNull.every((v) => Array.isArray(v))) {
      const elements: unknown[] = []
      for (const arr of nonNull as unknown[][]) elements.push(...arr)
      return `Vec<${this.resolveType(elements, singular(name))}>`
    }
    return this.scalarUnion(nonNull)
  }

  resolveType(values: unknown[], name: string): string {
    const vals = values.filter((v) => v !== undefined)
    const hasNull = vals.some((v) => v === null)
    const nonNull = vals.filter((v) => v !== null)
    if (nonNull.length === 0) return 'serde_json::Value'
    const base = this.computeBase(nonNull, name)
    return hasNull ? `Option<${base}>` : base
  }

  makeStruct(objs: Record<string, unknown>[], name: string): string {
    const keyOrder: string[] = []
    const seen = new Set<string>()
    for (const o of objs) for (const k of Object.keys(o)) if (!seen.has(k)) { seen.add(k); keyOrder.push(k) }
    const fields: RustField[] = []
    for (const k of keyOrder) {
      const present = objs.filter((o) => Object.prototype.hasOwnProperty.call(o, k)).map((o) => o[k])
      const optionalByMissing = present.length < objs.length
      let t = this.resolveType(present, structNameFromKey(k))
      if (optionalByMissing && !t.startsWith('Option<')) t = `Option<${t}>`
      fields.push({ name: fieldNameFromKey(k), type: t, rawKey: k })
    }
    return this.registerStruct(structNameFromKey(name), fields)
  }
}

export interface RustResult {
  ok: boolean
  code?: string
  error?: string
}

export function jsonToRust(
  jsonText: string,
  opts: { style?: RustStyle; rootName?: string; pubFields?: boolean } = {},
): RustResult {
  const style = opts.style ?? 'serde'
  const pub = opts.pubFields ?? true
  const rootName = structNameFromKey(opts.rootName ?? 'Root')
  let data: unknown
  try {
    data = JSON.parse(jsonText)
  } catch (e) {
    return { ok: false, error: 'JSON 解析失敗:' + (e as Error).message }
  }

  const gen = new Generator()
  let rootAlias = ''
  if (isPlainObject(data)) {
    gen.makeStruct([data], rootName)
  } else if (Array.isArray(data)) {
    let elemName = singular(rootName)
    if (elemName === rootName) elemName = rootName + 'Item'
    const t = gen.resolveType([data], elemName)
    rootAlias = `pub type ${rootName} = ${t};`
  } else {
    const t = gen.resolveType([data], rootName)
    rootAlias = `pub type ${rootName} = ${t};`
  }

  const useSerde = style === 'serde'
  const header: string[] = []
  if (useSerde) header.push('use serde::{Deserialize, Serialize};')

  const pubKw = pub ? 'pub ' : ''
  const blocks: string[] = []
  // 葉節點在前(建立順序),較易閱讀
  for (const st of gen.structs) {
    const lines: string[] = []
    if (useSerde) lines.push('#[derive(Debug, Clone, Serialize, Deserialize)]')
    else lines.push('#[derive(Debug, Clone)]')
    if (st.fields.length === 0) {
      lines.push(`pub struct ${st.name} {}`)
      blocks.push(lines.join('\n'))
      continue
    }
    lines.push(`pub struct ${st.name} {`)
    for (const f of st.fields) {
      if (f.name !== f.rawKey) {
        if (useSerde) lines.push(`    #[serde(rename = ${JSON.stringify(f.rawKey)})]`)
        else lines.push(`    // JSON 鍵: ${f.rawKey}`)
      }
      lines.push(`    ${pubKw}${f.name}: ${f.type},`)
    }
    lines.push('}')
    blocks.push(lines.join('\n'))
  }
  if (rootAlias) blocks.push(rootAlias)

  const head = header.length ? header.join('\n') + '\n\n' : ''
  return { ok: true, code: head + blocks.join('\n\n') + '\n' }
}
