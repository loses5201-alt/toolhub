/*
  網址解析核心 —— 純函式、無 DOM,可在 Node 測(URL 為標準全域物件)。
  把一條網址拆成各部位、把查詢字串拆成可編輯的鍵值對(保留順序與重複),
  並能反向組回網址。與 url-clean(拆解轉址包裝/清追蹤碼)互補:這支著重「看清楚與編輯」。
  全程瀏覽器、不連網、不上傳。
*/

export interface UrlParam {
  key: string
  value: string
  /** 原本就沒有 '='(旗標型參數,如 ?debug)。 */
  flag?: boolean
}

export interface UrlParts {
  protocol: string // 例 'https:'
  username: string
  password: string
  hostname: string
  port: string
  pathname: string
  hash: string // 含 '#'
}

export interface ParsedUrl {
  ok: boolean
  error?: string
  /** 是否因原輸入沒有協定,而自動補上 https:// */
  assumedProtocol?: boolean
  parts?: UrlParts
  params?: UrlParam[]
  href?: string
}

/** 解析查詢字串為鍵值對(保留順序與重複;'+' 視為空白)。 */
export function parseQuery(search: string): UrlParam[] {
  let s = search
  if (s.startsWith('?')) s = s.slice(1)
  if (s === '') return []
  const out: UrlParam[] = []
  for (const seg of s.split('&')) {
    if (seg === '') continue
    const eq = seg.indexOf('=')
    if (eq === -1) {
      out.push({ key: decodeComponent(seg), value: '', flag: true })
    } else {
      out.push({
        key: decodeComponent(seg.slice(0, eq)),
        value: decodeComponent(seg.slice(eq + 1)),
      })
    }
  }
  return out
}

/** 安全解碼:'+' → 空白,壞掉的 %XX 退回原字串而非丟例外。 */
function decodeComponent(s: string): string {
  const spaced = s.replace(/\+/g, ' ')
  try {
    return decodeURIComponent(spaced)
  } catch {
    return spaced
  }
}

/** 把鍵值對組回查詢字串(不含開頭 '?';旗標型參數不加 '=')。 */
export function buildQuery(params: UrlParam[]): string {
  return params
    .map((p) => {
      const k = encodeURIComponent(p.key)
      if (p.flag && p.value === '') return k
      return `${k}=${encodeURIComponent(p.value)}`
    })
    .join('&')
}

/** 解析網址;沒有協定時自動嘗試補 https://。 */
export function parseUrl(input: string): ParsedUrl {
  const raw = input.trim()
  if (raw === '') return { ok: false, error: '請輸入網址' }

  let u: URL | undefined
  let assumedProtocol = false
  try {
    u = new URL(raw)
  } catch {
    // 沒有協定就試著補上 https://
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) {
      try {
        u = new URL('https://' + raw)
        assumedProtocol = true
      } catch {
        /* 仍失敗 */
      }
    }
  }
  if (!u) return { ok: false, error: '無法解析這個網址,請確認格式' }

  return {
    ok: true,
    assumedProtocol,
    parts: {
      protocol: u.protocol,
      username: u.username,
      password: u.password,
      hostname: u.hostname,
      port: u.port,
      pathname: u.pathname,
      hash: u.hash,
    },
    params: parseQuery(u.search),
    href: u.href,
  }
}

/** 由部位 + 參數反向組回網址字串(以 http(s) 類網址為主)。 */
export function buildUrl(parts: UrlParts, params: UrlParam[]): string {
  let s = parts.protocol
  if (!s.endsWith(':')) s += ':'
  s += '//'
  if (parts.username) {
    s += parts.username
    if (parts.password) s += ':' + parts.password
    s += '@'
  }
  s += parts.hostname
  if (parts.port) s += ':' + parts.port
  s += parts.pathname || '/'
  const q = buildQuery(params)
  if (q) s += '?' + q
  if (parts.hash) s += parts.hash.startsWith('#') ? parts.hash : '#' + parts.hash
  return s
}
