/*
  工時時數計算引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-workhours.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `workhours-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/workHours.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { parseTime, shiftMinutes, totalMinutes, formatHM, toDecimalHours, estimatePay } =
  await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// --- parseTime ---
check('解析 09:30', parseTime('09:30') === 570)
check('解析 9:05(單位數時)', parseTime('9:05') === 545)
check('00:00 = 0', parseTime('00:00') === 0)
check('擋 24:00', parseTime('24:00') === null)
check('擋 12:60', parseTime('12:60') === null)
check('擋亂格式', parseTime('9點') === null)

// --- shiftMinutes ---
check('09:00–17:00 = 480 分', shiftMinutes({ start: '09:00', end: '17:00' }).minutes === 480)
check('扣 60 分休息 = 420 分', shiftMinutes({ start: '09:00', end: '17:00', breakMin: 60 }).minutes === 420)
const ov = shiftMinutes({ start: '22:00', end: '06:00' })
check('跨午夜 22:00–06:00 = 480 分', ov.minutes === 480)
check('跨午夜標記', ov.overnight === true)
check('非跨午夜不標記', shiftMinutes({ start: '09:00', end: '17:00' }).overnight === false)
check('整圈 09:00–09:00 視為 24h', shiftMinutes({ start: '09:00', end: '09:00' }).minutes === 1440)
check('休息超過工時 → 0(不為負)', shiftMinutes({ start: '09:00', end: '10:00', breakMin: 90 }).minutes === 0)
check('壞時間 → ok=false 且 0', shiftMinutes({ start: 'x', end: '10:00' }).ok === false)

// --- totalMinutes ---
const week = [
  { start: '09:00', end: '18:00', breakMin: 60 }, // 480
  { start: '09:00', end: '13:00' }, // 240
  { start: '22:00', end: '06:00', breakMin: 30 }, // 450
]
check('加總多段 = 1170 分', totalMinutes(week) === 1170)
check('壞班別以 0 計入', totalMinutes([{ start: 'bad', end: 'x' }, { start: '09:00', end: '10:00' }]) === 60)

// --- formatHM ---
check('480 → 8h', formatHM(480) === '8h')
check('450 → 7h 30m', formatHM(450) === '7h 30m')
check('30 → 30m', formatHM(30) === '30m')
check('0 → 0m', formatHM(0) === '0m')

// --- toDecimalHours ---
check('450 分 = 7.5 小時', toDecimalHours(450) === 7.5)
check('470 分 = 7.83 小時(四捨五入)', toDecimalHours(470) === 7.83)

// --- estimatePay ---
check('7.5h × 200 = 1500', estimatePay(450, 200) === 1500)
check('時薪 0 → 0', estimatePay(450, 0) === 0)

if (fail) {
  console.error(`\n${fail} 個測試未通過`)
  process.exit(1)
} else {
  console.log('\n全部通過 ✅')
}
