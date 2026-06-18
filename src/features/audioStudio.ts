/*
  音訊處理引擎 —— 純函式、無 DOM、無相依,方便回歸測試。
  以 { sampleRate, channels: Float32Array[] } 為內部統一格式(每聲道一條 [-1,1] 的取樣陣列)。
  解碼(各種音檔→取樣)交給瀏覽器的 AudioContext.decodeAudioData,只有「編碼成 WAV」與
  裁剪/淡入淡出/增益/正規化/轉單聲道」這些純運算放在這裡,故可在 Node 直接測。
*/
export interface AudioData {
  sampleRate: number
  channels: Float32Array[] // 至少一條;每條長度相同
}

/** 取樣數(以第一聲道為準) */
export function frameCount(d: AudioData): number {
  return d.channels[0]?.length ?? 0
}

/** 總長度(秒) */
export function duration(d: AudioData): number {
  return d.sampleRate > 0 ? frameCount(d) / d.sampleRate : 0
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/**
 * 把音訊編碼成 16-bit PCM 的 WAV 位元組(little-endian、交錯排列)。
 * WAV 相容性最好、無失真,任何裝置/播放器都開得了。
 */
export function encodeWav(d: AudioData): Uint8Array {
  const numCh = Math.max(1, d.channels.length)
  const frames = frameCount(d)
  const bytesPerSample = 2
  const blockAlign = numCh * bytesPerSample
  const dataSize = frames * blockAlign
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true) // fmt chunk 大小
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, numCh, true)
  view.setUint32(24, d.sampleRate, true)
  view.setUint32(28, d.sampleRate * blockAlign, true) // byte rate
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 8 * bytesPerSample, true) // bits per sample
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < numCh; c++) {
      const sample = clamp(d.channels[c][i] ?? 0, -1, 1)
      // 負值用 0x8000、正值用 0x7FFF,使 -1/+1 對稱映射到整數範圍
      const int = sample < 0 ? sample * 0x8000 : sample * 0x7fff
      view.setInt16(offset, Math.round(int), true)
      offset += 2
    }
  }
  return new Uint8Array(buffer)
}

/**
 * 解析 16-bit PCM 的 WAV(供測試與「WAV 直接讀回」用)。
 * 會掃描 chunk 找 fmt 與 data,不假設固定位移。非 16-bit PCM 會丟出錯誤。
 */
export function decodeWav(bytes: Uint8Array): AudioData {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const readStr = (o: number, n: number) => {
    let s = ''
    for (let i = 0; i < n; i++) s += String.fromCharCode(view.getUint8(o + i))
    return s
  }
  if (readStr(0, 4) !== 'RIFF' || readStr(8, 4) !== 'WAVE') throw new Error('不是有效的 WAV 檔')

  let numCh = 0
  let sampleRate = 0
  let bits = 0
  let dataOffset = -1
  let dataSize = 0
  let p = 12
  while (p + 8 <= bytes.byteLength) {
    const id = readStr(p, 4)
    const size = view.getUint32(p + 4, true)
    const body = p + 8
    if (id === 'fmt ') {
      numCh = view.getUint16(body + 2, true)
      sampleRate = view.getUint32(body + 4, true)
      bits = view.getUint16(body + 14, true)
    } else if (id === 'data') {
      dataOffset = body
      dataSize = size
    }
    p = body + size + (size % 2) // chunk 以偶數位元組對齊
  }
  if (dataOffset < 0 || numCh < 1) throw new Error('WAV 缺少 data/fmt')
  if (bits !== 16) throw new Error('僅支援 16-bit PCM')

  const frames = Math.floor(dataSize / (numCh * 2))
  const channels: Float32Array[] = Array.from({ length: numCh }, () => new Float32Array(frames))
  let o = dataOffset
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = view.getInt16(o, true)
      channels[c][i] = s < 0 ? s / 0x8000 : s / 0x7fff
      o += 2
    }
  }
  return { sampleRate, channels }
}

/** 裁剪 [startSec, endSec) 區段;會夾到合法範圍,start>=end 回傳空音訊 */
export function sliceAudio(d: AudioData, startSec: number, endSec: number): AudioData {
  const total = frameCount(d)
  let s = Math.round(startSec * d.sampleRate)
  let e = Math.round(endSec * d.sampleRate)
  s = clamp(s, 0, total)
  e = clamp(e, 0, total)
  const len = Math.max(0, e - s)
  return {
    sampleRate: d.sampleRate,
    channels: d.channels.map((ch) => ch.slice(s, s + len)),
  }
}

/** 整體增益(倍數);輸出夾在 [-1,1] 不破音 */
export function applyGain(d: AudioData, gain: number): AudioData {
  return {
    sampleRate: d.sampleRate,
    channels: d.channels.map((ch) => {
      const out = new Float32Array(ch.length)
      for (let i = 0; i < ch.length; i++) out[i] = clamp(ch[i] * gain, -1, 1)
      return out
    }),
  }
}

/** 線性淡入 / 淡出(秒);兩段重疊時各自獨立套用 */
export function applyFade(d: AudioData, fadeInSec: number, fadeOutSec: number): AudioData {
  const total = frameCount(d)
  const inN = clamp(Math.round(Math.max(0, fadeInSec) * d.sampleRate), 0, total)
  const outN = clamp(Math.round(Math.max(0, fadeOutSec) * d.sampleRate), 0, total)
  return {
    sampleRate: d.sampleRate,
    channels: d.channels.map((ch) => {
      const out = new Float32Array(ch.length)
      for (let i = 0; i < ch.length; i++) {
        let g = 1
        if (inN > 0 && i < inN) g *= i / inN
        if (outN > 0 && i >= total - outN) g *= (total - 1 - i) / outN
        out[i] = ch[i] * clamp(g, 0, 1)
      }
      return out
    }),
  }
}

/** 峰值正規化:把最大振幅拉到 target(預設 0.99,留一點餘裕)。全靜音原樣回傳 */
export function normalize(d: AudioData, target = 0.99): AudioData {
  let peak = 0
  for (const ch of d.channels) {
    for (let i = 0; i < ch.length; i++) {
      const a = Math.abs(ch[i])
      if (a > peak) peak = a
    }
  }
  if (peak === 0) return { sampleRate: d.sampleRate, channels: d.channels.map((c) => c.slice()) }
  return applyGain(d, target / peak)
}

/** 多聲道平均混成單聲道(省一半檔案,語音/備忘很夠用) */
export function mixToMono(d: AudioData): AudioData {
  if (d.channels.length <= 1) {
    return { sampleRate: d.sampleRate, channels: d.channels.map((c) => c.slice()) }
  }
  const frames = frameCount(d)
  const mono = new Float32Array(frames)
  for (let i = 0; i < frames; i++) {
    let sum = 0
    for (const ch of d.channels) sum += ch[i]
    mono[i] = sum / d.channels.length
  }
  return { sampleRate: d.sampleRate, channels: [mono] }
}

/** 估算編碼後 WAV 的位元組大小(給 UI 預估檔案大小用) */
export function estimateWavBytes(d: AudioData): number {
  return 44 + frameCount(d) * Math.max(1, d.channels.length) * 2
}
