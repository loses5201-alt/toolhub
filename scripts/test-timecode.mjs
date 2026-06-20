/*
  SMPTE 影格 / 時間碼換算引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-timecode.mjs
  oracle:經典 SMPTE drop-frame 演算法已知值 —— 29.97DF 影格 1800 = 00:01:00;02、
  影格 17982 = 00:10:00;00(整 10 分鐘不丟);non-drop 直接換算;以及來回一致性。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `timecode-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/timecode.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const {
  FPS_OPTIONS,
  fpsById,
  dropFramesPerMinute,
  framesToTimecode,
  parseTimecode,
  timecodeToFrames,
  framesToSeconds,
  formatSeconds,
} = await import('file://' + out)

let fail = 0
function eq(note, got, want) {
  const g = JSON.stringify(got)
  const w = JSON.stringify(want)
  if (g === w) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}\n   got : ${g}\n   want: ${w}`)
  }
}
function approx(note, got, want, eps = 1e-6) {
  if (Math.abs(got - want) <= eps) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}\n   got : ${got}\n   want: ${want}`)
  }
}

// ── 選項表 ──
eq('29.97 nominal=30', fpsById('29.97').nominal, 30)
eq('29.97 允許 DF', fpsById('29.97').dropAllowed, true)
eq('24 不允許 DF', fpsById('24').dropAllowed, false)
approx('29.97 實際幀率', fpsById('29.97').actual, 30000 / 1001)
eq('共 8 種幀率', FPS_OPTIONS.length, 8)

// ── dropFramesPerMinute ──
eq('30→2', dropFramesPerMinute(30), 2)
eq('60→4', dropFramesPerMinute(60), 4)

// ── framesToTimecode:non-drop 30fps ──
eq('frame 0', framesToTimecode(0, 30, false), '00:00:00:00')
eq('frame 30 = 1 秒', framesToTimecode(30, 30, false), '00:00:01:00')
eq('frame 1800 (ND)', framesToTimecode(1800, 30, false), '00:01:00:00')
eq('frame 108000 = 1 小時', framesToTimecode(108000, 30, false), '01:00:00:00')
eq('25fps frame 25 = 1 秒', framesToTimecode(25, 25, false), '00:00:01:00')

// ── framesToTimecode:drop-frame 29.97(經典 oracle)──
eq('DF frame 0', framesToTimecode(0, 30, true), '00:00:00;00')
eq('DF frame 1800 = 00:01:00;02', framesToTimecode(1800, 30, true), '00:01:00;02')
eq('DF frame 17982 = 00:10:00;00', framesToTimecode(17982, 30, true), '00:10:00;00')
// 59.94 DF:每分鐘丟 4
eq('DF60 frame 3600 = 00:01:00;04', framesToTimecode(3600, 60, true), '00:01:00;04')

// ── parseTimecode ──
eq('解析冒號', parseTimecode('01:02:03:04'), { hh: 1, mm: 2, ss: 3, ff: 4, dropFrame: false })
eq('解析分號為 DF', parseTimecode('00:01:00;02').dropFrame, true)
eq('解析點為 DF', parseTimecode('00:01:00.02').dropFrame, true)
eq('解析負號', parseTimecode('-00:00:01:00').hh, -0) // -0
eq('欄位不足回 null', parseTimecode('01:02:03'), null)
eq('非數字回 null', parseTimecode('aa:02:03:04'), null)
eq('秒>59 回 null', parseTimecode('00:00:60:00'), null)
eq('空字串回 null', parseTimecode(''), null)

// ── timecodeToFrames(經典反算 oracle)──
eq(
  'TC 00:01:00;02 → 1800',
  timecodeToFrames(parseTimecode('00:01:00;02'), 30, true),
  1800,
)
eq(
  'TC 00:10:00;00 → 17982',
  timecodeToFrames(parseTimecode('00:10:00;00'), 30, true),
  17982,
)
eq('TC 01:00:00:00 ND → 108000', timecodeToFrames(parseTimecode('01:00:00:00'), 30, false), 108000)

// ── 來回一致性:大量影格 round-trip ──
for (const [nominal, df] of [
  [30, false],
  [30, true],
  [24, false],
  [25, false],
  [60, true],
]) {
  let ok = true
  for (const fn of [0, 1, 29, 30, 1799, 1800, 1801, 17981, 17982, 100000, 215999]) {
    const tc = framesToTimecode(fn, nominal, df)
    const back = timecodeToFrames(parseTimecode(tc), nominal, df)
    if (back !== fn) {
      ok = false
      console.error(`   round-trip 失敗 nominal=${nominal} df=${df} fn=${fn} tc=${tc} back=${back}`)
      break
    }
  }
  eq(`round-trip nominal=${nominal} df=${df}`, ok, true)
}

// ── 實際時間 ──
approx('29.97 的 30000 影格約 1001 秒', framesToSeconds(30000, 30000 / 1001), 1001)
eq('formatSeconds 1.5 秒', formatSeconds(1.5), '00:00:01.500')
eq('formatSeconds 3661.25 秒', formatSeconds(3661.25), '01:01:01.250')

console.log(fail === 0 ? '\n✅ 全數通過' : `\n❌ ${fail} 筆失敗`)
process.exit(fail === 0 ? 0 : 1)
