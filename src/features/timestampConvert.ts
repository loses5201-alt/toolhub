/*
  Unix 時間戳記轉換引擎 —— 純函式、無 DOM、可在 Node 測試。
  - 自動判斷輸入的數字是「秒 / 毫秒 / 微秒」並還原成 Date
  - 解析常見日期字串成 Date
  - 算出與現在的相對時間(白話中文)
  全程在瀏覽器計算,不連網、不上傳。
*/

export type EpochUnit = 'seconds' | 'milliseconds' | 'microseconds'

export interface EpochParse {
  ok: boolean
  ms?: number // 換算成毫秒的 epoch
  unit?: EpochUnit // 判斷出的原始單位
  error?: string
}

/**
 * 解析一串純數字的時間戳記,自動判斷單位。
 * 依數值大小判斷:秒級 ~1e9、毫秒級 ~1e12、微秒級 ~1e15。
 */
export function parseEpoch(raw: string): EpochParse {
  const s = raw.trim().replace(/[, _]/g, '')
  if (!s) return { ok: false, error: '請輸入時間戳記' }
  if (!/^-?\d+$/.test(s)) return { ok: false, error: '時間戳記必須是整數數字' }
  const n = Number(s)
  if (!Number.isFinite(n)) return { ok: false, error: '數字過大無法處理' }

  const abs = Math.abs(n)
  let unit: EpochUnit
  let ms: number
  // 以整數的位數判斷單位(對 1970 之後的常見年代而言夠準)
  if (abs < 1e11) {
    unit = 'seconds'
    ms = n * 1000
  } else if (abs < 1e14) {
    unit = 'milliseconds'
    ms = n
  } else {
    unit = 'microseconds'
    ms = Math.floor(n / 1000)
  }
  if (Math.abs(ms) > 8.64e15) return { ok: false, error: '超出可表示的日期範圍' }
  return { ok: true, ms, unit }
}

/** 解析常見日期字串成毫秒 epoch。接受 ISO 8601 與多數瀏覽器可懂的格式。 */
export function parseDateString(raw: string): EpochParse {
  const s = raw.trim()
  if (!s) return { ok: false, error: '請輸入日期' }
  // 把 "2026-06-18 12:30" 這種空格分隔轉成 ISO 的 T,提高跨瀏覽器一致性
  const normalized = /^\d{4}-\d{2}-\d{2}[ ]\d{2}:\d{2}/.test(s) ? s.replace(' ', 'T') : s
  const t = Date.parse(normalized)
  if (Number.isNaN(t)) return { ok: false, error: '無法辨識的日期格式' }
  return { ok: true, ms: t }
}

const UNIT_LABEL: Record<EpochUnit, string> = {
  seconds: '秒 (10 位數)',
  milliseconds: '毫秒 (13 位數)',
  microseconds: '微秒 (16 位數)',
}
export function unitLabel(u: EpochUnit): string {
  return UNIT_LABEL[u]
}

/** 把毫秒 epoch 換算回指定單位的整數。 */
export function epochInUnit(ms: number, unit: EpochUnit): number {
  if (unit === 'seconds') return Math.floor(ms / 1000)
  if (unit === 'microseconds') return ms * 1000
  return ms
}

/** 兩格補零。 */
function pad(n: number, w = 2): string {
  return String(Math.abs(n)).padStart(w, '0')
}

const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六']

/** 格式化某個毫秒 epoch 在「指定時區偏移(分鐘)」下的本地時間字串。
 *  offsetMinutes 為該時區相對 UTC 的分鐘數(台灣 = +480)。 */
export function formatInOffset(ms: number, offsetMinutes: number): string {
  const d = new Date(ms + offsetMinutes * 60000)
  // 用 getUTC* 取出「已平移」後的時間,等同該時區的牆上時間
  const y = d.getUTCFullYear()
  const w = WEEK_CN[d.getUTCDay()]
  return `${y}/${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}(週${w}) ${pad(
    d.getUTCHours(),
  )}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
}

/** ISO 8601 (UTC, 含毫秒) */
export function toISO(ms: number): string {
  return new Date(ms).toISOString()
}

/** 與「現在」的白話相對時間。nowMs 預設為 Date.now(),測試可注入。 */
export function relativeFromNow(ms: number, nowMs: number = Date.now()): string {
  const diff = ms - nowMs // 正=未來
  const future = diff >= 0
  const abs = Math.abs(diff)
  const sec = Math.round(abs / 1000)
  let text: string
  if (sec < 60) text = `${sec} 秒`
  else if (sec < 3600) text = `${Math.round(sec / 60)} 分鐘`
  else if (sec < 86400) text = `${Math.round(sec / 3600)} 小時`
  else if (sec < 2592000) text = `${Math.round(sec / 86400)} 天`
  else if (sec < 31536000) text = `${Math.round(sec / 2592000)} 個月`
  else text = `${Math.round((sec / 31536000) * 10) / 10} 年`
  if (sec < 1) return '就是現在'
  return future ? `${text}後` : `${text}前`
}
