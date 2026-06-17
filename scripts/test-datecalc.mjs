/*
  日期計算引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-datecalc.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `datecalc-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/dateCalc.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const {
  parseDate, formatYMD, weekday, weekdayName, isWeekend,
  daysBetween, addDays, addBusinessDays, businessDaysBetween,
} = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}
const D = (s) => parseDate(s)

// --- parseDate ---
check('解析正常日期', formatYMD(D('2026-06-17')) === '2026-06-17')
check('補零格式化', formatYMD(D('2026-1-5')) === '2026-01-05')
check('擋 2 月 30 日', D('2026-02-30') === null)
check('閏年 2/29 有效', D('2024-02-29') !== null)
check('平年 2/29 無效', D('2026-02-29') === null)
check('月份超界無效', D('2026-13-01') === null)
check('格式錯誤無效', D('2026/06/17') === null)

// --- weekday ---
check('2026-06-17 是星期三', weekday(D('2026-06-17')) === 3 && weekdayName(D('2026-06-17')) === '星期三')
check('2026-06-20 是週末(六)', isWeekend(D('2026-06-20')) === true)
check('2026-06-19 非週末(五)', isWeekend(D('2026-06-19')) === false)

// --- daysBetween ---
check('相差 1 天', daysBetween(D('2026-06-17'), D('2026-06-18')) === 1)
check('反向為負', daysBetween(D('2026-06-18'), D('2026-06-17')) === -1)
check('同日為 0', daysBetween(D('2026-06-17'), D('2026-06-17')) === 0)
check('跨年天數', daysBetween(D('2025-12-31'), D('2026-01-01')) === 1)
check('整年(平年 365)', daysBetween(D('2026-01-01'), D('2027-01-01')) === 365)
check('閏年含 2/29(366)', daysBetween(D('2024-01-01'), D('2025-01-01')) === 366)

// --- addDays ---
check('加 14 天', formatYMD(addDays(D('2026-06-17'), 14)) === '2026-07-01')
check('減 1 天跨月', formatYMD(addDays(D('2026-07-01'), -1)) === '2026-06-30')
check('跨年加天', formatYMD(addDays(D('2025-12-31'), 1)) === '2026-01-01')

// --- addBusinessDays ---
// 2026-06-17 是週三;+3 工作日 → 四、五、(六日跳過)、一 = 6/22(週一)
check('週三 +3 工作日 → 下週一', formatYMD(addBusinessDays(D('2026-06-17'), 3)) === '2026-06-22')
// 週五 +1 工作日 → 跳過週末 → 下週一
check('週五 +1 工作日 → 下週一', formatYMD(addBusinessDays(D('2026-06-19'), 1)) === '2026-06-22')
// 週一 -1 工作日 → 上週五
check('週一 -1 工作日 → 上週五', formatYMD(addBusinessDays(D('2026-06-22'), -1)) === '2026-06-19')
check('+0 工作日為原日', formatYMD(addBusinessDays(D('2026-06-17'), 0)) === '2026-06-17')

// --- businessDaysBetween(含起訖) ---
// 週一(6/15)到週五(6/19):5 個工作日
check('整週一到五 = 5 工作日', businessDaysBetween(D('2026-06-15'), D('2026-06-19')) === 5)
// 週一(6/15)到下週一(6/22):含兩個週一,跨一個週末 → 6
check('跨週末 = 6 工作日', businessDaysBetween(D('2026-06-15'), D('2026-06-22')) === 6)
// 僅週末兩天 → 0
check('只有週末 = 0 工作日', businessDaysBetween(D('2026-06-20'), D('2026-06-21')) === 0)
// 順序顛倒結果相同
check('順序顛倒結果相同', businessDaysBetween(D('2026-06-19'), D('2026-06-15')) === 5)
// 同一天(工作日)= 1
check('同一工作日 = 1', businessDaysBetween(D('2026-06-17'), D('2026-06-17')) === 1)

if (fail) {
  console.error(`\n${fail} 個測試未通過`)
  process.exit(1)
} else {
  console.log('\n全部通過 ✅')
}
