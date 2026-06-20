/*
  HAR(HTTP Archive)分析引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  HAR 是瀏覽器 DevTools「Network」面板匯出的 .har 檔(JSON),記錄一次頁面載入
  的所有網路請求:URL、方法、狀態碼、大小、耗時與各階段時序。
  本引擎把它彙整成可讀的統計:總數/總大小/總時間、依狀態碼、依資源類型、依網域、
  最慢/最大的請求、錯誤清單。
  ⚠️ HAR 內常含 cookie、Authorization 標頭等敏感資料,所以全程在你的瀏覽器解析,
  不連網、不上傳。
*/

export interface HarEntry {
  method: string
  url: string
  host: string
  status: number
  statusText: string
  mimeType: string
  type: string // document/script/stylesheet/image/font/xhr/media/other
  time: number // 總耗時(毫秒)
  size: number // 傳輸大小(bytes,優先用 _transferSize,否則 bodySize+headersSize)
  contentSize: number // 解壓後內容大小
  startedDateTime: string
  timings: Record<string, number>
}

export interface HarSummary {
  count: number
  totalSize: number
  totalContentSize: number
  totalTime: number // 從最早請求開始到最晚請求結束的牆鐘時間(毫秒)
  startedAt: string
  byStatus: { group: string; count: number }[]
  byType: { type: string; count: number; size: number }[]
  byHost: { host: string; count: number; size: number }[]
  slowest: HarEntry[]
  largest: HarEntry[]
  errors: HarEntry[] // 4xx / 5xx / status 0
}

export interface HarParseResult {
  ok: boolean
  error?: string
  creator?: string
  pageTitle?: string
  entries: HarEntry[]
}

/** 由 mimeType 與副檔名判斷資源類型(對應 DevTools 的分類)。 */
export function classifyType(mimeType: string, url: string): string {
  const mt = (mimeType || '').toLowerCase().split(';')[0].trim()
  if (mt === 'text/html' || mt === 'application/xhtml+xml') return 'document'
  if (mt === 'text/css') return 'stylesheet'
  if (mt.includes('javascript') || mt === 'text/jsx' || mt === 'application/ecmascript')
    return 'script'
  if (mt.startsWith('image/')) return 'image'
  if (mt.startsWith('font/') || mt.includes('font-woff') || mt.includes('opentype') || mt.includes('truetype'))
    return 'font'
  if (mt.startsWith('audio/') || mt.startsWith('video/')) return 'media'
  if (mt === 'application/json' || mt.includes('+json') || mt === 'text/json') return 'xhr'
  if (mt === 'application/xml' || mt === 'text/xml' || mt.includes('+xml')) return 'xhr'
  // 退而求其次:看副檔名
  const path = extractPath(url).toLowerCase()
  const ext = path.includes('.') ? path.slice(path.lastIndexOf('.') + 1) : ''
  if (['css'].includes(ext)) return 'stylesheet'
  if (['js', 'mjs', 'cjs'].includes(ext)) return 'script'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp', 'avif'].includes(ext)) return 'image'
  if (['woff', 'woff2', 'ttf', 'otf', 'eot'].includes(ext)) return 'font'
  if (['mp4', 'webm', 'mp3', 'wav', 'ogg', 'm4a', 'mov'].includes(ext)) return 'media'
  if (['html', 'htm'].includes(ext)) return 'document'
  if (['json', 'xml'].includes(ext)) return 'xhr'
  return 'other'
}

/** 從 URL 抓出主機名(失敗回原字串)。 */
export function extractHost(url: string): string {
  const m = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i.exec(url || '')
  if (!m) return url || ''
  // 去掉使用者資訊與埠
  let host = m[1]
  const at = host.lastIndexOf('@')
  if (at !== -1) host = host.slice(at + 1)
  const colon = host.lastIndexOf(':')
  if (colon !== -1 && /^\d+$/.test(host.slice(colon + 1))) host = host.slice(0, colon)
  return host
}

function extractPath(url: string): string {
  const m = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]+([^?#]*)/i.exec(url || '')
  return m ? m[1] : url || ''
}

function statusGroup(status: number): string {
  if (!status || status === 0) return '其他 / 失敗'
  if (status >= 200 && status < 300) return '2xx 成功'
  if (status >= 300 && status < 400) return '3xx 轉址'
  if (status >= 400 && status < 500) return '4xx 用戶端錯誤'
  if (status >= 500) return '5xx 伺服器錯誤'
  return '1xx 資訊'
}

/** 解析 HAR JSON 字串為結構化請求清單。 */
export function parseHar(text: string): HarParseResult {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, error: 'JSON 格式錯誤,無法解析。請確認貼上的是完整的 .har 檔內容。', entries: [] }
  }
  const root = json as Record<string, unknown>
  const log = root && (root.log as Record<string, unknown>)
  if (!log || typeof log !== 'object') {
    return { ok: false, error: '找不到 HAR 的 log 物件,可能不是有效的 HAR 檔。', entries: [] }
  }
  const rawEntries = log.entries
  if (!Array.isArray(rawEntries)) {
    return { ok: false, error: 'HAR 內沒有 entries 陣列(沒有任何請求紀錄)。', entries: [] }
  }
  const creator = readCreator(log.creator)
  const pageTitle = readPageTitle(log.pages)

  const entries: HarEntry[] = rawEntries.map((e) => normalizeEntry(e as Record<string, unknown>))
  return { ok: true, creator, pageTitle, entries }
}

function readCreator(c: unknown): string | undefined {
  if (c && typeof c === 'object') {
    const o = c as Record<string, unknown>
    const name = typeof o.name === 'string' ? o.name : ''
    const version = typeof o.version === 'string' ? o.version : ''
    return [name, version].filter(Boolean).join(' ') || undefined
  }
  return undefined
}

function readPageTitle(pages: unknown): string | undefined {
  if (Array.isArray(pages) && pages.length) {
    const p = pages[0] as Record<string, unknown>
    if (typeof p.title === 'string' && p.title) return p.title
  }
  return undefined
}

function num(v: unknown): number {
  return typeof v === 'number' && isFinite(v) ? v : 0
}

function normalizeEntry(e: Record<string, unknown>): HarEntry {
  const req = (e.request as Record<string, unknown>) || {}
  const res = (e.response as Record<string, unknown>) || {}
  const content = (res.content as Record<string, unknown>) || {}
  const url = typeof req.url === 'string' ? req.url : ''
  const mimeType = typeof content.mimeType === 'string' ? content.mimeType : ''
  const status = num(res.status)

  // 傳輸大小:優先 _transferSize(Chrome 擴充欄位),否則用 headersSize+bodySize
  let size = num((res as Record<string, unknown>)._transferSize)
  if (size <= 0) {
    const headersSize = Math.max(0, num(res.headersSize))
    const bodySize = Math.max(0, num(res.bodySize))
    size = headersSize + bodySize
  }
  const contentSize = Math.max(0, num(content.size))

  const timings = readTimings(e.timings)
  return {
    method: typeof req.method === 'string' ? req.method : '',
    url,
    host: extractHost(url),
    status,
    statusText: typeof res.statusText === 'string' ? res.statusText : '',
    mimeType,
    type: classifyType(mimeType, url),
    time: Math.max(0, num(e.time)),
    size: Math.max(0, size),
    contentSize,
    startedDateTime: typeof e.startedDateTime === 'string' ? e.startedDateTime : '',
    timings,
  }
}

function readTimings(t: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (t && typeof t === 'object') {
    for (const k of ['blocked', 'dns', 'connect', 'ssl', 'send', 'wait', 'receive']) {
      const v = num((t as Record<string, unknown>)[k])
      if (v > 0) out[k] = v
    }
  }
  return out
}

/** 把請求清單彙整為統計摘要。topN 控制最慢/最大清單長度。 */
export function summarize(entries: HarEntry[], topN = 10): HarSummary {
  const count = entries.length
  let totalSize = 0
  let totalContentSize = 0
  for (const e of entries) {
    totalSize += e.size
    totalContentSize += e.contentSize
  }

  const statusMap = new Map<string, number>()
  const typeMap = new Map<string, { count: number; size: number }>()
  const hostMap = new Map<string, { count: number; size: number }>()
  for (const e of entries) {
    const g = statusGroup(e.status)
    statusMap.set(g, (statusMap.get(g) || 0) + 1)
    const t = typeMap.get(e.type) || { count: 0, size: 0 }
    t.count++
    t.size += e.size
    typeMap.set(e.type, t)
    const h = hostMap.get(e.host) || { count: 0, size: 0 }
    h.count++
    h.size += e.size
    hostMap.set(e.host, h)
  }

  const byStatus = [...statusMap.entries()]
    .map(([group, c]) => ({ group, count: c }))
    .sort((a, b) => b.count - a.count)
  const byType = [...typeMap.entries()]
    .map(([type, v]) => ({ type, count: v.count, size: v.size }))
    .sort((a, b) => b.size - a.size)
  const byHost = [...hostMap.entries()]
    .map(([host, v]) => ({ host, count: v.count, size: v.size }))
    .sort((a, b) => b.count - a.count)

  const slowest = [...entries].sort((a, b) => b.time - a.time).slice(0, topN)
  const largest = [...entries].sort((a, b) => b.size - a.size).slice(0, topN)
  const errors = entries.filter((e) => e.status === 0 || e.status >= 400)

  return {
    count,
    totalSize,
    totalContentSize,
    totalTime: wallClockTime(entries),
    startedAt: earliestStart(entries),
    byStatus,
    byType,
    byHost,
    slowest,
    largest,
    errors,
  }
}

function earliestStart(entries: HarEntry[]): string {
  let min = Infinity
  let s = ''
  for (const e of entries) {
    const t = Date.parse(e.startedDateTime)
    if (!isNaN(t) && t < min) {
      min = t
      s = e.startedDateTime
    }
  }
  return s
}

/** 牆鐘時間:最早請求開始 → 最晚請求結束(start+time)的毫秒差。 */
export function wallClockTime(entries: HarEntry[]): number {
  let min = Infinity
  let max = -Infinity
  for (const e of entries) {
    const start = Date.parse(e.startedDateTime)
    if (isNaN(start)) continue
    const end = start + e.time
    if (start < min) min = start
    if (end > max) max = end
  }
  if (min === Infinity || max === -Infinity) return 0
  return Math.max(0, max - min)
}

/** bytes 轉人類可讀(KB/MB)。 */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

/** 毫秒轉人類可讀(ms/s)。 */
export function formatMs(n: number): string {
  if (n < 1000) return `${Math.round(n)} ms`
  return `${(n / 1000).toFixed(2)} s`
}
