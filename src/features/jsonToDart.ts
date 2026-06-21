// JSON → Dart class 產生引擎 —— 貼上範例 JSON,推斷出對應的 Dart class。
// 兩種模式:plain(自帶 fromJson 工廠 + toJson,免 codegen,Flutter 直接可用)、
// json_serializable(@JsonSerializable + @JsonKey,搭配 build_runner 產生序列化碼)。
// 屬性採 lowerCamelCase,與原鍵不同或撞關鍵字時:plain 模式 fromJson/toJson 以原鍵存取、
// json_serializable 模式自動補 @JsonKey(name:)。純函式、無 DOM,可在 Node 測試。
// 與 json-to-ts / go / python / rust / csharp / kotlin / java / swift 互補。

// 結構化型別參照,用來同時產出顯示型別與 fromJson/toJson 表達式
type TRef =
  | { kind: 'scalar'; dart: string } // int / double / bool / String
  | { kind: 'class'; name: string }
  | { kind: 'list'; elem: TRef; elemNullable: boolean }
  | { kind: 'dynamic' }

interface DField {
  name: string // lowerCamelCase 屬性名
  type: TRef
  nullable: boolean
  rawKey: string // 原始 JSON 鍵
}
interface DClass {
  name: string
  fields: DField[]
  sig: string
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// Dart 保留字(不能作為識別字,需改名)
const DART_RESERVED = new Set([
  'assert', 'break', 'case', 'catch', 'class', 'const', 'continue', 'default', 'do', 'else',
  'enum', 'extends', 'false', 'final', 'finally', 'for', 'if', 'in', 'is', 'new', 'null',
  'rethrow', 'return', 'super', 'switch', 'this', 'throw', 'true', 'try', 'var', 'void',
  'while', 'with', 'await', 'yield',
])

function splitWords(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

export function classNameFromKey(key: string): string {
  const words = splitWords(key)
  if (!words.length) return 'Root'
  let name = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('')
  if (/^[0-9]/.test(name)) name = 'N' + name
  return name
}

export function propNameFromKey(key: string): string {
  const words = splitWords(key)
  if (!words.length) return 'field'
  let name = words
    .map((w, i) => (i === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('')
  if (/^[0-9]/.test(name)) name = 'n' + name.charAt(0).toUpperCase() + name.slice(1)
  if (DART_RESERVED.has(name)) name = name + '_'
  return name
}

function singular(name: string): string {
  if (/ies$/.test(name)) return name.replace(/ies$/, 'y')
  if (/sses$/.test(name)) return name.replace(/es$/, '')
  if (/[^s]s$/.test(name)) return name.slice(0, -1)
  return name
}

// 顯示用型別字串(含可空 ?;dynamic 永遠不加 ? —— Dart 不允許 dynamic?)
function refStr(t: TRef, nullable: boolean): string {
  let base: string
  switch (t.kind) {
    case 'scalar': base = t.dart; break
    case 'class': base = t.name; break
    case 'dynamic': return 'dynamic'
    case 'list': base = `List<${refStr(t.elem, t.elemNullable)}>`; break
  }
  return nullable ? base + '?' : base
}
// 不含可空標記(供註解、簽章顯示)
function typeStr(t: TRef): string {
  return refStr(t, false)
}

class Generator {
  classes: DClass[] = []
  byName = new Map<string, DClass>()

  register(baseName: string, fields: DField[]): TRef {
    const sig = JSON.stringify(fields.map((f) => [f.name, typeStr(f.type), f.nullable, f.rawKey]))
    let candidate = baseName || 'Root'
    let i = 1
    while (this.byName.has(candidate)) {
      if (this.byName.get(candidate)!.sig === sig) return { kind: 'class', name: candidate }
      candidate = baseName + i++
    }
    const c: DClass = { name: candidate, fields, sig }
    this.byName.set(candidate, c)
    this.classes.push(c)
    return { kind: 'class', name: candidate }
  }

  scalarUnion(values: unknown[]): TRef {
    const set = new Set<string>()
    for (const v of values) {
      if (typeof v === 'boolean') set.add('bool')
      else if (typeof v === 'number') set.add(Number.isInteger(v) ? 'int' : 'double')
      else if (typeof v === 'string') set.add('String')
      else set.add('dynamic')
    }
    if (set.size === 1) {
      const t = [...set][0]
      return t === 'dynamic' ? { kind: 'dynamic' } : { kind: 'scalar', dart: t }
    }
    if (set.size === 2 && set.has('int') && set.has('double')) return { kind: 'scalar', dart: 'double' }
    return { kind: 'dynamic' }
  }

  computeBase(nonNull: unknown[], name: string): TRef {
    if (nonNull.every(isPlainObject)) return this.makeClass(nonNull as Record<string, unknown>[], name)
    if (nonNull.every((v) => Array.isArray(v))) {
      const elements: unknown[] = []
      for (const arr of nonNull as unknown[][]) elements.push(...arr)
      const r = this.resolveType(elements, singular(name))
      return { kind: 'list', elem: r.type, elemNullable: r.nullable }
    }
    return this.scalarUnion(nonNull)
  }

  resolveType(values: unknown[], name: string): { type: TRef; nullable: boolean } {
    const vals = values.filter((v) => v !== undefined)
    const hasNull = vals.some((v) => v === null)
    const nonNull = vals.filter((v) => v !== null)
    if (nonNull.length === 0) return { type: { kind: 'dynamic' }, nullable: true }
    return { type: this.computeBase(nonNull, name), nullable: hasNull }
  }

  makeClass(objs: Record<string, unknown>[], name: string): TRef {
    const keyOrder: string[] = []
    const seen = new Set<string>()
    for (const o of objs) for (const k of Object.keys(o)) if (!seen.has(k)) { seen.add(k); keyOrder.push(k) }
    const fields: DField[] = []
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
    return this.register(classNameFromKey(name), fields)
  }
}

// 由 dynamic 值(access)轉成指定型別的 Dart 表達式
function fromJsonExpr(access: string, t: TRef, nullable: boolean, depth: number): string {
  const q = nullable ? '?' : ''
  switch (t.kind) {
    case 'dynamic':
      return access
    case 'scalar':
      return `${access} as ${t.dart}${q}`
    case 'class':
      if (nullable) return `${access} == null ? null : ${t.name}.fromJson(${access} as Map<String, dynamic>)`
      return `${t.name}.fromJson(${access} as Map<String, dynamic>)`
    case 'list': {
      const v = depth === 0 ? 'e' : 'e' + depth
      const inner = fromJsonExpr(v, t.elem, t.elemNullable, depth + 1)
      const cast = `(${access} as List<dynamic>${q})`
      return `${cast}${q}.map((${v}) => ${inner}).toList()`
    }
  }
}

// 該型別轉 JSON 時是否需要呼叫 .toJson()(scalar/dynamic/scalar-list 不需要)
function needsToJson(t: TRef): boolean {
  if (t.kind === 'class') return true
  if (t.kind === 'list') return needsToJson(t.elem)
  return false
}

function toJsonExpr(access: string, t: TRef, nullable: boolean, depth: number): string {
  if (!needsToJson(t)) return access
  const q = nullable ? '?' : ''
  if (t.kind === 'class') return `${access}${q}.toJson()`
  // list 內含 class
  if (t.kind === 'list') {
    const v = depth === 0 ? 'e' : 'e' + depth
    const inner = toJsonExpr(v, t.elem, t.elemNullable, depth + 1)
    return `${access}${q}.map((${v}) => ${inner}).toList()`
  }
  return access
}

export interface DartResult {
  ok: boolean
  code?: string
  error?: string
}

function emitPlain(c: DClass): string {
  const L: string[] = [`class ${c.name} {`]
  for (const f of c.fields) {
    L.push(`  final ${refStr(f.type, f.nullable)} ${f.name};`)
  }
  L.push('')
  // 建構子:非可空 required,可空 optional
  const params = c.fields.map((f) => (f.nullable ? `this.${f.name}` : `required this.${f.name}`))
  L.push(params.length ? `  ${c.name}({${params.join(', ')}});` : `  ${c.name}();`)
  L.push('')
  // fromJson 工廠
  L.push(`  factory ${c.name}.fromJson(Map<String, dynamic> json) => ${c.name}(`)
  for (const f of c.fields) {
    L.push(`        ${f.name}: ${fromJsonExpr(`json[${JSON.stringify(f.rawKey)}]`, f.type, f.nullable, 0)},`)
  }
  L.push('      );')
  L.push('')
  // toJson
  L.push('  Map<String, dynamic> toJson() => {')
  for (const f of c.fields) {
    L.push(`        ${JSON.stringify(f.rawKey)}: ${toJsonExpr(f.name, f.type, f.nullable, 0)},`)
  }
  L.push('      };')
  L.push('}')
  return L.join('\n')
}

function emitSerializable(c: DClass): string {
  const L: string[] = ['@JsonSerializable()', `class ${c.name} {`]
  for (const f of c.fields) {
    if (f.name !== f.rawKey) L.push(`  @JsonKey(name: ${JSON.stringify(f.rawKey)})`)
    L.push(`  final ${refStr(f.type, f.nullable)} ${f.name};`)
  }
  L.push('')
  const params = c.fields.map((f) => (f.nullable ? `this.${f.name}` : `required this.${f.name}`))
  L.push(params.length ? `  ${c.name}({${params.join(', ')}});` : `  ${c.name}();`)
  L.push('')
  L.push(`  factory ${c.name}.fromJson(Map<String, dynamic> json) => _$${c.name}FromJson(json);`)
  L.push(`  Map<String, dynamic> toJson() => _$${c.name}ToJson(this);`)
  L.push('}')
  return L.join('\n')
}

export function jsonToDart(
  jsonText: string,
  opts: { rootName?: string; mode?: 'plain' | 'serializable'; partFile?: string } = {},
): DartResult {
  const mode = opts.mode ?? 'plain'
  const rootName = classNameFromKey(opts.rootName ?? 'Root')
  let data: unknown
  try {
    data = JSON.parse(jsonText)
  } catch (e) {
    return { ok: false, error: 'JSON 解析失敗:' + (e as Error).message }
  }

  const gen = new Generator()
  let rootNote = ''
  if (isPlainObject(data)) {
    gen.makeClass([data], rootName)
  } else if (Array.isArray(data)) {
    let elemName = singular(rootName)
    if (elemName === rootName) elemName = rootName + 'Item'
    const r = gen.resolveType([data], elemName)
    rootNote = `// 根為陣列,請直接用 ${typeStr(r.type)}`
  } else {
    const r = gen.resolveType([data], rootName)
    rootNote = `// 根為純量,型別為 ${typeStr(r.type)}`
  }

  const blocks = gen.classes.map((c) => (mode === 'serializable' ? emitSerializable(c) : emitPlain(c)))
  if (rootNote) blocks.push(rootNote)

  let head = ''
  if (mode === 'serializable') {
    const part = (opts.partFile || 'model').replace(/\.dart$/, '')
    head =
      "import 'package:json_annotation/json_annotation.dart';\n\n" +
      `part '${part}.g.dart';\n\n` +
      '// 執行 `dart run build_runner build` 產生序列化程式碼。\n\n'
  }
  return { ok: true, code: head + blocks.join('\n\n') + '\n' }
}
