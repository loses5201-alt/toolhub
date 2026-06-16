/*
  郵件來源檢視引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  把使用者貼上的「郵件原始碼/完整標頭」解析出 From / Return-Path / Reply-To 等欄位,
  比對寄件網域是否對得上、檢查 SPF/DKIM/DMARC 驗證結果,標出常見的冒名詐騙警訊。
  注意:這是輔助判讀與防詐教育,不是「這封信是不是詐騙」的保證;標頭可被偽冒,
  但「網域對不上、驗證失敗」確實是釣魚信常見破綻。
*/

export interface ParsedAddress {
  display: string // 顯示名稱(可能為空)
  address: string // 實際 email(小寫),解析不到則空字串
  domain: string // address 的網域(小寫),解析不到則空字串
}

export type Severity = 'danger' | 'warn' | 'info'

export interface HeaderWarning {
  severity: Severity
  text: string
}

export interface HeaderResult {
  from: ParsedAddress | null
  replyTo: ParsedAddress | null
  returnPath: ParsedAddress | null
  to: string
  subject: string
  date: string
  auth: { spf?: string; dkim?: string; dmarc?: string }
  warnings: HeaderWarning[]
}

// 常見免費信箱網域 —— 「自稱官方機構卻用免費信箱」是強烈警訊
const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.com.tw', 'kimo.com',
  'hotmail.com', 'outlook.com', 'live.com', 'msn.com', 'icloud.com', 'me.com',
  'aol.com', 'pchome.com.tw', 'hinet.net', 'qq.com', '163.com', '126.com',
  'proton.me', 'protonmail.com', 'gmx.com', 'mail.com', 'yandex.com',
])

/** 把折行(RFC 5322:續行以空白開頭)還原成單行,再切成標頭陣列。只取空行前的標頭區。 */
export function splitHeaders(raw: string): Array<[string, string]> {
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  // 標頭與內文以第一個空行分隔;沒有空行則整段都當標頭
  const headerBlock = text.split(/\n\n/)[0] ?? ''
  const lines = headerBlock.split('\n')
  const out: Array<[string, string]> = []
  for (const line of lines) {
    if (/^[ \t]/.test(line) && out.length) {
      // 續行:接到上一個標頭值
      out[out.length - 1][1] += ' ' + line.trim()
    } else {
      const idx = line.indexOf(':')
      if (idx > 0) out.push([line.slice(0, idx).trim(), line.slice(idx + 1).trim()])
    }
  }
  return out
}

/** 取某標頭最後一次出現的值(多筆 Received 等以最後為主;一般欄位通常只有一個)。 */
function pick(headers: Array<[string, string]>, name: string): string {
  const lower = name.toLowerCase()
  let val = ''
  for (const [k, v] of headers) if (k.toLowerCase() === lower) val = v
  return val
}

/** 解析 "顯示名 <addr@dom>" 或 "addr@dom" 或 "<addr>"。 */
export function parseAddress(raw: string): ParsedAddress | null {
  if (!raw) return null
  let display = ''
  let address = ''
  const m = raw.match(/^(.*?)<([^>]*)>/)
  if (m) {
    display = m[1].trim().replace(/^"(.*)"$/, '$1').trim()
    address = m[2].trim()
  } else {
    address = raw.trim()
  }
  address = address.toLowerCase()
  const at = address.lastIndexOf('@')
  const domain = at >= 0 ? address.slice(at + 1).replace(/[>;,\s].*$/, '') : ''
  if (!address && !display) return null
  return { display, address, domain }
}

/** 從 Authentication-Results 標頭抽出 spf / dkim / dmarc 結果(pass/fail/softfail…)。 */
function parseAuth(headers: Array<[string, string]>): HeaderResult['auth'] {
  const joined = headers
    .filter(([k]) => /^(authentication-results|received-spf)$/i.test(k))
    .map(([, v]) => v)
    .join(' ; ')
    .toLowerCase()
  const auth: HeaderResult['auth'] = {}
  const spf = joined.match(/spf=(\w+)/)
  if (spf) auth.spf = spf[1]
  const dkim = joined.match(/dkim=(\w+)/)
  if (dkim) auth.dkim = dkim[1]
  const dmarc = joined.match(/dmarc=(\w+)/)
  if (dmarc) auth.dmarc = dmarc[1]
  return auth
}

/** 取得網域的「可註冊主網域」近似(最後兩段,或台灣三段如 com.tw 取三段)。 */
export function rootDomain(domain: string): string {
  if (!domain) return ''
  const parts = domain.split('.')
  if (parts.length <= 2) return domain
  const last2 = parts.slice(-2).join('.')
  // 處理 com.tw / org.tw / gov.tw / edu.tw / com.cn 等二級
  if (/^(com|org|net|gov|edu|idv|club|game)\.[a-z]{2}$/.test(last2)) {
    return parts.slice(-3).join('.')
  }
  return last2
}

export function analyzeHeaders(raw: string): HeaderResult {
  const headers = splitHeaders(raw)
  const from = parseAddress(pick(headers, 'From'))
  const replyTo = parseAddress(pick(headers, 'Reply-To'))
  const returnPath = parseAddress(pick(headers, 'Return-Path'))
  const auth = parseAuth(headers)
  const result: HeaderResult = {
    from,
    replyTo,
    returnPath,
    to: pick(headers, 'To'),
    subject: pick(headers, 'Subject'),
    date: pick(headers, 'Date'),
    auth,
    warnings: [],
  }
  const w = result.warnings
  const add = (severity: Severity, text: string) => w.push({ severity, text })

  if (!from || !from.address) {
    add('warn', '找不到 From(寄件者)欄位,請確認貼上的是完整的「郵件原始碼/標頭」。')
    return result
  }

  const fromRoot = rootDomain(from.domain)

  // 1) 顯示名稱裡藏了另一個網域/email,和真正寄件網域對不上(冒名常見手法)
  const dispMail = from.display.match(/[\w.+-]+@([\w.-]+\.\w+)/)
  if (dispMail) {
    const dispRoot = rootDomain(dispMail[1].toLowerCase())
    if (dispRoot && fromRoot && dispRoot !== fromRoot) {
      add('danger', `顯示名稱看起來是「${dispMail[0]}」,但真正寄件網域其實是「${from.domain}」,兩者不同 —— 典型的冒名手法。`)
    }
  }

  // 2) Reply-To 網域和 From 不同 —— 你按「回覆」會寄到另一個網域(BEC 變更匯款帳號常見)
  if (replyTo && replyTo.domain && rootDomain(replyTo.domain) !== fromRoot) {
    add('danger', `回覆地址(Reply-To)是「${replyTo.address}」,和寄件網域「${from.domain}」不同 —— 你按「回覆」會寄到別處,假冒客服/變更匯款常用此招。`)
  }

  // 3) Return-Path(真正退信來源)和 From 不同 —— 大量釣魚信特徵(但電子報/代發也可能,故為提醒)
  if (returnPath && returnPath.domain && rootDomain(returnPath.domain) !== fromRoot) {
    add('warn', `實際寄送來源(Return-Path)網域「${returnPath.domain}」與顯示寄件網域「${from.domain}」不同。電子報/代發信也可能如此,但釣魚信常見,請提高警覺。`)
  }

  // 4) 驗證結果失敗
  const fail = (v?: string) => v && /^(fail|softfail|temperror|permerror|none)$/.test(v)
  if (fail(auth.spf)) add(auth.spf === 'fail' ? 'danger' : 'warn', `SPF 驗證為「${auth.spf}」—— 寄件伺服器未通過該網域授權檢查,可能被冒名。`)
  if (auth.dkim && /^fail$/.test(auth.dkim)) add('danger', 'DKIM 簽章驗證失敗 —— 內容或寄件者可能被竄改/偽冒。')
  if (auth.dmarc && /^(fail)$/.test(auth.dmarc)) add('danger', 'DMARC 驗證失敗 —— 該網域明確要求驗證但未通過,高度可疑。')

  // 5) 自稱機構卻用免費信箱寄
  if (FREE_MAIL.has(from.domain) && /(銀行|bank|客服|service|官方|gov|政府|公司|帳號|物流|宅配|稅|海關|中華電信|郵局|健保|監理)/i.test(from.display + ' ' + result.subject)) {
    add('warn', `寄件者用免費信箱(${from.domain})卻自稱官方/機構 —— 正式機構通常用自有網域,留意冒名。`)
  }

  if (!w.length) {
    add('info', '標頭未發現明顯的網域不一致或驗證失敗。但這不代表一定安全:仍請勿輕易點連結、給帳密或匯款,可循官方管道另行查證。')
  }
  return result
}
