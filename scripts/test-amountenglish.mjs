/*
  金額轉英文大寫引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-amountenglish.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `amountenglish-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/amountEnglish.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { integerToEnglish, amountToEnglish } = await import('file://' + out)

let fail = 0
function eq(note, got, expect) {
  if (got === expect) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}\n    期望「${expect}」\n    實得「${got}」`)
  }
}
function throws(note, fn) {
  try {
    fn()
    fail++
    console.error(`✗ ${note}(預期丟錯但沒有)`)
  } catch {
    console.log(`✓ ${note}`)
  }
}

// --- integerToEnglish ---
eq('0', integerToEnglish(0), 'zero')
eq('5', integerToEnglish(5), 'five')
eq('13', integerToEnglish(13), 'thirteen')
eq('20', integerToEnglish(20), 'twenty')
eq('21', integerToEnglish(21), 'twenty-one')
eq('100', integerToEnglish(100), 'one hundred')
eq('105', integerToEnglish(105), 'one hundred five')
eq('234', integerToEnglish(234), 'two hundred thirty-four')
eq('999', integerToEnglish(999), 'nine hundred ninety-nine')
eq('1000', integerToEnglish(1000), 'one thousand')
eq('1234', integerToEnglish(1234), 'one thousand two hundred thirty-four')
eq('1000000', integerToEnglish(1000000), 'one million')
eq(
  '1234567',
  integerToEnglish(1234567),
  'one million two hundred thirty-four thousand five hundred sixty-seven',
)
eq('1000000000', integerToEnglish(1000000000), 'one billion')
eq('1000000000000', integerToEnglish(1000000000000), 'one trillion')
eq(
  '1234567890123',
  integerToEnglish(1234567890123),
  'one trillion two hundred thirty-four billion five hundred sixty-seven million eight hundred ninety thousand one hundred twenty-three',
)

// --- amountToEnglish (fraction 模式,預設) ---
eq('整數小數.words', amountToEnglish('1234.56').words, 'one thousand two hundred thirty-four and 56/100')
eq(
  '整數小數.cheque',
  amountToEnglish('1234.56').cheque,
  'ONE THOUSAND TWO HUNDRED THIRTY-FOUR AND 56/100 ONLY',
)
eq(
  '加幣別 USD',
  amountToEnglish('1234.56', { currency: 'USD' }).cheque,
  'USD ONE THOUSAND TWO HUNDRED THIRTY-FOUR AND 56/100 ONLY',
)
eq(
  '幣別小寫會轉大寫',
  amountToEnglish('100', { currency: 'us dollars' }).cheque,
  'US DOLLARS ONE HUNDRED AND 00/100 ONLY',
)
eq('整數無小數.words', amountToEnglish('100').words, 'one hundred and 00/100')
eq('hasCents=false', amountToEnglish('100').hasCents, false)
eq('hasCents=true', amountToEnglish('100.01').hasCents, true)

// --- words 模式(小數寫成 cents) ---
eq(
  'words 模式分.words',
  amountToEnglish('1234.56', { centsStyle: 'words' }).words,
  'one thousand two hundred thirty-four and fifty-six cents',
)
eq('words 模式單數 cent', amountToEnglish('0.01', { centsStyle: 'words' }).words, 'zero and one cent')
eq('words 模式無小數不加', amountToEnglish('100', { centsStyle: 'words' }).words, 'one hundred')
eq(
  'words 模式 cheque',
  amountToEnglish('2.05', { centsStyle: 'words', currency: 'USD' }).cheque,
  'USD TWO AND FIVE CENTS ONLY',
)

// --- 進位與輸入容錯 ---
eq('四捨五入到分', amountToEnglish('1234.567').words, 'one thousand two hundred thirty-four and 57/100')
eq('千分位逗號', amountToEnglish('1,234.56').words, 'one thousand two hundred thirty-four and 56/100')
eq('2.5 → 50/100', amountToEnglish('2.5').words, 'two and 50/100')
eq('數字型別輸入', amountToEnglish(89).words, 'eighty-nine and 00/100')
eq('零', amountToEnglish('0').words, 'zero and 00/100')

// --- 錯誤處理 ---
throws('非數字丟錯', () => amountToEnglish('abc'))
throws('負數丟錯', () => amountToEnglish('-5'))
throws('空字串丟錯', () => amountToEnglish(''))
throws('整數負數丟錯', () => integerToEnglish(-1))

if (fail) {
  console.error(`\n${fail} 筆測試失敗 ✗`)
  process.exit(1)
} else {
  console.log('\n全部測試通過 ✓')
}
