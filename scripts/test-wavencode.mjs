// 音訊裁剪引擎回歸測試:用 esbuild 打包 TS 後在 Node 跑(無 DOM 相依)。
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const entry = join(__dirname, '..', 'src', 'features', 'wavEncode.ts')

const out = await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  write: false,
  platform: 'node',
})
const mod = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
const { timeToSample, sliceChannels, applyFade, encodeWav, wavByteSize } = mod

let pass = 0
let fail = 0
function eq(name, got, want) {
  const a = JSON.stringify(got)
  const b = JSON.stringify(want)
  if (a === b) { pass++ } else { fail++; console.error(`✗ ${name}\n   got:  ${a}\n   want: ${b}`) }
}
function ok(name, cond) {
  if (cond) { pass++ } else { fail++; console.error(`✗ ${name}`) }
}

// ---- timeToSample ----
eq('timeToSample 1s@44100', timeToSample(1, 44100, 100000), 44100)
eq('timeToSample 四捨五入', timeToSample(0.50001, 100, 1000), 50)
eq('timeToSample 夾下界', timeToSample(-5, 44100, 1000), 0)
eq('timeToSample 夾上界', timeToSample(999, 44100, 1000), 1000)
eq('timeToSample NaN→0', timeToSample(NaN, 44100, 1000), 0)

// ---- sliceChannels ----
const ch = [Float32Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])]
eq('slice 2..5', Array.from(sliceChannels(ch, 2, 5)[0]), [2, 3, 4])
eq('slice start>end 互換為空', Array.from(sliceChannels(ch, 5, 2)[0]), [])
eq('slice 超過長度裁切', Array.from(sliceChannels(ch, 8, 100)[0]), [8, 9])
ok('slice 不改動輸入', ch[0][2] === 2 && ch[0].length === 10)
const stereo = [Float32Array.from([0, 1, 2, 3]), Float32Array.from([10, 11, 12, 13])]
const sl = sliceChannels(stereo, 1, 3)
eq('slice 立體聲 L', Array.from(sl[0]), [1, 2])
eq('slice 立體聲 R', Array.from(sl[1]), [11, 12])

// ---- applyFade ----
const fade = [Float32Array.from(new Array(10).fill(1))]
applyFade(fade, 4, 0)
ok('淡入第0樣=0', fade[0][0] === 0)
ok('淡入遞增', fade[0][1] > 0 && fade[0][1] < fade[0][2] && fade[0][3] < 1 && fade[0][4] === 1)
const fade2 = [Float32Array.from(new Array(10).fill(1))]
applyFade(fade2, 0, 4)
ok('淡出最後樣=0', fade2[0][9] === 0)
ok('淡出遞減', fade2[0][8] > 0 && fade2[0][8] < 1 && fade2[0][5] === 1)
const fade3 = [Float32Array.from(new Array(4).fill(1))]
applyFade(fade3, 4, 4) // 重疊 → 自動縮放,不應炸掉或產生 NaN
ok('淡入淡出重疊不產生 NaN', fade3[0].every((v) => !Number.isNaN(v) && v >= 0 && v <= 1))
const fadeStereo = [Float32Array.from(new Array(6).fill(1)), Float32Array.from(new Array(6).fill(1))]
applyFade(fadeStereo, 3, 0)
ok('淡入套用到所有聲道', fadeStereo[0][0] === 0 && fadeStereo[1][0] === 0)

// ---- encodeWav 標頭 ----
const wav = encodeWav([Float32Array.from([0, 0.5, -0.5, 1, -1])], 44100)
const dv = new DataView(wav.buffer, wav.byteOffset, wav.byteLength)
const str = (o, n) => String.fromCharCode(...wav.slice(o, o + n))
eq('WAV RIFF', str(0, 4), 'RIFF')
eq('WAV WAVE', str(8, 4), 'WAVE')
eq('WAV fmt ', str(12, 4), 'fmt ')
eq('WAV data', str(36, 4), 'data')
eq('fmt chunk 大小=16', dv.getUint32(16, true), 16)
eq('audioFormat=1(PCM)', dv.getUint16(20, true), 1)
eq('numChannels=1', dv.getUint16(22, true), 1)
eq('sampleRate=44100', dv.getUint32(24, true), 44100)
eq('byteRate', dv.getUint32(28, true), 44100 * 1 * 2)
eq('blockAlign', dv.getUint16(32, true), 2)
eq('bitsPerSample=16', dv.getUint16(34, true), 16)
eq('dataSize=5樣*2byte', dv.getUint32(40, true), 10)
eq('RIFF chunkSize=36+data', dv.getUint32(4, true), 36 + 10)
eq('總位元組=44+data', wav.byteLength, 44 + 10)

// 取樣值正確性(16-bit 量化)
eq('樣本0=0', dv.getInt16(44, true), 0)
eq('樣本0.5≈16383', dv.getInt16(46, true), Math.round(0.5 * 0x7fff))
eq('樣本-0.5≈-16384', dv.getInt16(48, true), Math.round(-0.5 * 0x8000))
eq('樣本1.0=32767(滿幅)', dv.getInt16(50, true), 0x7fff)
eq('樣本-1.0=-32768(滿幅)', dv.getInt16(52, true), -0x8000)

// 超出 [-1,1] 會被夾住,不溢位
const clip = encodeWav([Float32Array.from([2, -2])], 8000)
const cdv = new DataView(clip.buffer, clip.byteOffset, clip.byteLength)
eq('夾住 +2→32767', cdv.getInt16(44, true), 0x7fff)
eq('夾住 -2→-32768', cdv.getInt16(46, true), -0x8000)

// 立體聲交錯
const st = encodeWav([Float32Array.from([1, 0]), Float32Array.from([-1, 0])], 8000)
const sdv = new DataView(st.buffer, st.byteOffset, st.byteLength)
eq('立體聲 numChannels=2', sdv.getUint16(22, true), 2)
eq('交錯 frame0-L', sdv.getInt16(44, true), 0x7fff)
eq('交錯 frame0-R', sdv.getInt16(46, true), -0x8000)

// 不等長以最短為準
const uneven = encodeWav([Float32Array.from([0, 0, 0]), Float32Array.from([0])], 8000)
eq('不等長取最短:dataSize', new DataView(uneven.buffer, uneven.byteOffset).getUint32(40, true), 1 * 2 * 2)

// 空輸入
const empty = encodeWav([], 44100)
eq('空輸入仍有 44 byte 標頭', empty.byteLength, 44)

// ---- wavByteSize ----
eq('wavByteSize 單聲道', wavByteSize(100, 1), 44 + 200)
eq('wavByteSize 立體聲', wavByteSize(100, 2), 44 + 400)

console.log(`\nwavEncode: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
