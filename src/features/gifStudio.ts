/*
  動圖工坊引擎 —— 把多張圖片(已在元件端用 Canvas 取成 RGBA 像素)編碼成
  動畫 GIF。全程在瀏覽器,不上傳。

  這裡只放「與環境無關」的純函式(像素進、GIF 位元組出 / 尺寸計算),
  方便用 Node 跑回歸測試;Canvas/解碼圖片那段留在 .vue 元件。

  編碼用 gifenc(純 JS、無 WASM、無 worker):每張影格各自量化出最佳調色盤
  (畫質較佳),首張影格寫入 repeat 旗標控制循環次數。
*/
import { GIFEncoder, quantize, applyPalette } from 'gifenc'

export interface GifFrame {
  /** RGBA 像素,長度需等於 width*height*4 */
  rgba: Uint8ClampedArray | Uint8Array
  /** 此影格停留毫秒數 */
  delayMs: number
}

export interface EncodeOptions {
  width: number
  height: number
  /** 調色盤顏色數 2..256,越多越細緻但檔越大,預設 256 */
  maxColors?: number
  /** 循環次數:0 = 無限循環(預設),n>0 = 播 n 次後停 */
  loop?: number
}

const FORMAT = 'rgba4444' as const

/** 把 RGBA 影格陣列編碼成 GIF 位元組。每張各自量化調色盤。 */
export function encodeGif(frames: GifFrame[], opts: EncodeOptions): Uint8Array {
  const { width, height } = opts
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error('GIF 尺寸不正確')
  }
  if (frames.length === 0) throw new Error('至少需要一張影格')

  const maxColors = clampInt(opts.maxColors ?? 256, 2, 256)
  const loop = Math.max(0, Math.floor(opts.loop ?? 0))
  const expected = width * height * 4

  const enc = GIFEncoder()
  frames.forEach((frame, i) => {
    if (frame.rgba.length !== expected) {
      throw new Error(`第 ${i + 1} 張影格像素數不符(預期 ${expected},實得 ${frame.rgba.length})`)
    }
    const data = frame.rgba instanceof Uint8Array ? frame.rgba : new Uint8Array(frame.rgba.buffer)
    const palette = quantize(data, maxColors, { format: FORMAT })
    const index = applyPalette(data, palette, FORMAT)
    // gifenc 的 delay 單位是毫秒;repeat 只需設在第一張(0=無限)
    enc.writeFrame(index, width, height, {
      palette,
      delay: Math.max(0, Math.round(frame.delayMs)),
      repeat: i === 0 ? (loop === 0 ? 0 : loop) : undefined,
    })
  })
  enc.finish()
  return enc.bytes()
}

/**
 * 依目標寬度與「最長邊上限」算出每張影格統一輸出的畫布尺寸。
 * GIF 各影格必須同尺寸,故以第一張的長寬比為基準。
 */
export function planCanvasSize(
  firstW: number,
  firstH: number,
  targetWidth: number,
  maxSide = 1000,
): { width: number; height: number } {
  if (firstW < 1 || firstH < 1) throw new Error('來源尺寸不正確')
  let w = Math.round(targetWidth)
  let h = Math.round((firstH / firstW) * w)
  const longest = Math.max(w, h)
  if (longest > maxSide) {
    const s = maxSide / longest
    w = Math.max(1, Math.round(w * s))
    h = Math.max(1, Math.round(h * s))
  }
  return { width: Math.max(1, w), height: Math.max(1, h) }
}

/** 由 FPS 換算每張影格毫秒數(GIF 實際以 1/100 秒為單位,故四捨五入到 10ms)。 */
export function fpsToDelay(fps: number): number {
  const f = clampNum(fps, 1, 50)
  return Math.max(20, Math.round(1000 / f / 10) * 10)
}

export interface FramePlan {
  /** 要從影片擷取的時間點(秒),含起點與終點、平均分布 */
  times: number[]
  /** 每張影格停留毫秒數(已對齊到 10ms);總長 ≈ 所選片段長度 */
  delayMs: number
}

/**
 * 規劃「影片轉 GIF」要擷取哪些時間點。
 * 以 fps 當「目標流暢度」算出張數,但受 maxFrames 上限保護(避免做出超大檔/當機);
 * 不論是否觸頂,影格都平均分布在 [start, end] 全段(含頭尾),
 * 並把每張停留時間設成讓 GIF 總長 ≈ 所選片段長度,播放速度才自然。
 */
export function planFrameTimes(
  startSec: number,
  endSec: number,
  fps: number,
  maxFrames = 150,
): FramePlan {
  if (![startSec, endSec, fps].every((n) => Number.isFinite(n))) {
    throw new Error('時間或速度數值不正確')
  }
  if (startSec < 0) startSec = 0
  const span = endSec - startSec
  if (span <= 0) throw new Error('結束時間需大於開始時間')

  const f = clampNum(fps, 1, 50)
  const cap = Math.max(2, Math.floor(maxFrames))
  const desired = Math.round(span * f)
  const count = clampInt(desired, 2, cap)

  const times: number[] = []
  for (let i = 0; i < count; i++) {
    times.push(startSec + (span * i) / (count - 1))
  }
  // 每張停留 = 總長 / 張數,對齊到 10ms、至少 20ms(GIF 單位為 1/100 秒)
  const delayMs = Math.max(20, Math.round((span * 1000) / count / 10) * 10)
  return { times, delayMs }
}

function clampInt(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}
function clampNum(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}
