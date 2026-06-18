/*
  Cron 解讀引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-cron.mjs
  注意:nextRuns 用本機時區,測試以固定 from 日期 + 相對關係驗證,避免時區依賴。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `cron-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/cron.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { parseCron, describeCron, nextRuns } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// --- parseCron ---
const everyMin = parseCron('* * * * *')
check('全 * 分鐘全集', everyMin.minute.values.length === 60 && everyMin.minute.isAll)
check('全 * 週全集', everyMin.dow.values.length === 7)

const c1 = parseCron('30 9 * * 1')
check('單值分', c1.minute.values.join() === '30')
check('單值時', c1.hour.values.join() === '9')
check('週一', c1.dow.values.join() === '1' && !c1.dow.isAll)

check('清單', parseCron('0,15,30,45 * * * *').minute.values.join() === '0,15,30,45')
check('範圍', parseCron('0 9-17 * * *').hour.values.join() === '9,10,11,12,13,14,15,16,17')
check('步進 */15', parseCron('*/15 * * * *').minute.values.join() === '0,15,30,45')
check('範圍加步進 0-30/10', parseCron('0-30/10 * * * *').minute.values.join() === '0,10,20,30')
check('a/n 至上限', parseCron('5/20 * * * *').minute.values.join() === '5,25,45')
check('月份英文名', parseCron('0 0 1 jan,jul *').month.values.join() === '1,7')
check('週名 mon-fri', parseCron('0 9 * * mon-fri').dow.values.join() === '1,2,3,4,5')
check('週日 7=0', parseCron('0 0 * * 7').dow.values.join() === '0')
check('捷徑 @daily', parseCron('@daily').hour.values.join() === '0' && parseCron('@daily').minute.values.join() === '0')
check('捷徑 @hourly', parseCron('@hourly').minute.values.join() === '0' && parseCron('@hourly').hour.isAll)

// --- 錯誤處理 ---
function throws(fn) {
  try { fn(); return false } catch { return true }
}
check('欄位不足報錯', throws(() => parseCron('* * *')))
check('超出範圍報錯', throws(() => parseCron('99 * * * *')))
check('非法字元報錯', throws(() => parseCron('a * * * *')))
check('步進 0 報錯', throws(() => parseCron('*/0 * * * *')))
check('逆向範圍報錯', throws(() => parseCron('30-10 * * * *')))

// --- describeCron(不求完美措辭,驗證關鍵字出現) ---
check('每分鐘描述', describeCron('* * * * *').includes('每分鐘'))
check('固定時間描述', describeCron('30 9 * * *').includes('09:30'))
check('星期描述', describeCron('0 8 * * 1').includes('星期 一'))
check('月份描述', describeCron('0 0 1 1 *').includes('1 月'))
check('每月幾號描述', describeCron('0 0 15 * *').includes('15 號'))
check('dom+dow 任一備註', describeCron('0 0 1 * 1').includes('任一符合'))

// --- nextRuns ---
// 基準:2026-01-01 00:00:00 本機時間
const base = new Date(2026, 0, 1, 0, 0, 0, 0)

const r1 = nextRuns('* * * * *', base, 3)
check('每分鐘:下一次是 00:01', r1[0].getMinutes() === 1 && r1[0].getHours() === 0)
check('每分鐘:連續遞增', r1[1].getMinutes() === 2 && r1[2].getMinutes() === 3)
check('回傳數量', r1.length === 3)

const r2 = nextRuns('0 9 * * *', base, 2)
check('每天9點:時間正確', r2[0].getHours() === 9 && r2[0].getMinutes() === 0)
check('每天9點:相隔一天', (r2[1].getTime() - r2[0].getTime()) === 24 * 3600 * 1000)

const r3 = nextRuns('30 14 * * *', base, 1)
check('14:30', r3[0].getHours() === 14 && r3[0].getMinutes() === 30 && r3[0].getDate() === 1)

// 每週一(2026-01-01 是週四;下一個週一是 1/5)
const r4 = nextRuns('0 0 * * 1', base, 2)
check('每週一:第一次是週一', r4[0].getDay() === 1)
check('每週一:相隔七天', (r4[1].getTime() - r4[0].getTime()) === 7 * 24 * 3600 * 1000)

// 每月 15 號
const r5 = nextRuns('0 0 15 * *', base, 2)
check('每月15號:日期=15', r5[0].getDate() === 15 && r5[1].getDate() === 15)
check('每月15號:跨月', r5[0].getMonth() === 0 && r5[1].getMonth() === 1)

// 只在 2 月(跨年等待)
const r6 = nextRuns('0 0 1 2 *', base, 1)
check('只在2月1號', r6[0].getMonth() === 1 && r6[0].getDate() === 1)

// dom+dow OR 語意:每月13號 或 週五
const r7 = nextRuns('0 0 13 * 5', base, 5)
check('13號或週五:每筆符合其一', r7.every((d) => d.getDate() === 13 || d.getDay() === 5))

// 每 15 分
const r8 = nextRuns('*/15 * * * *', base, 4)
check('每15分:0/15/30/45', r8.map((d) => d.getMinutes()).join() === '15,30,45,0')

console.log(fail === 0 ? `\n全部通過` : `\n${fail} 筆失敗`)
process.exit(fail === 0 ? 0 : 1)
