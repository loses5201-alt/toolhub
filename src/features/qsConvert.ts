/*
  JSON ↔ 查詢字串(query string)轉換引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  支援巢狀物件與陣列的方括號表示法(qs / axios paramsSerializer 常見格式):
    a=1&b=2              ↔ { a: "1", b: "2" }
    a[b]=1&a[c]=2        ↔ { a: { b: "1", c: "2" } }
    a[]=1&a[]=2          ↔ { a: ["1", "2"] }
    a[0]=x&a[1]=y        ↔ { a: ["x", "y"] }
    a[b][]=1             ↔ { a: { b: ["1"] } }
    a=1&a=2(重複裸鍵)  →  { a: ["1", "2"] }
  與 url-parse(編輯單一網址的扁平參數表)互補,這支處理巢狀結構並與 JSON 互轉。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

export type ArrayFormat = 'brackets' | 'indices' | 'repeat' | 'comma'

interface Seg {
  type: 'key' | 'index' | 'push'
  value: string
}

/** 把 query string 的鍵(可能含 [] 方括號)拆成路徑片段。 */
function parseKeyPath(key: string): Seg[] {
  const segs: Seg[] = []
  const first = key.indexOf('[')
  const base = first < 0 ? key : key.slice(0, first)
  segs.push({ type: 'key', value: base })
  if (first < 0) return segs
  const rest = key.slice(first)
  const re = /\[([^\]]*)\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(rest))) {
    const inner = m[1]
    if (inner === '') segs.push({ type: 'push', value: '' })
    else if (/^\d+$/.test(inner)) segs.push({ type: 'index', value: inner })
    else segs.push({ type: 'key', value: inner })
  }
  return segs
}

function decode(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '))
  } catch {
    return s
  }
}

/** 沿 segments 把 value 設進巢狀結構(物件/陣列)。 */
function assign(root: Record<string, unknown>, segs: Seg[], value: unknown): void {
  let node: Record<string, unknown> | unknown[] = root
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]
    const last = i === segs.length - 1
    const nextIsArr = !last && (segs[i + 1].type === 'index' || segs[i + 1].type === 'push')
    if (seg.type === 'push') {
      // node 必為陣列
      const arr = node as unknown[]
      if (last) {
        arr.push(value)
      } else {
        const child = nextIsArr ? [] : {}
        arr.push(child)
        node = child as Record<string, unknown> | unknown[]
      }
      continue
    }
    const k = seg.type === 'index' ? Number(seg.value) : seg.value
    const container = node as Record<string | number, unknown>
    if (last) {
      // 重複裸鍵 → 轉成陣列
      if (k in container && container[k as keyof typeof container] !== undefined) {
        const existing = container[k as never]
        if (Array.isArray(existing)) (existing as unknown[]).push(value)
        else container[k as never] = [existing, value] as never
      } else {
        container[k as never] = value as never
      }
    } else {
      let child = container[k as never] as unknown
      if (child === undefined || child === null || typeof child !== 'object') {
        child = nextIsArr ? [] : {}
        container[k as never] = child as never
      }
      node = child as Record<string, unknown> | unknown[]
    }
  }
}

/** 解析 query string 成(可能巢狀的)JSON 物件。值一律為字串。 */
export function queryToJson(qs: string): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  let s = (qs || '').trim()
  if (s.startsWith('?')) s = s.slice(1)
  if (!s) return out
  for (const pair of s.split('&')) {
    if (!pair) continue
    const eq = pair.indexOf('=')
    const rawKey = eq < 0 ? pair : pair.slice(0, eq)
    const rawVal = eq < 0 ? '' : pair.slice(eq + 1)
    const key = decode(rawKey)
    const val = decode(rawVal)
    assign(out, parseKeyPath(key), val)
  }
  return out
}

function enc(s: string): string {
  return encodeURIComponent(s)
}

/** 編碼鍵名,但保留結構用的方括號 [ ] 為字面值(較易讀且可正確往返)。 */
function encKey(s: string): string {
  return encodeURIComponent(s).replace(/%5B/g, '[').replace(/%5D/g, ']')
}

function isPrimitive(v: unknown): boolean {
  return v === null || ['string', 'number', 'boolean'].includes(typeof v)
}

function primToStr(v: unknown): string {
  if (v === null) return ''
  return String(v)
}

/** 把(巢狀)值序列化成 query string 的 key=value 片段。 */
function serialize(prefix: string, value: unknown, fmt: ArrayFormat, out: string[]): void {
  if (Array.isArray(value)) {
    if (fmt === 'comma') {
      out.push(`${encKey(prefix)}=${enc(value.map(primToStr).join(','))}`)
      return
    }
    value.forEach((item, i) => {
      let key: string
      if (fmt === 'repeat') key = prefix
      else if (fmt === 'indices') key = `${prefix}[${i}]`
      else key = `${prefix}[]`
      serialize(key, item, fmt, out)
    })
    return
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      serialize(`${prefix}[${k}]`, v, fmt, out)
    }
    return
  }
  if (isPrimitive(value)) {
    out.push(`${encKey(prefix)}=${enc(primToStr(value))}`)
  }
}

/** 把 JSON 物件序列化成 query string。 */
export function jsonToQuery(obj: unknown, fmt: ArrayFormat = 'brackets'): string {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return ''
  const out: string[] = []
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    serialize(k, v, fmt, out)
  }
  return out.join('&')
}
