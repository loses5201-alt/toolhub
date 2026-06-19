/*
  User-Agent 解析引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  把瀏覽器送出的 User-Agent 字串拆成「瀏覽器 / 版本 / 排版引擎 / 作業系統 / 裝置類型」,
  方便看 server log、分析流量、debug 相容性問題。全程在你的瀏覽器,不連網、不上傳。

  說明:UA 字串本身就充滿歷史包袱(每家瀏覽器都假裝自己是別人,例如都含 Mozilla/5.0、
  Chrome 也含 Safari/AppleWebKit),所以解析靠的是「比對順序」與啟發式規則,結果為合理推斷,
  不保證 100%(尤其偽造或極罕見的 UA)。偵測順序刻意由「最特殊」排到「最通用」。
*/

export interface UAResult {
  browser: string
  browserVersion: string
  engine: string
  engineVersion: string
  os: string
  osVersion: string
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown'
  isBot: boolean
}

function ver(ua: string, re: RegExp): string {
  const m = ua.match(re)
  return m && m[1] ? m[1].replace(/_/g, '.') : ''
}

/** Windows NT 版本號 → 行銷名稱。 */
function windowsName(nt: string): string {
  const map: Record<string, string> = {
    '10.0': '10 / 11',
    '6.3': '8.1',
    '6.2': '8',
    '6.1': '7',
    '6.0': 'Vista',
    '5.2': 'XP x64',
    '5.1': 'XP',
  }
  return map[nt] || nt
}

/** macOS 主版本 → 行銷名稱(部分代表性版本)。 */
function macName(v: string): string {
  const major = v.split('.').slice(0, 2).join('.')
  const map: Record<string, string> = {
    '10.15': 'Catalina',
    '10.14': 'Mojave',
    '10.13': 'High Sierra',
    '11': 'Big Sur',
    '12': 'Monterey',
    '13': 'Ventura',
    '14': 'Sonoma',
    '15': 'Sequoia',
  }
  const big = v.split('.')[0]
  return map[major] || map[big] || ''
}

const BOT_RE =
  /(bot|crawler|spider|crawling|slurp|mediapartners|facebookexternalhit|embedly|quora link preview|whatsapp|telegrambot|bingpreview|googlebot|baiduspider|yandex|duckduckbot|applebot|semrush|ahrefs|petalbot|curl|wget|python-requests|axios|okhttp|java\/|go-http-client|headlesschrome|phantomjs)/i

/** 解析作業系統與版本。 */
function detectOS(ua: string): { os: string; osVersion: string } {
  if (/windows nt/i.test(ua)) {
    return { os: 'Windows', osVersion: windowsName(ver(ua, /windows nt ([\d.]+)/i)) }
  }
  if (/windows phone/i.test(ua)) {
    return { os: 'Windows Phone', osVersion: ver(ua, /windows phone(?: os)? ([\d.]+)/i) }
  }
  if (/iphone|ipod/i.test(ua)) {
    return { os: 'iOS', osVersion: ver(ua, /os ([\d_]+)/i) }
  }
  if (/ipad/i.test(ua)) {
    return { os: 'iPadOS', osVersion: ver(ua, /os ([\d_]+)/i) }
  }
  if (/android/i.test(ua)) {
    return { os: 'Android', osVersion: ver(ua, /android ([\d.]+)/i) }
  }
  if (/cros/i.test(ua)) {
    return { os: 'Chrome OS', osVersion: '' }
  }
  if (/mac os x/i.test(ua)) {
    const v = ver(ua, /mac os x ([\d_]+)/i)
    const name = macName(v)
    return { os: 'macOS', osVersion: name ? `${v} (${name})` : v }
  }
  if (/linux/i.test(ua)) {
    return { os: 'Linux', osVersion: '' }
  }
  return { os: '', osVersion: '' }
}

/** 解析瀏覽器與版本(偵測順序由特殊到通用)。 */
function detectBrowser(ua: string): { browser: string; browserVersion: string } {
  // Edge:新版 Edg/、舊 EdgA(Android)/EdgiOS,以及最舊 Edge/(EdgeHTML)
  if (/edg(a|ios|)\//i.test(ua)) {
    return { browser: 'Microsoft Edge', browserVersion: ver(ua, /edg(?:a|ios)?\/([\d.]+)/i) }
  }
  if (/edge\//i.test(ua)) {
    return { browser: 'Microsoft Edge (Legacy)', browserVersion: ver(ua, /edge\/([\d.]+)/i) }
  }
  if (/opr\/|opera/i.test(ua)) {
    return { browser: 'Opera', browserVersion: ver(ua, /(?:opr|opera|version)\/([\d.]+)/i) }
  }
  if (/samsungbrowser/i.test(ua)) {
    return { browser: 'Samsung Internet', browserVersion: ver(ua, /samsungbrowser\/([\d.]+)/i) }
  }
  if (/ucbrowser/i.test(ua)) {
    return { browser: 'UC Browser', browserVersion: ver(ua, /ucbrowser\/([\d.]+)/i) }
  }
  if (/firefox|fxios/i.test(ua)) {
    return { browser: 'Firefox', browserVersion: ver(ua, /(?:firefox|fxios)\/([\d.]+)/i) }
  }
  if (/crios/i.test(ua)) {
    return { browser: 'Chrome (iOS)', browserVersion: ver(ua, /crios\/([\d.]+)/i) }
  }
  if (/chrome|chromium/i.test(ua)) {
    return { browser: 'Chrome', browserVersion: ver(ua, /(?:chrome|chromium)\/([\d.]+)/i) }
  }
  if (/safari/i.test(ua) && /version\//i.test(ua)) {
    return { browser: 'Safari', browserVersion: ver(ua, /version\/([\d.]+)/i) }
  }
  if (/msie |trident\//i.test(ua)) {
    const v = ver(ua, /msie ([\d.]+)/i) || ver(ua, /rv:([\d.]+)/i)
    return { browser: 'Internet Explorer', browserVersion: v }
  }
  return { browser: '', browserVersion: '' }
}

/** 解析排版引擎。 */
function detectEngine(ua: string): { engine: string; engineVersion: string } {
  if (/edgehtml\//i.test(ua)) return { engine: 'EdgeHTML', engineVersion: ver(ua, /edgehtml\/([\d.]+)/i) }
  if (/trident\//i.test(ua)) return { engine: 'Trident', engineVersion: ver(ua, /trident\/([\d.]+)/i) }
  if (/gecko\//i.test(ua) && /firefox/i.test(ua))
    return { engine: 'Gecko', engineVersion: ver(ua, /rv:([\d.]+)/i) }
  // iOS 上所有瀏覽器都被強制使用 WebKit(CriOS/FxiOS/EdgiOS/OPiOS 皆然)
  if (/crios|fxios|edgios|opios/i.test(ua) && /applewebkit/i.test(ua))
    return { engine: 'WebKit', engineVersion: ver(ua, /applewebkit\/([\d.]+)/i) }
  // Blink 與 WebKit 都帶 AppleWebKit;桌面/Android 的 Chrome/Opera/Edge(新)/Samsung 為 Blink
  if (/chrome|chromium|edg|opr|samsungbrowser/i.test(ua) && /applewebkit/i.test(ua))
    return { engine: 'Blink', engineVersion: ver(ua, /applewebkit\/([\d.]+)/i) }
  if (/applewebkit\//i.test(ua))
    return { engine: 'WebKit', engineVersion: ver(ua, /applewebkit\/([\d.]+)/i) }
  if (/gecko\//i.test(ua)) return { engine: 'Gecko', engineVersion: ver(ua, /rv:([\d.]+)/i) }
  return { engine: '', engineVersion: '' }
}

/** 判斷裝置類型。 */
function detectDevice(ua: string, isBot: boolean): UAResult['deviceType'] {
  if (isBot) return 'bot'
  if (/ipad|tablet|(android(?!.*mobile))|kindle|playbook|nexus (7|9|10)/i.test(ua)) return 'tablet'
  if (/mobi|iphone|ipod|android.*mobile|windows phone|blackberry|iemobile|opera mini/i.test(ua))
    return 'mobile'
  if (/windows|macintosh|mac os x|cros|linux|x11/i.test(ua)) return 'desktop'
  return 'unknown'
}

/** 解析 User-Agent 字串。空字串回 unknown。 */
export function parseUA(input: string): UAResult {
  const ua = (input || '').trim()
  const isBot = BOT_RE.test(ua)
  const { browser, browserVersion } = detectBrowser(ua)
  const { engine, engineVersion } = detectEngine(ua)
  const { os, osVersion } = detectOS(ua)
  return {
    browser,
    browserVersion,
    engine,
    engineVersion,
    os,
    osVersion,
    deviceType: detectDevice(ua, isBot),
    isBot,
  }
}
