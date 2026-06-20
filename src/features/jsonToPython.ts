// JSON → Python 型別 產生引擎 —— 貼上範例 JSON,推斷出對應的 Python 類別
// (dataclass / TypedDict / Pydantic BaseModel)。純函式、無 DOM,可在 Node 測試。
// 與 json-to-ts(TypeScript)、json-to-go(Go)互補。

export type PyStyle = 'dataclass' | 'typeddict' | 'pydantic'

interface PyField {
  name: string // Python 欄位名
  type: string // 型別字串
  rawKey: string // 原始 JSON 鍵(若與 name 不同則加註解)
}
interface PyClass {
  name: string
  fields: PyField[]
  sig: string
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// 把 JSON 鍵轉成類別名稱(PascalCase)
export function classNameFromKey(key: string): string {
  const words = key.replace(/[^A-Za-z0-9]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/\s+/).filter(Boolean)
  if (!words.length) return 'Model'
  let name = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('')
  if (/^[0-9]/.test(name)) name = '_' + name
  return name
}

// 粗略單數化(users → user)當作陣列元素類別名
function singular(name: string): string {
  if (/ies$/.test(name)) return name.replace(/ies$/, 'y')
  if (/sses$/.test(name)) return name.replace(/es$/, '')
  if (/[^s]s$/.test(name)) return name.slice(0, -1)
  return name
}

// 合法 Python 識別字?
function isIdentifier(s: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(s) && !PY_KEYWORDS.has(s)
}
const PY_KEYWORDS = new Set([
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue',
  'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in',
  'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
])

function fieldNameFromKey(key: string): string {
  if (isIdentifier(key)) return key
  let s = key.replace(/[^A-Za-z0-9_]/g, '_')
  if (/^[0-9]/.test(s)) s = '_' + s
  if (!s || !isIdentifier(s)) s = 'field_' + s
  return s
}

class Generator {
  classes: PyClass[] = []
  byName = new Map<string, PyClass>()

  // 把同名同結構的類別重用,否則加序號
  registerClass(baseName: string, fields: PyField[]): string {
    const sig = JSON.stringify(fields.map((f) => [f.name, f.type]))
    let candidate = baseName || 'Model'
    let i = 1
    while (this.byName.has(candidate)) {
      if (this.byName.get(candidate)!.sig === sig) return candidate
      candidate = baseName + i++
    }
    const cls: PyClass = { name: candidate, fields, sig }
    this.byName.set(candidate, cls)
    this.classes.push(cls)
    return candidate
  }

  scalarUnion(values: unknown[]): string {
    const set = new Set<string>()
    for (const v of values) {
      if (typeof v === 'boolean') set.add('bool')
      else if (typeof v === 'number') set.add(Number.isInteger(v) ? 'int' : 'float')
      else if (typeof v === 'string') set.add('str')
      else set.add('Any')
    }
    if (set.size === 1) return [...set][0]
    if (set.size === 2 && set.has('int') && set.has('float')) return 'float'
    return 'Any'
  }

  computeBase(nonNull: unknown[], name: string): string {
    if (nonNull.every(isPlainObject)) return this.makeClass(nonNull as Record<string, unknown>[], name)
    if (nonNull.every((v) => Array.isArray(v))) {
      const elements: unknown[] = []
      for (const arr of nonNull as unknown[][]) elements.push(...arr)
      return `List[${this.resolveType(elements, singular(name))}]`
    }
    return this.scalarUnion(nonNull)
  }

  resolveType(values: unknown[], name: string): string {
    const vals = values.filter((v) => v !== undefined)
    const hasNull = vals.some((v) => v === null)
    const nonNull = vals.filter((v) => v !== null)
    if (nonNull.length === 0) return 'Any'
    const base = this.computeBase(nonNull, name)
    return hasNull && base !== 'Any' ? `Optional[${base}]` : base
  }

  makeClass(objs: Record<string, unknown>[], name: string): string {
    const keyOrder: string[] = []
    const seen = new Set<string>()
    for (const o of objs) for (const k of Object.keys(o)) if (!seen.has(k)) { seen.add(k); keyOrder.push(k) }
    const fields: PyField[] = []
    for (const k of keyOrder) {
      const present = objs.filter((o) => Object.prototype.hasOwnProperty.call(o, k)).map((o) => o[k])
      const optionalByMissing = present.length < objs.length
      let t = this.resolveType(present, classNameFromKey(k))
      if (optionalByMissing && !t.startsWith('Optional[') && t !== 'Any') t = `Optional[${t}]`
      fields.push({ name: fieldNameFromKey(k), type: t, rawKey: k })
    }
    return this.registerClass(classNameFromKey(name), fields)
  }
}

export interface PyResult {
  ok: boolean
  code?: string
  error?: string
}

export function jsonToPython(jsonText: string, opts: { style?: PyStyle; rootName?: string } = {}): PyResult {
  const style = opts.style ?? 'dataclass'
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
    const t = gen.resolveType([data], elemName)
    rootAlias = `${rootName} = ${t}`
  } else {
    const t = gen.resolveType([data], rootName)
    rootAlias = `${rootName} = ${t}`
  }

  // 蒐集用到的 typing 名稱
  const allTypes = gen.classes.flatMap((c) => c.fields.map((f) => f.type)).concat(rootAlias)
  const used = (name: string) => allTypes.some((t) => new RegExp(`\\b${name}\\b`).test(t))
  const typingImports: string[] = []
  if (used('Any')) typingImports.push('Any')
  if (used('List')) typingImports.push('List')
  if (used('Optional')) typingImports.push('Optional')
  if (style === 'typeddict') typingImports.push('TypedDict')

  const header: string[] = ['from __future__ import annotations']
  if (style === 'dataclass') header.push('from dataclasses import dataclass')
  if (typingImports.length) header.push(`from typing import ${typingImports.join(', ')}`)
  if (style === 'pydantic') header.push('from pydantic import BaseModel')

  const blocks: string[] = []
  // 葉節點在前(建立順序),較易閱讀
  for (const cls of gen.classes) {
    const lines: string[] = []
    if (style === 'dataclass') lines.push('@dataclass')
    const base = style === 'typeddict' ? '(TypedDict)' : style === 'pydantic' ? '(BaseModel)' : ''
    lines.push(`class ${cls.name}${base}:`)
    if (cls.fields.length === 0) {
      lines.push('    pass')
    } else {
      for (const f of cls.fields) {
        const note = f.name !== f.rawKey ? `  # JSON 鍵: ${f.rawKey}` : ''
        lines.push(`    ${f.name}: ${f.type}${note}`)
      }
    }
    blocks.push(lines.join('\n'))
  }
  if (rootAlias) blocks.push(rootAlias)

  return { ok: true, code: header.join('\n') + '\n\n\n' + blocks.join('\n\n\n') + '\n' }
}
