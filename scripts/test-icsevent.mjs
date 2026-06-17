/*
  行事曆事件(.ics)產生引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-icsevent.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `icsevent-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/icsEvent.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { buildIcs, escapeText, formatDateTime, formatDate } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

const opts = { uid: 'fixed-uid@toolhub', dtstamp: '20260617T000000Z' }

// --- escapeText ---
check('逸出逗號', escapeText('a,b') === 'a\\,b')
check('逸出分號', escapeText('a;b') === 'a\\;b')
check('逸出反斜線', escapeText('a\\b') === 'a\\\\b')
check('逸出換行', escapeText('a\nb') === 'a\\nb')

// --- formatDateTime / formatDate ---
check('formatDateTime 補秒', formatDateTime('2026-06-20T14:30') === '20260620T143000')
check('formatDate', formatDate('2026-06-20') === '20260620')

// --- 一般定時事件 ---
const r1 = buildIcs(
  { title: '牙醫回診', start: '2026-06-20T14:30', end: '2026-06-20T15:00', allDay: false, location: '台北', reminderMinutes: 30 },
  opts,
)
check('定時:ok', r1.ok)
check('定時:含 BEGIN/END VCALENDAR', r1.ics.includes('BEGIN:VCALENDAR') && r1.ics.includes('END:VCALENDAR'))
check('定時:DTSTART 正確', r1.ics.includes('DTSTART:20260620T143000'))
check('定時:DTEND 正確', r1.ics.includes('DTEND:20260620T150000'))
check('定時:SUMMARY', r1.ics.includes('SUMMARY:牙醫回診'))
check('定時:LOCATION', r1.ics.includes('LOCATION:台北'))
check('定時:固定 UID/DTSTAMP', r1.ics.includes('UID:fixed-uid@toolhub') && r1.ics.includes('DTSTAMP:20260617T000000Z'))
check('定時:VALARM 30 分鐘前', r1.ics.includes('TRIGGER:-PT30M') && r1.ics.includes('BEGIN:VALARM'))
check('定時:CRLF 行尾', r1.ics.includes('\r\n'))
check('定時:檔名', r1.filename === '牙醫回診.ics')

// --- 未填結束 → 預設 +1 小時 ---
const r2 = buildIcs({ title: 'A', start: '2026-12-31T23:30', allDay: false, reminderMinutes: null }, opts)
check('預設結束 +1 小時(跨日進位)', r2.ics.includes('DTEND:20270101T003000'))
check('無提醒時不含 VALARM', !r2.ics.includes('VALARM'))

// --- 全日事件:DTEND 為隔天(排他) ---
const r3 = buildIcs({ title: '生日', start: '2026-06-20', allDay: true, reminderMinutes: null }, opts)
check('全日:DTSTART VALUE=DATE', r3.ics.includes('DTSTART;VALUE=DATE:20260620'))
check('全日:DTEND 為隔天', r3.ics.includes('DTEND;VALUE=DATE:20260621'))
check('全日:月底跨月隔天', buildIcs({ title: 'x', start: '2026-06-30', allDay: true }, opts).ics.includes('DTEND;VALUE=DATE:20260701'))

// --- 逸出進入 SUMMARY/DESCRIPTION ---
const r4 = buildIcs(
  { title: '聚餐, 慶生', start: '2026-06-20T18:00', allDay: false, description: '第一行\n第二行;備註' },
  opts,
)
check('SUMMARY 內逗號被逸出', r4.ics.includes('SUMMARY:聚餐\\, 慶生'))
check('DESCRIPTION 換行與分號逸出', r4.ics.includes('DESCRIPTION:第一行\\n第二行\\;備註'))

// --- 錯誤處理 ---
check('無標題報錯', buildIcs({ title: '', start: '2026-06-20T10:00', allDay: false }, opts).ok === false)
check('無開始時間報錯', buildIcs({ title: 'x', start: '', allDay: false }, opts).ok === false)
check('壞時間格式報錯', buildIcs({ title: 'x', start: '2026/06/20', allDay: false }, opts).ok === false)
check('檔名清掉非法字元', buildIcs({ title: 'a/b:c?', start: '2026-06-20T10:00', allDay: false }, opts).filename === 'a_b_c_.ics')

if (fail) {
  console.error(`\n${fail} 個測試未通過`)
  process.exit(1)
} else {
  console.log('\n全部通過 ✅')
}
