/*
  JSON 查詢引擎(JSONPath 子集,純函式、無 DOM,可在 Node 直接測)。

  用途:從又大又深的 API 回應 / 設定 / log JSON 裡,用路徑表達式直接撈出要的值,
  免自己一層層展開。API 回應常含 token、個資,不該貼到線上 JSONPath 工具;
  本引擎全程在瀏覽器執行、不上傳。

  支援的語法(刻意收斂為「正確且可測」的子集):
    $              根節點(可省略)
    .key / key     物件屬性
    ["key"]        含特殊字元/空白的屬性(單或雙引號)
    [n] / [-1]     陣列索引(負數由尾端起算)
    [*] / *        萬用:物件所有值 / 陣列所有元素
    ..             遞迴下降(任意深度),後接 key / * / [...]
    [start:end:step]  陣列切片(可省略任一段;step 預設 1)
    [?(@.field OP value)]  過濾(OP:== != < <= > >= ;或只寫 @.field 表示「存在」)

  不支援(會誠實報錯或忽略):過濾器的 && ||、多重聯集 [a,b]、函式、運算式。
*/

export interface QueryResult {
  ok: boolean
  results: unknown[]
  output: string
  count: number
  error: string
}

type Selector =
  | { t: 'child'; name: string }
  | { t: 'index'; i: number }
  | { t: 'wild' }
  | { t: 'recurse' }
  | { t: 'slice'; start?: number; end?: number; step: number }
  | { t: 'filter'; path: string[]; op: string; value: unknown; hasOp: boolean }

const NAME_CHAR = /[A-Za-z0-9_$À-￿-]/
const NAME_START = /[A-Za-z_$À-￿]/

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// ── 路徑解析 ────────────────────────────────────────────
interface ParseOk {
  ok: true
  sels: Selector[]
}
interface ParseErr {
  ok: false
  error: string
}

function parsePath(expr: string): ParseOk | ParseErr {
  const sels: Selector[] = []
  let i = 0
  const s = expr.trim()
  const n = s.length
  if (s[0] === '$') i = 1

  function readName(): string {
    let name = ''
    while (i < n && NAME_CHAR.test(s[i])) name += s[i++]
    return name
  }

  while (i < n) {
    const c = s[i]
    if (c === '.') {
      if (s[i + 1] === '.') {
        sels.push({ t: 'recurse' })
        i += 2
        // 遞迴後可直接接 name 或 *(也可能接 [ 由下一輪處理)
        if (i < n && s[i] === '*') {
          sels.push({ t: 'wild' })
          i++
        } else if (i < n && NAME_START.test(s[i])) {
          sels.push({ t: 'child', name: readName() })
        }
        continue
      }
      i++ // 吃掉單一 '.'
      if (s[i] === '*') {
        sels.push({ t: 'wild' })
        i++
        continue
      }
      if (i >= n || !NAME_START.test(s[i])) return { ok: false, error: `'.' 後面要接屬性名稱(位置 ${i + 1})` }
      sels.push({ t: 'child', name: readName() })
      continue
    }
    if (c === '[') {
      const close = findBracketEnd(s, i)
      if (close === -1) return { ok: false, error: `中括號 [ 沒有對應的 ]` }
      const inner = s.slice(i + 1, close).trim()
      const sel = parseBracket(inner)
      if ('error' in sel) return { ok: false, error: sel.error }
      sels.push(sel.sel)
      i = close + 1
      continue
    }
    if (c === '*') {
      sels.push({ t: 'wild' })
      i++
      continue
    }
    if (NAME_START.test(c)) {
      // 開頭直接寫屬性名(未加 $ 或 .)
      sels.push({ t: 'child', name: readName() })
      continue
    }
    if (c === ' ' || c === '\t' || c === '\n') {
      i++
      continue
    }
    return { ok: false, error: `無法解析的字元「${c}」(位置 ${i + 1})` }
  }
  return { ok: true, sels }
}

/** 找到與位置 lt 的 '[' 對應的 ']'(略過引號內的 ])。 */
function findBracketEnd(s: string, lt: number): number {
  let quote = ''
  for (let i = lt + 1; i < s.length; i++) {
    const c = s[i]
    if (quote) {
      if (c === quote) quote = ''
    } else if (c === '"' || c === "'") {
      quote = c
    } else if (c === ']') {
      return i
    }
  }
  return -1
}

function parseBracket(inner: string): { sel: Selector } | { error: string } {
  if (inner === '*') return { sel: { t: 'wild' } }
  // 引號屬性名
  if ((inner[0] === '"' && inner.endsWith('"')) || (inner[0] === "'" && inner.endsWith("'"))) {
    return { sel: { t: 'child', name: inner.slice(1, -1) } }
  }
  // 過濾器 ?( ... )
  if (inner[0] === '?') {
    const m = /^\?\s*\(([\s\S]*)\)\s*$/.exec(inner)
    if (!m) return { error: `過濾器格式應為 [?(@.欄位 == 值)]` }
    return parseFilter(m[1].trim())
  }
  // 切片 a:b:c
  if (inner.includes(':')) {
    const parts = inner.split(':')
    if (parts.length > 3) return { error: `切片最多 start:end:step 三段` }
    const num = (x: string): number | undefined => {
      const t = x.trim()
      if (t === '') return undefined
      const v = Number(t)
      if (!Number.isInteger(v)) return NaN
      return v
    }
    const start = num(parts[0])
    const end = num(parts[1])
    const stepRaw = parts.length === 3 ? num(parts[2]) : 1
    if (Number.isNaN(start) || Number.isNaN(end) || Number.isNaN(stepRaw))
      return { error: `切片只接受整數` }
    const step = stepRaw === undefined ? 1 : stepRaw
    if (step === 0) return { error: `切片 step 不能為 0` }
    return { sel: { t: 'slice', start, end, step } }
  }
  // 整數索引
  if (/^-?\d+$/.test(inner)) return { sel: { t: 'index', i: parseInt(inner, 10) } }
  return { error: `無法解析中括號內容「${inner}」` }
}

function parseFilter(body: string): { sel: Selector } | { error: string } {
  if (body[0] !== '@') return { error: `過濾條件需以 @ 開頭(例 @.price > 100)` }
  // 讀 @ 之後的路徑 .a.b
  let i = 1
  const path: string[] = []
  while (i < body.length && body[i] === '.') {
    i++
    let name = ''
    while (i < body.length && NAME_CHAR.test(body[i])) name += body[i++]
    if (!name) return { error: `過濾條件的欄位名稱無效` }
    path.push(name)
  }
  const rest = body.slice(i).trim()
  if (rest === '') return { sel: { t: 'filter', path, op: '', value: undefined, hasOp: false } }
  const m = /^(==|!=|<=|>=|<|>)\s*([\s\S]+)$/.exec(rest)
  if (!m) return { error: `過濾條件無法解析:${rest}` }
  const op = m[1]
  const lit = m[2].trim()
  let value: unknown
  if ((lit[0] === '"' && lit.endsWith('"')) || (lit[0] === "'" && lit.endsWith("'"))) {
    value = lit.slice(1, -1)
  } else if (lit === 'true') value = true
  else if (lit === 'false') value = false
  else if (lit === 'null') value = null
  else if (/^-?\d+(\.\d+)?$/.test(lit)) value = Number(lit)
  else return { error: `過濾條件的值無法解析:${lit}` }
  return { sel: { t: 'filter', path, op, value, hasOp: true } }
}

// ── 求值 ────────────────────────────────────────────────
function resolvePath(node: unknown, path: string[]): unknown {
  let cur = node
  for (const k of path) {
    if (!isObject(cur)) return undefined
    cur = cur[k]
  }
  return cur
}

function matchFilter(node: unknown, sel: Extract<Selector, { t: 'filter' }>): boolean {
  const target = resolvePath(node, sel.path)
  if (!sel.hasOp) return target !== undefined
  if (target === undefined) return false
  const v = sel.value
  switch (sel.op) {
    case '==':
      return target === v || String(target) === String(v)
    case '!=':
      return !(target === v || String(target) === String(v))
    case '<':
    case '<=':
    case '>':
    case '>=': {
      const a = typeof target === 'number' && typeof v === 'number' ? target : String(target)
      const b = typeof target === 'number' && typeof v === 'number' ? (v as number) : String(v)
      if (sel.op === '<') return a < b
      if (sel.op === '<=') return a <= b
      if (sel.op === '>') return a > b
      return a >= b
    }
    default:
      return false
  }
}

function collectDescendants(node: unknown, out: unknown[]) {
  out.push(node)
  if (Array.isArray(node)) for (const v of node) collectDescendants(v, out)
  else if (isObject(node)) for (const k of Object.keys(node)) collectDescendants(node[k], out)
}

function evaluate(root: unknown, sels: Selector[]): unknown[] {
  let cur: unknown[] = [root]
  for (const sel of sels) {
    const next: unknown[] = []
    if (sel.t === 'recurse') {
      for (const node of cur) collectDescendants(node, next)
      cur = next
      continue
    }
    for (const node of cur) {
      switch (sel.t) {
        case 'child':
          if (isObject(node) && sel.name in node) next.push(node[sel.name])
          break
        case 'index':
          if (Array.isArray(node)) {
            const idx = sel.i < 0 ? node.length + sel.i : sel.i
            if (idx >= 0 && idx < node.length) next.push(node[idx])
          }
          break
        case 'wild':
          if (Array.isArray(node)) for (const v of node) next.push(v)
          else if (isObject(node)) for (const k of Object.keys(node)) next.push(node[k])
          break
        case 'slice':
          if (Array.isArray(node)) {
            for (const v of sliceArray(node, sel)) next.push(v)
          }
          break
        case 'filter':
          if (Array.isArray(node)) {
            for (const v of node) if (matchFilter(v, sel)) next.push(v)
          } else if (isObject(node)) {
            for (const k of Object.keys(node)) if (matchFilter(node[k], sel)) next.push(node[k])
          }
          break
      }
    }
    cur = next
  }
  return cur
}

function sliceArray(arr: unknown[], sel: Extract<Selector, { t: 'slice' }>): unknown[] {
  const len = arr.length
  const step = sel.step
  const norm = (v: number | undefined, dflt: number): number => {
    if (v === undefined) return dflt
    return v < 0 ? Math.max(len + v, 0) : Math.min(v, len)
  }
  const out: unknown[] = []
  if (step > 0) {
    const start = norm(sel.start, 0)
    const end = norm(sel.end, len)
    for (let i = start; i < end; i += step) out.push(arr[i])
  } else {
    const start = sel.start === undefined ? len - 1 : sel.start < 0 ? len + sel.start : Math.min(sel.start, len - 1)
    const end = sel.end === undefined ? -1 : sel.end < 0 ? len + sel.end : sel.end
    for (let i = start; i > end; i += step) if (i >= 0 && i < len) out.push(arr[i])
  }
  return out
}

/** 主入口:輸入 JSON 字串與路徑,回傳符合的值清單。 */
export function queryJson(jsonText: string, pathExpr: string): QueryResult {
  const empty = (error: string): QueryResult => ({ ok: false, results: [], output: '', count: 0, error })
  if (!jsonText.trim()) return empty('請先貼上 JSON 內容。')
  if (!pathExpr.trim()) return empty('請輸入查詢路徑(例:$.store.book[*].title)。')
  let data: unknown
  try {
    data = JSON.parse(jsonText)
  } catch (e) {
    return empty('JSON 解析失敗:' + (e as Error).message)
  }
  const parsed = parsePath(pathExpr)
  if (!parsed.ok) return empty('路徑解析失敗:' + parsed.error)
  let results: unknown[]
  try {
    results = evaluate(data, parsed.sels)
  } catch (e) {
    return empty('查詢失敗:' + (e as Error).message)
  }
  const output = JSON.stringify(results, null, 2)
  return { ok: true, results, output, count: results.length, error: '' }
}
