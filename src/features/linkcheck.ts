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
  'line', 'google', 'facebook', 'instagram', 'apple', 'paypal', 'microsoft', 'netflix',
  'whatsapp', 'telegram', 'binance', 'max',
  'shopee', 'ruten', 'pchome', 'momo', 'amazon', 'coupang', 'books', 'lottery',
  'rakuten', 'pinkoi', 'eslite', 'klook', 'kkday', 'foodpanda', 'pxmart', 'familymart',
  'esun', 'ctbc', 'cathay', 'fubon', 'taishin', 'mega', 'firstbank', 'hncb',
  'landbank', 'bot', 'sinopac', 'post', 'chunghwa', 'cht', 'taiwanpay', 'jkos',
  'hsbc', 'citibank', 'standardchartered', 'kgi', 'yuanta', 'tcb', 'scsb',
  'gov', 'nat', 'etax', 'nhi', 'monitor', 'einvoice', 'twmp', 'etag', 'fetc',
  'mvdis', 'mohw', 'bli', 'taipower', 'easycard', 'thsrc', 'railway',
  'fedex', 'dhl', 'ups', 'kerry', 't-cat', 'hct', 'seveneleven', '711', 'fmart',
  'taiwanmobile', 'fetnet', 'fareastone',
]

// 已知的官方/可信主域(命中可給安心訊號)
const KNOWN_GOOD = [
  'line.me', 'google.com', 'facebook.com', 'instagram.com', 'apple.com', 'paypal.com',
  'microsoft.com', 'netflix.com', 'whatsapp.com', 'telegram.org',
  'shopee.tw', 'pchome.com.tw', 'momoshop.com.tw', 'ruten.com.tw', 'books.com.tw',
  'coupang.com', 'binance.com', 'max.maicoin.com',
  'rakuten.com.tw', 'pinkoi.com', 'eslite.com', 'klook.com', 'kkday.com',
  'foodpanda.com.tw', 'pxmart.com.tw', 'family.com.tw',
  'gov.tw', 'nat.gov.tw', 'esunbank.com', 'ctbcbank.com', 'cathaybk.com.tw',
  'fubon.com', 'taishinbank.com.tw', 'megabank.com.tw', 'firstbank.com.tw',
  'landbank.com.tw', 'bot.com.tw', 'sinopac.com',
  'hsbc.com.tw', 'citibank.com.tw', 'standardchartered.com.tw', 'kgibank.com',
  'yuantabank.com.tw', 'tcb-bank.com.tw',
  'mvdis.gov.tw', 'mohw.gov.tw', 'bli.gov.tw', 'taipower.com.tw', 'easycard.com.tw',
  'thsrc.com.tw', 'railway.gov.tw',
  'post.gov.tw', 'youtube.com', 'amazon.com', 'fetc.net.tw', 'einvoice.nat.gov.tw',
  'cht.com.tw', 'taiwanmobile.com', 'fetnet.net',
]

// 短網址服務(看不到真實目的地)
const SHORTENERS = [
  'bit.ly', 'reurl.cc', 'lihi.cc', 'lihi1.com', 'lihi2.com', 'lihi3.com', 'lihi.io',
  'tinyurl.com', 'goo.gl', 'pse.is', 'is.gd', 't.co', 'ppt.cc', 'risu.io',
  'reurl.tw', 'surl.tw', 'tinurl.com', 'rebrand.ly', 'cutt.ly', 'shorturl.at', 'tr.im',
]

// 免費網頁寄存平台 —— 釣魚頁常寄生於此,搭配品牌字尤其可疑
const FREE_HOSTS = [
  'web.app', 'firebaseapp.com', 'weebly.com', 'blogspot.com', 'wixsite.com',
  '000webhostapp.com', 'github.io', 'netlify.app', 'pages.dev', 'glitch.me',
  'square.site', 'godaddysites.com', 'r2.dev', 'workers.dev',
]

// typosquatting 比對目標(知名品牌的 SLD,長度 ≥4),用編輯距離抓相似拼字
const TYPO_TARGETS = [
  'line', 'google', 'facebook', 'instagram', 'apple', 'paypal', 'microsoft',
  'netflix', 'youtube', 'whatsapp', 'telegram', 'amazon', 'binance',
  'shopee', 'pchome', 'momoshop', 'ruten', 'coupang', 'esunbank', 'ctbcbank',
  'cathaybk', 'taishinbank', 'megabank', 'firstbank', 'sinopac', 'fubon',
  'rakuten', 'foodpanda', 'pinkoi', 'klook', 'kkday', 'easycard',
]

// 詐騙網站偏好的便宜/冷門 TLD
const RISKY_TLDS = [
  'xyz', 'top', 'tk', 'cn', 'buzz', 'icu', 'cc', 'club', 'work', 'gq', 'ml', 'cf', 'rest', 'cyou',
]

// 可疑路徑/字串關鍵字
const SUSPICIOUS_PATH = [
  'verify', 'login', 'signin', 'account', 'secure', 'update', 'confirm', 'wallet',
  'unlock', 'gift', 'reward', 'bonus', 'invoice', 'delivery', 'customs', 'refund', 'otp',
  'package', 'tracking', 'shipping', 'expired', 'suspend', 'suspended', 'claim', 'coupon',
  'reactivate', 'validate', 'authorize', 'redeem', 'recharge',
]

// 危險的網址協定(非 http/https,可能執行程式碼或內嵌偽裝內容)
const DANGEROUS_SCHEMES = /^\s*(javascript|data|vbscript|file|blob):/i

// 編輯距離(Levenshtein),用來偵測拼字相近的假冒網域
function editDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (Math.abs(m - n) > 3) return 99 // 差太多直接放棄,省運算
  const dp = Array.from({ length: m + 1 }, (_, i) => i)
  for (let j = 1; j <= n; j++) {
    let prev = dp[0]
    dp[0] = j
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i]
      dp[i] = a[i - 1] === b[j - 1] ? prev : Math.min(prev, dp[i - 1], dp[i]) + 1
      prev = tmp
    }
  }
  return dp[m]
}

// 把常見「字母↔數字/相似字」還原,讓 paypa1 / g00gle / faceb00k 也能比中
function deglyph(s: string): string {
  return s
    .replace(/0/g, 'o')
    .replace(/1/g, 'l')
    .replace(/3/g, 'e')
    .replace(/5/g, 's')
    .replace(/\$/g, 's')
    .replace(/4/g, 'a')
    .replace(/7/g, 't')
    .replace(/8/g, 'b')
}

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
  // 危險協定:在解析前先攔截(javascript:/data: 等不會有正常 hostname)
  if (DANGEROUS_SCHEMES.test(raw)) {
    return {
      ok: true,
      level: 'danger',
      host: '',
      findings: [{
        level: 'danger',
        text: '這不是一般網頁連結,而是可能直接執行程式或內嵌偽裝內容的特殊連結(如 javascript:、data:),正派網站不會這樣寄給你,請勿點擊。',
      }],
    }
  }

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

  // 6b. 把完整官方網域放在前面當幌子(如 cathaybk.com.tw.login-secure.xyz)
  if (!isKnownGood) {
    const embedded = KNOWN_GOOD.find(
      (d) => host.includes('.' + d + '.') || host.startsWith(d + '.'),
    )
    if (embedded) {
      const real = host.split('.').slice(-2).join('.')
      add('danger', `網址把官方網域「${embedded}」放在前面當幌子,但真正前往的是「${real}」,這是典型的釣魚偽裝。`)
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

  // 11. typosquatting / 字形混淆:主機標籤與知名品牌拼字極相近(但不相等)
  if (!isKnownGood) {
    const labels = host.split('.').filter((l) => l.length >= 4)
    let glyphHit: { label: string; brand: string } | null = null
    let typoHit: { label: string; brand: string } | null = null
    outer: for (const label of labels) {
      const cleaned = deglyph(label)
      for (const brand of TYPO_TARGETS) {
        if (label === brand) continue // 完全相同:由規則 6 處理
        // 字形混淆:用數字/符號替代字母,還原後正好等於品牌(如 paypa1、g00gle)
        if (cleaned === brand) {
          glyphHit = { label, brand }
          break outer
        }
        if (host.includes(brand)) continue // 含完整品牌字:由規則 6 處理
        // 拼字錯位:編輯距離極近(如 goggle、faceboook、lnie)
        const d = editDistance(label, brand)
        const maxDist = brand.length >= 6 ? 2 : 1
        if (d >= 1 && d <= maxDist) {
          typoHit = { label, brand }
        }
      }
    }
    if (glyphHit) {
      add('danger', `網域「${glyphHit.label}」用數字或符號假冒知名品牌「${glyphHit.brand}」(字形混淆),典型仿冒手法,極可能是釣魚網站。`)
    } else if (typoHit) {
      add('danger', `網域「${typoHit.label}」與知名品牌「${typoHit.brand}」拼字極為相近,典型的仿冒網址(typosquatting),極可能是釣魚網站。`)
    }
  }

  // 12. 寄生在免費網頁平台,又帶品牌字眼
  const freeHost = FREE_HOSTS.find((f) => host === f || host.endsWith('.' + f))
  if (freeHost) {
    const brandOnFree = BRAND_KEYWORDS.find((b) => host.includes(b))
    if (brandOnFree) {
      add('danger', `頁面架在免費平台(${freeHost})卻冒用「${brandOnFree}」名義,官方不會這樣放置,高度疑似詐騙。`)
    } else {
      add('warn', `頁面架設在免費網頁平台(${freeHost}),任何人都能申請,請確認是否為你預期的對象。`)
    }
  }

  // 13. 主機標籤過長或數字過多(亂數產生的拋棄式網域)
  const sld = host.split('.').filter((l) => !['com', 'net', 'org', 'gov', 'edu', 'tw', 'co'].includes(l)).sort((a, b) => b.length - a.length)[0] || ''
  if (sld.length >= 25) {
    add('warn', '網域名稱異常冗長,常見於系統大量產生的拋棄式詐騙網址。')
  }
  const digits = (sld.match(/\d/g) || []).length
  if (sld.length >= 6 && digits / sld.length > 0.4) {
    add('warn', '網域含過多數字,常見於臨時搭建的詐騙/賭博網站。')
  }

  // 安心訊號
  if (isKnownGood && danger === 0) {
    add('ok', '主域屬於常見的官方/可信網站。')
  }

  const level: Level = danger > 0 ? 'danger' : warn > 0 ? 'warn' : 'safe'
  return { ok: true, level, host, findings }
}
