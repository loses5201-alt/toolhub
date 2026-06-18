/*
  JSON → TypeScript 型別產生引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  貼上一段 JSON(例如某支 API 的回應),自動推斷出對應的 TypeScript interface,省去手刻型別。
  陣列內多筆物件會「合併」成一個 interface:某些筆才有的鍵標成可選(?),同鍵不同型別合成聯集。
  全程在你的瀏覽器,可能含密鑰的回應不上傳。
*/

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

const IDENT_RE = /^[A-Za-z_$][\w$]*$/

function pascalCase(s: string): string {
  const parts = s.split(/[^A-Za-z0-9]+/).filter(Boolean)
  const name = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('')
  return name && /^[A-Za-z]/.test(name) ? name : 'Item'
}

function singular(s: string): string {
  if (/ies$/i.test(s)) return s.replace(/ies$/i, 'y')
  if (/(ses|xes|zes|ches|shes)$/i.test(s)) return s.replace(/es$/i, '')
  if (/s$/i.test(s) && !/ss$/i.test(s)) return s.slice(0, -1)
  return s
}

interface Ctx {
  // interface 名稱 → 欄位定義字串列(已含分號)
  interfaces: Map<string, string[]>
  order: string[]
}

/** 取一個尚未使用的 interface 名稱(衝突時加序號)。 */
function uniqueName(ctx: Ctx, base: string): string {
  let name = base
  let i = 2
  while (ctx.interfaces.has(name)) name = base + i++
  return name
}

/** 推斷一組(同位置)值的 TS 型別字串;必要時註冊 interface。 */
function typeForValues(values: unknown[], nameHint: string, ctx: Ctx): string {
  const objs: Record<string, unknown>[] = []
  const arrs: unknown[][] = []
  const prims = new Set<string>()
  for (const v of values) {
    if (isPlainObject(v)) objs.push(v)
    else if (Array.isArray(v)) arrs.push(v)
    else if (v === null) prims.add('null')
    else prims.add(typeof v) // string / number / boolean
  }
  const parts: string[] = []
  if (objs.length) parts.push(mergeObjects(objs, nameHint, ctx))
  if (arrs.length) {
    const elems = arrs.flat()
    const elemType = elems.length ? typeForValues(elems, singular(nameHint), ctx) : 'unknown'
    parts.push(elemType.includes('|') ? `(${elemType})[]` : `${elemType}[]`)
  }
  for (const p of prims) parts.push(p)
  const uniq = [...new Set(parts)]
  return uniq.length ? uniq.join(' | ') : 'unknown'
}

/** 合併多個物件成一個 interface,回傳其名稱。 */
function mergeObjects(objs: Record<string, unknown>[], nameHint: string, ctx: Ctx): string {
  const total = objs.length
  const keyOrder: string[] = []
  const seen = new Set<string>()
  for (const o of objs) {
    for (const k of Object.keys(o)) {
      if (!seen.has(k)) {
        seen.add(k)
        keyOrder.push(k)
      }
    }
  }
  const fields: string[] = []
  for (const k of keyOrder) {
    const present = objs.filter((o) => Object.prototype.hasOwnProperty.call(o, k))
    const optional = present.length < total
    const t = typeForValues(present.map((o) => o[k]), pascalCase(k), ctx)
    const key = IDENT_RE.test(k) ? k : JSON.stringify(k)
    fields.push(`  ${key}${optional ? '?' : ''}: ${t};`)
  }
  const name = uniqueName(ctx, pascalCase(nameHint))
  ctx.interfaces.set(name, fields)
  ctx.order.push(name)
  return name
}

export interface TsResult {
  ok: boolean
  error?: string
  code?: string
}

/** 解析 JSON 文字並產生 TypeScript 型別宣告。 */
export function jsonToTs(text: string, rootName = 'Root'): TsResult {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '無法解析 JSON' }
  }
  const ctx: Ctx = { interfaces: new Map(), order: [] }
  const root = pascalCase(rootName)

  let header = ''
  if (isPlainObject(value)) {
    mergeObjects([value], root, ctx)
  } else {
    // 根為陣列或基本值 → 用 type 別名
    const t = typeForValues([value], root, ctx)
    header = `export type ${root} = ${t};\n`
  }

  // 以註冊順序的反序輸出(root 先、巢狀在後),較好讀
  const blocks: string[] = []
  for (let i = ctx.order.length - 1; i >= 0; i--) {
    const name = ctx.order[i]
    const fields = ctx.interfaces.get(name)!
    blocks.push(`export interface ${name} {\n${fields.join('\n')}\n}`)
  }
  const code = (header + blocks.join('\n\n')).trim() + '\n'
  return { ok: true, code }
}
