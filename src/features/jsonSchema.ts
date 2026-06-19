/*
  JSON Schema 產生器核心 —— 由一段範例 JSON 推斷出 JSON Schema(draft-07)。
  陣列會合併所有元素的結構、物件的 required 取「所有樣本都出現」的鍵。
  純函式、無 DOM,可在 Node 測;全程瀏覽器、不連網、不上傳。
*/

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [k: string]: JsonValue }

// Schema 用一般物件表示(draft-07 子集)
export interface Schema {
  type?: string
  properties?: Record<string, Schema>
  required?: string[]
  items?: Schema
  format?: string
  anyOf?: Schema[]
  [k: string]: unknown
}

export interface InferOptions {
  detectFormat?: boolean // 偵測 string 的 email / date-time / uri 等格式
  requireAll?: boolean // 物件鍵是否全列為 required(預設 true)
}

function jsonType(v: JsonValue): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  const t = typeof v
  if (t === 'number') return Number.isInteger(v as number) ? 'integer' : 'number'
  if (t === 'boolean') return 'boolean'
  if (t === 'string') return 'string'
  return 'object'
}

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RE_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/
const RE_DATE = /^\d{4}-\d{2}-\d{2}$/
const RE_URI = /^https?:\/\/[^\s]+$/
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function detectStringFormat(s: string): string | undefined {
  if (RE_DATETIME.test(s)) return 'date-time'
  if (RE_DATE.test(s)) return 'date'
  if (RE_EMAIL.test(s)) return 'email'
  if (RE_UUID.test(s)) return 'uuid'
  if (RE_URI.test(s)) return 'uri'
  return undefined
}

/** 推斷單一值的 schema(不含 $schema 包裝)。 */
export function inferSchema(value: JsonValue, options: InferOptions = {}): Schema {
  const opt = { detectFormat: true, requireAll: true, ...options }
  const t = jsonType(value)
  switch (t) {
    case 'null':
      return { type: 'null' }
    case 'boolean':
      return { type: 'boolean' }
    case 'integer':
      return { type: 'integer' }
    case 'number':
      return { type: 'number' }
    case 'string': {
      const schema: Schema = { type: 'string' }
      if (opt.detectFormat) {
        const fmt = detectStringFormat(value as string)
        if (fmt) schema.format = fmt
      }
      return schema
    }
    case 'array': {
      const arr = value as JsonValue[]
      if (arr.length === 0) return { type: 'array' }
      const itemSchemas = arr.map((el) => inferSchema(el, opt))
      return { type: 'array', items: mergeSchemas(itemSchemas) }
    }
    default: {
      const obj = value as Record<string, JsonValue>
      const keys = Object.keys(obj)
      const properties: Record<string, Schema> = {}
      for (const k of keys) properties[k] = inferSchema(obj[k], opt)
      const schema: Schema = { type: 'object', properties }
      if (opt.requireAll && keys.length) schema.required = [...keys]
      return schema
    }
  }
}

/** 合併多個 schema 成一個(用於陣列元素、跨樣本物件)。 */
export function mergeSchemas(schemas: Schema[]): Schema {
  return schemas.reduce((acc, s) => mergeTwo(acc, s))
}

function sameType(a: Schema, b: Schema): boolean {
  return a.type === b.type && !a.anyOf && !b.anyOf
}

function mergeTwo(a: Schema, b: Schema): Schema {
  if (JSON.stringify(a) === JSON.stringify(b)) return a

  // integer + number → number
  if (
    (a.type === 'integer' && b.type === 'number') ||
    (a.type === 'number' && b.type === 'integer')
  ) {
    return { type: 'number' }
  }

  // 兩個物件:合併 properties,required 取交集(所有樣本都出現的鍵)
  if (sameType(a, b) && a.type === 'object') {
    const props: Record<string, Schema> = {}
    const aProps = a.properties || {}
    const bProps = b.properties || {}
    const allKeys = new Set([...Object.keys(aProps), ...Object.keys(bProps)])
    for (const k of allKeys) {
      if (aProps[k] && bProps[k]) props[k] = mergeTwo(aProps[k], bProps[k])
      else props[k] = aProps[k] || bProps[k]
    }
    const aReq = new Set(a.required || [])
    const required = (b.required || []).filter((k) => aReq.has(k))
    const out: Schema = { type: 'object', properties: props }
    if (required.length) out.required = required.sort()
    return out
  }

  // 兩個陣列:合併 items
  if (sameType(a, b) && a.type === 'array') {
    if (a.items && b.items) return { type: 'array', items: mergeTwo(a.items, b.items) }
    return { type: 'array', items: a.items || b.items || {} }
  }

  // 相同基本型別但細節不同(如 string 有無 format)→ 取較寬鬆(去掉 format)
  if (sameType(a, b)) {
    return { type: a.type }
  }

  // 型別不同 → anyOf(攤平、去重)
  const variants: Schema[] = []
  const push = (s: Schema) => {
    if (s.anyOf) s.anyOf.forEach((v) => push(v))
    else if (!variants.some((v) => JSON.stringify(v) === JSON.stringify(s))) variants.push(s)
  }
  push(a)
  push(b)
  if (variants.length === 1) return variants[0]
  return { anyOf: variants }
}

/** 產出完整 schema(含 $schema 標頭),並回傳格式化 JSON 字串。 */
export function buildSchema(value: JsonValue, options: InferOptions = {}): Schema {
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    ...inferSchema(value, options),
  }
}

export interface GenerateResult {
  ok: boolean
  schema?: string
  error?: string
}

/** 從 JSON 文字產生 schema 字串(含解析錯誤處理)。 */
export function generate(jsonText: string, options: InferOptions = {}): GenerateResult {
  let parsed: JsonValue
  try {
    parsed = JSON.parse(jsonText)
  } catch (e) {
    return { ok: false, error: 'JSON 解析失敗:' + (e instanceof Error ? e.message : String(e)) }
  }
  const schema = buildSchema(parsed, options)
  return { ok: true, schema: JSON.stringify(schema, null, 2) }
}
