/*
  工時時數計算引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  打工 / 排班族常要自己加總一週、一個月上了幾小時(對帳薪資、報工時),手算容易錯,
  跨午夜的夜班(例如 22:00 上到隔天 06:00)更麻煩。本引擎處理每段班別的時數、
  扣除休息時間、跨午夜自動 +24 小時,並加總。全程在瀏覽器計算,不上傳。
*/

/** 解析 "HH:mm" 為當日分鐘數(0–1439);格式錯誤回 null。 */
export function parseTime(s: string): number | null {
  const m = s.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

export interface Shift {
  start: string // "HH:mm"
  end: string // "HH:mm"
  breakMin?: number // 休息分鐘(不計薪)
}

export interface ShiftResult {
  ok: boolean
  minutes: number // 實際工時分鐘(已扣休息)
  overnight: boolean // 是否跨午夜
  error?: string
}

/**
 * 計算單段班別工時(分鐘)。
 * - 結束 <= 開始 視為跨午夜,結束時間 +24 小時。
 * - 扣除休息分鐘;若休息 >= 工時,回 0(不為負)。
 */
export function shiftMinutes(shift: Shift): ShiftResult {
  const s = parseTime(shift.start)
  const e = parseTime(shift.end)
  if (s == null || e == null) {
    return { ok: false, minutes: 0, overnight: false, error: '時間格式需為 HH:mm' }
  }
  const brk = Math.max(0, Math.floor(shift.breakMin ?? 0))
  let span = e - s
  let overnight = false
  if (span <= 0) {
    span += 1440 // 跨午夜
    overnight = true
  }
  const minutes = Math.max(0, span - brk)
  return { ok: true, minutes, overnight }
}

/** 加總多段班別的有效工時(分鐘)。格式錯誤的班別以 0 計入。 */
export function totalMinutes(shifts: Shift[]): number {
  return shifts.reduce((sum, sh) => {
    const r = shiftMinutes(sh)
    return sum + (r.ok ? r.minutes : 0)
  }, 0)
}

/** 分鐘數格式化為 "Xh Ym"(0 分鐘顯示 0m)。 */
export function formatHM(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

/** 分鐘數轉小數小時(四捨五入到小數 2 位),供乘時薪。 */
export function toDecimalHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100
}

/** 依時薪估算「平日原始工資」(直接時數 × 時薪,不含加班加成)。 */
export function estimatePay(minutes: number, hourlyRate: number): number {
  if (!(hourlyRate > 0)) return 0
  return Math.round(toDecimalHours(minutes) * hourlyRate)
}
