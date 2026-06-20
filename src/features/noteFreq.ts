/*
  音名 / 頻率 / MIDI 換算引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  以十二平均律(equal temperament)為基礎,標準音 A4 預設 440 Hz(可調)。
   - noteToMidi / midiToNote:音名(C4、A#5、Bb3)↔ MIDI 音高編號(A4 = 69、C4 = 60)。
   - midiToFreq / freqToMidi:MIDI 編號 ↔ 頻率(Hz)。
   - noteToFreq / nearestNote:音名 → 頻率;任意頻率 → 最接近的音 + 偏差音分(cents),做調音器用。
  約定:中央 C = C4(MIDI 60),即「科學音高記號(SPN)」。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

export const A4_MIDI = 69
export const DEFAULT_A4 = 440

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

// 各音名字母對應的半音偏移(以 C 為 0)
const LETTER_SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** 解析音名(如 C4、A#5、Bb3、F#-1)成 MIDI 編號;無法解析回 null。 */
export function noteToMidi(name: string): number | null {
  const m = name.trim().match(/^([A-Ga-g])([#♯b♭xX]*)(-?\d+)$/)
  if (!m) return null
  const letter = m[1].toUpperCase()
  const accidentals = m[2]
  const octave = parseInt(m[3], 10)
  let semitone = LETTER_SEMITONE[letter]
  for (const ch of accidentals) {
    if (ch === '#' || ch === '♯') semitone += 1
    else if (ch === 'b' || ch === '♭') semitone -= 1
    else if (ch === 'x' || ch === 'X') semitone += 2 // 重升記號
  }
  // 科學音高記號:C4 = MIDI 60 → midi = (octave+1)*12 + semitone
  return (octave + 1) * 12 + semitone
}

/** MIDI 編號 → 音名(預設用升記號;flats=true 用降記號)。 */
export function midiToNote(midi: number, flats = false): string {
  const m = Math.round(midi)
  const names = flats ? FLAT_NAMES : SHARP_NAMES
  const octave = Math.floor(m / 12) - 1
  const idx = ((m % 12) + 12) % 12
  return names[idx] + octave
}

/** MIDI 編號 → 頻率(Hz)。 */
export function midiToFreq(midi: number, a4 = DEFAULT_A4): number {
  return a4 * Math.pow(2, (midi - A4_MIDI) / 12)
}

/** 頻率(Hz)→ MIDI 編號(可為小數,代表偏離整數半音)。 */
export function freqToMidi(freq: number, a4 = DEFAULT_A4): number {
  return A4_MIDI + 12 * Math.log2(freq / a4)
}

/** 音名 → 頻率(Hz);無法解析回 null。 */
export function noteToFreq(name: string, a4 = DEFAULT_A4): number | null {
  const midi = noteToMidi(name)
  return midi === null ? null : midiToFreq(midi, a4)
}

export interface NearestNote {
  note: string // 最接近的音名(含八度)
  midi: number // 對應整數 MIDI
  exactFreq: number // 該音的標準頻率
  cents: number // 輸入頻率相對該音的偏差音分(-50 ~ +50,正=偏高)
}

/** 任意頻率 → 最接近的音 + 偏差音分(調音器用)。 */
export function nearestNote(freq: number, a4 = DEFAULT_A4, flats = false): NearestNote | null {
  if (!(freq > 0)) return null
  const midiFloat = freqToMidi(freq, a4)
  const midi = Math.round(midiFloat)
  const exactFreq = midiToFreq(midi, a4)
  const cents = Math.round((midiFloat - midi) * 100)
  return { note: midiToNote(midi, flats), midi, exactFreq, cents }
}

export interface NoteRow {
  midi: number
  note: string
  freq: number
}

/** 產生一段音域的對照表(含 MIDI、音名、頻率)。 */
export function noteTable(
  fromMidi: number,
  toMidi: number,
  a4 = DEFAULT_A4,
  flats = false,
): NoteRow[] {
  const rows: NoteRow[] = []
  const lo = Math.min(fromMidi, toMidi)
  const hi = Math.max(fromMidi, toMidi)
  for (let m = lo; m <= hi; m++) {
    rows.push({ midi: m, note: midiToNote(m, flats), freq: midiToFreq(m, a4) })
  }
  return rows
}
