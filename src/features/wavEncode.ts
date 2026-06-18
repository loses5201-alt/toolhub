/*
  音訊裁剪引擎 —— 純函式、無 DOM,可在 Node 測試。
  瀏覽器端用 AudioContext.decodeAudioData 把任意音檔解成 Float32 取樣(每聲道一條),
  本檔負責「裁切時間區間 + 淡入淡出 + 編成標準 16-bit PCM WAV 位元組」。
  WAV 是無損、所有裝置/播放器都吃的格式,當作輸出最保險(不需任何第三方編碼器)。
*/

/** 把秒數換成取樣索引,四捨五入並夾在 [0, total] 範圍內。 */
export function timeToSample(seconds: number, sampleRate: number, total: number): number {
  if (!isFinite(seconds) || seconds < 0) seconds = 0
  const s = Math.round(seconds * sampleRate)
  return Math.max(0, Math.min(total, s))
}

/** 從各聲道擷取 [start, end) 的取樣,回傳新的 Float32Array 陣列(不改動輸入)。 */
export function sliceChannels(channels: Float32Array[], start: number, end: number): Float32Array[] {
  const a = Math.max(0, Math.min(start, end))
  const b = Math.max(a, end)
  return channels.map((ch) => ch.slice(Math.min(a, ch.length), Math.min(b, ch.length)))
}

/**
 * 線性淡入 / 淡出,直接修改傳入的取樣(就地)。
 * fadeIn / fadeOut 為取樣數;會自動夾住,避免重疊或超過長度。
 */
export function applyFade(channels: Float32Array[], fadeIn: number, fadeOut: number): void {
  const len = channels[0]?.length ?? 0
  let fi = Math.max(0, Math.floor(fadeIn))
  let fo = Math.max(0, Math.floor(fadeOut))
  // 淡入 + 淡出不可超過總長度
  if (fi + fo > len) {
    const scale = len / (fi + fo)
    fi = Math.floor(fi * scale)
    fo = Math.floor(fo * scale)
  }
  for (const ch of channels) {
    for (let i = 0; i < fi && i < ch.length; i++) ch[i] *= i / fi
    for (let i = 0; i < fo && i < ch.length; i++) {
      const idx = ch.length - 1 - i
      if (idx >= 0) ch[idx] *= i / fo
    }
  }
}

function clampSample(x: number): number {
  if (x > 1) x = 1
  else if (x < -1) x = -1
  return x < 0 ? x * 0x8000 : x * 0x7fff
}

/**
 * 把多聲道 Float32 取樣編成 16-bit PCM WAV(交錯排列),回傳 Uint8Array。
 * 各聲道長度若不一,以最短者為準(理論上應等長)。
 */
export function encodeWav(channels: Float32Array[], sampleRate: number): Uint8Array {
  const numChannels = Math.max(1, channels.length)
  const frames = channels.length ? Math.min(...channels.map((c) => c.length)) : 0
  const dataSize = frames * numChannels * 2
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM fmt chunk 大小
  view.setUint16(20, 1, true) // audioFormat = 1 (PCM)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * 2, true) // byteRate
  view.setUint16(32, numChannels * 2, true) // blockAlign
  view.setUint16(34, 16, true) // bitsPerSample
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)

  let off = 44
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const ch = channels[c] || channels[0]
      view.setInt16(off, Math.round(clampSample(ch[i])), true)
      off += 2
    }
  }
  return new Uint8Array(buffer)
}

/** 估算編成 WAV 後的位元組大小(用於 UI 預估檔案大小)。 */
export function wavByteSize(frames: number, numChannels: number): number {
  return 44 + frames * numChannels * 2
}
