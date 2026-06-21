// JSON → Kotlin data class 產生引擎 —— 貼上範例 JSON,推斷出對應的 Kotlin data class。
// 可選 kotlinx.serialization / Gson / Moshi / 無 的序列化標註。純函式、無 DOM,可在 Node 測試。
// 與 json-to-ts / go / python / rust / csharp 互補。

export type KtLib = 'kotlinx' | 'gson' | 'moshi' | 'none'

interface KtField {
  name: string // camelCase 屬性名
  type: string // 型別字串
  nullable: boolean
  rawKey: string // 原始 JSON 鍵(若與 name 不同則加序列化標註)
}
interface KtClass {
  name: string
  fields: KtField[]
  sig: string
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

const KT_KEYWORDS = new Set([
  'as', 'break', 'class', 'continue', 'do', 'else', 'false', 'for', 'fun', 'if', 'in', 'interface',
  'is', 'null', 'object', 'package', 'return', 'super', 'this', 'throw', 'true', 'try', 'typealias',
  'typeof', 'val', 'var', 'when', 'while', 'by', 'catch', 'constructor', 'delegate', 'dynamic',
  'field', 'file', 'finally', 'get', 'import', 'init', 'param', 'property', 'receiver', 'set',
  'setparam', 'value', 'where',
])

// 把 JSON 鍵轉成 PascalCase 類別名
export function classNameFromKey(key: string): string {
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

// 把 JSON 鍵轉成 camelCase 屬性名
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

// 反引號包覆 Kotlin 關鍵字
function escapeProp(name: string): string {
  return KT_KEYWORDS.has(name) ? '`' + name + '`' : name
}

function singular(name: string): string {
  if (/ies$/.test(name)) return name.replace(/ies$/, 'y')
  if (/sses$/.test(name)) return name.replace(/es$/, '')
  if (/[^s]s$/.test(name)) return name.slice(0, -1)
  return name
}

class Generator {
  classes: KtClass[] = []
  byName = new Map<string, KtClass>()

  registerClass(baseName: string, fields: KtField[]): string {
    const sig = JSON.stringify(fields.map((f) => [f.name, f.type, f.nullable, f.rawKey]))
    let candidate = baseName || 'Root'
    let i = 1
    while (this.byName.has(candidate)) {
      if (this.byName.get(candidate)!.sig === sig) return candidate
      candidate = baseName + i++
    }
    const c: KtClass = { name: candidate, fields, sig }
    this.byName.set(candidate, c)
    this.classes.push(c)
    return candidate
  }

  scalarUnion(values: unknown[]): string {
    const set = new Set<string>()
    for (const v of values) {
      if (typeof v === 'boolean') set.add('Boolean')
      else if (typeof v === 'number') set.add(Number.isInteger(v) ? 'Long' : 'Double')
      else if (typeof v === 'string') set.add('String')
      else set.add('Any')
    }
    if (set.size === 1) return [...set][0]
    if (set.size === 2 && set.has('Long') && set.has('Double')) return 'Double'
    return 'Any'
  }

  computeBase(nonNull: unknown[], name: string): string {
    if (nonNull.every(isPlainObject)) return this.makeClass(nonNull as Record<string, unknown>[], name)
    if (nonNull.every((v) => Array.isArray(v))) {
      const elements: unknown[] = []
      for (const arr of nonNull as unknown[][]) elements.push(...arr)
      return `List<${this.resolveType(elements, singular(name)).type}>`
    }
    return this.scalarUnion(nonNull)
  }

  // 回傳 base 型別與是否可空
  resolveType(values: unknown[], name: string): { type: string; nullable: boolean } {
    const vals = values.filter((v) => v !== undefined)
    const hasNull = vals.some((v) => v === null)
    const nonNull = vals.filter((v) => v !== null)
    if (nonNull.length === 0) return { type: 'Any', nullable: true }
    return { type: this.computeBase(nonNull, name), nullable: hasNull }
  }

  makeClass(objs: Record<string, unknown>[], name: string): string {
    const keyOrder: string[] = []
    const seen = new Set<string>()
    for (const o of objs) for (const k of Object.keys(o)) if (!seen.has(k)) { seen.add(k); keyOrder.push(k) }
    const fields: KtField[] = []
    for (const k of keyOrder) {
      const present = objs.filter((o) => Object.prototype.hasOwnProperty.call(o, k)).map((o) => o[k])
      const optionalByMissing = present.length < objs.length
      const r = this.resolveType(present, classNameFromKey(k))
      fields.push({
        name: propNameFromKey(k),
        type: r.type,
        nullable: r.nullable || optionalByMissing,
        rawKey: k,
      })
    }
    return this.registerClass(classNameFromKey(name), fields)
  }
}

export interface KtResult {
  ok: boolean
  code?: string
  error?: string
}

export function jsonToKotlin(
  jsonText: string,
  opts: { lib?: KtLib; rootName?: string } = {},
): KtResult {
  const lib = opts.lib ?? 'kotlinx'
  const rootName = classNameFromKey(opts.rootName ?? 'Root')
  let data: unknown
  try {
    data = JSON.parse(jsonText)
  } catch (e) {
    return { ok: false, error: 'JSON 解析失敗:' + (e as Error).message }
  }

  const gen = new Generator()
  let rootAlias = ''
  if (isPlainObject(data)) {
    gen.makeClass([data], rootName)
  } else if (Array.isArray(data)) {
    let elemName = singular(rootName)
    if (elemName === rootName) elemName = rootName + 'Item'
    const r = gen.resolveType([data], elemName)
    rootAlias = `// 根為陣列,請直接用 ${r.type}${r.nullable ? '?' : ''}`
  } else {
    const r = gen.resolveType([data], rootName)
    rootAlias = `// 根為純量,型別為 ${r.type}${r.nullable ? '?' : ''}`
  }

  const imports: string[] = []
  if (lib === 'kotlinx') {
    imports.push('import kotlinx.serialization.SerialName', 'import kotlinx.serialization.Serializable')
  } else if (lib === 'gson') {
    imports.push('import com.google.gson.annotations.SerializedName')
  } else if (lib === 'moshi') {
    imports.push('import com.squareup.moshi.Json', 'import com.squareup.moshi.JsonClass')
  }

  // 屬性層的 rename 標註
  const renameAnno = (key: string): string | null => {
    if (lib === 'kotlinx') return `@SerialName(${JSON.stringify(key)})`
    if (lib === 'gson') return `@SerializedName(${JSON.stringify(key)})`
    if (lib === 'moshi') return `@Json(name = ${JSON.stringify(key)})`
    return null
  }

  const blocks: string[] = []
  // 葉節點在前(建立順序)
  for (const cls of gen.classes) {
    const lines: string[] = []
    if (lib === 'kotlinx') lines.push('@Serializable')
    else if (lib === 'moshi') lines.push('@JsonClass(generateAdapter = true)')
    if (cls.fields.length === 0) {
      lines.push(`class ${cls.name}`)
      blocks.push(lines.join('\n'))
      continue
    }
    lines.push(`data class ${cls.name}(`)
    cls.fields.forEach((f, idx) => {
      const comma = idx < cls.fields.length - 1 ? ',' : ''
      const typeStr = f.type + (f.nullable ? '?' : '')
      const def = f.nullable ? ' = null' : ''
      const prop = `    val ${escapeProp(f.name)}: ${typeStr}${def}${comma}`
      if (f.name !== f.rawKey) {
        const a = renameAnno(f.rawKey)
        if (a) lines.push(`    ${a}\n${prop}`)
        else lines.push(`    // JSON 鍵: ${f.rawKey}\n${prop}`)
      } else {
        lines.push(prop)
      }
    })
    lines.push(')')
    blocks.push(lines.join('\n'))
  }
  if (rootAlias) blocks.push(rootAlias)

  const head = imports.length ? imports.join('\n') + '\n\n' : ''
  return { ok: true, code: head + blocks.join('\n\n') + '\n' }
}
