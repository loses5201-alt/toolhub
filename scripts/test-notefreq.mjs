/*
  音名 / 頻率 / MIDI 引擎回歸測試(node 直接跑)。
  執行:node scripts/test-notefreq.mjs
  oracle(十二平均律,A4 = 440 Hz、中央 C = C4 = MIDI 60):
   1) A4 = MIDI 69 = 440 Hz;C4 = 60 = 261.6256 Hz;A5 = 880、A3 = 220(八度加倍)。
   2) C#4 = Db4 = 61(等音);midiToNote 升/降記號;往返一致。
   3) freqToMidi(440)=69;1 半音 = 100 cents;nearestNote 偏差;noteTable 連續。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `notefreq-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/noteFreq.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const {
  noteToMidi,
  midiToNote,
  midiToFreq,
  freqToMidi,
  noteToFreq,
  nearestNote,
  noteTable,
} = await import('file://' + out)

let pass = 0
let fail = 0
function ok(name, cond) {
  if (cond) pass++
  else {
    fail++
    console.error('✗', name)
  }
}
const near = (a, b, eps = 1e-3) => Math.abs(a - b) <= eps

// 1) 基準
ok('A4 = MIDI 69', noteToMidi('A4') === 69)
ok('C4 = MIDI 60', noteToMidi('C4') === 60)
ok('C-1 = MIDI 0', noteToMidi('C-1') === 0)
ok('G9 = MIDI 127', noteToMidi('G9') === 127)
ok('A4 = 440 Hz', near(midiToFreq(69), 440))
ok('C4 ≈ 261.6256 Hz', near(midiToFreq(60), 261.6255653, 1e-4))
ok('A5 = 880 Hz(八度加倍)', near(midiToFreq(noteToMidi('A5')), 880))
ok('A3 = 220 Hz(八度減半)', near(midiToFreq(noteToMidi('A3')), 220))
ok('noteToFreq A4 = 440', near(noteToFreq('A4'), 440))

// 2) 等音 / 記號 / 往返
ok('C#4 = Db4 = 61', noteToMidi('C#4') === 61 && noteToMidi('Db4') === 61)
ok('Bb3 = A#3', noteToMidi('Bb3') === noteToMidi('A#3'))
ok('全形升降號可解析', noteToMidi('F♯4') === noteToMidi('F#4') && noteToMidi('E♭4') === noteToMidi('Eb4'))
ok('重升 Cx4 = D4', noteToMidi('Cx4') === noteToMidi('D4'))
ok('midiToNote 61 升記號 = C#4', midiToNote(61, false) === 'C#4')
ok('midiToNote 61 降記號 = Db4', midiToNote(61, true) === 'Db4')
ok('midiToNote 69 = A4', midiToNote(69) === 'A4')
ok('midiToNote 0 = C-1', midiToNote(0) === 'C-1')
// 往返:0–127 每個 MIDI 經音名再解析回來一致
let roundOk = true
for (let m = 0; m <= 127; m++) {
  if (noteToMidi(midiToNote(m, false)) !== m) roundOk = false
  if (noteToMidi(midiToNote(m, true)) !== m) roundOk = false
}
ok('MIDI 0–127 音名往返一致', roundOk)

// 解析失敗
ok('亂字串回 null', noteToMidi('Hello') === null)
ok('缺八度回 null', noteToMidi('C#') === null)

// 3) 頻率反查 / cents
ok('freqToMidi(440) = 69', near(freqToMidi(440), 69))
ok('八度 = 12 半音', near(freqToMidi(880) - freqToMidi(440), 12))
ok('freqToMidi 兩倍頻率差 12', near(freqToMidi(523.2511) - freqToMidi(261.6256), 12, 1e-3))

const n440 = nearestNote(440)
ok('nearestNote(440) = A4, 0 cents', n440.note === 'A4' && n440.cents === 0 && near(n440.exactFreq, 440))
const n445 = nearestNote(445)
ok('nearestNote(445) ≈ A4 +19~20 cents', n445.note === 'A4' && n445.cents >= 19 && n445.cents <= 20)
// 半音上方一半(50 cents)應落在邊界
const halfUp = midiToFreq(69 + 0.5)
ok('+50 cents 仍歸 A4 或 A#4 邊界', ['A4', 'A#4'].includes(nearestNote(halfUp).note))
ok('nearestNote 非正頻率回 null', nearestNote(0) === null && nearestNote(-10) === null)

// 自訂 A4 = 442
ok('A4=442 時 A4 = 442 Hz', near(midiToFreq(69, 442), 442))

// noteTable
const tbl = noteTable(60, 72)
ok('noteTable 連續 13 列', tbl.length === 13 && tbl[0].note === 'C4' && tbl[12].note === 'C5')
ok('noteTable C5 = 2×C4', near(tbl[12].freq, tbl[0].freq * 2, 1e-6))

console.log(`\n音名/頻率:${pass} 通過,${fail} 失敗`)
if (fail) process.exit(1)
