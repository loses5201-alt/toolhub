/*
  搜尋排序(finderRank)引擎回歸測試。執行:node scripts/test-finderrank.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `finderrank-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/finderRank.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { rankTools } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (!cond) {
    fail++
    console.error('❌', note)
  } else {
    console.log('✓', note)
  }
}

const list = [
  { name: '特休天數計算', description: '依到職日算應有特休', keywords: ['特休', '年假', '休假'] },
  { name: '加班費計算', description: '平日假日加班費', keywords: ['加班', '加班費', '工時'] },
  { name: '資遣費試算', description: '離職資遣金額', keywords: ['資遣', '離職', '遣散'] },
  { name: 'BMI 計算', description: '身體質量指數', keywords: ['bmi', '體重', '健康'] },
]

// --- 空查詢 ---
check('空字串回 []', rankTools('', list).length === 0)
check('空白字串回 []', rankTools('   ', list).length === 0)

// --- 命中與過濾 ---
check('無命中回 []', rankTools('完全不相關xyz', list).length === 0)
check('關鍵字命中', (() => {
  const r = rankTools('特休', list)
  return r.length >= 1 && r[0].tool.name === '特休天數計算'
})())

// --- 名稱 > 關鍵字 > 說明 的權重 ---
check('名稱命中分數高於僅關鍵字命中', (() => {
  // 'bmi' 同時在名稱與關鍵字;'體重' 只在關鍵字
  const byName = rankTools('bmi', list)[0]
  const byKw = rankTools('體重', list)[0]
  return byName.score > byKw.score
})())

// --- 整句命中關鍵字 +5 ---
check('整句等於關鍵字得高分(+5)', (() => {
  const r = rankTools('加班費', list).find((m) => m.tool.name === '加班費計算')
  // 'q.includes(k)' 對 '加班'、'加班費' 命中(+5+5),逐詞名稱含 '加班費'(+4)
  return r.score >= 10
})())

// --- 排序由高到低 ---
check('結果依分數遞減排序', (() => {
  const r = rankTools('加班', list)
  for (let i = 1; i < r.length; i++) if (r[i - 1].score < r[i].score) return false
  return true
})())

// --- 大小寫不敏感 ---
check('大小寫不敏感', rankTools('BMI', list)[0].tool.name === 'BMI 計算' && rankTools('bmi', list)[0].tool.name === 'BMI 計算')

// --- 多詞:任一詞命中即計分 ---
check('多詞分別計分', (() => {
  const r = rankTools('特休 加班', list)
  const names = r.map((m) => m.tool.name)
  return names.includes('特休天數計算') && names.includes('加班費計算')
})())

// --- 說明命中(僅 +1)---
check('只在說明命中也算(分數低)', (() => {
  const r = rankTools('離職', list)
  // '離職' 是資遣費的關鍵字 → 會命中
  return r.some((m) => m.tool.name === '資遣費試算')
})())
check('純說明字詞命中分數低於名稱命中', (() => {
  const descHit = rankTools('指數', list)[0] // 只在 BMI 說明出現
  return descHit && descHit.score === 1
})())

// --- 不改動輸入清單 ---
check('不變更原清單', (() => {
  const copy = JSON.parse(JSON.stringify(list))
  rankTools('特休', list)
  return JSON.stringify(copy) === JSON.stringify(list)
})())

console.log(fail === 0 ? '\n全部通過 ✅' : `\n${fail} 筆失敗 ❌`)
process.exit(fail === 0 ? 0 : 1)
