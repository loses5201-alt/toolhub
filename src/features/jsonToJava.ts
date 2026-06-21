// JSON → Java class / record 產生引擎 —— 貼上範例 JSON,推斷出對應的 Java 類別。
// 可選 Jackson(@JsonProperty)/ Gson(@SerializedName)/ 無 的序列化標註,並支援 class 與 record 兩種樣式。
// 純函式、無 DOM,可在 Node 測試。與 json-to-ts / go / python / rust / csharp / kotlin 互補。

export type JavaLib = 'jackson' | 'gson' | 'none'
export type JavaStyle = 'class' | 'record'

interface JField {
  name: string // camelCase 屬性名(已避開關鍵字)
  type: string // 型別字串(一律用裝箱型別,JSON 缺值/ null 才放得進去)
  rawKey: string // 原始 JSON 鍵(若與 name 不同則加序列化標註)
}
interface JClass {
  name: string
  fields: JField[]
  sig: string
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

const JAVA_KEYWORDS = new Set([
  'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class', 'const',
  'continue', 'default', 'do', 'double', 'else', 'enum', 'extends', 'final', 'finally', 'float',
  'for', 'goto', 'if', 'implements', 'import', 'instanceof', 'int', 'interface', 'long', 'native',
  'new', 'package', 'private', 'protected', 'public', 'return', 'short', 'static', 'strictfp',
  'super', 'switch', 'synchronized', 'this', 'throw', 'throws', 'transient', 'try', 'void',
  'volatile', 'while', 'true', 'false', 'null', 'var', 'record', 'yield', 'sealed', 'permits',
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

// 把 JSON 鍵轉成 camelCase 屬性名(撞 Java 關鍵字補底線)
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
  if (JAVA_KEYWORDS.has(name)) name = name + '_'
  return name
}

function singular(name: string): string {
  if (/ies$/.test(name)) return name.replace(/ies$/, 'y')
  if (/sses$/.test(name)) return name.replace(/es$/, '')
  if (/[^s]s$/.test(name)) return name.slice(0, -1)
  return name
}

class Generator {
  classes: JClass[] = []
  byName = new Map<string, JClass>()
  usesList = false

  registerClass(baseName: string, fields: JField[]): string {
    const sig = JSON.stringify(fields.map((f) => [f.name, f.type, f.rawKey]))
    let candidate = baseName || 'Root'
    let i = 1
    while (this.byName.has(candidate)) {
      if (this.byName.get(candidate)!.sig === sig) return candidate
      candidate = baseName + i++
    }
    const c: JClass = { name: candidate, fields, sig }
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
      else set.add('Object')
    }
    if (set.size === 1) return [...set][0]
    if (set.size === 2 && set.has('Long') && set.has('Double')) return 'Double'
    return 'Object'
  }

  computeBase(nonNull: unknown[], name: string): string {
    if (nonNull.every(isPlainObject)) return this.makeClass(nonNull as Record<string, unknown>[], name)
    if (nonNull.every((v) => Array.isArray(v))) {
      const elements: unknown[] = []
      for (const arr of nonNull as unknown[][]) elements.push(...arr)
      this.usesList = true
      return `List<${this.resolveType(elements, singular(name))}>`
    }
    return this.scalarUnion(nonNull)
  }

  resolveType(values: unknown[], name: string): string {
    const vals = values.filter((v) => v !== undefined)
    const nonNull = vals.filter((v) => v !== null)
    if (nonNull.length === 0) return 'Object'
    return this.computeBase(nonNull, name)
  }

  makeClass(objs: Record<string, unknown>[], name: string): string {
    const keyOrder: string[] = []
    const seen = new Set<string>()
    for (const o of objs) for (const k of Object.keys(o)) if (!seen.has(k)) { seen.add(k); keyOrder.push(k) }
    const fields: JField[] = []
    for (const k of keyOrder) {
      const present = objs.filter((o) => Object.prototype.hasOwnProperty.call(o, k)).map((o) => o[k])
      fields.push({
        name: propNameFromKey(k),
        type: this.resolveType(present, classNameFromKey(k)),
        rawKey: k,
      })
    }
    return this.registerClass(classNameFromKey(name), fields)
  }
}

export interface JavaResult {
  ok: boolean
  code?: string
  error?: string
}

export function jsonToJava(
  jsonText: string,
  opts: { lib?: JavaLib; style?: JavaStyle; rootName?: string } = {},
): JavaResult {
  const lib = opts.lib ?? 'jackson'
  const style = opts.style ?? 'class'
  const rootName = classNameFromKey(opts.rootName ?? 'Root')
  let data: unknown
  try {
    data = JSON.parse(jsonText)
  } catch (e) {
    return { ok: false, error: 'JSON 解析失敗:' + (e as Error).message }
  }

  const gen = new Generator()
  let rootClass = ''
  let rootAlias = ''
  if (isPlainObject(data)) {
    rootClass = gen.makeClass([data], rootName)
  } else if (Array.isArray(data)) {
    let elemName = singular(rootName)
    if (elemName === rootName) elemName = rootName + 'Item'
    const t = gen.resolveType([data], elemName)
    rootAlias = `// 根為陣列,請直接用 ${t}`
  } else {
    const t = gen.resolveType([data], rootName)
    rootAlias = `// 根為純量,型別為 ${t}`
  }

  // rename 標註(屬性名與原鍵不同時)
  const renameAnno = (key: string): string | null => {
    if (lib === 'jackson') return `@JsonProperty(${JSON.stringify(key)})`
    if (lib === 'gson') return `@SerializedName(${JSON.stringify(key)})`
    return null
  }

  const blocks: string[] = []
  for (const cls of gen.classes) {
    // 一個 .java 檔只能有一個 public 頂層型別,根類別 public、其餘 package-private
    const mod = cls.name === rootClass ? 'public ' : ''
    if (style === 'record') {
      if (cls.fields.length === 0) {
        blocks.push(`${mod}record ${cls.name}() {}`)
        continue
      }
      const params = cls.fields.map((f, idx) => {
        const comma = idx < cls.fields.length - 1 ? ',' : ''
        if (f.name !== f.rawKey) {
          const a = renameAnno(f.rawKey)
          if (a) return `    ${a} ${f.type} ${f.name}${comma}`
          return `    // JSON 鍵: ${f.rawKey}\n    ${f.type} ${f.name}${comma}`
        }
        return `    ${f.type} ${f.name}${comma}`
      })
      blocks.push(`${mod}record ${cls.name}(\n${params.join('\n')}\n) {}`)
      continue
    }
    // class 樣式:public 欄位
    const lines: string[] = [`${mod}class ${cls.name} {`]
    cls.fields.forEach((f) => {
      if (f.name !== f.rawKey) {
        const a = renameAnno(f.rawKey)
        if (a) lines.push(`    ${a}`)
        else lines.push(`    // JSON 鍵: ${f.rawKey}`)
      }
      lines.push(`    public ${f.type} ${f.name};`)
    })
    lines.push('}')
    blocks.push(lines.join('\n'))
  }
  if (rootAlias) blocks.push(rootAlias)

  const imports: string[] = []
  if (gen.usesList) imports.push('import java.util.List;')
  if (lib === 'jackson') imports.push('import com.fasterxml.jackson.annotation.JsonProperty;')
  else if (lib === 'gson') imports.push('import com.google.gson.annotations.SerializedName;')

  const head = imports.length ? imports.join('\n') + '\n\n' : ''
  return { ok: true, code: head + blocks.join('\n\n') + '\n' }
}
