/*
  網購 / 交易詐騙風險評估引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-dealrisk.mjs
  oracle:依加權與門檻(關鍵題命中 → 極高;否則 percent>=35 高 / >=15 中 / >0 低 / 0 無)。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `dealrisk-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/dealRisk.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { assess, summaryFor, QUESTIONS } = await import('file://' + out)

let fail = 0
function eq(note, got, want) {
  if (got === want) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}\n   got : ${JSON.stringify(got)}\n   want: ${JSON.stringify(want)}`)
  }
}
const maxScore = QUESTIONS.reduce((s, q) => s + q.weight, 0)

// --- 題庫健全性 ---
eq('題數 > 8', QUESTIONS.length >= 8, true)
eq('有關鍵題', QUESTIONS.some((q) => q.critical), true)
eq('每題都有 advice', QUESTIONS.every((q) => typeof q.advice === 'string' && q.advice.length > 0), true)
eq('id 不重複', new Set(QUESTIONS.map((q) => q.id)).size, QUESTIONS.length)

// --- 全部否 → 無風險 ---
const none = assess({})
eq('空:score 0', none.score, 0)
eq('空:level 無明顯風險', none.level, '無明顯風險')
eq('空:hasCritical false', none.hasCritical, false)
eq('空:hits 0', none.hits.length, 0)
eq('maxScore 一致', none.maxScore, maxScore)

// --- 單一關鍵題 → 極高 ---
const critical = assess({ atm: true })
eq('關鍵題:level 極高', critical.level, '極高風險')
eq('關鍵題:hasCritical', critical.hasCritical, true)
eq('關鍵題:hit 1', critical.hits.length, 1)
eq('關鍵題:hit critical', critical.hits[0].critical, true)

// --- 一個低權重非關鍵 → 低風險 ---
const oneLow = assess({ urgent: true }) // weight 2
const lowPct = Math.round((2 / maxScore) * 100)
eq('單一低權重 percent', oneLow.percent, lowPct)
eq('單一低權重 level 低', oneLow.level, '低風險')

// --- 關鍵題排在最前 ---
const mixed = assess({ urgent: true, atm: true, price: true })
eq('混合 hasCritical', mixed.hasCritical, true)
eq('混合 level 極高', mixed.level, '極高風險')
eq('混合 第一個是關鍵', mixed.hits[0].critical, true)

// --- 多個非關鍵堆到高風險 ---
// 選 price(3)+offplatform(3)+prepay(3)+weirdlink(3)+delay(3) = 15 分,非關鍵
const highCombo = assess({ price: true, offplatform: true, prepay: true, weirdlink: true, delay: true })
eq('高組合 無關鍵', highCombo.hasCritical, false)
const hcPct = Math.round((15 / maxScore) * 100)
eq('高組合 percent', highCombo.percent, hcPct)
// 15/37 ≈ 41% >= 35% → 高風險
eq('15 分達高風險門檻', highCombo.level, '高風險')

// --- 中風險:price(3)+offplatform(3) = 6 分 ≈ 16% ---
const mid = assess({ price: true, offplatform: true })
const midPct = Math.round((6 / maxScore) * 100)
eq('中組合 percent', mid.percent, midPct)
eq('中組合 level 中(>=15%)', mid.level, '中風險')

// --- summaryFor 每級都有字串 ---
for (const lv of ['無明顯風險', '低風險', '中風險', '高風險', '極高風險']) {
  eq(`summary(${lv}) 非空`, summaryFor(lv).length > 0, true)
}

// --- score 上限 = maxScore(全勾) ---
const all = {}
for (const q of QUESTIONS) all[q.id] = true
const full = assess(all)
eq('全勾 score = maxScore', full.score, maxScore)
eq('全勾 percent 100', full.percent, 100)
eq('全勾 level 極高', full.level, '極高風險')

if (fail) {
  console.error(`\n${fail} 筆失敗`)
  process.exit(1)
}
console.log('\n全部通過 ✅')
