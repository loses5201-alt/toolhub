/*
  網址清理 / 看穿轉址引擎 —— 純函式、無 DOM 依賴(只用標準 URL),可在 Node 直接測試。
  兩件事:
    1) 清理:移除網址裡的「追蹤參數」(utm_*、fbclid、gclid…),分享出去的連結更乾淨、
       不把你怎麼點進來的、從哪個廣告來的洩漏給對方,也更短好讀。
    2) 看穿轉址:很多連結其實是「轉址包裝」(google.com/url?q=…、facebook l.php?u=…、
       Outlook safelinks),真正要去的網址藏在參數裡 —— 詐騙也常用這招把釣魚連結藏起來。
       本引擎把包裝一層層拆開,讓你先看清楚「這個連結最後到底連去哪」再決定要不要點。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

// 追蹤參數:前綴比對(整類移除)
const TRACKING_PREFIXES = ['utm_', 'pk_', 'mtm_', 'mc_', 'hsa_', 'oly_', 'vero_', 'matomo_']

// 追蹤參數:完全比對(常見廣告/社群點擊識別碼)
const TRACKING_EXACT = new Set([
  'fbclid', 'gclid', 'dclid', 'gclsrc', 'gbraid', 'wbraid', 'msclkid', 'yclid',
  'twclid', 'ttclid', 'igshid', 'igsh', 'mkt_tok', '_hsenc', '_hsmi',
  'ref_src', 'ref_url', 'spm', 'scm', 'wickedid', 'soc_src', 'soc_trk',
  'fb_action_ids', 'fb_action_types', 'fb_ref', 'action_object_map',
  'action_type_map', 'action_ref_map', 's_kwcid', 'ef_id', 'vgo_ee', 'rb_clickid',
])

function isTracking(name: string): boolean {
  const lower = name.toLowerCase()
  if (TRACKING_EXACT.has(lower)) return true
  return TRACKING_PREFIXES.some((p) => lower.startsWith(p))
}

export interface CleanResult {
  ok: boolean // 是否為可解析的 http(s) 網址
  original: string
  cleaned: string // 移除追蹤參數後的網址(失敗時等於原值)
  removed: string[] // 被移除的參數名稱
  error?: string
}

function parseHttp(input: string): URL | null {
  try {
    const u = new URL(input.trim())
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u
  } catch {
    return null
  }
}

/** 移除網址中的追蹤參數,保留其餘參數順序。 */
export function cleanUrl(input: string): CleanResult {
  const u = parseHttp(input)
  if (!u) {
    return { ok: false, original: input, cleaned: input, removed: [], error: '不是有效的 http(s) 網址' }
  }
  const removed: string[] = []
  const kept: [string, string][] = []
  for (const [k, v] of u.searchParams.entries()) {
    if (isTracking(k)) removed.push(k)
    else kept.push([k, v])
  }
  // 重建查詢字串(用保留的鍵值,維持原順序)
  const sp = new URLSearchParams()
  for (const [k, v] of kept) sp.append(k, v)
  u.search = sp.toString()
  return { ok: true, original: input, cleaned: u.toString(), removed }
}

// 已知的轉址包裝:host 比對(可選 path)+ 藏有真正網址的參數名(依序試)
interface Wrapper {
  host: RegExp
  path?: RegExp
  params: string[]
}
const WRAPPERS: Wrapper[] = [
  { host: /(^|\.)google\.[a-z.]+$/, path: /^\/url$/, params: ['q', 'url'] },
  { host: /(^|\.)facebook\.com$/, path: /^\/l\.php$/, params: ['u'] },
  { host: /(^|\.)l\.facebook\.com$/, params: ['u'] },
  { host: /(^|\.)lm\.facebook\.com$/, params: ['u'] },
  { host: /(^|\.)l\.instagram\.com$/, params: ['u'] },
  { host: /(^|\.)safelinks\.protection\.outlook\.com$/, params: ['url'] },
  { host: /(^|\.)youtube\.com$/, path: /^\/redirect$/, params: ['q', 'url'] },
  { host: /(^|\.)away\.vk\.com$/, params: ['to'] },
  { host: /(^|\.)href\.li$/, params: ['url'] },
  { host: /(^|\.)nern\.li$/, params: ['url'] },
]

// 通用「強參數名」:任何 host 上若這些參數值本身就是一個 http(s) 網址,視為轉址
const GENERIC_PARAMS = ['url', 'u', 'q', 'target', 'dest', 'destination', 'redirect', 'redirect_url', 'to', 'link', 'r']

/** 嘗試從一個網址拆出它包裝的「真正目標網址」;拆不出回 null。 */
function unwrapOnce(u: URL): string | null {
  // 1) 先試已知包裝(較精準)
  for (const w of WRAPPERS) {
    if (!w.host.test(u.hostname)) continue
    if (w.path && !w.path.test(u.pathname)) continue
    for (const p of w.params) {
      const v = u.searchParams.get(p)
      if (v && parseHttp(v)) return v
    }
  }
  // 2) 通用偵測:強參數名且值為 http(s) 網址,且目標 host 與目前不同(避免無意義自指)
  for (const p of GENERIC_PARAMS) {
    const v = u.searchParams.get(p)
    if (!v) continue
    const target = parseHttp(v)
    if (target && target.hostname !== u.hostname) return v
  }
  return null
}

export interface UnwrapResult {
  ok: boolean
  wrapped: boolean // 是否真的拆出了內層網址
  finalUrl: string // 最終目標(拆不出時等於輸入)
  hops: string[] // 拆解過程的每一層網址(含起點與終點)
  error?: string
}

/** 一層層拆開轉址包裝,回傳最終目標與過程。含迴圈與深度保護。 */
export function unwrapRedirect(input: string, maxDepth = 8): UnwrapResult {
  const start = parseHttp(input)
  if (!start) {
    return { ok: false, wrapped: false, finalUrl: input, hops: [], error: '不是有效的 http(s) 網址' }
  }
  const hops: string[] = [start.toString()]
  const seen = new Set<string>([start.toString()])
  let current = start
  for (let i = 0; i < maxDepth; i++) {
    const next = unwrapOnce(current)
    if (!next) break
    const nextUrl = parseHttp(next)
    if (!nextUrl) break
    const key = nextUrl.toString()
    if (seen.has(key)) break // 迴圈保護
    seen.add(key)
    hops.push(key)
    current = nextUrl
  }
  return {
    ok: true,
    wrapped: hops.length > 1,
    finalUrl: hops[hops.length - 1],
    hops,
  }
}

export interface ProcessResult {
  ok: boolean
  error?: string
  unwrap: UnwrapResult
  clean: CleanResult // 對「最終目標」做清理的結果
}

/** 一次到位:先看穿轉址拿到最終目標,再清掉最終目標的追蹤參數。 */
export function processUrl(input: string): ProcessResult {
  const unwrap = unwrapRedirect(input)
  if (!unwrap.ok) {
    return { ok: false, error: unwrap.error, unwrap, clean: cleanUrl(input) }
  }
  const clean = cleanUrl(unwrap.finalUrl)
  return { ok: true, unwrap, clean }
}
