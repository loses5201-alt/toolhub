// JSON → Protobuf(.proto,proto3)產生引擎 —— 貼上範例 JSON,推斷出對應的 proto3 message 定義。
// 純函式、無 DOM,可在 Node 測試。與 json-to-ts / go / python / rust / csharp / kotlin / java / swift / dart 互補。
//
// 型別對應:整數→int64、含小數→double、布林→bool、字串→string、物件→巢狀 message、
// 陣列→repeated;型別衝突或全 null→google.protobuf.Value(自動加 import);proto3 欄位皆為
// optional 語意(無 required),故 null / 缺鍵不影響型別,僅標註。proto3 不允許 repeated repeated,
// 故陣列的陣列自動產生 wrapper message(欄位 values)以維持合法。

type TRef =
  | { kind: 'scalar'; proto: string } // int64 / double / bool / string
  | { kind: 'message'; name: string }
  | { kind: 'list'; elem: TRef } // elem 保證非 list(巢狀已 wrap)
  | { kind: 'value' } // google.protobuf.Value

interface PField {
  name: string // snake_case 欄位名
  type: TRef
  rawKey: string
}
interface PMessage {
  name: string
  fields: PField[]
  sig: string
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function splitWords(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

export function messageNameFromKey(key: string): string {
  const words = splitWords(key)
  if (!words.length) return 'Root'
  let name = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('')
  if (/^[0-9]/.test(name)) name = 'N' + name
  return name
}

export function fieldNameFromKey(key: string): string {
  const words = splitWords(key)
  if (!words.length) return 'field'
  let name = words.map((w) => w.toLowerCase()).join('_')
  if (/^[0-9]/.test(name)) name = 'n_' + name
  return name
}

function singular(name: string): string {
  if (/ies$/.test(name)) return name.replace(/ies$/, 'y')
  if (/sses$/.test(name)) return name.replace(/es$/, '')
  if (/[^s]s$/.test(name)) return name.slice(0, -1)
  return name
}

function typeStr(t: TRef): string {
  switch (t.kind) {
    case 'scalar': return t.proto
    case 'message': return t.name
    case 'value': return 'google.protobuf.Value'
    case 'list': return `repeated ${typeStr(t.elem)}`
  }
}

class Generator {
  messages: PMessage[] = []
  byName = new Map<string, PMessage>()
  usesValue = false

  register(baseName: string, fields: PField[]): TRef {
    const sig = JSON.stringify(fields.map((f) => [f.name, typeStr(f.type), f.rawKey]))
    let candidate = baseName || 'Root'
    let i = 1
    while (this.byName.has(candidate)) {
      if (this.byName.get(candidate)!.sig === sig) return { kind: 'message', name: candidate }
      candidate = baseName + i++
    }
    const m: PMessage = { name: candidate, fields, sig }
    this.byName.set(candidate, m)
    this.messages.push(m)
    return { kind: 'message', name: candidate }
  }

  scalarUnion(values: unknown[]): TRef {
    const set = new Set<string>()
    for (const v of values) {
      if (typeof v === 'boolean') set.add('bool')
      else if (typeof v === 'number') set.add(Number.isInteger(v) ? 'int64' : 'double')
      else if (typeof v === 'string') set.add('string')
      else set.add('value')
    }
    if (set.size === 1) {
      const t = [...set][0]
      if (t === 'value') { this.usesValue = true; return { kind: 'value' } }
      return { kind: 'scalar', proto: t }
    }
    if (set.size === 2 && set.has('int64') && set.has('double')) return { kind: 'scalar', proto: 'double' }
    this.usesValue = true
    return { kind: 'value' }
  }

  // 解析陣列元素為 proto-safe TRef(若元素本身是陣列,wrap 成 message)
  protoElem(values: unknown[], name: string): TRef {
    const t = this.resolve(values, name)
    if (t.kind === 'list') {
      // 巢狀陣列:proto3 不允許 repeated repeated,改用 wrapper message { repeated <elem> values = 1; }
      return this.register(messageNameFromKey(name), [{ name: 'values', type: t, rawKey: 'values' }])
    }
    return t
  }

  resolve(values: unknown[], name: string): TRef {
    const nonNull = values.filter((v) => v !== null && v !== undefined)
    if (nonNull.length === 0) { this.usesValue = true; return { kind: 'value' } }
    if (nonNull.every(isPlainObject)) return this.makeMessage(nonNull as Record<string, unknown>[], name)
    if (nonNull.every((v) => Array.isArray(v))) {
      const elements: unknown[] = []
      for (const arr of nonNull as unknown[][]) elements.push(...arr)
      return { kind: 'list', elem: this.protoElem(elements, singular(name)) }
    }
    return this.scalarUnion(nonNull)
  }

  makeMessage(objs: Record<string, unknown>[], name: string): TRef {
    const keyOrder: string[] = []
    const seen = new Set<string>()
    for (const o of objs) for (const k of Object.keys(o)) if (!seen.has(k)) { seen.add(k); keyOrder.push(k) }
    const fields: PField[] = []
    for (const k of keyOrder) {
      const present = objs.filter((o) => Object.prototype.hasOwnProperty.call(o, k)).map((o) => o[k])
      fields.push({ name: fieldNameFromKey(k), type: this.resolve(present, messageNameFromKey(k)), rawKey: k })
    }
    return this.register(messageNameFromKey(name), fields)
  }
}

export interface ProtoResult {
  ok: boolean
  code?: string
  error?: string
}

function emit(m: PMessage): string {
  const L: string[] = [`message ${m.name} {`]
  let n = 1
  for (const f of m.fields) {
    // proto 慣例:json 鍵與 snake_case 欄位名不同時補 [json_name]
    const opt = f.name !== f.rawKey && /^[A-Za-z_][A-Za-z0-9_]*$/.test(f.rawKey)
      ? ` [json_name = "${f.rawKey}"]`
      : ''
    L.push(`  ${typeStr(f.type)} ${f.name} = ${n++}${opt};`)
  }
  L.push('}')
  return L.join('\n')
}

export function jsonToProto(
  jsonText: string,
  opts: { rootName?: string; packageName?: string } = {},
): ProtoResult {
  const rootName = messageNameFromKey(opts.rootName ?? 'Root')
  let data: unknown
  try {
    data = JSON.parse(jsonText)
  } catch (e) {
    return { ok: false, error: 'JSON 解析失敗:' + (e as Error).message }
  }

  const gen = new Generator()
  let rootNote = ''
  if (isPlainObject(data)) {
    gen.makeMessage([data], rootName)
  } else if (Array.isArray(data)) {
    let elemName = singular(rootName)
    if (elemName === rootName) elemName = rootName + 'Item'
    const t = gen.resolve([data], elemName)
    rootNote = `// 根為陣列,請用欄位 ${typeStr(t)}`
  } else {
    const t = gen.resolve([data], rootName)
    rootNote = `// 根為純量,型別為 ${typeStr(t)}`
  }

  // 依相依順序輸出(巢狀 message 先於使用者),messages 已依產生順序(葉節點在前)
  const blocks = gen.messages.map(emit)
  if (rootNote) blocks.push(rootNote)

  const head: string[] = ['syntax = "proto3";', '']
  if (opts.packageName && opts.packageName.trim()) {
    head.push(`package ${opts.packageName.trim()};`, '')
  }
  if (gen.usesValue) {
    head.push('import "google/protobuf/struct.proto";', '')
  }
  return { ok: true, code: head.join('\n') + blocks.join('\n\n') + '\n' }
}
