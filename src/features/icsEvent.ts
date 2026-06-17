/*
  行事曆事件(.ics / iCalendar)產生引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  把一個活動(標題、時間、地點、備註、提醒)組成符合 RFC 5545 的 .ics 檔案內容,
  讓使用者下載後直接匯入 Google / Apple / Outlook 行事曆 —— 不必把活動內容交給任何網站、
  也不必授權任何 App 存取你的行事曆。全程在瀏覽器產生,不上傳。
*/

export interface EventInput {
  title: string
  start: string // datetime-local 值(YYYY-MM-DDTHH:mm)或 all-day 時的日期(YYYY-MM-DD)
  end?: string // 同上;留空則 datetime 預設 +1 小時、all-day 預設當天
  allDay: boolean
  location?: string
  description?: string
  url?: string
  reminderMinutes?: number | null // 事前幾分鐘提醒;null/未設則無提醒
}

export interface BuildOptions {
  uid?: string // 可注入以利測試
  dtstamp?: string // 可注入以利測試(YYYYMMDDTHHMMSSZ)
}

/** RFC 5545 文字逸出:反斜線、換行、逗號、分號。 */
export function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\n|\r/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
}

/** 把 datetime-local 字串轉為 ICS 浮動本地時間 YYYYMMDDTHHMMSS。 */
export function formatDateTime(local: string): string {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!m) throw new Error('INVALID_DATETIME')
  const [, y, mo, d, h, mi, s] = m
  return `${y}${mo}${d}T${h}${mi}${s ?? '00'}`
}

/** 把日期字串轉為 ICS 全日格式 YYYYMMDD。 */
export function formatDate(local: string): string {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) throw new Error('INVALID_DATE')
  const [, y, mo, d] = m
  return `${y}${mo}${d}`
}

/** 全日事件的 DTEND 為「隔天」(RFC 規定結束日為排他)。 */
function nextDay(dateStr: string): string {
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) throw new Error('INVALID_DATE')
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  dt.setUTCDate(dt.getUTCDate() + 1)
  const y = dt.getUTCFullYear()
  const mo = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const d = String(dt.getUTCDate()).padStart(2, '0')
  return `${y}${mo}${d}`
}

/** datetime-local 加上指定小時,回傳 ICS datetime。 */
function addHours(local: string, hours: number): string {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!m) throw new Error('INVALID_DATETIME')
  const dt = new Date(
    Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]),
  )
  dt.setHours(dt.getHours() + hours)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}${p(dt.getMonth() + 1)}${p(dt.getDate())}T${p(dt.getHours())}${p(dt.getMinutes())}00`
}

export interface BuildResult {
  ok: boolean
  error?: string
  ics: string
  filename: string
}

/** 組出完整 .ics 內容。 */
export function buildIcs(input: EventInput, options: BuildOptions = {}): BuildResult {
  const fail = (error: string): BuildResult => ({ ok: false, error, ics: '', filename: '' })

  if (!input.title.trim()) return fail('請輸入活動標題')
  if (!input.start.trim()) return fail('請輸入開始時間')

  const uid = options.uid ?? `${Date.now()}-${Math.random().toString(36).slice(2)}@toolhub`
  const dtstamp = options.dtstamp ?? defaultStamp()

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ToolHub//Event//ZH-TW',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
  ]

  try {
    if (input.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${formatDate(input.start)}`)
      const endDate = input.end?.trim() ? nextDay(input.end) : nextDay(input.start)
      lines.push(`DTEND;VALUE=DATE:${endDate}`)
    } else {
      lines.push(`DTSTART:${formatDateTime(input.start)}`)
      const end = input.end?.trim() ? formatDateTime(input.end) : addHours(input.start, 1)
      lines.push(`DTEND:${end}`)
    }
  } catch {
    return fail('時間格式不正確')
  }

  lines.push(`SUMMARY:${escapeText(input.title.trim())}`)
  if (input.location?.trim()) lines.push(`LOCATION:${escapeText(input.location.trim())}`)
  if (input.description?.trim()) lines.push(`DESCRIPTION:${escapeText(input.description.trim())}`)
  if (input.url?.trim()) lines.push(`URL:${escapeText(input.url.trim())}`)

  if (input.reminderMinutes != null && input.reminderMinutes >= 0) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(input.title.trim())}`,
      `TRIGGER:-PT${Math.floor(input.reminderMinutes)}M`,
      'END:VALARM',
    )
  }

  lines.push('END:VEVENT', 'END:VCALENDAR')

  const ics = lines.join('\r\n') + '\r\n'
  const safeName = input.title.trim().replace(/[\\/:*?"<>|]/g, '_').slice(0, 50) || 'event'
  return { ok: true, ics, filename: `${safeName}.ics` }
}

/** 產生符合格式的 UTC 時間戳(僅在未注入時用,故不需可測)。 */
function defaultStamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(
    d.getUTCHours(),
  )}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
}
