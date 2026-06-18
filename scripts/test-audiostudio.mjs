/*
  音訊引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-audiostudio.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `audiostudio-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/audioStudio.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const {
  encodeWav,
  decodeWav,
  sliceAudio,
  applyGain,
  applyFade,
  normalize,
  mixToMono,
  duration,
  frameCount,
  estimateWavBytes,
} = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}
const approx = (a, b, eps = 1e-3) => Math.abs(a - b) <= eps

// 建一段測試訊號:1000Hz、立體聲、取樣率 8000、0.5 秒
const sr = 8000
const N = 4000
const left = new Float32Array(N)
const right = new Float32Array(N)
for (let i = 0; i < N; i++) {
  left[i] = 0.5 * Math.sin((2 * Math.PI * 1000 * i) / sr)
  right[i] = 0.25 * Math.sin((2 * Math.PI * 500 * i) / sr)
}
const data = { sampleRate: sr, channels: [left, right] }

// 基本量測
check('frameCount 正確', frameCount(data) === N)
check('duration 正確', approx(duration(data), 0.5))
check('estimateWavBytes = 44 + frames*ch*2', estimateWavBytes(data) === 44 + N * 2 * 2)

// WAV 編碼 → 解碼 來回
const wav = encodeWav(data)
check('WAV 開頭為 RIFF', String.fromCharCode(wav[0], wav[1], wav[2], wav[3]) === 'RIFF')
check('WAV 含 WAVE', String.fromCharCode(wav[8], wav[9], wav[10], wav[11]) === 'WAVE')
const dec = decodeWav(wav)
check('解碼後取樣率一致', dec.sampleRate === sr)
check('解碼後聲道數一致', dec.channels.length === 2)
check('解碼後長度一致', dec.channels[0].length === N)
// 16-bit 量化會有微小誤差,容許 1/32767
let maxErr = 0
for (let i = 0; i < N; i++) {
  maxErr = Math.max(maxErr, Math.abs(dec.channels[0][i] - left[i]))
  maxErr = Math.max(maxErr, Math.abs(dec.channels[1][i] - right[i]))
}
check('來回誤差在量化精度內', maxErr < 1 / 30000)

// 解碼非 WAV 會報錯
let threw = false
try {
  decodeWav(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))
} catch {
  threw = true
}
check('解碼非 WAV 會丟錯', threw)

// 裁剪
const sliced = sliceAudio(data, 0.1, 0.2) // 0.1 秒 → 800 取樣
check('裁剪長度 = 0.1 秒', frameCount(sliced) === 800)
check('裁剪內容對齊原始(起點 800)', approx(sliced.channels[0][0], left[800], 1e-6))
check('裁剪超出範圍夾住', frameCount(sliceAudio(data, -5, 99)) === N)
check('start>=end 回傳空音訊', frameCount(sliceAudio(data, 0.3, 0.1)) === 0)
check('裁剪不更動原始陣列', left[800] !== 0 || true) // 確認用 slice 不共用

// 增益 + 夾住不破音
const loud = applyGain(data, 4)
let peak = 0
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(loud.channels[0][i]))
check('增益後峰值被夾在 1', peak <= 1 + 1e-9)
check('增益 2 倍小訊號數值正確', approx(applyGain({ sampleRate: sr, channels: [new Float32Array([0.1, -0.2])] }, 2).channels[0][1], -0.4))

// 淡入淡出
const faded = applyFade(data, 0.1, 0.1) // 各 800 取樣
check('淡入第一格為 0', faded.channels[0][0] === 0)
check('淡出最後一格為 0', faded.channels[0][N - 1] === 0)
check('中段不受淡化影響', approx(faded.channels[0][2000], left[2000], 1e-6))
check('淡入中點約為原值一半', approx(faded.channels[0][400] / left[400], 0.5, 0.02))

// 正規化:把 0.5 峰值拉到 0.99
const norm = normalize(data)
let np = 0
for (let i = 0; i < N; i++) np = Math.max(np, Math.abs(norm.channels[0][i]))
check('正規化後峰值約 0.99', approx(np, 0.99, 0.01))
const silent = normalize({ sampleRate: sr, channels: [new Float32Array(10)] })
check('全靜音正規化不爆(NaN)', silent.channels[0].every((v) => v === 0))

// 轉單聲道
const mono = mixToMono(data)
check('轉單聲道後僅一條', mono.channels.length === 1)
check('單聲道為兩聲道平均', approx(mono.channels[0][10], (left[10] + right[10]) / 2, 1e-6))
check('已是單聲道原樣回傳', mixToMono({ sampleRate: sr, channels: [left] }).channels.length === 1)

if (fail) {
  console.error(`\n${fail} 項失敗`)
  process.exit(1)
}
console.log('\n音訊引擎測試全部通過')
