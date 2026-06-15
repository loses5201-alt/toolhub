/*
  可疑網址啟發式檢查引擎(純前端,不連網)。
  目的:幫一般人/長輩在點連結前,快速看出常見的詐騙網址特徵。
  限制:這是「啟發式」判斷,無法 100% 保證安全;最終仍應打 165 或向官方查證。
  設計:每條規則各自獨立產生 finding,彼此不影響(容錯),最後彙總評分。
*/

export type Level = 'danger' | 'warn' | 'safe'

export interface Finding {
  level: 'danger' | 'warn' | 'ok'
  text: string
}

export interface Analysis {
  ok: boolean // 是否成功解析
  level: Level
  host: string
  findings: Finding[]
}

// 常被假冒的品牌/機構關鍵字(出現在主機名但網域不對 = 高風險)
const BRAND_KEYWORDS = [
  'line', 'google', 'facebook', 'apple', 'paypal', 'microsoft', 'netflix',
  'shopee', 'ruten', 'pchome', 'momo', 'amazon',
  'esun', 'ctbc', 'cathay', 'fubon', 'taishin', 'mega', 'firstbank', 'hncb',
  'landbank', 'bot', 'sinopac', 'post', 'chunghwa', 'cht',
  'gov', 'nat', 'etax', 'nhi', 'monitor', 'einvoice',
  'fedex', 'dhl', 'ups', 'kerry', 't-cat', 'hct', 'seveneleven', '711',
]

// 已知的官方/可信主域(命中可給安心訊號)
const KNOWN_GOOD = [
  'line.me', 'google.com', 'facebook.com', 'apple.com', 'paypal.com',
  'microsoft.com', 'shopee.tw', 'pchome.com.tw', 'momoshop.com.tw', 'ruten.com.tw',
  'gov.tw', 'nat.gov.tw', 'esunbank.com', 'ctbcbank.com', 'cathaybk.com.tw',
  'post.gov.tw', 'youtube.com', 'amazon.com',
]

// 短網址服務(看不到真實目的地)
const SHORTENERS = [
  'bit.ly', 'reurl.cc', 'lihi.cc', 'lihi1.com', 'lihi2.com', 'lihi3.com',
  'tinyurl.com', 'goo.gl', 'pse.is', 'is.gd', 't.co', 'ppt.cc', 'risu.io',
]

// 詐騙網站偏好的便宜/冷門 TLD
const RISKY_TLDS = [
  'xyz', 'top', 'tk', 'cn', 'buzz', 'icu', 'cc', 'club', 'work', 'gq', 'ml', 'cf', 'rest', 'cyou',
]

// 可疑路徑/字串關鍵字
const SUSPICIOUS_PATH = [
  'verify', 'login', 'signin', 'account', 'secure', 'update', 'confirm', 'wallet',
  'unlock', 'gift', 'reward', 'bonus', 'invoice', 'delivery', 'customs', 'refund', 'otp',
]

function normalize(raw: string): URL | null {
  let s = raw.trim()
  if (!s) return null
  if (!/^https?:\/\//i.test(s)) s = 'http://' + s
  try {
    return new URL(s)
  } catch {
    return null
  }
}

export function analyzeUrl(raw: string): Analysis {
  const url = normalize(raw)
  if (!url) {
    return { ok: false, level: 'warn', host: '', findings: [] }
  }

  const host = url.hostname.toLowerCase()
  const lowerRaw = raw.toLowerCase()
  const findings: Finding[] = []
  let danger = 0
  let warn = 0

  const add = (level: Finding['level'], text: string) => {
    findings.push({ level, text })
    if (level === 'danger') danger++
    if (level === 'warn') warn++
  }

  const isKnownGood = KNOWN_GOOD.some((d) => host === d || host.endsWith('.' + d))

  // 1. 協定
  if (url.protocol !== 'https:') {
    add('warn', '不是 https 加密連線,傳送資料可能被竊聽。')
  }

  // 2. 主機是 IP 位址
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes('[')) {
    add('danger', '網址直接用 IP 位址,正派網站幾乎不會這樣,常見於詐騙。')
  }

  // 3. userinfo 騙術(@ 之前是假的)
  if (url.username || raw.includes('@')) {
    add('danger', '網址含「@」符號,真正前往的網站是 @ 後面那段,常被用來偽裝。')
  }

  // 4. punycode 國際化網域偽裝
  if (host.includes('xn--')) {
    add('danger', '網址使用 punycode(xn--),可能用相似外文字母偽裝成知名網站。')
  }

  // 5. 短網址
  if (SHORTENERS.some((s) => host === s || host.endsWith('.' + s))) {
    add('warn', '這是短網址,看不到真正的目的地,點之前無法判斷,要特別小心。')
  }

  // 6. 假冒品牌:含品牌字但主域不在已知官方清單
  if (!isKnownGood) {
    const hit = BRAND_KEYWORDS.find((b) => host.includes(b))
    if (hit) {
      add('danger', `主機名含「${hit}」卻不是該品牌的官方網域,高度疑似假冒。`)
    }
  }

  // 7. 數字/連字號混淆(g00gle、paypa1、line-tw-xxx)
  if (/[0-9]/.test(host.replace(/\.\w+$/, '')) && BRAND_KEYWORDS.some((b) => host.includes(b))) {
    add('warn', '網域含數字夾雜在品牌字中(如 0 假冒 o、1 假冒 l),常見偽裝手法。')
  }
  const hyphenCount = (host.match(/-/g) || []).length
  if (hyphenCount >= 2) {
    add('warn', '網域含多個連字號(-),詐騙網站常用來拼湊像官方的名稱。')
  }

  // 8. 過多子網域
  if (host.split('.').length >= 5) {
    add('warn', '子網域層數過多,可能想把真正的網域藏在後面。')
  }

  // 9. 可疑 TLD
  const tld = host.split('.').pop() || ''
  if (RISKY_TLDS.includes(tld)) {
    add('warn', `網域結尾為 .${tld},此類網域常被詐騙集團大量申請。`)
  }

  // 10. 可疑路徑關鍵字
  const pathHit = SUSPICIOUS_PATH.find((k) => lowerRaw.includes(k))
  if (pathHit && !isKnownGood) {
    add('warn', `網址含「${pathHit}」等字眼,常見於釣魚頁面(要你登入/驗證/領獎)。`)
  }

  // 安心訊號
  if (isKnownGood && danger === 0) {
    add('ok', '主域屬於常見的官方/可信網站。')
  }

  const level: Level = danger > 0 ? 'danger' : warn > 0 ? 'warn' : 'safe'
  return { ok: true, level, host, findings }
}
