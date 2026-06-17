/*
  日期計算引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  日常用途:算兩個日期相差幾天、從某天起算 N 天後是哪天(可只算工作日)、
  兩日期之間有幾個上班日 —— 例如契約/退貨鑑賞期/繳費/活動倒數的到期日推算。
  以 UTC 為基準避免日光節約時間誤差。本工具不上傳任何資料。
*/

export interface YMD {
  y: number
  m: number // 1-12
  d: number
}

/** 解析 YYYY-MM-DD,並驗證是真實存在的日期(擋 2 月 30 日之類)。 */
export function parseDate(str: string): YMD | null {
  const m = str.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const dt = new Date(Date.UTC(y, mo - 1, d))
  // 回推驗證(Date 會把 2/30 進位成 3/2,比對可抓出)
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null
  return { y, m: mo, d }
}

function toUTC(ymd: YMD): Date {
  return new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d))
}

function fromUTC(dt: Date): YMD {
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() }
}

const MS_PER_DAY = 86400000

/** 格式化為 YYYY-MM-DD。 */
export function formatYMD(ymd: YMD): string {
  return `${ymd.y}-${String(ymd.m).padStart(2, '0')}-${String(ymd.d).padStart(2, '0')}`
}

/** 星期幾(0=日 … 6=六)。 */
export function weekday(ymd: YMD): number {
  return toUTC(ymd).getUTCDay()
}

const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六']
export function weekdayName(ymd: YMD): string {
  return '星期' + WEEKDAY_NAMES[weekday(ymd)]
}

export function isWeekend(ymd: YMD): boolean {
  const w = weekday(ymd)
  return w === 0 || w === 6
}

/**
 * 工作日選項:
 * - holidays:額外視為「放假」的日期(YYYY-MM-DD),例如國定假日、公司行事曆休假日,
 *   即使落在平日也不算工作日。
 * - workdays:強制視為「上班」的日期(YYYY-MM-DD),例如颱風補班、補行上班日,
 *   即使落在週末也算工作日(優先於 holidays 與週末)。
 */
export interface BusinessOpts {
  holidays?: Set<string>
  workdays?: Set<string>
}

/** 從一段文字(每行或逗號分隔)抽出所有 YYYY-MM-DD 合法日期,回傳 Set。 */
export function parseDateList(text: string): Set<string> {
  const set = new Set<string>()
  if (!text) return set
  for (const token of text.split(/[\s,、，;；]+/)) {
    const ymd = parseDate(token)
    if (ymd) set.add(formatYMD(ymd))
  }
  return set
}

/**
 * 判斷某天是否為工作日。優先序:補班日 > 假日清單 > 週末。
 * 沒有提供 opts 時,等同「平日(非週六日)即工作日」。
 */
export function isWorkday(ymd: YMD, opts: BusinessOpts = {}): boolean {
  const key = formatYMD(ymd)
  if (opts.workdays?.has(key)) return true
  if (opts.holidays?.has(key)) return false
  return !isWeekend(ymd)
}

/** b 減 a 的天數(b 在後為正)。 */
export function daysBetween(a: YMD, b: YMD): number {
  return Math.round((toUTC(b).getTime() - toUTC(a).getTime()) / MS_PER_DAY)
}

/** 從 base 加上 n 天(可為負)。 */
export function addDays(base: YMD, n: number): YMD {
  const dt = toUTC(base)
  dt.setUTCDate(dt.getUTCDate() + Math.trunc(n))
  return fromUTC(dt)
}

/**
 * 從 base 起算 n 個工作日(預設跳過週六、週日;可用 opts 加扣假日/加計補班日)。
 * n 為正往後、為負往前;base 當天不計入,從隔(工作)日開始數。
 */
export function addBusinessDays(base: YMD, n: number, opts: BusinessOpts = {}): YMD {
  let count = Math.trunc(n)
  const step = count >= 0 ? 1 : -1
  let cur = base
  count = Math.abs(count)
  while (count > 0) {
    cur = addDays(cur, step)
    if (isWorkday(cur, opts)) count--
  }
  return cur
}

/**
 * 計算 a 到 b(含起訖兩端)之間的工作日數(預設排除週末;可用 opts 加扣假日/加計補班日)。
 * 自動處理 a、b 先後順序,回傳非負整數。
 */
export function businessDaysBetween(a: YMD, b: YMD, opts: BusinessOpts = {}): number {
  let start = a
  let end = b
  if (daysBetween(start, end) < 0) [start, end] = [end, start]
  let count = 0
  let cur = start
  const total = daysBetween(start, end)
  for (let i = 0; i <= total; i++) {
    if (isWorkday(cur, opts)) count++
    cur = addDays(cur, 1)
  }
  return count
}
