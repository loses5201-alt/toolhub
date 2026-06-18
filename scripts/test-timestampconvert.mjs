// timestampConvert 回歸測試。以 esbuild 打包 TS 後執行。
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const entry = resolve(__dirname, '../src/features/timestampConvert.ts')

const out = await build({
  entryPoints: [entry],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
})
const mod = await import(
  'data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64')
)
const { parseEpoch, parseDateString, epochInUnit, formatInOffset, toISO, relativeFromNow } = mod

let pass = 0
let fail = 0
function ok(cond, msg) {
  if (cond) pass++
  else {
    fail++
    console.error('  ✗ ' + msg)
  }
}

// 已知時間點:2026-06-18T04:30:00.000Z = 1781584200000 ms = 1781584200 s
const MS = Date.UTC(2026, 5, 18, 4, 30, 0)
const SEC = MS / 1000

// --- parseEpoch 單位判斷 ---
{
  const r = parseEpoch(String(SEC))
  ok(r.ok && r.unit === 'seconds' && r.ms === MS, '10 位數判為秒並換算正確')
}
{
  const r = parseEpoch(String(MS))
  ok(r.ok && r.unit === 'milliseconds' && r.ms === MS, '13 位數判為毫秒')
}
{
  const r = parseEpoch(String(MS * 1000))
  ok(r.ok && r.unit === 'microseconds' && r.ms === MS, '16 位數判為微秒並換算正確')
}
{
  const r = parseEpoch('0')
  ok(r.ok && r.unit === 'seconds' && r.ms === 0, '0 視為秒 → epoch 起點')
}
{
  const grouped = String(SEC).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const r = parseEpoch(grouped)
  ok(r.ok && r.ms === MS, '含千分位逗號可解析')
}
{
  const r = parseEpoch(' ' + SEC + ' ')
  ok(r.ok && r.ms === MS, '前後空白可解析')
}
{
  ok(!parseEpoch('').ok, '空字串報錯')
  ok(!parseEpoch('abc').ok, '非數字報錯')
  ok(!parseEpoch('12.5').ok, '小數報錯(時間戳記須整數)')
}
{
  const r = parseEpoch('-100')
  ok(r.ok && r.unit === 'seconds' && r.ms === -100000, '負數(1970 前)判為秒')
}

// --- epochInUnit 還原 ---
{
  ok(epochInUnit(MS, 'seconds') === SEC, 'epochInUnit 秒')
  ok(epochInUnit(MS, 'milliseconds') === MS, 'epochInUnit 毫秒')
  ok(epochInUnit(MS, 'microseconds') === MS * 1000, 'epochInUnit 微秒')
}

// --- parseDateString ---
{
  const r = parseDateString('2026-06-18T04:30:00Z')
  ok(r.ok && r.ms === MS, 'ISO UTC 字串解析')
}
{
  const r = parseDateString('2026-06-18 04:30:00Z')
  ok(r.ok && r.ms === MS, '空格分隔(補 T)+ Z 解析')
}
{
  ok(!parseDateString('').ok, '空日期報錯')
  ok(!parseDateString('不是日期').ok, '亂字串報錯')
}

// --- formatInOffset (台灣 +480) ---
{
  // 2026-06-18T04:30Z + 8h = 12:30 台灣時間,當天為週四
  const s = formatInOffset(MS, 480)
  ok(s.includes('2026/06/18') && s.includes('12:30:00'), `台灣時間格式正確: ${s}`)
  ok(s.includes('週四'), '星期幾正確(週四)')
}
{
  // UTC offset 0
  const s = formatInOffset(MS, 0)
  ok(s.includes('04:30:00'), 'UTC offset 0 顯示 04:30')
}
{
  // 跨日:UTC 04:30 在 -8 時區為前一天 20:30
  const s = formatInOffset(MS, -480)
  ok(s.includes('2026/06/17') && s.includes('20:30:00'), `負偏移跨日正確: ${s}`)
}

// --- toISO ---
{
  ok(toISO(MS) === '2026-06-18T04:30:00.000Z', 'toISO 輸出標準格式')
}

// --- relativeFromNow (注入 now) ---
{
  ok(relativeFromNow(MS, MS) === '就是現在', '同一刻 → 就是現在')
  ok(relativeFromNow(MS + 30000, MS) === '30 秒後', '30 秒後')
  ok(relativeFromNow(MS - 30000, MS) === '30 秒前', '30 秒前')
  ok(relativeFromNow(MS + 5 * 60000, MS) === '5 分鐘後', '分鐘')
  ok(relativeFromNow(MS + 3 * 3600000, MS) === '3 小時後', '小時')
  ok(relativeFromNow(MS + 2 * 86400000, MS) === '2 天後', '天')
  ok(relativeFromNow(MS - 60 * 86400000, MS).includes('個月前'), '月')
  ok(relativeFromNow(MS + 730 * 86400000, MS).includes('年後'), '年')
}

console.log(`timestampConvert: ${pass} 通過, ${fail} 失敗`)
if (fail > 0) process.exit(1)
