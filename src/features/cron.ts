/*
  Cron 表達式解讀引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  把 5 欄位的 cron(分 時 日 月 週)解析成中文說明,並算出接下來幾次的執行時間。
  crontab.guru 很好用但只有英文;這裡用白話中文解讀 + 列出下次執行時間,排程設定不再猜。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

export interface CronField {
  values: number[] // 排序後符合的數值集合
  isAll: boolean // 是否為 *(未限定)
}

export interface CronParsed {
  minute: CronField
  hour: CronField
  dom: CronField // day of month 1-31
  month: CronField // 1-12
  dow: CronField // day of week 0-6(0=週日)
}

const RANGES: Record<keyof CronParsed, [number, number]> = {
  minute: [0, 59],
  hour: [0, 23],
  dom: [1, 31],
  month: [1, 12],
  dow: [0, 6],
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}
const DOW_NAMES: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
}

const SHORTCUTS: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
}

function parseFieldToken(token: string, key: keyof CronParsed): number[] {
  const [min, max] = RANGES[key]
  const names = key === 'month' ? MONTH_NAMES : key === 'dow' ? DOW_NAMES : null
  const resolve = (s: string): number => {
    const low = s.toLowerCase()
    if (names && low in names) return names[low]
    if (!/^-?\d+$/.test(s)) throw new Error(`無法解析「${s}」`)
    return parseInt(s, 10)
  }
  const out = new Set<number>()
  for (const part of token.split(',')) {
    if (part === '') throw new Error('有空白欄位片段')
    let step = 1
    let body = part
    const slash = part.indexOf('/')
    if (slash >= 0) {
      body = part.slice(0, slash)
      const stepStr = part.slice(slash + 1)
      step = parseInt(stepStr, 10)
      if (!/^\d+$/.test(stepStr) || step < 1) throw new Error(`步進值「${stepStr}」無效`)
    }
    let lo: number
    let hi: number
    if (body === '*') {
      lo = min
      hi = max
    } else if (body.includes('-')) {
      const [a, b] = body.split('-')
      lo = resolve(a)
      hi = resolve(b)
    } else {
      lo = hi = resolve(body)
      if (slash >= 0) hi = max // a/n 代表 a, a+n, ... 至上限
    }
    // dow 允許 7 = 週日
    if (key === 'dow') {
      if (lo === 7) lo = 0
      if (hi === 7) hi = 0
    }
    if (lo < min || hi > max || lo > hi) throw new Error(`「${part}」超出範圍 ${min}-${max}`)
    for (let v = lo; v <= hi; v += step) out.add(v)
  }
  return [...out].sort((a, b) => a - b)
}

/** 解析 cron 字串(5 欄位或 @ 捷徑)。失敗丟 Error。 */
export function parseCron(expr: string): CronParsed {
  let e = expr.trim().toLowerCase()
  if (e in SHORTCUTS) e = SHORTCUTS[e]
  const parts = e.split(/\s+/)
  if (parts.length !== 5) throw new Error(`需要 5 個欄位(分 時 日 月 週),目前有 ${parts.length} 個`)
  const keys: (keyof CronParsed)[] = ['minute', 'hour', 'dom', 'month', 'dow']
  const field = (i: number): CronField => ({
    values: parseFieldToken(parts[i], keys[i]),
    isAll: parts[i] === '*',
  })
  return {
    minute: field(0),
    hour: field(1),
    dom: field(2),
    month: field(3),
    dow: field(4),
  }
}

const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六']

function listCN(values: number[], unit: string, all: boolean, total: number): string {
  if (all) return ''
  if (values.length === total) return ''
  // 偵測等間隔步進
  if (values.length >= 3) {
    const step = values[1] - values[0]
    const even = values.every((v, i) => i === 0 || v - values[i - 1] === step)
    if (even && step > 1 && values[0] === values[0]) return `每 ${step} ${unit}`
  }
  return values.join('、') + ' ' + unit
}

/** 把 cron 轉成中文白話說明。 */
export function describeCron(expr: string): string {
  const c = parseCron(expr)
  const parts: string[] = []

  // 時間部分(分 + 時)
  if (c.minute.isAll && c.hour.isAll) {
    parts.push('每分鐘')
  } else if (c.minute.values.length === 1 && c.hour.values.length === 1) {
    const t = `${pad(c.hour.values[0])}:${pad(c.minute.values[0])}`
    parts.push(`在 ${t}`)
  } else {
    if (!c.hour.isAll) {
      const h = listCN(c.hour.values, '小時', c.hour.isAll, 24)
      parts.push(h.startsWith('每') ? h : `在第 ${c.hour.values.join('、')} 時`)
    }
    if (c.minute.isAll) parts.push('的每分鐘')
    else {
      const m = listCN(c.minute.values, '分鐘', c.minute.isAll, 60)
      parts.push(m.startsWith('每') ? m : `第 ${c.minute.values.join('、')} 分`)
    }
  }

  // 日期部分
  const segs: string[] = []
  if (!c.month.isAll) segs.push('在 ' + c.month.values.map((m) => `${m} 月`).join('、'))
  if (!c.dom.isAll) segs.push('每月 ' + c.dom.values.map((d) => `${d} 號`).join('、'))
  if (!c.dow.isAll) segs.push('星期 ' + c.dow.values.map((d) => WEEK_CN[d]).join('、'))
  if (!c.dom.isAll && !c.dow.isAll) {
    segs.push('(日期或星期任一符合即執行)')
  }

  return parts.join('') + (segs.length ? ',' + segs.join(',') : '') + ' 執行'
}

function pad(n: number): string {
  return n < 10 ? '0' + n : '' + n
}

function dayMatches(c: CronParsed, date: Date): boolean {
  const domOk = c.dom.values.includes(date.getDate())
  const dowOk = c.dow.values.includes(date.getDay())
  // cron 規則:dom 與 dow 都有限定時,任一符合即可;否則須各自符合。
  if (!c.dom.isAll && !c.dow.isAll) return domOk || dowOk
  return domOk && dowOk
}

/** 從 from(不含)之後,算出接下來 count 次執行時間。 */
export function nextRuns(expr: string, from: Date, count = 5): Date[] {
  const c = parseCron(expr)
  const out: Date[] = []
  const t = new Date(from.getTime())
  t.setSeconds(0, 0)
  t.setMinutes(t.getMinutes() + 1)
  let guard = 0
  while (out.length < count && guard < 500000) {
    guard++
    if (!c.month.values.includes(t.getMonth() + 1)) {
      t.setMonth(t.getMonth() + 1, 1)
      t.setHours(0, 0, 0, 0)
      continue
    }
    if (!dayMatches(c, t)) {
      t.setDate(t.getDate() + 1)
      t.setHours(0, 0, 0, 0)
      continue
    }
    if (!c.hour.values.includes(t.getHours())) {
      t.setHours(t.getHours() + 1, 0, 0, 0)
      continue
    }
    if (!c.minute.values.includes(t.getMinutes())) {
      t.setMinutes(t.getMinutes() + 1, 0, 0)
      continue
    }
    out.push(new Date(t.getTime()))
    t.setMinutes(t.getMinutes() + 1)
  }
  return out
}
