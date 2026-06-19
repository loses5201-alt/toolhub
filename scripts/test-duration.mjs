/*
  時間長度轉換引擎回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-duration.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `duration-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/duration.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { parseDuration, breakdown, formatHuman, formatClock, formatIso } =
  await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}
const sec = (s) => parseDuration(s).seconds

// --- 純數字(秒) ---
check('純數字當秒', sec('90') === 90)
check('小數秒', sec('1.5') === 1.5)

// --- 時鐘格式 ---
check('mm:ss', sec('1:30') === 90)
check('hh:mm:ss', sec('01:30:00') === 5400)
check('hh:mm:ss 帶秒', sec('2:03:04') === 7384)
check('時鐘小數秒', sec('0:01:30.5') === 90.5)

// --- ISO 8601 ---
check('PT1H30M', sec('PT1H30M') === 5400)
check('P1DT2H', sec('P1DT2H') === 93600)
check('PT45S', sec('PT45S') === 45)
check('P1W', sec('P1W') === 604800)
check('小寫 pt1h', sec('pt1h') === 3600)
check('純 P 無數值 → 報錯', parseDuration('P').ok === false)
check('純 PT 無數值 → 報錯', parseDuration('PT').ok === false)

// --- 帶單位(英文) ---
check('1h30m', sec('1h30m') === 5400)
check('90m', sec('90m') === 5400)
check('1d2h3m4s', sec('1d2h3m4s') === 93784)
check('1.5h', sec('1.5h') === 5400)
check('90 min(長寫+空白)', sec('90 min') === 5400)
check('2 hours', sec('2 hours') === 7200)
check('1 day', sec('1 day') === 86400)
check('3 weeks', sec('3 weeks') === 1814400)

// --- 帶單位(中文) ---
check('1天2小時30分', sec('1天2小時30分') === 95400)
check('90分鐘', sec('90分鐘') === 5400)
check('2小時', sec('2小時') === 7200)
check('45秒', sec('45秒') === 45)
check('1週', sec('1週') === 604800)
check('3天', sec('3天') === 259200)
check('「時」單字當小時', sec('2時') === 7200)

// --- 錯誤處理 ---
check('空字串報錯', parseDuration('  ').ok === false)
check('亂字串報錯', parseDuration('abc').ok === false)
check('殘留字元報錯', parseDuration('1h xyz').ok === false)
check('單位後沒數字報錯', parseDuration('h').ok === false)

// --- breakdown ---
const b = breakdown(93784)
check('breakdown 天', b.days === 1)
check('breakdown 時', b.hours === 2)
check('breakdown 分', b.minutes === 3)
check('breakdown 秒', b.seconds === 4)

// --- 格式化 ---
check('formatHuman', formatHuman(95400) === '1 天 2 小時 30 分鐘')
check('formatHuman 0', formatHuman(0) === '0 秒')
check('formatHuman 只有秒', formatHuman(45) === '45 秒')
check('formatClock', formatClock(5400) === '01:30:00')
check('formatClock 超過一天累進小時', formatClock(90000) === '25:00:00')
check('formatIso', formatIso(5400) === 'PT1H30M')
check('formatIso 含天', formatIso(93600) === 'P1DT2H')
check('formatIso 0', formatIso(0) === 'PT0S')

// --- 來回一致 ---
for (const total of [0, 45, 90, 5400, 93784, 604800]) {
  check(`ISO 來回一致 ${total}`, sec(formatIso(total)) === total)
  check(`時鐘來回一致 ${total}`, sec(formatClock(total)) === total)
}

if (fail) {
  console.error(`\n${fail} 個測試失敗`)
  process.exit(1)
}
console.log('\n全部通過')
