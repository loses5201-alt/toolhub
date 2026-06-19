/*
  資料圖表產生引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-chartsvg.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `chartsvg-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/chartSvg.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const {
  parseNumber, buildChartData, niceScale, pieSlices, polarPoint, arcPath, fmtNum, renderChart,
} = await import('file://' + out)

let fail = 0
function eq(note, got, want) {
  const g = JSON.stringify(got)
  const w = JSON.stringify(want)
  if (g === w) console.log(`✓ ${note}`)
  else { fail++; console.error(`✗ ${note}\n   got : ${g}\n   want: ${w}`) }
}
function ok(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else { fail++; console.error(`✗ ${note}`) }
}
function near(note, got, want, eps = 1e-6) {
  if (Math.abs(got - want) <= eps) console.log(`✓ ${note}`)
  else { fail++; console.error(`✗ ${note}\n   got : ${got}\n   want: ${want}`) }
}

// --- parseNumber ---
eq('整數', parseNumber('1200'), 1200)
eq('千分位逗號', parseNumber('1,200'), 1200)
eq('小數', parseNumber('3.14'), 3.14)
eq('負數', parseNumber('-50'), -50)
eq('前後空白', parseNumber('  42 '), 42)
eq('百分比符號去除', parseNumber('85%'), 85)
eq('貨幣符號去除', parseNumber('$1,000'), 1000)
eq('底線分隔', parseNumber('1_000'), 1000)
eq('已是數字直接回傳', parseNumber(7), 7)
ok('空字串為 NaN', Number.isNaN(parseNumber('')))
ok('非數字為 NaN', Number.isNaN(parseNumber('abc')))

// --- buildChartData ---
const table = { headers: ['月份', '收入', '支出'], rows: [['一月', '1,000', '600'], ['二月', '1500', 'x']] }
const cd = buildChartData(table, 0, [1, 2])
eq('標籤取自 labelCol', cd.labels, ['一月', '二月'])
eq('兩個數列', cd.series.length, 2)
eq('數列名取自表頭', cd.series.map((s) => s.name), ['收入', '支出'])
eq('收入值解析', cd.series[0].values, [1000, 1500])
eq('非數字值視為 0', cd.series[1].values, [600, 0])

// --- niceScale ---
const s1 = niceScale(0, 95)
eq('0~95 下界 0', s1.min, 0)
ok('0~95 上界 >=95', s1.max >= 95)
ok('刻度遞增且含上下界', s1.ticks[0] === s1.min && s1.ticks[s1.ticks.length - 1] === s1.max)
ok('刻度間距一致', s1.ticks.every((t, i) => i === 0 || Math.abs(t - s1.ticks[i - 1] - s1.step) < 1e-6))
const s2 = niceScale(0, 0)
ok('min===max 仍給有效區間', s2.max > s2.min)
const s3 = niceScale(-40, 80)
ok('含負值下界 <=-40', s3.min <= -40)
ok('含負值刻度涵蓋 0', s3.ticks.some((t) => Math.abs(t) < 1e-9))
ok('刻度無浮點雜訊', niceScale(0, 30).ticks.every((t) => Math.abs(t - Math.round(t)) < 1e-9))

// --- pieSlices ---
const ps = pieSlices([1, 1, 2])
eq('比例正確', ps.map((s) => s.fraction), [0.25, 0.25, 0.5])
near('總角度為 360', ps[ps.length - 1].end, 360)
eq('第一片自 0 起', ps[0].start, 0)
ok('片段首尾相接', ps[0].end === ps[1].start && ps[1].end === ps[2].start)
const psn = pieSlices([5, -3, 0])
eq('負值與 0 不佔比例', psn.map((s) => s.fraction), [1, 0, 0])
const psz = pieSlices([0, 0])
eq('全 0 比例皆 0', psz.map((s) => s.fraction), [0, 0])

// --- polarPoint / arcPath ---
const pt0 = polarPoint(100, 100, 50, 0)
near('0 度在正上方 x', pt0.x, 100)
near('0 度在正上方 y', pt0.y, 50)
const pt90 = polarPoint(100, 100, 50, 90)
near('90 度在右側 x', pt90.x, 150)
near('90 度在右側 y', pt90.y, 100)
ok('一般扇形大弧旗標為 0', arcPath(100, 100, 50, 0, 90).includes(' 0 1 '))
ok('>180 度大弧旗標為 1', arcPath(100, 100, 50, 0, 270).includes(' 1 1 '))
ok('整圓用兩段弧', (arcPath(100, 100, 50, 0, 360).match(/A/g) || []).length === 2)
ok('扇形自圓心起筆', arcPath(100, 100, 50, 0, 90).startsWith('M100,100'))

// --- fmtNum ---
eq('大數加千分位', fmtNum(1234567), '1,234,567')
eq('小數保留兩位', fmtNum(3.14159), '3.14')
eq('小於千不加逗號', fmtNum(999), '999')
ok('NaN 為空字串', fmtNum(NaN) === '')

// --- renderChart ---
const d2 = { labels: ['A', 'B', 'C'], series: [{ name: 'x', values: [10, 20, 30] }] }
const barSvg = renderChart('bar', d2, { title: '測試', showValues: true })
ok('長條圖為 svg', barSvg.startsWith('<svg') && barSvg.endsWith('</svg>'))
eq('單數列三長條 → 3 個 rect(扣背景)', (barSvg.match(/<rect/g) || []).length - 1, 3)
ok('含標題文字', barSvg.includes('測試'))
ok('顯示數值', barSvg.includes('>30<'))
const lineSvg = renderChart('line', d2, {})
ok('折線圖含 polyline', lineSvg.includes('<polyline'))
eq('折線三點 → 3 個 circle', (lineSvg.match(/<circle/g) || []).length, 3)
const pieSvg = renderChart('pie', d2, {})
eq('圓餅三片 → 3 個 path', (pieSvg.match(/<path/g) || []).length, 3)
ok('圓餅含百分比', /%/.test(pieSvg))
// 多數列長條圖:分組長條 = 2 數列 × 3 類別 = 6
const d3 = { labels: ['A', 'B', 'C'], series: [{ name: 'x', values: [1, 2, 3] }, { name: 'y', values: [4, 5, 6] }] }
eq('分組長條 6 根(扣背景)', (renderChart('bar', d3, { showLegend: true }).match(/<rect/g) || []).length - 1 - 2, 6) // 扣 2 圖例方塊
ok('多數列顯示圖例', renderChart('bar', d3, { showLegend: true }).includes('>x<'))

if (fail) {
  console.error(`\n${fail} 筆測試失敗`)
  process.exit(1)
}
console.log('\n全部通過')
