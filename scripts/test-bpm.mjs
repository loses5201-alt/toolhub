/*
  BPM 節拍 / 延遲時間引擎回歸測試(node 直接跑)。
  執行:node scripts/test-bpm.mjs
  oracle(基本節拍數學):
   1) BPM 120:四分音符 = 500ms、八分 = 250、二分 = 1000、全音符 = 2000、十六分 = 125。
   2) 附點 = ×1.5(附點八分 = 375)、三連音 = ×2/3(四分三連 = 333.33)。
   3) msToHz/hzToMs 互逆(四分音符@120 = 2Hz);bpmFromTaps 反推。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `bpm-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/bpm.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { quarterMs, noteMs, msToHz, hzToMs, buildTable, bpmFromTaps, NOTE_VALUES } = await import(
  'file://' + out
)

let pass = 0
let fail = 0
function ok(name, cond) {
  if (cond) pass++
  else {
    fail++
    console.error('✗', name)
  }
}
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps

// 1) BPM 120 基本值
ok('120 BPM 四分音符 = 500ms', quarterMs(120) === 500)
ok('60 BPM 四分音符 = 1000ms', quarterMs(60) === 1000)
ok('八分音符@120 = 250', noteMs(120, 0.5) === 250)
ok('二分音符@120 = 1000', noteMs(120, 2) === 1000)
ok('全音符@120 = 2000', noteMs(120, 4) === 2000)
ok('十六分音符@120 = 125', noteMs(120, 0.25) === 125)

// 2) 附點 / 三連音
ok('附點八分@120 = 375', noteMs(120, 0.5, 'dotted') === 375)
ok('附點四分@120 = 750', noteMs(120, 1, 'dotted') === 750)
ok('四分三連@120 ≈ 333.333', near(noteMs(120, 1, 'triplet'), 1000 / 3))
ok('八分三連@120 ≈ 166.667', near(noteMs(120, 0.5, 'triplet'), 500 / 3))

// 3) Hz 互轉
ok('四分音符@120 = 2Hz', msToHz(noteMs(120, 1)) === 2)
ok('msToHz/hzToMs 互逆', near(hzToMs(msToHz(333)), 333))
ok('500ms = 2Hz', msToHz(500) === 2)

// 錯誤
ok('BPM 0 丟例外', (() => { try { quarterMs(0); return false } catch { return true } })())
ok('msToHz 0 丟例外', (() => { try { msToHz(0); return false } catch { return true } })())

// buildTable
const t = buildTable(120)
ok('table 6 列', t.length === NOTE_VALUES.length)
const q = t.find((r) => r.key === 'quarter')
ok('table 四分音符直音 500 / 附點 750 / 三連 333.33 / 2Hz', q.straightMs === 500 && q.dottedMs === 750 && q.tripletMs === 333.33 && q.straightHz === 2)

// bpmFromTaps
ok('taps 每 500ms → 120 BPM', bpmFromTaps([0, 500, 1000, 1500]) === 120)
ok('taps 每 1000ms → 60 BPM', bpmFromTaps([1000, 2000, 3000]) === 60)
ok('taps 不足兩點 → null', bpmFromTaps([100]) === null)
ok('taps 空 → null', bpmFromTaps([]) === null)
ok('taps 平均間隔', near(bpmFromTaps([0, 400, 1000]), 60000 / 500)) // 間隔 400,600 平均 500 → 120

console.log(`\nBPM:${pass} 通過,${fail} 失敗`)
if (fail) process.exit(1)
