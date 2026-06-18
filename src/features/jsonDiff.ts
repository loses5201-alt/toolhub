/*
  JSON 結構比對引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  比對兩份 JSON,列出「新增 / 刪除 / 變更」的欄位與其路徑(物件鍵不分順序、陣列依索引比)。
  比對兩次 API 回應、兩個版本的設定檔差在哪 —— 用逐行 diff 看 JSON 常被排版與鍵順序干擾,
  這裡做的是「語意層級」的比對。全程在你的瀏覽器,可能含密鑰的資料不上傳。
*/

export type ChangeKind = 'added' | 'removed' | 'changed'
export interface Change {
  path: string // 例:user.tags[2];根層級為 '(根)'
  kind: ChangeKind
  before?: unknown
  after?: unknown
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((x, i) => deepEqual(x, b[i]))
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ka = Object.keys(a)
    const kb = Object.keys(b)
    if (ka.length !== kb.length) return false
    return ka.every((k) => k in b && deepEqual(a[k], b[k]))
  }
  return false
}

function joinKey(path: string, key: string): string {
  // 鍵含非單純字元時用 ["..."] 標記,否則用點
  const safe = /^[A-Za-z_$一-鿿][\w$一-鿿]*$/.test(key)
  if (!path) return safe ? key : `["${key.replace(/"/g, '\\"')}"]`
  return safe ? `${path}.${key}` : `${path}["${key.replace(/"/g, '\\"')}"]`
}

/** 比對兩個已解析的值,回傳變更清單(深度優先、路徑由淺到深)。 */
export function diffValues(a: unknown, b: unknown, path = ''): Change[] {
  const here = path || '(根)'
  if (deepEqual(a, b)) return []

  if (Array.isArray(a) && Array.isArray(b)) {
    const out: Change[] = []
    const max = Math.max(a.length, b.length)
    for (let i = 0; i < max; i++) {
      const p = `${path}[${i}]`
      if (i >= a.length) out.push({ path: p, kind: 'added', after: b[i] })
      else if (i >= b.length) out.push({ path: p, kind: 'removed', before: a[i] })
      else out.push(...diffValues(a[i], b[i], p))
    }
    return out
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const out: Change[] = []
    const keys: string[] = []
    const seen = new Set<string>()
    for (const k of [...Object.keys(a), ...Object.keys(b)]) {
      if (!seen.has(k)) {
        seen.add(k)
        keys.push(k)
      }
    }
    for (const k of keys) {
      const p = joinKey(path, k)
      const inA = k in a
      const inB = k in b
      if (inA && !inB) out.push({ path: p, kind: 'removed', before: a[k] })
      else if (!inA && inB) out.push({ path: p, kind: 'added', after: b[k] })
      else out.push(...diffValues(a[k], b[k], p))
    }
    return out
  }

  // 型別不同或基本值不同 → 整體變更
  return [{ path: here, kind: 'changed', before: a, after: b }]
}

export interface DiffResult {
  ok: boolean
  error?: string
  errorSide?: 'left' | 'right'
  changes?: Change[]
  summary?: { added: number; removed: number; changed: number }
}

function tryParse(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '無法解析 JSON' }
  }
}

/** 解析兩段 JSON 文字並比對。 */
export function compareJSON(leftText: string, rightText: string): DiffResult {
  const l = tryParse(leftText)
  if (!l.ok) return { ok: false, error: l.error, errorSide: 'left' }
  const r = tryParse(rightText)
  if (!r.ok) return { ok: false, error: r.error, errorSide: 'right' }
  const changes = diffValues(l.value, r.value)
  const summary = { added: 0, removed: 0, changed: 0 }
  for (const c of changes) summary[c.kind]++
  return { ok: true, changes, summary }
}

/** 把值轉成簡短可讀字串(供 UI 顯示)。 */
export function preview(v: unknown, max = 80): string {
  let s: string
  if (v === undefined) s = 'undefined'
  else s = JSON.stringify(v)
  if (s === undefined) s = String(v)
  return s.length > max ? s.slice(0, max) + '…' : s
}
