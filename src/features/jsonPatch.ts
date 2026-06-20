/*
  JSON Patch(RFC 6902)+ JSON Pointer(RFC 6901)引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  - applyPatch:把一份 patch(add/remove/replace/move/copy/test)套用到 JSON 文件。
  - diffPatch:比較兩份 JSON,產生一份 replace/add/remove 的 patch(物件遞迴;陣列或型別不同則整段 replace)。
  JSON Pointer 路徑如 /foo/0/bar,其中 ~1 代表 /、~0 代表 ~。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

export type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue }

export interface PatchOp {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test'
  path: string
  from?: string
  value?: JsonValue
}

export interface ApplyResult {
  ok: boolean
  error?: string
  result?: JsonValue
}

function clone<T>(v: T): T {
  return v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T)
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (a === null || b === null) return a === b
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((x, i) => deepEqual(x, b[i]))
  }
  if (typeof a === 'object') {
    const ka = Object.keys(a as object)
    const kb = Object.keys(b as object)
    if (ka.length !== kb.length) return false
    return ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  }
  return false
}

/** 解析 JSON Pointer 成 token 陣列(已還原 ~1 ~0)。 */
export function parsePointer(pointer: string): string[] {
  if (pointer === '') return []
  if (pointer[0] !== '/') throw new Error(`JSON Pointer 必須以 / 開頭:${pointer}`)
  return pointer
    .slice(1)
    .split('/')
    .map((t) => t.replace(/~1/g, '/').replace(/~0/g, '~'))
}

function isObject(v: unknown): v is Record<string, JsonValue> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function arrayIndex(token: string, len: number, allowDash: boolean): number {
  if (allowDash && token === '-') return len
  if (!/^(0|[1-9][0-9]*)$/.test(token)) throw new Error(`陣列索引不合法:${token}`)
  return parseInt(token, 10)
}

/** 取得指定路徑的值(找不到丟錯)。 */
function getAt(doc: JsonValue, tokens: string[]): JsonValue {
  let cur: JsonValue = doc
  for (const tk of tokens) {
    if (Array.isArray(cur)) {
      const i = arrayIndex(tk, cur.length, false)
      if (i < 0 || i >= cur.length) throw new Error(`路徑不存在(陣列索引越界):${tk}`)
      cur = cur[i]
    } else if (isObject(cur)) {
      if (!(tk in cur)) throw new Error(`路徑不存在:${tk}`)
      cur = cur[tk]
    } else {
      throw new Error(`路徑無法深入(目標不是物件或陣列):${tk}`)
    }
  }
  return cur
}

function setAt(doc: JsonValue, tokens: string[], value: JsonValue, mode: 'add' | 'replace'): JsonValue {
  if (tokens.length === 0) return value // 取代根
  const parentTokens = tokens.slice(0, -1)
  const last = tokens[tokens.length - 1]
  const parent = getAt(doc, parentTokens)
  if (Array.isArray(parent)) {
    const i = arrayIndex(last, parent.length, mode === 'add')
    if (mode === 'add') {
      if (i < 0 || i > parent.length) throw new Error(`新增位置越界:${last}`)
      parent.splice(i, 0, value)
    } else {
      if (i < 0 || i >= parent.length) throw new Error(`取代位置越界:${last}`)
      parent[i] = value
    }
  } else if (isObject(parent)) {
    if (mode === 'replace' && !(last in parent)) throw new Error(`取代的目標不存在:${last}`)
    parent[last] = value
  } else {
    throw new Error(`父層不是物件或陣列,無法設定:${last}`)
  }
  return doc
}

function removeAt(doc: JsonValue, tokens: string[]): JsonValue {
  if (tokens.length === 0) throw new Error('不能移除根。')
  const parentTokens = tokens.slice(0, -1)
  const last = tokens[tokens.length - 1]
  const parent = getAt(doc, parentTokens)
  if (Array.isArray(parent)) {
    const i = arrayIndex(last, parent.length, false)
    if (i < 0 || i >= parent.length) throw new Error(`移除位置越界:${last}`)
    parent.splice(i, 1)
  } else if (isObject(parent)) {
    if (!(last in parent)) throw new Error(`要移除的目標不存在:${last}`)
    delete parent[last]
  } else {
    throw new Error(`父層不是物件或陣列,無法移除:${last}`)
  }
  return doc
}

function isPrefix(from: string[], path: string[]): boolean {
  if (from.length > path.length) return false
  return from.every((t, i) => t === path[i])
}

/** 套用一份 JSON Patch。 */
export function applyPatch(doc: JsonValue, patch: PatchOp[]): ApplyResult {
  if (!Array.isArray(patch)) return { ok: false, error: 'patch 必須是一個陣列。' }
  let work = clone(doc)
  try {
    for (let idx = 0; idx < patch.length; idx++) {
      const op = patch[idx]
      if (!op || typeof op !== 'object') throw new Error(`第 ${idx + 1} 個操作格式錯誤。`)
      const tokens = parsePointer(op.path)
      switch (op.op) {
        case 'add':
          work = setAt(work, tokens, clone(op.value as JsonValue), 'add')
          break
        case 'replace':
          work = setAt(work, tokens, clone(op.value as JsonValue), 'replace')
          break
        case 'remove':
          work = removeAt(work, tokens)
          break
        case 'test': {
          const got = getAt(work, tokens)
          if (!deepEqual(got, op.value)) throw new Error(`test 失敗:${op.path} 的值與預期不符。`)
          break
        }
        case 'move': {
          if (op.from == null) throw new Error('move 缺少 from。')
          const fromTokens = parsePointer(op.from)
          if (isPrefix(fromTokens, tokens) && fromTokens.length !== tokens.length)
            throw new Error('move 的目標不能在來源底下。')
          const val = clone(getAt(work, fromTokens))
          work = removeAt(work, fromTokens)
          work = setAt(work, tokens, val, 'add')
          break
        }
        case 'copy': {
          if (op.from == null) throw new Error('copy 缺少 from。')
          const fromTokens = parsePointer(op.from)
          const val = clone(getAt(work, fromTokens))
          work = setAt(work, tokens, val, 'add')
          break
        }
        default:
          throw new Error(`不支援的操作:${(op as PatchOp).op}`)
      }
    }
    return { ok: true, result: work }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

function escapeToken(t: string): string {
  return t.replace(/~/g, '~0').replace(/\//g, '~1')
}

/** 比較兩份 JSON,產生 patch(物件遞迴;陣列/型別不同則整段 replace)。 */
export function diffPatch(a: JsonValue, b: JsonValue, base = ''): PatchOp[] {
  if (deepEqual(a, b)) return []
  // 型別不同、其中之一非純物件 → 整段 replace(或 add 根不適用,根一定 replace)
  if (!isObject(a) || !isObject(b)) {
    return [{ op: 'replace', path: base === '' ? '' : base, value: clone(b) }]
  }
  const ops: PatchOp[] = []
  // a 有、b 沒有 → remove
  for (const k of Object.keys(a)) {
    if (!(k in b)) ops.push({ op: 'remove', path: `${base}/${escapeToken(k)}` })
  }
  for (const k of Object.keys(b)) {
    const path = `${base}/${escapeToken(k)}`
    if (!(k in a)) {
      ops.push({ op: 'add', path, value: clone(b[k]) })
    } else if (!deepEqual(a[k], b[k])) {
      ops.push(...diffPatch(a[k], b[k], path))
    }
  }
  return ops
}
