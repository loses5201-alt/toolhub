/*
  網址清理引擎 —— 零相依、純函式,全程在瀏覽器執行。
  兩件事:
  1) 還原轉址包裝:把 Google / Facebook / Outlook 安全連結等「先導到中介站再跳轉」
     的網址,還原成「真正會去的目的地」,讓你在點之前看清楚要去哪(防釣魚)。
  2) 清掉追蹤參數:移除 utm_*、fbclid、gclid 等只用來追蹤你的參數,
     連結變乾淨、不洩漏來源,功能不受影響。
  與 UI 分離,方便回歸測試(scripts/test-urlclean.mjs)。
*/

export interface RemovedParam {
  key: string
  value: string
}

export interface CleanResult {
  ok: boolean // 是否成功解析為 http(s) 網址
  input: string // 原始輸入(已 trim)
  cleaned: string // 清理後網址(失敗時等於 input)
  unwrapped: boolean // 是否從轉址包裝還原出真正目的地
  unwrapChain: string[] // 還原經過的中介站 host(依序),供顯示
  removed: RemovedParam[] // 被移除的追蹤參數
  schemeAdded: boolean // 是否替沒寫 http(s) 的輸入補上 https://
  changed: boolean // 結果與輸入是否不同
  note?: string // 失敗或提醒訊息
}

// 已知的「轉址中介站」host 後綴 —— 只在這些站才嘗試還原,
// 避免把正常網址裡剛好帶完整網址的參數(例:?next=)誤判成轉址。
const REDIRECTOR_SUFFIXES = [
  'google.com',
  'google.com.tw',
  'l.facebook.com',
  'lm.facebook.com',
  'l.instagram.com',
  'l.messenger.com',
  'safelinks.protection.outlook.com',
  'youtube.com',
  'out.reddit.com',
  'away.vk.com',
  'href.li',
  't.umblr.com',
  'steamcommunity.com',
  'getpocket.com',
]

// 轉址網址通常把真正目的地放在這些參數其中之一
const REDIRECT_PARAM_KEYS = ['q', 'url', 'u', 'target', 'dest', 'to', 'continue', 'next', 'r', 'redirect']

// 追蹤參數:前綴比對(整類移除)
const TRACK_PREFIXES = [
  'utm_',
  'utm-',
  'pk_',
  'mtm_',
  'mc_',
  'ml_',
  'hsa_',
  '_hs',
  'vero_',
  'oly_',
  'wt_',
  'wt.',
  'stm_',
  'trk_',
  'ga_',
  '_ga',
  'spm_',
  'scm_',
  'at_',
]

// 追蹤參數:完全比對(逐一移除)
const TRACK_EXACT = new Set([
  'fbclid',
  'gclid',
  'dclid',
  'gclsrc',
  'wbraid',
  'gbraid',
  'msclkid',
  'yclid',
  'twclid',
  'ttclid',
  'igshid',
  'igsh',
  'si', // YouTube / 各家「分享」歸因
  'spm',
  'scm',
  'ref',
  'ref_src',
  'ref_url',
  'referrer',
  'source',
  'cmpid',
  'campaign',
  'campaign_id',
  'ad_id',
  'adset_id',
  'fb_action_ids',
  'fb_action_types',
  'fb_source',
  'action_object_map',
  'action_type_map',
  'action_ref_map',
  '_openstat',
  'from',
  'share_source',
  'share_medium',
  'share_plus',
  'xtor',
  'guccounter',
  'guce_referrer',
  'guce_referrer_sig',
  '__twitter_impression',
])

const SCHEME_RE = /^[a-z][a-z0-9+.-]*:\/\//i
const HTTP_URL_RE = /^https?:\/\//i

function hostMatches(host: string): boolean {
  return REDIRECTOR_SUFFIXES.some((s) => host === s || host.endsWith('.' + s))
}

function isTrackingKey(key: string): boolean {
  const k = key.toLowerCase()
  if (TRACK_EXACT.has(k)) return true
  return TRACK_PREFIXES.some((p) => k.startsWith(p))
}

// 嘗試把字串解析成 URL;沒有 scheme 又像網域時補上 https://
function parse(raw: string): { url: URL | null; schemeAdded: boolean } {
  try {
    return { url: new URL(raw), schemeAdded: false }
  } catch {
    // 沒寫 http(s):若第一段(到第一個 / ? # 前)含有「.」就當網域補 https://
    if (!SCHEME_RE.test(raw)) {
      const headEnd = raw.search(/[/?#]/)
      const head = headEnd === -1 ? raw : raw.slice(0, headEnd)
      if (head.includes('.') && !head.includes(' ')) {
        try {
          return { url: new URL('https://' + raw), schemeAdded: true }
        } catch {
          /* 落到下方回 null */
        }
      }
    }
    return { url: null, schemeAdded: false }
  }
}

/** 清理單一網址 */
export function cleanUrl(raw: string): CleanResult {
  const input = raw.trim()
  const base: CleanResult = {
    ok: false,
    input,
    cleaned: input,
    unwrapped: false,
    unwrapChain: [],
    removed: [],
    schemeAdded: false,
    changed: false,
  }

  if (!input) return { ...base, note: '請貼上要清理的網址' }

  let { url, schemeAdded } = parse(input)
  if (!url) return { ...base, note: '看起來不是有效的網址' }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ...base, note: '只支援 http / https 網址' }
  }

  // 1) 逐層還原轉址(最多 5 層,防無限迴圈)
  const chain: string[] = []
  for (let i = 0; i < 5; i++) {
    if (!hostMatches(url.host)) break
    let inner: string | null = null
    for (const key of REDIRECT_PARAM_KEYS) {
      const v = url.searchParams.get(key)
      if (v && HTTP_URL_RE.test(v)) {
        inner = v
        break
      }
    }
    if (!inner) break
    let next: URL
    try {
      next = new URL(inner)
    } catch {
      break
    }
    if (next.protocol !== 'http:' && next.protocol !== 'https:') break
    chain.push(url.host)
    url = next
  }

  // 2) 移除追蹤參數(保留其餘參數的原本順序)
  const removed: RemovedParam[] = []
  const keys = [...url.searchParams.keys()]
  for (const key of keys) {
    if (isTrackingKey(key)) {
      // 同名多值:逐一取出記錄,再整批刪除
      for (const v of url.searchParams.getAll(key)) removed.push({ key, value: v })
      url.searchParams.delete(key)
    }
  }

  const unwrapped = chain.length > 0
  // 完全沒動到時,回傳原字串避免不必要的重新編碼(例 %20 ↔ +)
  if (!unwrapped && removed.length === 0 && !schemeAdded) {
    return { ...base, ok: true, cleaned: input, changed: false }
  }

  const cleaned = url.toString()
  return {
    ok: true,
    input,
    cleaned,
    unwrapped,
    unwrapChain: chain,
    removed,
    schemeAdded,
    changed: cleaned !== input,
  }
}

/** 逐行清理多個網址(空行略過) */
export function cleanUrls(text: string): CleanResult[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map(cleanUrl)
}
