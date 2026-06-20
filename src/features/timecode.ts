/*
  SMPTE 影格 / 時間碼換算引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  在「影格數(frame count)」與「時間碼 HH:MM:SS:FF」之間互轉,
  支援 drop-frame(29.97 / 59.94)與 non-drop;另算出實際時間長度。
  drop-frame 採經典 SMPTE 演算法(每分鐘開頭丟棄影格號,但每第 10 分鐘不丟)。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

export interface FpsOption {
  id: string
  label: string
  actual: number // 實際幀率(用來算真實時間長度)
  nominal: number // 時間碼用的整數幀率
  dropAllowed: boolean
}

export const FPS_OPTIONS: FpsOption[] = [
  { id: '23.976', label: '23.976(24000/1001)', actual: 24000 / 1001, nominal: 24, dropAllowed: false },
  { id: '24', label: '24', actual: 24, nominal: 24, dropAllowed: false },
  { id: '25', label: '25(PAL)', actual: 25, nominal: 25, dropAllowed: false },
  { id: '29.97', label: '29.97(30000/1001)', actual: 30000 / 1001, nominal: 30, dropAllowed: true },
  { id: '30', label: '30', actual: 30, nominal: 30, dropAllowed: false },
  { id: '50', label: '50', actual: 50, nominal: 50, dropAllowed: false },
  { id: '59.94', label: '59.94(60000/1001)', actual: 60000 / 1001, nominal: 60, dropAllowed: true },
  { id: '60', label: '60', actual: 60, nominal: 60, dropAllowed: false },
]

export function fpsById(id: string): FpsOption | undefined {
  return FPS_OPTIONS.find((f) => f.id === id)
}

function pad(n: number, width = 2): string {
  return String(Math.abs(n)).padStart(width, '0')
}

/** 每分鐘丟棄的影格數(29.97→2、59.94→4)。 */
export function dropFramesPerMinute(nominal: number): number {
  return Math.round(nominal * 0.066666)
}

/**
 * 影格數 → 時間碼字串。drop-frame 用「;」分隔最後一段,non-drop 用「:」。
 * 採經典 SMPTE drop-frame 演算法。
 */
export function framesToTimecode(frameNumber: number, nominal: number, dropFrame: boolean): string {
  let fn = Math.trunc(frameNumber)
  const neg = fn < 0
  fn = Math.abs(fn)

  if (dropFrame) {
    const d = dropFramesPerMinute(nominal)
    const framesPer10Min = nominal * 60 * 10 - 9 * d
    const framesPerMin = nominal * 60 - d
    const tenMins = Math.floor(fn / framesPer10Min)
    const rem = fn % framesPer10Min
    if (rem > d) {
      fn += d * 9 * tenMins + d * Math.floor((rem - d) / framesPerMin)
    } else {
      fn += d * 9 * tenMins
    }
  }

  const ff = fn % nominal
  const ss = Math.floor(fn / nominal) % 60
  const mm = Math.floor(fn / (nominal * 60)) % 60
  const hh = Math.floor(fn / (nominal * 3600)) % 24
  const sep = dropFrame ? ';' : ':'
  return `${neg ? '-' : ''}${pad(hh)}:${pad(mm)}:${pad(ss)}${sep}${pad(ff)}`
}

export interface ParsedTimecode {
  hh: number
  mm: number
  ss: number
  ff: number
  dropFrame: boolean
}

/** 解析時間碼字串,容錯「:」「;」「.」「,」分隔與前導負號。 */
export function parseTimecode(tc: string): ParsedTimecode | null {
  const s = (tc || '').trim()
  if (!s) return null
  const neg = s.startsWith('-')
  const body = neg ? s.slice(1) : s
  // 是否 drop-frame:最後一個分隔是 ; 或 .
  const dropFrame = /[;.]/.test(body) && /[;.]\d+$/.test(body)
  const parts = body.split(/[:;.,]/)
  if (parts.length !== 4) return null
  if (parts.some((p) => p === '' || !/^\d+$/.test(p))) return null
  const [hh, mm, ss, ff] = parts.map(Number)
  if (mm > 59 || ss > 59) return null
  return { hh: neg ? -hh : hh, mm, ss, ff, dropFrame }
}

/** 時間碼 → 影格數。採經典 SMPTE 反算公式。 */
export function timecodeToFrames(
  p: ParsedTimecode,
  nominal: number,
  dropFrame: boolean,
): number {
  const neg = p.hh < 0
  const hh = Math.abs(p.hh)
  const base = ((hh * 60 + p.mm) * 60 + p.ss) * nominal + p.ff
  let frames = base
  if (dropFrame) {
    const d = dropFramesPerMinute(nominal)
    const totalMinutes = 60 * hh + p.mm
    frames = base - d * (totalMinutes - Math.floor(totalMinutes / 10))
  }
  return neg ? -frames : frames
}

/** 影格數 → 實際秒數(用實際幀率)。 */
export function framesToSeconds(frameNumber: number, actualFps: number): number {
  return frameNumber / actualFps
}

/** 把秒數格式化為 HH:MM:SS.mmm。 */
export function formatSeconds(totalSec: number): string {
  const neg = totalSec < 0
  let s = Math.abs(totalSec)
  const hh = Math.floor(s / 3600)
  s -= hh * 3600
  const mm = Math.floor(s / 60)
  s -= mm * 60
  const ss = Math.floor(s)
  const ms = Math.round((s - ss) * 1000)
  return `${neg ? '-' : ''}${pad(hh)}:${pad(mm)}:${pad(ss)}.${pad(ms, 3)}`
}
