/*
  RRULE 解讀引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-rrule.mjs
  oracle:RFC 5545 規格文件「Recurrence Rule」節的官方範例(含兩個 WKST 會改變結果的經典例),
  以及手算的台灣常見行事曆規則。日期以本機時區計算,比對只看 YYYY-MM-DD / HH:MM,不依賴時區位移。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `rrule-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/rrule.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { parseRRule, occurrences, describeRRule } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}
const p = (n) => (n < 10 ? '0' + n : '' + n)
const ymd = (d) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
const hm = (d) => `${p(d.getHours())}:${p(d.getMinutes())}`
// dtstart 建構子(本機時間)
const dt = (y, mo, d, h = 9, mi = 0) => new Date(y, mo - 1, d, h, mi, 0)
function eqDates(note, got, expected) {
  const g = got.map(ymd).join(',')
  const e = expected.join(',')
  check(`${note} → ${e}`, g === e)
  if (g !== e) console.error(`   實得:${g}`)
}

// --- RFC 5545 官方範例:每兩週的週二與週四,直到 1997-10-07 ---
eqDates(
  'RFC: 每兩週 TU,TH 直到 10/07',
  occurrences('FREQ=WEEKLY;INTERVAL=2;UNTIL=19971007T000000Z;WKST=SU;BYDAY=TU,TH', dt(1997, 9, 2), 20),
  ['1997-09-02', '1997-09-04', '1997-09-16', '1997-09-18', '1997-09-30', '1997-10-02'],
)

// --- RFC 5545 官方範例:WKST 會改變結果(WKST=MO)---
eqDates(
  'RFC: WKST=MO 每兩週 TU,SU 共 4 次',
  occurrences('FREQ=WEEKLY;INTERVAL=2;COUNT=4;BYDAY=TU,SU;WKST=MO', dt(1997, 8, 5), 20),
  ['1997-08-05', '1997-08-10', '1997-08-19', '1997-08-24'],
)
// --- 同上但 WKST=SU,結果不同 ---
eqDates(
  'RFC: WKST=SU 每兩週 TU,SU 共 4 次',
  occurrences('FREQ=WEEKLY;INTERVAL=2;COUNT=4;BYDAY=TU,SU;WKST=SU', dt(1997, 8, 5), 20),
  ['1997-08-05', '1997-08-17', '1997-08-19', '1997-08-31'],
)

// --- 平日每天(工作日)---
eqDates(
  '每週一到週五',
  occurrences('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', dt(2026, 1, 5), 5),
  ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09'],
)

// --- 每隔一週的週二 ---
eqDates(
  '每兩週的週二',
  occurrences('FREQ=WEEKLY;INTERVAL=2;BYDAY=TU', dt(2026, 1, 6), 3),
  ['2026-01-06', '2026-01-20', '2026-02-03'],
)

// --- 每月最後一個週五 ---
eqDates(
  '每月最後一個週五(-1FR)',
  occurrences('FREQ=MONTHLY;BYDAY=-1FR', dt(2026, 1, 30), 3),
  ['2026-01-30', '2026-02-27', '2026-03-27'],
)

// --- 每月最後一天 ---
eqDates(
  '每月最後一天(BYMONTHDAY=-1)',
  occurrences('FREQ=MONTHLY;BYMONTHDAY=-1', dt(2026, 1, 31), 3),
  ['2026-01-31', '2026-02-28', '2026-03-31'],
)

// --- 每月第二與第四個週一 ---
eqDates(
  '每月第 2、4 個週一',
  occurrences('FREQ=MONTHLY;BYDAY=2MO,4MO', dt(2026, 1, 12), 3),
  ['2026-01-12', '2026-01-26', '2026-02-09'],
)

// --- 每月最後一個工作日(BYSETPOS=-1)---
eqDates(
  '每月最後一個工作日(BYSETPOS=-1)',
  occurrences('FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1', dt(2026, 1, 30), 2),
  ['2026-01-30', '2026-02-27'],
)

// --- 黑色星期五(Friday the 13th):BYDAY 與 BYMONTHDAY 同時須符合(交集)---
eqDates(
  '13 號又逢週五(交集)',
  occurrences('FREQ=MONTHLY;BYDAY=FR;BYMONTHDAY=13', dt(2026, 2, 13), 2),
  ['2026-02-13', '2026-03-13'],
)

// --- 每兩個月的 15 號 ---
eqDates(
  '每兩個月 15 號',
  occurrences('FREQ=MONTHLY;INTERVAL=2', dt(2026, 1, 15), 3),
  ['2026-01-15', '2026-03-15', '2026-05-15'],
)

// --- 每年(週年)---
eqDates(
  '每年同一天(週年)',
  occurrences('FREQ=YEARLY', dt(2026, 2, 15), 3),
  ['2026-02-15', '2027-02-15', '2028-02-15'],
)

// --- 美國感恩節:每年 11 月第 4 個週四 ---
eqDates(
  '每年 11 月第 4 個週四',
  occurrences('FREQ=YEARLY;BYMONTH=11;BYDAY=4TH', dt(2026, 11, 26), 2),
  ['2026-11-26', '2027-11-25'],
)

// --- 每 3 天,共 4 次(COUNT)---
eqDates(
  '每 3 天共 4 次',
  occurrences('FREQ=DAILY;INTERVAL=3;COUNT=4', dt(2026, 1, 1), 10),
  ['2026-01-01', '2026-01-04', '2026-01-07', '2026-01-10'],
)

// --- 每天直到指定日期(UNTIL 純日期 → 當天含)---
eqDates(
  '每天直到 2026-01-05',
  occurrences('FREQ=DAILY;UNTIL=20260105', dt(2026, 1, 1, 0, 0), 20),
  ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05'],
)

// --- COUNT 上限優先於 limit ---
check('COUNT 限制次數', occurrences('FREQ=DAILY;COUNT=3', dt(2026, 1, 1), 99).length === 3)
// --- limit 上限優先於無限規則 ---
check('limit 限制次數', occurrences('FREQ=DAILY', dt(2026, 1, 1), 7).length === 7)
// --- 發生時間保留 DTSTART 的時刻 ---
check('保留時刻 14:30', hm(occurrences('FREQ=DAILY', dt(2026, 1, 1, 14, 30), 1)[0]) === '14:30')

// --- parse ---
const r = parseRRule('RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,-1FR;WKST=SU')
check('parse freq', r.freq === 'WEEKLY')
check('parse interval', r.interval === 2)
check('parse byday 序數', r.byday.length === 2 && r.byday[1].ord === -1 && r.byday[1].wd === 5)
check('parse wkst', r.wkst === 0)
check('parse 容許含 DTSTART 前綴行', parseRRule('DTSTART:20260101T090000\nRRULE:FREQ=DAILY').freq === 'DAILY')

// --- 錯誤情況 ---
function throws(note, fn) {
  let t = false
  try { fn() } catch { t = true }
  check(note, t)
}
throws('缺 FREQ 報錯', () => parseRRule('INTERVAL=2'))
throws('FREQ 無效報錯', () => parseRRule('FREQ=DECADELY'))
throws('COUNT 與 UNTIL 並存報錯', () => parseRRule('FREQ=DAILY;COUNT=3;UNTIL=20260101'))
throws('BYDAY 無效報錯', () => parseRRule('FREQ=WEEKLY;BYDAY=XX'))
throws('BYMONTHDAY 0 報錯', () => parseRRule('FREQ=MONTHLY;BYMONTHDAY=0'))
throws('INTERVAL 非正整數報錯', () => parseRRule('FREQ=DAILY;INTERVAL=0'))
throws('不支援 SECONDLY 報錯', () => parseRRule('FREQ=SECONDLY'))

// --- describe ---
check('describe 每週 + 星期', /每週/.test(describeRRule('FREQ=WEEKLY;BYDAY=MO,WE,FR')) && /星期一/.test(describeRRule('FREQ=WEEKLY;BYDAY=MO,WE,FR')))
check('describe 每兩個月', /每 2 個月/.test(describeRRule('FREQ=MONTHLY;INTERVAL=2')))
check('describe 最後一個週五', /最後一個星期五/.test(describeRRule('FREQ=MONTHLY;BYDAY=-1FR')))
check('describe 最後一天', /最後一天/.test(describeRRule('FREQ=MONTHLY;BYMONTHDAY=-1')))
check('describe 共 N 次', /共 5 次/.test(describeRRule('FREQ=DAILY;COUNT=5')))
check('describe 直到', /直到 2026\/1\/5/.test(describeRRule('FREQ=DAILY;UNTIL=20260105')))
check('describe 時刻', /於 09:30/.test(describeRRule('FREQ=DAILY', dt(2026, 1, 1, 9, 30))))

console.log(fail ? `\n${fail} 項失敗` : '\n全部通過')
process.exit(fail ? 1 : 0)
