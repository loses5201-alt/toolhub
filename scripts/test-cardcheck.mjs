/*
  卡號檢核引擎回歸測試(node 直接跑,esbuild 即時轉 TS)。
  測試卡號皆為各發卡組織公開的「測試卡號」,非真實帳戶。
  執行:node scripts/test-cardcheck.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `cardcheck-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/cardCheck.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { luhnValid, detectBrand, formatCardNumber, checkCard } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// --- Luhn ---
check('Luhn 通過 4111111111111111', luhnValid('4111111111111111'))
check('Luhn 通過 79927398713', luhnValid('79927398713'))
check('Luhn 失敗 4111111111111112', !luhnValid('4111111111111112'))
check('Luhn 失敗 79927398714', !luhnValid('79927398714'))
check('Luhn 非數字回 false', !luhnValid('4111a'))

// --- detectBrand(公開測試卡號開頭)---
check('Visa 4xxx', detectBrand('4111111111111111') === 'Visa')
check('Mastercard 51-55', detectBrand('5555555555554444') === 'Mastercard')
check('Mastercard 2221-2720 新號段', detectBrand('2223000048410010') === 'Mastercard')
check('AmEx 34/37', detectBrand('378282246310005') === 'American Express')
check('JCB 3528-3589', detectBrand('3530111333300000') === 'JCB')
check('UnionPay 62', detectBrand('6200000000000005') === 'UnionPay')
check('Discover 6011', detectBrand('6011111111111117') === 'Discover')
check('Diners 36', detectBrand('36227206271667') === 'Diners Club')
check('未知 9xxx → Unknown', detectBrand('9999999999999999') === 'Unknown')
// 邊界:Mastercard 上界 2720、超界 2721 不應判為 MC
check('2720 屬 Mastercard', detectBrand('2720000000000000') === 'Mastercard')
check('2721 非 Mastercard', detectBrand('2721000000000000') !== 'Mastercard')

// --- formatCardNumber ---
check('Visa 4-4-4-4 分組', formatCardNumber('4111111111111111', 'Visa') === '4111 1111 1111 1111')
check('AmEx 4-6-5 分組', formatCardNumber('378282246310005', 'American Express') === '3782 822463 10005')

// --- checkCard 整合 ---
let r = checkCard('4111 1111 1111 1111')
check('整合:Visa 測試卡號去空白後 ok', r.ok && r.brand === 'Visa' && r.luhn && r.lengthOk)
r = checkCard('4111-1111-1111-1111')
check('整合:連字號也可', r.ok && r.digits === '4111111111111111')
r = checkCard('4111111111111112')
check('整合:Luhn 錯 → 不 ok 且提示打錯', !r.ok && /打錯/.test(r.message))
r = checkCard('411111111111') // 12 碼,Visa 應 13/16/19
check('整合:Visa 長度不符 → 提示長度', !r.ok && /長度不符/.test(r.message))
r = checkCard('378282246310005')
check('整合:AmEx 15 碼測試卡號 ok', r.ok && r.brand === 'American Express')
r = checkCard('')
check('整合:空輸入 → 提示輸入卡號', !r.ok && /請輸入/.test(r.message))
r = checkCard('4111 1111 1111 abcd')
check('整合:含字母 → 提示只能數字', !r.ok && /只能/.test(r.message))

if (fail) {
  console.error(`\n${fail} 項失敗`)
  process.exit(1)
}
console.log('\n卡號檢核引擎全部通過')
