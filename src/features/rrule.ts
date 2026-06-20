/*
  RRULE(RFC 5545 行事曆重複規則)解讀引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  把 iCalendar 的 RRULE(例:FREQ=MONTHLY;BYDAY=-1FR)解析成中文白話說明,
  並依起始時間(DTSTART)算出接下來幾次實際發生的日期時間。
  Google/Apple/Outlook 行事曆匯出的 .ics 裡那串 RRULE 沒人看得懂;這裡用白話解讀 + 列出下次發生時間。
  支援:FREQ(DAILY/WEEKLY/MONTHLY/YEARLY)、INTERVAL、COUNT、UNTIL、
        BYMONTH、BYMONTHDAY(含負數=從月底倒數)、BYDAY(含序數如 2MO、-1FR)、BYSETPOS、WKST。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

export type Freq = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'

export interface ByDay {
  ord: number // 0 = 未指定序數;>0 第 n 個;<0 從月/年底倒數
  wd: number // 0=週日 .. 6=週六(對應 JS getDay)
}

export interface RRule {
  freq: Freq
  interval: number
  count: number | null
  until: Date | null
  bymonth: number[] // 1-12
  bymonthday: number[] // 1-31 或負數
  byday: ByDay[]
  bysetpos: number[]
  wkst: number // 0-6,預設 1(週一)
}

const WD_CODES: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 }
const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六']

function daysInMonth(year: number, m0: number): number {
  return new Date(year, m0 + 1, 0).getDate()
}

function parseUntil(s: string): Date {
  // 格式:YYYYMMDD 或 YYYYMMDDTHHMMSS(Z 結尾視為當地牆上時間,與本機時區計算一致)
  const m = s.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?Z?$/)
  if (!m) throw new Error(`UNTIL 日期格式「${s}」無法解析(需 YYYYMMDD 或 YYYYMMDDTHHMMSSZ)`)
  const [, y, mo, d, h, mi, se] = m
  return new Date(+y, +mo - 1, +d, h ? +h : 23, mi ? +mi : 59, se ? +se : 59)
}

function parseByDay(token: string): ByDay {
  const m = token.trim().toUpperCase().match(/^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/)
  if (!m) throw new Error(`BYDAY「${token}」無效(需如 MO、2TH、-1FR)`)
  return { ord: m[1] ? parseInt(m[1], 10) : 0, wd: WD_CODES[m[2]] }
}

/** 解析 RRULE 字串。可含 RRULE: 前綴。失敗丟 Error。 */
export function parseRRule(input: string): RRule {
  let body = input.trim()
  // 容許貼上整段(含 DTSTART 行),只取 RRULE 那行
  const line = body.split(/\r?\n/).find((l) => /RRULE[:=]/i.test(l)) ?? body
  body = line.replace(/^.*RRULE[:=]/i, '').trim()
  if (!body) throw new Error('請輸入 RRULE,例如 FREQ=WEEKLY;BYDAY=MO,WE,FR')

  const rule: RRule = {
    freq: 'DAILY', interval: 1, count: null, until: null,
    bymonth: [], bymonthday: [], byday: [], bysetpos: [], wkst: 1,
  }
  let hasFreq = false

  for (const part of body.split(';')) {
    if (!part.trim()) continue
    const eq = part.indexOf('=')
    if (eq < 0) throw new Error(`「${part}」不是有效的 key=value`)
    const key = part.slice(0, eq).trim().toUpperCase()
    const val = part.slice(eq + 1).trim()
    switch (key) {
      case 'FREQ': {
        const f = val.toUpperCase()
        if (f === 'SECONDLY' || f === 'MINUTELY' || f === 'HOURLY')
          throw new Error(`目前不支援 FREQ=${f}(本工具聚焦行事曆常用的日/週/月/年)`)
        if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(f))
          throw new Error(`FREQ「${val}」無效(需 DAILY/WEEKLY/MONTHLY/YEARLY)`)
        rule.freq = f as Freq
        hasFreq = true
        break
      }
      case 'INTERVAL': {
        const n = parseInt(val, 10)
        if (!/^\d+$/.test(val) || n < 1) throw new Error(`INTERVAL「${val}」需為正整數`)
        rule.interval = n
        break
      }
      case 'COUNT': {
        const n = parseInt(val, 10)
        if (!/^\d+$/.test(val) || n < 1) throw new Error(`COUNT「${val}」需為正整數`)
        rule.count = n
        break
      }
      case 'UNTIL':
        rule.until = parseUntil(val)
        break
      case 'BYMONTH':
        rule.bymonth = val.split(',').map((v) => {
          const n = parseInt(v, 10)
          if (!/^\d+$/.test(v) || n < 1 || n > 12) throw new Error(`BYMONTH「${v}」需為 1-12`)
          return n
        })
        break
      case 'BYMONTHDAY':
        rule.bymonthday = val.split(',').map((v) => {
          const n = parseInt(v, 10)
          if (!/^[+-]?\d+$/.test(v) || n === 0 || n > 31 || n < -31)
            throw new Error(`BYMONTHDAY「${v}」需為 1-31 或 -1~-31`)
          return n
        })
        break
      case 'BYDAY':
        rule.byday = val.split(',').map(parseByDay)
        break
      case 'BYSETPOS':
        rule.bysetpos = val.split(',').map((v) => {
          const n = parseInt(v, 10)
          if (!/^[+-]?\d+$/.test(v) || n === 0) throw new Error(`BYSETPOS「${v}」需為非零整數`)
          return n
        })
        break
      case 'WKST': {
        const w = val.toUpperCase()
        if (!(w in WD_CODES)) throw new Error(`WKST「${val}」無效`)
        rule.wkst = WD_CODES[w]
        break
      }
      default:
        // 略過不支援的欄位(BYYEARDAY、BYWEEKNO、BYHOUR…),不影響主要結果
        break
    }
  }
  if (!hasFreq) throw new Error('缺少必填的 FREQ')
  if (rule.count !== null && rule.until !== null)
    throw new Error('COUNT 與 UNTIL 不可同時出現')
  return rule
}

// 該月某星期幾的所有日期(1-based 日數),依序排列
function weekdayDaysInMonth(year: number, m0: number, wd: number): number[] {
  const out: number[] = []
  const dim = daysInMonth(year, m0)
  for (let d = 1; d <= dim; d++) if (new Date(year, m0, d).getDay() === wd) out.push(d)
  return out
}

// 依 BYMONTHDAY / BYDAY(序數於該月內解讀)算出該月符合的日數;皆未指定回傳 null(由呼叫端決定預設)
function dayNumbersForMonth(year: number, m0: number, rule: RRule): number[] | null {
  const dim = daysInMonth(year, m0)
  let mdSet: Set<number> | null = null
  if (rule.bymonthday.length) {
    mdSet = new Set()
    for (const md of rule.bymonthday) {
      const d = md > 0 ? md : dim + md + 1
      if (d >= 1 && d <= dim) mdSet.add(d)
    }
  }
  let bdSet: Set<number> | null = null
  if (rule.byday.length) {
    bdSet = new Set()
    for (const { ord, wd } of rule.byday) {
      const occ = weekdayDaysInMonth(year, m0, wd)
      if (ord === 0) occ.forEach((d) => bdSet!.add(d))
      else {
        const idx = ord > 0 ? ord - 1 : occ.length + ord
        if (idx >= 0 && idx < occ.length) bdSet.add(occ[idx])
      }
    }
  }
  let days: number[]
  if (mdSet && bdSet) days = [...mdSet].filter((d) => bdSet!.has(d))
  else if (mdSet) days = [...mdSet]
  else if (bdSet) days = [...bdSet]
  else return null
  return days.sort((a, b) => a - b)
}

function applySetPos(dates: Date[], pos: number[]): Date[] {
  if (!pos.length) return dates
  const out: Date[] = []
  for (const p of pos) {
    const idx = p > 0 ? p - 1 : dates.length + p
    if (idx >= 0 && idx < dates.length) out.push(dates[idx])
  }
  return out.sort((a, b) => a.getTime() - b.getTime())
}

function atTime(year: number, m0: number, d: number, base: Date): Date {
  return new Date(year, m0, d, base.getHours(), base.getMinutes(), base.getSeconds(), 0)
}

// 產生某個週期內(已排序、含時間)的候選日期
function candidatesForPeriod(periodStart: Date, rule: RRule, dtstart: Date): Date[] {
  const inMonth = (m1: number) => !rule.bymonth.length || rule.bymonth.includes(m1)
  if (rule.freq === 'DAILY') {
    const y = periodStart.getFullYear(), m0 = periodStart.getMonth(), d = periodStart.getDate()
    if (!inMonth(m0 + 1)) return []
    if (rule.byday.length && !rule.byday.some((b) => b.wd === periodStart.getDay())) return []
    if (rule.bymonthday.length) {
      const dim = daysInMonth(y, m0)
      const ok = rule.bymonthday.some((md) => (md > 0 ? md : dim + md + 1) === d)
      if (!ok) return []
    }
    return [atTime(y, m0, d, dtstart)]
  }
  if (rule.freq === 'WEEKLY') {
    const wds = rule.byday.length ? rule.byday.map((b) => b.wd) : [dtstart.getDay()]
    const out: Date[] = []
    for (let off = 0; off < 7; off++) {
      const day = new Date(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate() + off)
      if (!wds.includes(day.getDay())) continue
      if (!inMonth(day.getMonth() + 1)) continue
      out.push(atTime(day.getFullYear(), day.getMonth(), day.getDate(), dtstart))
    }
    return applySetPos(out, rule.bysetpos)
  }
  if (rule.freq === 'MONTHLY') {
    const y = periodStart.getFullYear(), m0 = periodStart.getMonth()
    if (!inMonth(m0 + 1)) return []
    let days = dayNumbersForMonth(y, m0, rule)
    if (days === null) {
      const dd = dtstart.getDate()
      days = dd <= daysInMonth(y, m0) ? [dd] : []
    }
    return applySetPos(days.map((d) => atTime(y, m0, d, dtstart)), rule.bysetpos)
  }
  // YEARLY
  const y = periodStart.getFullYear()
  const months = rule.bymonth.length
    ? rule.bymonth.map((m) => m - 1)
    : rule.byday.length || rule.bymonthday.length
      ? Array.from({ length: 12 }, (_, i) => i)
      : [dtstart.getMonth()]
  const out: Date[] = []
  for (const m0 of months) {
    let days = dayNumbersForMonth(y, m0, rule)
    if (days === null) {
      const dd = dtstart.getDate()
      days = dd <= daysInMonth(y, m0) ? [dd] : []
    }
    for (const d of days) out.push(atTime(y, m0, d, dtstart))
  }
  out.sort((a, b) => a.getTime() - b.getTime())
  return applySetPos(out, rule.bysetpos)
}

function startPeriod(rule: RRule, dt: Date): Date {
  const y = dt.getFullYear(), m0 = dt.getMonth(), d = dt.getDate()
  if (rule.freq === 'DAILY') return new Date(y, m0, d)
  if (rule.freq === 'WEEKLY') {
    const back = (dt.getDay() - rule.wkst + 7) % 7
    return new Date(y, m0, d - back)
  }
  if (rule.freq === 'MONTHLY') return new Date(y, m0, 1)
  return new Date(y, 0, 1)
}

function advance(rule: RRule, p: Date): Date {
  const y = p.getFullYear(), m0 = p.getMonth(), d = p.getDate()
  if (rule.freq === 'DAILY') return new Date(y, m0, d + rule.interval)
  if (rule.freq === 'WEEKLY') return new Date(y, m0, d + rule.interval * 7)
  if (rule.freq === 'MONTHLY') return new Date(y, m0 + rule.interval, 1)
  return new Date(y + rule.interval, 0, 1)
}

/** 從 dtstart 起,算出接下來最多 limit 次發生時間(含符合規則的 dtstart 本身)。 */
export function occurrences(input: string | RRule, dtstart: Date, limit = 10): Date[] {
  const rule = typeof input === 'string' ? parseRRule(input) : input
  const cap = rule.count !== null ? Math.min(rule.count, limit) : limit
  const out: Date[] = []
  let p = startPeriod(rule, dtstart)
  let guard = 0
  while (out.length < cap && guard < 200000) {
    guard++
    for (const c of candidatesForPeriod(p, rule, dtstart)) {
      if (c.getTime() < dtstart.getTime()) continue
      if (rule.until && c.getTime() > rule.until.getTime()) return out
      out.push(c)
      if (out.length >= cap) return out
    }
    p = advance(rule, p)
  }
  return out
}

function ordCN(n: number): string {
  if (n === -1) return '最後一個'
  if (n < 0) return `倒數第 ${-n} 個`
  return `第 ${n} 個`
}

/** 把 RRULE 轉成中文白話說明。 */
export function describeRRule(input: string | RRule, dtstart?: Date): string {
  const rule = typeof input === 'string' ? parseRRule(input) : input
  const i = rule.interval
  const base: Record<Freq, [string, string]> = {
    DAILY: ['每天', `每 ${i} 天`],
    WEEKLY: ['每週', `每 ${i} 週`],
    MONTHLY: ['每月', `每 ${i} 個月`],
    YEARLY: ['每年', `每 ${i} 年`],
  }
  const parts: string[] = [i === 1 ? base[rule.freq][0] : base[rule.freq][1]]

  if (rule.bymonth.length) parts.push('的 ' + rule.bymonth.map((m) => `${m} 月`).join('、'))

  if (rule.bymonthday.length) {
    parts.push(
      rule.bymonthday
        .map((d) => (d === -1 ? '最後一天' : d < 0 ? `倒數第 ${-d} 天` : `${d} 號`))
        .join('、'),
    )
  }
  if (rule.byday.length) {
    parts.push(
      rule.byday
        .map((b) => (b.ord === 0 ? `星期${WEEK_CN[b.wd]}` : `${ordCN(b.ord)}星期${WEEK_CN[b.wd]}`))
        .join('、'),
    )
  }
  if (rule.bysetpos.length) parts.push(`(取其中${rule.bysetpos.map(ordCN).join('、')})`)

  if (dtstart) {
    const p = (n: number) => (n < 10 ? '0' + n : '' + n)
    parts.push(`於 ${p(dtstart.getHours())}:${p(dtstart.getMinutes())}`)
  }
  parts.push('發生')

  if (rule.count !== null) parts.push(`,共 ${rule.count} 次`)
  else if (rule.until) {
    const u = rule.until
    parts.push(`,直到 ${u.getFullYear()}/${u.getMonth() + 1}/${u.getDate()}`)
  }
  return parts.join('')
}
