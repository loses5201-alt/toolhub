/*
  表格統計 / 樞紐引擎回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-tablestats.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `tablestats-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/tableStats.ts', 'src/features/tableClean.ts'],
  bundle: true,
  format: 'esm',
  outdir: out,
  logLevel: 'silent',
})
const { computeStats, parseNum, formatNum } = await import('file://' + join(out, 'tableStats.js'))
const { parseTable } = await import('file://' + join(out, 'tableClean.js'))

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// region,amount
const t = parseTable('region,amount\n北,100\n南,200\n北,300\n南,50\n北,', {})
const ci = { region: 0, amount: 1 }

// --- count ---
const c = computeStats(t, { groupCol: ci.region, valueCol: ci.amount, agg: 'count' })
check('count 分組數', c.groups === 2)
check('count 表頭', c.table.headers.join(',') === 'region,筆數')
check('count 維持首次出現順序(北先)', c.table.rows[0][0] === '北')
check('count 北=3', c.table.rows[0][1] === '3')
check('count 南=2', c.table.rows[1][1] === '2')

// --- sum(忽略空值)---
const s = computeStats(t, { groupCol: ci.region, valueCol: ci.amount, agg: 'sum' })
check('sum 表頭', s.table.headers.join(',') === 'region,amount 加總')
check('sum 北=400(空值略過)', s.table.rows[0][1] === '400')
check('sum 南=250', s.table.rows[1][1] === '250')

// --- avg ---
const a = computeStats(t, { groupCol: ci.region, valueCol: ci.amount, agg: 'avg' })
check('avg 北=200(400/2,空值不計入分母)', a.table.rows[0][1] === '200')
check('avg 南=125', a.table.rows[1][1] === '125')

// --- min / max ---
const mn = computeStats(t, { groupCol: ci.region, valueCol: ci.amount, agg: 'min' })
check('min 北=100', mn.table.rows[0][1] === '100')
const mx = computeStats(t, { groupCol: ci.region, valueCol: ci.amount, agg: 'max' })
check('max 北=300', mx.table.rows[0][1] === '300')

// --- distinct ---
const dt = parseTable('region,city\n北,台北\n北,台北\n北,基隆\n南,高雄', {})
const d = computeStats(dt, { groupCol: 0, valueCol: 1, agg: 'distinct' })
check('distinct 表頭', d.table.headers.join(',') === 'region,city 不重複數')
check('distinct 北=2(台北/基隆)', d.table.rows[0][1] === '2')
check('distinct 南=1', d.table.rows[1][1] === '1')

// --- 不分組(全部一組)---
const all = computeStats(t, { groupCol: -1, valueCol: ci.amount, agg: 'sum' })
check('不分組 groups=1', all.groups === 1)
check('不分組 名稱=全部', all.table.rows[0][0] === '全部')
check('不分組 加總=650', all.table.rows[0][1] === '650')

// --- 千分位 / 空白數值 ---
const tc = parseTable('g,v\nA,"1,200"\nA, 800 \nA,x', {})
const sc = computeStats(tc, { groupCol: 0, valueCol: 1, agg: 'sum' })
check('sum 吃千分位+去空白,非數值略過', sc.table.rows[0][1] === '2000')

// --- 全組無數值 → 空字串 ---
const noNum = parseTable('g,v\nA,foo\nA,bar', {})
const sn = computeStats(noNum, { groupCol: 0, valueCol: 1, agg: 'sum' })
check('全非數值 sum 回空字串', sn.table.rows[0][1] === '')

// --- parseNum / formatNum ---
check('parseNum 千分位', parseNum('1,234.5') === 1234.5)
check('parseNum 空白回 null', parseNum('  ') === null)
check('parseNum 文字回 null', parseNum('abc') === null)
check('parseNum 負數', parseNum('-50') === -50)
check('formatNum 整數不帶小數', formatNum(400) === '400')
check('formatNum 去尾零', formatNum(125.5) === '125.5')
check('formatNum 四位精度', formatNum(1 / 3) === '0.3333')

// --- 小數平均不爆長 ---
const avgF = computeStats(parseTable('g,v\nA,1\nA,2', {}), { groupCol: 0, valueCol: 1, agg: 'avg' })
check('avg 1.5', avgF.table.rows[0][1] === '1.5')

console.log(fail === 0 ? '\n全部通過 ✅' : `\n${fail} 筆失敗 ❌`)
process.exit(fail === 0 ? 0 : 1)
