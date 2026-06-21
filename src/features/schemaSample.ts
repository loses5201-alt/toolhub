// JSON Schema → 範例 JSON 產生引擎 —— 貼上 JSON Schema(draft-07 / 2020-12 常見子集),
// 產生一筆符合 schema 的範例資料,用於 API mock、測試假資料、看懂 schema 長相。
// 純函式、無 DOM,可在 Node 測試。與 json-schema(反向:JSON→Schema)、fake-data 互補。

type Json = unknown
interface SchemaNode {
  [k: string]: Json
}

function isObj(v: unknown): v is SchemaNode {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export interface SampleOptions {
  requiredOnly?: boolean // 物件只輸出 required 欄位(預設 false:全部輸出)
  arrayCount?: number // 陣列預設產生幾筆(預設 1)
}

// 依 format 給合理範例字串
function stringForFormat(format: string | undefined, node: SchemaNode): string {
  switch (format) {
    case 'email': return 'user@example.com'
    case 'date': return '2026-01-01'
    case 'date-time': return '2026-01-01T00:00:00Z'
    case 'time': return '00:00:00'
    case 'uri':
    case 'url': return 'https://example.com'
    case 'uri-reference': return '/path'
    case 'hostname': return 'example.com'
    case 'ipv4': return '192.0.2.1'
    case 'ipv6': return '2001:db8::1'
    case 'uuid': return '00000000-0000-0000-0000-000000000000'
    case 'duration': return 'P1D'
    case 'regex': return '.*'
    default: {
      const min = typeof node.minLength === 'number' ? node.minLength : 0
      let s = 'string'
      while (s.length < min) s += 'x'
      if (typeof node.maxLength === 'number' && s.length > node.maxLength) s = s.slice(0, node.maxLength)
      return s
    }
  }
}

function numberFor(node: SchemaNode, integer: boolean): number {
  let n: number
  if (typeof node.minimum === 'number') n = node.minimum
  else if (typeof node.exclusiveMinimum === 'number') n = node.exclusiveMinimum + (integer ? 1 : 0.1)
  else if (typeof node.maximum === 'number') n = node.maximum
  else n = integer ? 1 : 1.5
  if (typeof node.multipleOf === 'number' && node.multipleOf > 0) {
    n = Math.ceil(n / node.multipleOf) * node.multipleOf
  }
  return integer ? Math.round(n) : n
}

// 解析本地 $ref(#/definitions/X、#/$defs/X、#/properties/...)
function resolveRef(ref: string, root: SchemaNode): SchemaNode | null {
  if (!ref.startsWith('#')) return null
  const path = ref.slice(1).split('/').filter(Boolean).map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'))
  let cur: Json = root
  for (const seg of path) {
    if (!isObj(cur)) return null
    cur = cur[seg]
  }
  return isObj(cur) ? cur : null
}

class Generator {
  root: SchemaNode
  opts: Required<SampleOptions>
  constructor(root: SchemaNode, opts: SampleOptions) {
    this.root = root
    this.opts = { requiredOnly: opts.requiredOnly ?? false, arrayCount: Math.max(1, opts.arrayCount ?? 1) }
  }

  gen(node: Json, refPath: Set<string>, depth: number): Json {
    if (node === true) return {} // schema true:任何值
    if (node === false || !isObj(node)) return null
    if (depth > 8) return null

    // 明確值優先
    if ('const' in node) return node.const
    if ('default' in node) return node.default
    if (Array.isArray(node.examples) && node.examples.length) return node.examples[0]
    if (Array.isArray(node.enum) && node.enum.length) return node.enum[0]

    // $ref(避免無限遞迴)
    if (typeof node.$ref === 'string') {
      if (refPath.has(node.$ref)) return null
      const target = resolveRef(node.$ref, this.root)
      if (!target) return null
      const next = new Set(refPath)
      next.add(node.$ref)
      return this.gen(target, next, depth + 1)
    }

    // 組合:allOf 合併物件、anyOf/oneOf 取第一個
    if (Array.isArray(node.allOf) && node.allOf.length) {
      const merged: Record<string, Json> = {}
      let nonObj: Json = undefined
      for (const sub of node.allOf) {
        const v = this.gen(sub, refPath, depth + 1)
        if (isObj(v)) Object.assign(merged, v)
        else nonObj = v
      }
      // allOf 也可能與本身的 properties 並存
      if (isObj(node.properties) || node.type === 'object') {
        Object.assign(merged, this.genObject(node, refPath, depth) as Record<string, Json>)
      }
      return Object.keys(merged).length ? merged : nonObj ?? merged
    }
    for (const key of ['anyOf', 'oneOf'] as const) {
      const arr = node[key]
      if (Array.isArray(arr) && arr.length) return this.gen(arr[0], refPath, depth + 1)
    }

    // 型別(可為陣列,取第一個非 null)
    let type = node.type as string | string[] | undefined
    if (Array.isArray(type)) type = type.find((t) => t !== 'null') ?? type[0]
    if (!type) {
      if (isObj(node.properties)) type = 'object'
      else if ('items' in node) type = 'array'
      else return null
    }

    switch (type) {
      case 'object': return this.genObject(node, refPath, depth)
      case 'array': return this.genArray(node, refPath, depth)
      case 'string': return stringForFormat(node.format as string | undefined, node)
      case 'integer': return numberFor(node, true)
      case 'number': return numberFor(node, false)
      case 'boolean': return true
      case 'null': return null
      default: return null
    }
  }

  genObject(node: SchemaNode, refPath: Set<string>, depth: number): Json {
    const out: Record<string, Json> = {}
    const props = isObj(node.properties) ? node.properties : {}
    const required = Array.isArray(node.required) ? (node.required as string[]) : []
    const keys = this.opts.requiredOnly && required.length
      ? Object.keys(props).filter((k) => required.includes(k))
      : Object.keys(props)
    for (const k of keys) {
      out[k] = this.gen(props[k], refPath, depth + 1)
    }
    return out
  }

  genArray(node: SchemaNode, refPath: Set<string>, depth: number): Json {
    const items = node.items
    // tuple 形式:items 為陣列
    if (Array.isArray(items)) {
      return items.map((it) => this.gen(it, refPath, depth + 1))
    }
    if (items === undefined) return []
    const min = typeof node.minItems === 'number' ? node.minItems : 0
    let count = Math.max(this.opts.arrayCount, min)
    if (typeof node.maxItems === 'number') count = Math.min(count, node.maxItems)
    count = Math.max(0, count)
    const out: Json[] = []
    for (let i = 0; i < count; i++) out.push(this.gen(items, refPath, depth + 1))
    return out
  }
}

export interface SampleResult {
  ok: boolean
  sample?: string
  error?: string
}

export function sampleFromSchema(schemaText: string, opts: SampleOptions = {}): SampleResult {
  let schema: Json
  try {
    schema = JSON.parse(schemaText)
  } catch (e) {
    return { ok: false, error: 'JSON Schema 解析失敗:' + (e as Error).message }
  }
  if (!isObj(schema) && schema !== true) {
    return { ok: false, error: '根必須是一個 JSON Schema 物件' }
  }
  const gen = new Generator(isObj(schema) ? schema : {}, opts)
  const value = gen.gen(schema, new Set(), 0)
  return { ok: true, sample: JSON.stringify(value, null, 2) }
}
