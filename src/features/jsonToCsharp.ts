// JSON → C# 類別 產生引擎 —— 貼上範例 JSON,推斷出對應的 C# class / record。
// 可選 System.Text.Json 或 Newtonsoft 的屬性標註。純函式、無 DOM,可在 Node 測試。
// 與 json-to-ts / json-to-go / json-to-python / json-to-rust 互補。

export type CsStyle = 'class' | 'record'
export type CsJsonLib = 'system' | 'newtonsoft' | 'none'

interface CsField {
  name: string // PascalCase 屬性名
  type: string // 型別字串
  rawKey: string // 原始 JSON 鍵(若與 name 不同則加 JSON 屬性標註)
}
interface CsClass {
  name: string
  fields: CsField[]
  sig: string
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// 把 JSON 鍵轉成 PascalCase 識別字(C# 屬性/類別名)
export function pascalFromKey(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (!words.length) return 'Field'
  let name = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('')
  if (/^[0-9]/.test(name)) name = '_' + name
  return name
}

// 粗略單數化(Users → User)當作 List 元素類別名
function singular(name: string): string {
  if (/ies$/.test(name)) return name.replace(/ies$/, 'y')
  if (/sses$/.test(name)) return name.replace(/es$/, '')
  if (/[^s]s$/.test(name)) return name.slice(0, -1)
  return name
}

class Generator {
  classes: CsClass[] = []
  byName = new Map<string, CsClass>()

  // 把同名同結構的類別重用,否則加序號
  registerClass(baseName: string, fields: CsField[]): string {
    const sig = JSON.stringify(fields.map((f) => [f.name, f.type, f.rawKey]))
    let candidate = baseName || 'Root'
    let i = 1
    while (this.byName.has(candidate)) {
      if (this.byName.get(candidate)!.sig === sig) return candidate
      candidate = baseName + i++
    }
    const c: CsClass = { name: candidate, fields, sig }
    this.byName.set(candidate, c)
    this.classes.push(c)
    return candidate
  }

  scalarUnion(values: unknown[]): string {
    const set = new Set<string>()
    for (const v of values) {
      if (typeof v === 'boolean') set.add('bool')
      else if (typeof v === 'number') set.add(Number.isInteger(v) ? 'long' : 'double')
      else if (typeof v === 'string') set.add('string')
      else set.add('object')
    }
    if (set.size === 1) return [...set][0]
    if (set.size === 2 && set.has('long') && set.has('double')) return 'double'
    return 'object'
  }

  computeBase(nonNull: unknown[], name: string): string {
    if (nonNull.every(isPlainObject)) return this.makeClass(nonNull as Record<string, unknown>[], name)
    if (nonNull.every((v) => Array.isArray(v))) {
      const elements: unknown[] = []
      for (const arr of nonNull as unknown[][]) elements.push(...arr)
      return `List<${this.resolveType(elements, singular(name))}>`
    }
    return this.scalarUnion(nonNull)
  }

  // nullable:value type 與 object 才加 ?(reference type 預設可空,保持乾淨)
  private nullable(base: string): string {
    if (base === 'long' || base === 'double' || base === 'bool') return base + '?'
    return base
  }

  resolveType(values: unknown[], name: string): string {
    const vals = values.filter((v) => v !== undefined)
    const hasNull = vals.some((v) => v === null)
    const nonNull = vals.filter((v) => v !== null)
    if (nonNull.length === 0) return 'object'
    const base = this.computeBase(nonNull, name)
    return hasNull ? this.nullable(base) : base
  }

  makeClass(objs: Record<string, unknown>[], name: string): string {
    const keyOrder: string[] = []
    const seen = new Set<string>()
    for (const o of objs) for (const k of Object.keys(o)) if (!seen.has(k)) { seen.add(k); keyOrder.push(k) }
    const fields: CsField[] = []
    for (const k of keyOrder) {
      const present = objs.filter((o) => Object.prototype.hasOwnProperty.call(o, k)).map((o) => o[k])
      const optionalByMissing = present.length < objs.length
      let t = this.resolveType(present, pascalFromKey(k))
      if (optionalByMissing) t = this.nullable(t)
      fields.push({ name: pascalFromKey(k), type: t, rawKey: k })
    }
    return this.registerClass(pascalFromKey(name), fields)
  }
}

export interface CsResult {
  ok: boolean
  code?: string
  error?: string
}

export function jsonToCsharp(
  jsonText: string,
  opts: { style?: CsStyle; jsonLib?: CsJsonLib; rootName?: string; namespace?: string } = {},
): CsResult {
  const style = opts.style ?? 'class'
  const jsonLib = opts.jsonLib ?? 'system'
  const rootName = pascalFromKey(opts.rootName ?? 'Root')
  const ns = (opts.namespace ?? '').trim()
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
    const t = gen.resolveType([data], elemName)
    rootAlias = `// 根為陣列,請直接用 ${t}`
  } else {
    const t = gen.resolveType([data], rootName)
    rootAlias = `// 根為純量,型別為 ${t}`
  }

  const usings: string[] = ['using System.Collections.Generic;']
  if (jsonLib === 'system') usings.push('using System.Text.Json.Serialization;')
  else if (jsonLib === 'newtonsoft') usings.push('using Newtonsoft.Json;')

  const accessor = style === 'record' ? '{ get; init; }' : '{ get; set; }'
  const attr = (key: string): string | null => {
    if (jsonLib === 'system') return `[JsonPropertyName(${JSON.stringify(key)})]`
    if (jsonLib === 'newtonsoft') return `[JsonProperty(${JSON.stringify(key)})]`
    return null
  }

  const indent = ns ? '    ' : ''
  const blocks: string[] = []
  // 葉節點在前(建立順序),較易閱讀
  for (const cls of gen.classes) {
    const lines: string[] = []
    lines.push(`${indent}public ${style} ${cls.name}`)
    lines.push(`${indent}{`)
    for (const f of cls.fields) {
      if (f.name !== f.rawKey) {
        const a = attr(f.rawKey)
        if (a) lines.push(`${indent}    ${a}`)
        else lines.push(`${indent}    // JSON 鍵: ${f.rawKey}`)
      }
      lines.push(`${indent}    public ${f.type} ${f.name} ${accessor}`)
    }
    lines.push(`${indent}}`)
    blocks.push(lines.join('\n'))
  }
  if (rootAlias) blocks.push(indent + rootAlias)

  let body = blocks.join('\n\n')
  if (ns) body = `namespace ${ns}\n{\n${body}\n}`

  return { ok: true, code: usings.join('\n') + '\n\n' + body + '\n' }
}
