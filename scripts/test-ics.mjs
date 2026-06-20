/*
  .ics(iCalendar)解析引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-ics.mjs
  oracle:RFC 5545 的 .ics 結構與跳脫/折行規則,以手構樣本逐欄比對。
  日期以本機時間建構,比對只看年月日時分,不依賴時區位移。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `ics-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/ics.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { parseIcs, unfoldLines, parseLine, unescapeText, parseIcsDate } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else { fail++; console.error(`✗ ${note}`) }
}

// --- 行折疊還原 ---
const folded = 'DESCRIPTION:Hello\r\n  World\r\nSUMMARY:Test'
const uf = unfoldLines(folded)
check('折行:續行接回上一行', uf[0] === 'DESCRIPTION:Hello World')
check('折行:正常行不變', uf[1] === 'SUMMARY:Test')
check('折行:Tab 續行', unfoldLines('A:1\n\t2')[0] === 'A:12')

// --- content line 解析 ---
const cl = parseLine('DTSTART;TZID=Asia/Taipei;VALUE=DATE-TIME:20260115T090000')
check('parseLine name', cl.name === 'DTSTART')
check('parseLine params TZID', cl.params.TZID === 'Asia/Taipei')
check('parseLine value', cl.value === '20260115T090000')
const clq = parseLine('ORGANIZER;CN="王小明":mailto:a@b.com')
check('parseLine 引號內冒號不切斷', clq.params.CN === '王小明' && clq.value === 'mailto:a@b.com')
check('parseLine 無冒號回 null', parseLine('JUSTNAME') === null)

// --- TEXT 跳脫還原 ---
check('unescape 換行', unescapeText('a\\nb') === 'a\nb')
check('unescape 逗號分號反斜線', unescapeText('a\\,b\\;c\\\\d') === 'a,b;c\\d')

// --- 日期解析 ---
const d1 = parseIcsDate('20260115T093000', {})
check('日期:DATE-TIME', d1.date.getFullYear() === 2026 && d1.date.getMonth() === 0 && d1.date.getDate() === 15 && d1.date.getHours() === 9 && d1.date.getMinutes() === 30 && !d1.allDay)
const d2 = parseIcsDate('20260115', { VALUE: 'DATE' })
check('日期:整天 DATE', d2.allDay && d2.date.getDate() === 15)
const d3 = parseIcsDate('20260115T010000Z', {})
check('日期:UTC 標示', d3.utc === true)
check('日期:格式錯誤回 null', parseIcsDate('not-a-date', {}) === null)

// --- 完整 .ics 解析 ---
const sample = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Test//EN',
  'BEGIN:VEVENT',
  'UID:evt-1@test',
  'SUMMARY:每月例會\\, 第一週',
  'DESCRIPTION:議程:\\n1. 報告\\n2. 討論',
  'LOCATION:台北市信義區',
  'DTSTART;TZID=Asia/Taipei:20260105T140000',
  'DTEND;TZID=Asia/Taipei:20260105T150000',
  'RRULE:FREQ=MONTHLY;BYDAY=1MO',
  'STATUS:CONFIRMED',
  'ORGANIZER;CN=王小明:mailto:wang@test.com',
  'BEGIN:VALARM',
  'ACTION:DISPLAY',
  'TRIGGER:-PT15M',
  'SUMMARY:提醒(不應混入事件)',
  'END:VALARM',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:evt-2@test',
  'SUMMARY:全天假日',
  'DTSTART;VALUE=DATE:20260101',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

const evs = parseIcs(sample)
check('事件數 = 2', evs.length === 2)
// 排序:全天 1/1 應排在 1/5 之前
check('依開始時間排序', evs[0].uid === 'evt-2@test' && evs[1].uid === 'evt-1@test')
const e = evs[1]
check('SUMMARY 跳脫還原', e.summary === '每月例會, 第一週')
check('DESCRIPTION 換行還原', e.description === '議程:\n1. 報告\n2. 討論')
check('LOCATION', e.location === '台北市信義區')
check('DTSTART 解析', e.start.date.getMonth() === 0 && e.start.date.getDate() === 5 && e.start.date.getHours() === 14)
check('DTEND 解析', e.end.date.getHours() === 15)
check('RRULE 原值', e.rrule === 'FREQ=MONTHLY;BYDAY=1MO')
check('STATUS', e.status === 'CONFIRMED')
check('ORGANIZER 取 CN', e.organizer === '王小明')
check('VALARM 子元件未污染事件 SUMMARY', e.summary === '每月例會, 第一週')
const e2 = evs[0]
check('全天事件 allDay', e2.start.allDay === true)
check('沒有 RRULE 的事件 rrule 為 undefined', e2.rrule === undefined)

// --- 邊界:無 VEVENT ---
check('空行事曆回空陣列', parseIcs('BEGIN:VCALENDAR\r\nEND:VCALENDAR').length === 0)

console.log(fail ? `\n${fail} 項失敗` : '\n全部通過')
process.exit(fail ? 1 : 0)
