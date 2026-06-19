/*
  時間長度轉換核心 —— 純函式、無 DOM,可在 Node 測。
  在「人話(1天2小時30分)、時鐘(01:30:00)、ISO 8601(PT1H30M)、總秒/分/時」之間互轉。
  全程瀏覽器、不連網、不上傳。
*/

const UNIT_SECONDS: Record<string, number> = {
  w: 604800,
  d: 86400,
  h: 3600,
  m: 60,
  s: 1,
}

export interface ParseResult {
  ok: boolean
  seconds?: number
  error?: string
}

/** 解析帶單位的字串(支援中英單位混寫,如 1d2h、1天30分、90 min)。 */
function parseUnits(input: string): number | null {
  let str = input.toLowerCase()
  // 中文單位(長詞先換,避免「小時」被「時」截斷)
  str = str
    .replace(/小時|小时|鐘頭/g, 'h')
    .replace(/分鐘|分钟/g, 'm')
    .replace(/秒鐘|秒钟/g, 's')
    .replace(/星期|禮拜|礼拜|週|周/g, 'w')
    .replace(/天|日/g, 'd')
    .replace(/時|时/g, 'h')
    .replace(/分/g, 'm')
    .replace(/秒/g, 's')
  // 英文長寫
  str = str
    .replace(/weeks?|wks?/g, 'w')
    .replace(/days?/g, 'd')
    .replace(/hours?|hrs?/g, 'h')
    .replace(/minutes?|mins?/g, 'm')
    .replace(/seconds?|secs?/g, 's')
  const stripped = str.replace(/\s+/g, '')
  const re = /(\d+(?:\.\d+)?)([wdhms])/g
  let total = 0
  let rebuilt = ''
  let m: RegExpExecArray | null
  while ((m = re.exec(stripped))) {
    total += Number(m[1]) * UNIT_SECONDS[m[2]]
    rebuilt += m[0]
  }
  // 必須完整消耗輸入(無殘留字元),且至少有一段
  if (rebuilt === '' || rebuilt !== stripped) return null
  return total
}

/** 解析各種時間長度表示法為「總秒數」。 */
export function parseDuration(input: string): ParseResult {
  const s = input.trim()
  if (s === '') return { ok: false, error: '請輸入時間長度' }

  // 純數字 → 視為秒
  if (/^\d+(\.\d+)?$/.test(s)) return { ok: true, seconds: Number(s) }

  // 時鐘格式 mm:ss 或 hh:mm:ss(末段可帶小數)
  if (/^\d+(:\d{1,2}){1,2}(\.\d+)?$/.test(s)) {
    const parts = s.split(':').map(Number)
    if (parts.some((n) => Number.isNaN(n))) return { ok: false, error: '時鐘格式有誤' }
    let sec = 0
    for (const p of parts) sec = sec * 60 + p
    return { ok: true, seconds: sec }
  }

  // ISO 8601 期間:P[nW][nD]T[nH][nM][nS]
  const iso =
    /^P(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i
  const im = s.match(iso)
  if (im && im.slice(1).some((g) => g !== undefined)) {
    const [w, d, h, mi, se] = im.slice(1).map((g) => (g ? Number(g) : 0))
    return { ok: true, seconds: w * 604800 + d * 86400 + h * 3600 + mi * 60 + se }
  }

  // 帶單位字串
  const u = parseUnits(s)
  if (u !== null) return { ok: true, seconds: u }

  return { ok: false, error: '看不懂這個時間長度格式' }
}

export interface UnitBreakdown {
  days: number
  hours: number
  minutes: number
  seconds: number
}

/** 拆成天/時/分/秒(整數秒;小數秒保留在 seconds)。 */
export function breakdown(totalSeconds: number): UnitBreakdown {
  let s = Math.abs(totalSeconds)
  const days = Math.floor(s / 86400)
  s -= days * 86400
  const hours = Math.floor(s / 3600)
  s -= hours * 3600
  const minutes = Math.floor(s / 60)
  s -= minutes * 60
  return { days, hours, minutes, seconds: s }
}

/** 人話格式:1 天 2 小時 30 分鐘。 */
export function formatHuman(totalSeconds: number): string {
  if (totalSeconds === 0) return '0 秒'
  const sign = totalSeconds < 0 ? '-' : ''
  const b = breakdown(totalSeconds)
  const parts: string[] = []
  if (b.days) parts.push(`${b.days} 天`)
  if (b.hours) parts.push(`${b.hours} 小時`)
  if (b.minutes) parts.push(`${b.minutes} 分鐘`)
  if (b.seconds) parts.push(`${round(b.seconds)} 秒`)
  return sign + parts.join(' ')
}

/** 時鐘格式 HH:MM:SS(超過一天會累進到小時)。 */
export function formatClock(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? '-' : ''
  let s = Math.abs(totalSeconds)
  const h = Math.floor(s / 3600)
  s -= h * 3600
  const m = Math.floor(s / 60)
  s -= m * 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${sign}${pad(h)}:${pad(m)}:${pad(round(s))}`
}

/** ISO 8601 期間格式:PT1H30M。 */
export function formatIso(totalSeconds: number): string {
  if (totalSeconds === 0) return 'PT0S'
  const sign = totalSeconds < 0 ? '-' : ''
  const b = breakdown(totalSeconds)
  let out = 'P'
  if (b.days) out += `${b.days}D`
  const timeParts =
    (b.hours ? `${b.hours}H` : '') +
    (b.minutes ? `${b.minutes}M` : '') +
    (b.seconds ? `${round(b.seconds)}S` : '')
  if (timeParts) out += 'T' + timeParts
  return sign + out
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000
}
