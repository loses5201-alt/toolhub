/*
  BPM 節拍 / 延遲時間引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  音樂製作常用:給定速度(BPM),算出各種音符的時長(毫秒)與對應頻率(Hz),
  用來設定 delay 延遲、reverb 殘響、LFO 速率等,讓效果與節奏同步。
   - quarterMs:一拍(四分音符)的毫秒數 = 60000 / BPM。
   - noteMs:某音符(直音 / 附點 / 三連音)的毫秒數。
   - msToHz:毫秒 ↔ 頻率(Hz)。
   - bpmFromTaps:由連續打點的時間戳推算 BPM(tap tempo)。
   - buildTable:產生常見音符的對照表。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

export interface NoteValue {
  key: string
  name: string // 中文名
  beats: number // 相對四分音符(1 拍)的拍數
}

/** 常見音符(以四分音符 = 1 拍為基準)。 */
export const NOTE_VALUES: NoteValue[] = [
  { key: 'whole', name: '全音符', beats: 4 },
  { key: 'half', name: '二分音符', beats: 2 },
  { key: 'quarter', name: '四分音符', beats: 1 },
  { key: 'eighth', name: '八分音符', beats: 0.5 },
  { key: 'sixteenth', name: '十六分音符', beats: 0.25 },
  { key: 'thirtysecond', name: '三十二分音符', beats: 0.125 },
]

export type Modifier = 'straight' | 'dotted' | 'triplet'

const MOD_FACTOR: Record<Modifier, number> = {
  straight: 1,
  dotted: 1.5, // 附點 = 1.5 倍
  triplet: 2 / 3, // 三連音 = 2/3 倍
}

/** 一拍(四分音符)的毫秒數。 */
export function quarterMs(bpm: number): number {
  if (!(bpm > 0)) throw new Error('BPM 須大於 0')
  return 60000 / bpm
}

/** 某音符(可加附點 / 三連音)的毫秒數。 */
export function noteMs(bpm: number, beats: number, mod: Modifier = 'straight'): number {
  return quarterMs(bpm) * beats * MOD_FACTOR[mod]
}

/** 毫秒 → 頻率(Hz)。 */
export function msToHz(ms: number): number {
  if (!(ms > 0)) throw new Error('毫秒須大於 0')
  return 1000 / ms
}

/** 頻率(Hz)→ 毫秒。 */
export function hzToMs(hz: number): number {
  if (!(hz > 0)) throw new Error('Hz 須大於 0')
  return 1000 / hz
}

export interface TableRow {
  key: string
  name: string
  straightMs: number
  dottedMs: number
  tripletMs: number
  straightHz: number
}

/** 產生常見音符在指定 BPM 下的時長 / 頻率對照表。 */
export function buildTable(bpm: number, digits = 2): TableRow[] {
  const round = (x: number) => {
    const f = Math.pow(10, digits)
    return Math.round(x * f) / f
  }
  return NOTE_VALUES.map((nv) => {
    const straight = noteMs(bpm, nv.beats, 'straight')
    return {
      key: nv.key,
      name: nv.name,
      straightMs: round(straight),
      dottedMs: round(noteMs(bpm, nv.beats, 'dotted')),
      tripletMs: round(noteMs(bpm, nv.beats, 'triplet')),
      straightHz: round(msToHz(straight)),
    }
  })
}

/**
 * 由一連串打點的時間戳(毫秒,遞增)推算 BPM。
 * 取相鄰間隔的平均值換算;少於 2 點回 null。
 */
export function bpmFromTaps(timestamps: number[]): number | null {
  if (timestamps.length < 2) return null
  const intervals: number[] = []
  for (let i = 1; i < timestamps.length; i++) {
    const dt = timestamps[i] - timestamps[i - 1]
    if (dt > 0) intervals.push(dt)
  }
  if (!intervals.length) return null
  const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
  return 60000 / avg
}
