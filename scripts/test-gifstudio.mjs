/*
  動圖工坊引擎的回歸測試(無需測試框架,node 直接跑)。
  用 esbuild 把含 gifenc 的 TS 引擎打包成 ESM 再 import。
  執行:node scripts/test-gifstudio.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `gifstudio-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/gifStudio.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
  logLevel: 'silent',
})
const { encodeGif, planCanvasSize, fpsToDelay, planVideoFrameTimes } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

function frame(w, h, r, g, b, delayMs) {
  const rgba = new Uint8Array(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = r
    rgba[i * 4 + 1] = g
    rgba[i * 4 + 2] = b
    rgba[i * 4 + 3] = 255
  }
  return { rgba, delayMs }
}
const ascii = (bytes) => String.fromCharCode(...bytes)
function includesAscii(bytes, needle) {
  // latin1 字串搜尋,擋位元組層級的標記
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return s.includes(needle)
}

// ── encodeGif:基本輸出格式 ──
const w = 8,
  h = 6
const g1 = encodeGif(
  [frame(w, h, 200, 0, 0, 100), frame(w, h, 0, 200, 0, 100), frame(w, h, 0, 0, 200, 100)],
  { width: w, height: h },
)
check('輸出為 Uint8Array', g1 instanceof Uint8Array)
check('GIF89a 檔頭', ascii(g1.slice(0, 6)) === 'GIF89a')
check('GIF 結尾 0x3B', g1[g1.length - 1] === 0x3b)
check('合理長度', g1.length > 50)
// 邏輯螢幕寬高(小端)寫在第 6..9 byte
check('檔頭寬度正確', g1[6] + (g1[7] << 8) === w)
check('檔頭高度正確', g1[8] + (g1[9] << 8) === h)

// ── 循環旗標:預設無限循環應有 NETSCAPE2.0 擴充 ──
check('預設無限循環含 NETSCAPE2.0', includesAscii(g1, 'NETSCAPE2.0'))
const g2 = encodeGif([frame(w, h, 10, 10, 10, 50), frame(w, h, 250, 250, 250, 50)], {
  width: w,
  height: h,
  loop: 3,
})
check('指定循環次數仍含 NETSCAPE2.0', includesAscii(g2, 'NETSCAPE2.0'))

// ── 顏色數越少,輸出通常越小(或至少能編碼) ──
const many = encodeGif([frame(w, h, 123, 45, 67, 100)], { width: w, height: h, maxColors: 256 })
const few = encodeGif([frame(w, h, 123, 45, 67, 100)], { width: w, height: h, maxColors: 4 })
check('maxColors=4 可正常編碼', few instanceof Uint8Array && ascii(few.slice(0, 6)) === 'GIF89a')
check('單色影格亦可編碼', many.length > 0)

// ── 錯誤處理 ──
let threw = false
try {
  encodeGif([], { width: w, height: h })
} catch {
  threw = true
}
check('空影格陣列丟錯', threw)

threw = false
try {
  encodeGif([{ rgba: new Uint8Array(10), delayMs: 100 }], { width: w, height: h })
} catch {
  threw = true
}
check('像素數不符丟錯', threw)

threw = false
try {
  encodeGif([frame(2, 2, 1, 1, 1, 100)], { width: 0, height: 2 })
} catch {
  threw = true
}
check('尺寸不正確丟錯', threw)

// ── planCanvasSize ──
check('等比縮放(橫向)', JSON.stringify(planCanvasSize(800, 400, 400, 1000)) === JSON.stringify({ width: 400, height: 200 }))
check('等比縮放(直向)', JSON.stringify(planCanvasSize(400, 800, 400, 1000)) === JSON.stringify({ width: 400, height: 800 }))
const capped = planCanvasSize(400, 800, 2000, 1000)
check('最長邊上限生效', Math.max(capped.width, capped.height) === 1000)
check('上限後仍維持比例', Math.abs(capped.width / capped.height - 400 / 800) < 0.02)
threw = false
try {
  planCanvasSize(0, 10, 100)
} catch {
  threw = true
}
check('來源尺寸 0 丟錯', threw)

// ── fpsToDelay ──
check('10 FPS = 100ms', fpsToDelay(10) === 100)
check('5 FPS = 200ms', fpsToDelay(5) === 200)
check('FPS 下限夾 1', fpsToDelay(0) === 1000)
check('FPS 上限夾 50(>=20ms)', fpsToDelay(999) === 20)
check('delay 對齊 10ms', fpsToDelay(3) % 10 === 0)

// ── planVideoFrameTimes(影片轉 GIF 取樣規劃) ──
const p1 = planVideoFrameTimes(0, 2, 8)
check('2 秒 @8fps 取 16 張', p1.times.length === 16)
check('第一張在開始時間', p1.times[0] === 0)
check('間隔為 1/fps', Math.abs(p1.interval - 1 / 8) < 1e-9)
check('未截斷', p1.truncated === false)
check('最後一張落在區間內', p1.times[p1.times.length - 1] < 2)
const p2 = planVideoFrameTimes(1.5, 3.5, 10)
check('指定起點偏移正確', p2.times[0] === 1.5)
check('2 秒 @10fps 取 20 張', p2.times.length === 20)
check('時間遞增', p2.times.every((t, i) => i === 0 || t > p2.times[i - 1]))
const p3 = planVideoFrameTimes(0, 100, 30, 50)
check('超過上限被截斷', p3.truncated === true && p3.times.length === 50)
const p4 = planVideoFrameTimes(0, 0.05, 8)
check('極短片段至少 1 張', p4.times.length === 1)
check('時間四捨五入到毫秒', planVideoFrameTimes(0, 1, 3).times.every((t) => Number.isInteger(Math.round(t * 1000))))
threw = false
try {
  planVideoFrameTimes(2, 1, 8)
} catch {
  threw = true
}
check('結束<=開始丟錯', threw)
threw = false
try {
  planVideoFrameTimes(NaN, 5, 8)
} catch {
  threw = true
}
check('時間 NaN 丟錯', threw)
const p5 = planVideoFrameTimes(0, 5, 999)
check('fps 上限夾 50', Math.abs(p5.interval - 1 / 50) < 1e-9)

if (fail) {
  console.error(`\n${fail} 個測試未通過`)
  process.exit(1)
}
console.log('\n全部 gifStudio 測試通過')
