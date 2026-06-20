// JSONPath 查詢引擎 —— 以路徑運算式從 JSON 取出資料(Goessner 風格的實用子集)。
// 支援:$ 根、.key 與 ['key']、[index](負數)、[*] 與 .*、[a:b:c] 切片、
// ..(遞迴下降)、[?(...)] 過濾(== != < <= > >=、&&、||、@ 相對路徑、字串/數字/布林/null 字面值)。
// 純函式、無 DOM、不連網,可在 Node 測試。

export interface PathNode {
  value: unknown
  path: string // 正規化路徑,如 $['store']['book'][0]
}

export interface QueryResult {
  ok: boolean
  error?: string
  matches: PathNode[]
}

type StepType = 'child' | 'wildcard' | 'index' | 'slice' | 'filter'
interface Step {
  type: StepType
  descendant: boolean
  keys?: string[] // child
  indices?: number[] // index
  slice?: { start: number | null; end: number | null; step: number | null }
  expr?: string // filter
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function pathKey(k: string): string {
  return `['${k.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}']`
}

// 在頂層(忽略引號與括號內)尋找分隔字串,回傳切段
function splitTop(s: string, delim: string): string[] {
  const out: string[] = []
  let depth = 0
  let quote: string | null = null
  let buf = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (quote) {
      buf += c
      if (c === quote && s[i - 1] !== '\\') quote = null
      continue
    }
    if (c === '"' || c === "'") {
      quote = c
      buf += c
      continue
    }
    if (c === '[' || c === '(') depth++
    else if (c === ']' || c === ')') depth--
    if (depth === 0 && s.startsWith(delim, i)) {
      out.push(buf)
      buf = ''
      i += delim.length - 1
      continue
    }
    buf += c
  }
  out.push(buf)
  return out
}

function hasTop(s: string, ch: string): boolean {
  return splitTop(s, ch).length > 1
}

function unquote(s: string): string {
  s = s.trim()
  if (s.length >= 2 && (s[0] === '"' || s[0] === "'") && s[s.length - 1] === s[0]) {
    return s.slice(1, -1).replace(/\\(['"\\])/g, '$1')
  }
  return s
}

// ── 解析路徑字串成步驟陣列 ──
export function parsePath(path: string): Step[] {
  const p = path.trim()
  if (!p) throw new Error('路徑不可為空')
  let i = 0
  if (p[0] === '$') i = 1
  else if (p[0] !== '.' && p[0] !== '[') throw new Error("路徑須以 $ 開頭")
  const steps: Step[] = []

  function readName(): string {
    let name = ''
    while (i < p.length && !'.[]'.includes(p[i])) {
      name += p[i]
      i++
    }
    return name
  }

  while (i < p.length) {
    const c = p[i]
    if (c === '.') {
      let descendant = false
      i++
      if (p[i] === '.') {
        descendant = true
        i++
      }
      if (p[i] === '[') {
        const step = readBracket(p, i)
        step.step.descendant = descendant
        steps.push(step.step)
        i = step.next
      } else {
        const name = readName()
        if (name === '') throw new Error('. 後面缺少名稱')
        if (name === '*') steps.push({ type: 'wildcard', descendant })
        else steps.push({ type: 'child', descendant, keys: [name] })
      }
    } else if (c === '[') {
      const step = readBracket(p, i)
      steps.push(step.step)
      i = step.next
    } else {
      // 容許省略開頭點:$store → 視為 child
      const name = readName()
      if (name === '') throw new Error(`無法解析:${p.slice(i)}`)
      steps.push({ type: 'child', descendant: false, keys: [name] })
    }
  }
  return steps
}

function readBracket(p: string, i: number): { step: Step; next: number } {
  // p[i] === '['  找出配對的 ]
  let depth = 0
  let quote: string | null = null
  let j = i + 1
  for (; j < p.length; j++) {
    const c = p[j]
    if (quote) {
      if (c === quote && p[j - 1] !== '\\') quote = null
      continue
    }
    if (c === '"' || c === "'") quote = c
    else if (c === '[') depth++
    else if (c === ']') {
      if (depth === 0) break
      depth--
    }
  }
  if (j >= p.length) throw new Error('中括號未閉合 [')
  const inner = p.slice(i + 1, j).trim()
  return { step: parseBracketInner(inner), next: j + 1 }
}

function parseBracketInner(inner: string): Step {
  if (inner === '*') return { type: 'wildcard', descendant: false }
  if (inner.startsWith('?')) {
    const m = inner.match(/^\?\s*\(([\s\S]*)\)\s*$/)
    if (!m) throw new Error('過濾運算式格式錯誤,應為 [?(...)]')
    return { type: 'filter', descendant: false, expr: m[1].trim() }
  }
  // 切片 a:b:c(頂層含冒號且非引號鍵)
  if (hasTop(inner, ':') && !/^['"]/.test(inner)) {
    const parts = splitTop(inner, ':').map((x) => x.trim())
    if (parts.length > 3) throw new Error('切片最多 start:end:step 三段')
    const num = (x: string): number | null => (x === '' ? null : toInt(x))
    return {
      type: 'slice',
      descendant: false,
      slice: { start: num(parts[0]), end: num(parts[1] ?? ''), step: num(parts[2] ?? '') },
    }
  }
  // 字串鍵(可逗號聯集)
  if (/^['"]/.test(inner)) {
    const keys = splitTop(inner, ',').map((x) => unquote(x))
    return { type: 'child', descendant: false, keys }
  }
  // 數字索引(可逗號聯集)
  const indices = splitTop(inner, ',').map((x) => toInt(x.trim()))
  return { type: 'index', descendant: false, indices }
}

function toInt(s: string): number {
  if (!/^-?\d+$/.test(s.trim())) throw new Error(`不是整數:${s}`)
  return parseInt(s, 10)
}

// ── 查詢執行 ──
export function query(data: unknown, path: string): PathNode[] {
  const steps = parsePath(path)
  let nodes: PathNode[] = [{ value: data, path: '$' }]
  for (const step of steps) {
    const next: PathNode[] = []
    const bases = step.descendant ? nodes.flatMap(descendants) : nodes
    for (const n of bases) selectChildren(n, step, next)
    nodes = next
  }
  return nodes
}

function descendants(node: PathNode): PathNode[] {
  const out: PathNode[] = [node]
  const v = node.value
  if (Array.isArray(v)) {
    v.forEach((el, idx) => out.push(...descendants({ value: el, path: `${node.path}[${idx}]` })))
  } else if (isObject(v)) {
    for (const k of Object.keys(v)) out.push(...descendants({ value: v[k], path: node.path + pathKey(k) }))
  }
  return out
}

function selectChildren(node: PathNode, step: Step, out: PathNode[]): void {
  const v = node.value
  switch (step.type) {
    case 'child':
      for (const k of step.keys!) {
        if (isObject(v) && Object.prototype.hasOwnProperty.call(v, k)) {
          out.push({ value: v[k], path: node.path + pathKey(k) })
        }
      }
      break
    case 'wildcard':
      if (Array.isArray(v)) v.forEach((el, i) => out.push({ value: el, path: `${node.path}[${i}]` }))
      else if (isObject(v)) for (const k of Object.keys(v)) out.push({ value: v[k], path: node.path + pathKey(k) })
      break
    case 'index':
      if (Array.isArray(v)) {
        for (const raw of step.indices!) {
          const idx = raw < 0 ? v.length + raw : raw
          if (idx >= 0 && idx < v.length) out.push({ value: v[idx], path: `${node.path}[${idx}]` })
        }
      }
      break
    case 'slice':
      if (Array.isArray(v)) sliceNodes(v, step.slice!, node.path, out)
      break
    case 'filter':
      applyFilter(v, step.expr!, node.path, out)
      break
  }
}

function sliceNodes(arr: unknown[], sl: { start: number | null; end: number | null; step: number | null }, base: string, out: PathNode[]): void {
  const n = arr.length
  const step = sl.step ?? 1
  if (step === 0) return
  const norm = (x: number | null, def: number): number => {
    if (x === null) return def
    return x < 0 ? Math.max(n + x, step > 0 ? 0 : -1) : Math.min(x, step > 0 ? n : n - 1)
  }
  if (step > 0) {
    const start = norm(sl.start, 0)
    const end = norm(sl.end, n)
    for (let i = start; i < end; i += step) out.push({ value: arr[i], path: `${base}[${i}]` })
  } else {
    const start = norm(sl.start, n - 1)
    const end = sl.end === null ? -1 : sl.end < 0 ? n + sl.end : sl.end
    for (let i = start; i > end; i += step) if (i >= 0 && i < n) out.push({ value: arr[i], path: `${base}[${i}]` })
  }
}

function applyFilter(v: unknown, expr: string, base: string, out: PathNode[]): void {
  const test = makeFilter(expr)
  if (Array.isArray(v)) {
    v.forEach((el, i) => {
      if (test(el)) out.push({ value: el, path: `${base}[${i}]` })
    })
  } else if (isObject(v)) {
    for (const k of Object.keys(v)) if (test(v[k])) out.push({ value: v[k], path: base + pathKey(k) })
  }
}

// ── 過濾運算式 ──
function makeFilter(expr: string): (value: unknown) => boolean {
  const orGroups = splitTop(expr, '||').map((g) => splitTop(g, '&&').map((t) => t.trim()))
  return (value: unknown) => orGroups.some((and) => and.every((term) => evalTerm(term, value)))
}

const OPS = ['==', '!=', '<=', '>=', '<', '>']
function evalTerm(term: string, value: unknown): boolean {
  for (const op of OPS) {
    const parts = splitTop(term, op)
    if (parts.length === 2) {
      const l = resolveOperand(parts[0].trim(), value)
      const r = resolveOperand(parts[1].trim(), value)
      return compare(l.value, op, r.value, l.found, r.found)
    }
  }
  // 存在性 / 真值測試
  const res = resolveOperand(term, value)
  return res.found && res.value !== false && res.value !== null && res.value !== undefined
}

function resolveOperand(s: string, value: unknown): { found: boolean; value: unknown } {
  s = s.trim()
  if (s.startsWith('@')) {
    const sub = '$' + s.slice(1)
    let res: PathNode[]
    try {
      res = query(value, sub)
    } catch {
      return { found: false, value: undefined }
    }
    return res.length > 0 ? { found: true, value: res[0].value } : { found: false, value: undefined }
  }
  return { found: true, value: parseLiteral(s) }
}

function parseLiteral(s: string): unknown {
  if (s === 'true') return true
  if (s === 'false') return false
  if (s === 'null') return null
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s)) return Number(s)
  return unquote(s)
}

function compare(l: unknown, op: string, r: unknown, lFound: boolean, rFound: boolean): boolean {
  if (op === '==') return lFound === rFound && l === r
  if (op === '!=') return !(lFound === rFound && l === r)
  if (!lFound || !rFound) return false
  if (typeof l !== typeof r) return false
  if (typeof l === 'number' && typeof r === 'number') {
    return op === '<' ? l < r : op === '<=' ? l <= r : op === '>' ? l > r : l >= r
  }
  if (typeof l === 'string' && typeof r === 'string') {
    return op === '<' ? l < r : op === '<=' ? l <= r : op === '>' ? l > r : l >= r
  }
  return false
}

// ── 對外:解析 JSON 字串並查詢 ──
export function evaluate(jsonText: string, path: string): QueryResult {
  let data: unknown
  try {
    data = JSON.parse(jsonText)
  } catch (e) {
    return { ok: false, error: 'JSON 解析失敗:' + (e as Error).message, matches: [] }
  }
  try {
    return { ok: true, matches: query(data, path) }
  } catch (e) {
    return { ok: false, error: (e as Error).message, matches: [] }
  }
}
