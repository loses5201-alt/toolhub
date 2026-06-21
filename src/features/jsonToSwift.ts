// JSON → Swift struct 產生引擎 —— 貼上範例 JSON,推斷出對應的 Swift Codable struct。
// 屬性採 camelCase,與原鍵不同時自動產生 CodingKeys(Swift 規定:一旦自訂就要列出全部鍵)。
// 純函式、無 DOM,可在 Node 測試。與 json-to-ts / go / python / rust / csharp / kotlin / java 互補。

interface SField {
  name: string // camelCase 屬性名(未含反引號)
  type: string // 型別字串(不含結尾 ?)
  nullable: boolean
  rawKey: string // 原始 JSON 鍵
}
interface SStruct {
  name: string
  fields: SField[]
  sig: string
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// Swift 保留字(作為識別字時需反引號包覆)
const SWIFT_KEYWORDS = new Set([
  'associatedtype', 'class', 'deinit', 'enum', 'extension', 'fileprivate', 'func', 'import', 'init',
  'inout', 'internal', 'let', 'open', 'operator', 'private', 'protocol', 'public', 'rethrows',
  'static', 'struct', 'subscript', 'typealias', 'var', 'break', 'case', 'continue', 'default',
  'defer', 'do', 'else', 'fallthrough', 'for', 'guard', 'if', 'in', 'repeat', 'return', 'switch',
  'where', 'while', 'as', 'catch', 'false', 'is', 'nil', 'super', 'self', 'Self', 'throw', 'throws',
  'true', 'try', 'Type', 'Any', 'Protocol',
])

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

export function propNameFromKey(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (!words.length) return 'field'
  let name = words
    .map((w, i) => (i === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('')
  if (/^[0-9]/.test(name)) name = '_' + name
  return name
}

// 反引號包覆 Swift 關鍵字
function esc(name: string): string {
  return SWIFT_KEYWORDS.has(name) ? '`' + name + '`' : name
}

function singular(name: string): string {
  if (/ies$/.test(name)) return name.replace(/ies$/, 'y')
  if (/sses$/.test(name)) return name.replace(/es$/, '')
  if (/[^s]s$/.test(name)) return name.slice(0, -1)
  return name
}

class Generator {
  structs: SStruct[] = []
  byName = new Map<string, SStruct>()
  usesAny = false

  register(baseName: string, fields: SField[]): string {
    const sig = JSON.stringify(fields.map((f) => [f.name, f.type, f.nullable, f.rawKey]))
    let candidate = baseName || 'Root'
    let i = 1
    while (this.byName.has(candidate)) {
      if (this.byName.get(candidate)!.sig === sig) return candidate
      candidate = baseName + i++
    }
    const s: SStruct = { name: candidate, fields, sig }
    this.byName.set(candidate, s)
    this.structs.push(s)
    return candidate
  }

  scalarUnion(values: unknown[]): string {
    const set = new Set<string>()
    for (const v of values) {
      if (typeof v === 'boolean') set.add('Bool')
      else if (typeof v === 'number') set.add(Number.isInteger(v) ? 'Int' : 'Double')
      else if (typeof v === 'string') set.add('String')
      else set.add('Any')
    }
    if (set.size === 1) {
      const t = [...set][0]
      if (t === 'Any') this.usesAny = true
      return t
    }
    if (set.size === 2 && set.has('Int') && set.has('Double')) return 'Double'
    this.usesAny = true
    return 'AnyCodable'
  }

  computeBase(nonNull: unknown[], name: string): string {
    if (nonNull.every(isPlainObject)) return this.makeStruct(nonNull as Record<string, unknown>[], name)
    if (nonNull.every((v) => Array.isArray(v))) {
      const elements: unknown[] = []
      for (const arr of nonNull as unknown[][]) elements.push(...arr)
      return `[${this.resolveType(elements, singular(name)).type}]`
    }
    const t = this.scalarUnion(nonNull)
    return t === 'Any' ? 'AnyCodable' : t
  }

  resolveType(values: unknown[], name: string): { type: string; nullable: boolean } {
    const vals = values.filter((v) => v !== undefined)
    const hasNull = vals.some((v) => v === null)
    const nonNull = vals.filter((v) => v !== null)
    if (nonNull.length === 0) {
      this.usesAny = true
      return { type: 'AnyCodable', nullable: true }
    }
    return { type: this.computeBase(nonNull, name), nullable: hasNull }
  }

  makeStruct(objs: Record<string, unknown>[], name: string): string {
    const keyOrder: string[] = []
    const seen = new Set<string>()
    for (const o of objs) for (const k of Object.keys(o)) if (!seen.has(k)) { seen.add(k); keyOrder.push(k) }
    const fields: SField[] = []
    for (const k of keyOrder) {
      const present = objs.filter((o) => Object.prototype.hasOwnProperty.call(o, k)).map((o) => o[k])
      const optionalByMissing = present.length < objs.length
      const r = this.resolveType(present, structNameFromKey(k))
      fields.push({
        name: propNameFromKey(k),
        type: r.type,
        nullable: r.nullable || optionalByMissing,
        rawKey: k,
      })
    }
    return this.register(structNameFromKey(name), fields)
  }
}

export interface SwiftResult {
  ok: boolean
  code?: string
  error?: string
}

export function jsonToSwift(
  jsonText: string,
  opts: { rootName?: string } = {},
): SwiftResult {
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
    const r = gen.resolveType([data], elemName)
    rootAlias = `// 根為陣列,請直接用 ${r.type}${r.nullable ? '?' : ''}`
  } else {
    const r = gen.resolveType([data], rootName)
    rootAlias = `// 根為純量,型別為 ${r.type}${r.nullable ? '?' : ''}`
  }

  const blocks: string[] = []
  for (const st of gen.structs) {
    const lines: string[] = [`struct ${st.name}: Codable {`]
    for (const f of st.fields) {
      lines.push(`    let ${esc(f.name)}: ${f.type}${f.nullable ? '?' : ''}`)
    }
    // 只要有任一屬性名與原鍵不同,Swift 就要求 CodingKeys 列出全部
    const needsKeys = st.fields.some((f) => f.name !== f.rawKey)
    if (needsKeys) {
      lines.push('')
      lines.push('    enum CodingKeys: String, CodingKey {')
      for (const f of st.fields) {
        if (f.name === f.rawKey) lines.push(`        case ${esc(f.name)}`)
        else lines.push(`        case ${esc(f.name)} = ${JSON.stringify(f.rawKey)}`)
      }
      lines.push('    }')
    }
    lines.push('}')
    blocks.push(lines.join('\n'))
  }
  if (rootAlias) blocks.push(rootAlias)

  let head = 'import Foundation\n\n'
  if (gen.usesAny) {
    head +=
      '// 注意:含型別不一致或全為 null 的欄位,以 AnyCodable 表示;\n' +
      '// 請改用具體型別,或引入 AnyCodable 套件(如 Flight-School/AnyCodable)。\n\n'
  }
  return { ok: true, code: head + blocks.join('\n\n') + '\n' }
}
