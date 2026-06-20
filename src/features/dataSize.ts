/*
  資料大小與傳輸時間換算引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  解決三個常見混淆:
  1. KB / MB / GB(十進位 1000)vs KiB / MiB / GiB(二進位 1024)—— 硬碟標 1TB,系統卻顯示 931GB 的由來。
  2. bit(位元)vs byte(位元組)—— 網路頻寬 100 Mbps 其實只有約 12.5 MB/s,因為 1 byte = 8 bit。
  3. 下載/上傳一個檔案要多久 —— 檔案大小 ÷ 頻寬。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

/** 標準:十進位(SI,1000)或二進位(IEC,1024)。 */
export type SizeStandard = 'si' | 'iec'

const SI_UNITS = ['B', 'kB', 'MB', 'GB', 'TB', 'PB']
const IEC_UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']

/** 取得某單位對應的位元組數(冪次依標準)。 */
export function unitBytes(unit: string): number {
  const si = SI_UNITS.indexOf(unit)
  if (si >= 0) return 1000 ** si
  const iec = IEC_UNITS.indexOf(unit)
  if (iec >= 0) return 1024 ** iec
  if (unit === 'bit' || unit === 'b') return 1 / 8
  if (unit === 'byte') return 1
  return NaN
}

/** 把 value + unit 轉成位元組數。回傳 NaN 表示單位不合法。 */
export function toBytes(value: number, unit: string): number {
  const f = unitBytes(unit)
  if (!isFinite(f) || isNaN(f)) return NaN
  return value * f
}

export interface SizeBreakdown {
  bytes: number
  bits: number
  si: { unit: string; value: number }[]
  iec: { unit: string; value: number }[]
}

/** 把位元組數展開成 SI 與 IEC 各單位的數值。 */
export function breakdown(bytes: number): SizeBreakdown {
  return {
    bytes,
    bits: bytes * 8,
    si: SI_UNITS.map((unit, i) => ({ unit, value: bytes / 1000 ** i })),
    iec: IEC_UNITS.map((unit, i) => ({ unit, value: bytes / 1024 ** i })),
  }
}

/** 四捨五入到指定有效位數風格(去掉多餘的零)。 */
export function round(n: number, digits = 2): number {
  if (!isFinite(n)) return n
  const f = 10 ** digits
  return Math.round(n * f) / f
}

/**
 * 自動挑選最適合的單位(數值落在 1 ~ 進位 之間)。
 * standard='si' 用 1000 進位與 kB/MB…;'iec' 用 1024 與 KiB/MiB…
 */
export function humanize(bytes: number, standard: SizeStandard = 'si', digits = 2): string {
  if (bytes === 0) return '0 B'
  const units = standard === 'iec' ? IEC_UNITS : SI_UNITS
  const base = standard === 'iec' ? 1024 : 1000
  const neg = bytes < 0
  let n = Math.abs(bytes)
  let i = 0
  while (n >= base && i < units.length - 1) {
    n /= base
    i++
  }
  return `${neg ? '-' : ''}${round(n, digits)} ${units[i]}`
}

/**
 * 估算傳輸時間(秒)。
 * sizeBytes:檔案大小(位元組);speed:頻寬數值;speedUnit:頻寬單位。
 * 網路頻寬常以「每秒位元」計(Mbps = 每秒百萬位元),故換算時 1 byte = 8 bit。
 */
export function transferSeconds(
  sizeBytes: number,
  speed: number,
  speedUnit: 'bps' | 'Kbps' | 'Mbps' | 'Gbps' | 'KBps' | 'MBps' | 'GBps',
): number {
  if (sizeBytes < 0 || speed <= 0) return NaN
  const bitFactor: Record<string, number> = {
    bps: 1,
    Kbps: 1e3,
    Mbps: 1e6,
    Gbps: 1e9,
    KBps: 8e3,
    MBps: 8e6,
    GBps: 8e9,
  }
  const bitsPerSec = speed * bitFactor[speedUnit]
  if (!bitsPerSec) return NaN
  return (sizeBytes * 8) / bitsPerSec
}

/** 把秒數轉成白話時間(時/分/秒,毫秒以下用小數秒)。 */
export function humanDuration(seconds: number): string {
  if (!isFinite(seconds)) return '—'
  if (seconds < 1) return `${round(seconds * 1000, 0)} 毫秒`
  if (seconds < 60) return `${round(seconds, 1)} 秒`
  const parts: string[] = []
  let s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  s -= h * 3600
  const m = Math.floor(s / 60)
  s -= m * 60
  if (h) parts.push(`${h} 小時`)
  if (m) parts.push(`${m} 分`)
  if (s) parts.push(`${s} 秒`)
  return parts.join(' ') || '0 秒'
}

export { SI_UNITS, IEC_UNITS }
