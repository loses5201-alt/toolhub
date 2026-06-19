/*
  Cookie / Set-Cookie 解析引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  兩種:
   - Set-Cookie(伺服器回應):單一 cookie + 各屬性(Domain/Path/Expires/Max-Age/Secure/HttpOnly/SameSite…)。
   - Cookie(瀏覽器請求):多組 name=value。
  並附安全性提醒(SameSite=None 需 Secure、缺 HttpOnly 等)。
  全程在你的瀏覽器,不連網、不上傳。
*/

export interface SetCookieResult {
  name: string
  value: string
  attributes: Record<string, string | boolean>
  expiresInfo: string // 存活時間的白話說明
  warnings: string[]
}

export interface CookiePair {
  name: string
  value: string
}

/** 解析請求端 Cookie 標頭:"a=1; b=2" → 多組 name/value。 */
export function parseCookieHeader(input: string): CookiePair[] {
  const s = (input || '').replace(/^cookie:\s*/i, '').trim()
  if (!s) return []
  return s
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((pair) => {
      const eq = pair.indexOf('=')
      if (eq === -1) return { name: pair, value: '' }
      return { name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim() }
    })
}

const KNOWN_FLAGS = ['secure', 'httponly']
const KNOWN_ATTRS = ['domain', 'path', 'expires', 'max-age', 'samesite', 'priority', 'partitioned']

/** 解析 Set-Cookie 標頭(單一)。 */
export function parseSetCookie(input: string): SetCookieResult | null {
  let s = (input || '').replace(/^set-cookie:\s*/i, '').trim()
  if (!s) return null
  const parts = s.split(';')
  const first = parts[0].trim()
  const eq = first.indexOf('=')
  const name = eq === -1 ? first : first.slice(0, eq).trim()
  const value = eq === -1 ? '' : first.slice(eq + 1).trim()
  if (!name) return null

  const attributes: Record<string, string | boolean> = {}
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i].trim()
    if (!p) continue
    const e = p.indexOf('=')
    const key = (e === -1 ? p : p.slice(0, e)).trim().toLowerCase()
    const val = e === -1 ? true : p.slice(e + 1).trim()
    if (KNOWN_FLAGS.includes(key)) {
      attributes[key] = true
    } else if (KNOWN_ATTRS.includes(key)) {
      attributes[key] = val
    } else {
      // 未知屬性照樣保留(小寫鍵)
      attributes[key] = val
    }
  }

  const warnings: string[] = []
  const sameSite = typeof attributes['samesite'] === 'string' ? (attributes['samesite'] as string).toLowerCase() : ''
  if (sameSite === 'none' && !attributes['secure']) {
    warnings.push('SameSite=None 必須同時設定 Secure,否則瀏覽器會拒絕此 cookie。')
  }
  if (!attributes['httponly']) {
    warnings.push('未設定 HttpOnly:JavaScript 可讀取此 cookie,較易受 XSS 竊取。')
  }
  if (!attributes['secure']) {
    warnings.push('未設定 Secure:cookie 可能透過未加密的 HTTP 傳送。')
  }
  if (!sameSite) {
    warnings.push('未明確設定 SameSite:多數現代瀏覽器預設視為 Lax。')
  }

  // 存活時間說明:Max-Age 優先於 Expires
  let expiresInfo: string
  if (attributes['max-age'] !== undefined) {
    const secs = Number(attributes['max-age'])
    if (Number.isFinite(secs)) {
      if (secs <= 0) expiresInfo = 'Max-Age ≤ 0:立即刪除此 cookie。'
      else expiresInfo = `Max-Age=${secs} 秒(約 ${humanDuration(secs)})後過期。`
    } else {
      expiresInfo = 'Max-Age 非數字,無效。'
    }
  } else if (typeof attributes['expires'] === 'string') {
    const d = new Date(attributes['expires'] as string)
    if (!Number.isNaN(d.getTime())) {
      expiresInfo = `於 ${d.toISOString()} 過期。`
    } else {
      expiresInfo = 'Expires 日期格式無法解析。'
    }
  } else {
    expiresInfo = '未設定 Expires / Max-Age:屬於 session cookie,關閉瀏覽器即失效。'
  }

  return { name, value, attributes, expiresInfo, warnings }
}

/** 把秒數轉成白話(天/小時/分)。 */
export function humanDuration(seconds: number): string {
  const s = Math.floor(Math.abs(seconds))
  const days = Math.floor(s / 86400)
  const hours = Math.floor((s % 86400) / 3600)
  const mins = Math.floor((s % 3600) / 60)
  const parts: string[] = []
  if (days) parts.push(`${days} 天`)
  if (hours) parts.push(`${hours} 小時`)
  if (mins && !days) parts.push(`${mins} 分`)
  if (parts.length === 0) parts.push(`${s} 秒`)
  return parts.join(' ')
}
