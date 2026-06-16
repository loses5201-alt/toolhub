/*
  統一編號檢核引擎的回歸測試(無需測試框架,node 直接跑)。
  用 esbuild 即時把 TS 轉成 ESM 再 import,斷言檢查碼/批次/正規化結果。
  執行:node scripts/test-vatcheck.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `vatcheck-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/vatCheck.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { isValidVat, checkVat, normalizeVat, checkVatBatch } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// --- 已知合法統編(已逐筆以演算法核算)---
check('台積電 22099131 有效', isValidVat('22099131') === true)
check('鴻海 04541302 有效', isValidVat('04541302') === true)
check('統一企業 73251209 有效', isValidVat('73251209') === true)

// --- 第 7 碼為 7 的特例(需 (sum+1)%5 規則才會通過)---
// 12345670:位元乘積數字和 = 1+4+1+8+1+(12→3)+(28→10)+0 = 28;28%5≠0,但第7碼為7且 29%5≠0… 改用實際特例號
// 以「基底 %5≠0 但第7碼=7 時 +1 後 %5==0」驗證特例分支有被觸發
check('特例分支:第7碼=7 且 (sum+1)%5==0 視為有效', (() => {
  // 找一個第7碼為7、基底sum%5==4 的號碼:00000070 → 乘積和 = 0..+ (7*4=28→10) +0 = 10,10%5==0(非特例)
  // 構造 sum%5==4:00000370 → 3*4? index6是'7',index5是'3'(*2=6→6),其餘0 → 6 + (28→10) = 16;16%5=1
  // 直接信任演算法:對所有第7碼=7的8碼,(sum)%5==0 或 (sum+1)%5==0 才有效;此處檢查一個基底+1才過的案例
  // 00000074: idx6='7'(28→10) idx7='4'(4) 其餘0 → sum=14;14%5=4;(14+1)%5=0 → 應有效
  return isValidVat('00000074') === true
})())
check('對照:00000075 第7碼=7 但 (sum)%5、(sum+1)%5 皆非0 → 無效', (() => {
  // 00000075: idx6='7'(10) idx7='5'(5) → sum=15;15%5=0 → 其實有效;換 00000076
  // 00000076: sum = 10 + 6 = 16;16%5=1;(16+1)%5=2 → 無效
  return isValidVat('00000076') === false
})())

// --- 打錯一碼應失效(台積電改一碼)---
check('22099132(末碼改錯)無效', isValidVat('22099132') === false)
check('22099141(改一碼)無效', isValidVat('22099141') === false)

// --- 格式 ---
check('長度不足 7 碼無效', isValidVat('2209913') === false)
check('長度過長 9 碼無效', isValidVat('220991310') === false)
check('含字母無效', isValidVat('2209913A') === false)

// --- normalize ---
check('全形數字正規化', normalizeVat('２２０９９１３１') === '22099131')
check('去除連字號與空白', normalizeVat(' 220-991-31 ') === '22099131')

// --- checkVat 包裝 ---
check('checkVat 有效回傳 valid=true', checkVat('22099131').valid === true)
check('checkVat 空字串 reason 提示未輸入', checkVat('   ').reason.includes('尚未輸入'))
check('checkVat 含字母 reason 提示非數字', checkVat('2209913X').reason.includes('非數字'))
check('checkVat 長度錯 reason 提示 8 碼', checkVat('123').reason.includes('8 碼'))

// --- 批次 ---
const b = checkVatBatch('22099131, 04541302\n22099131; 99999999\n2209913X')
check('批次:總筆數 5', b.total === 5)
check('批次:有效 3 筆(含重複)', b.validCount === 3)
check('批次:無效 2 筆', b.invalidCount === 2)
check('批次:重複 1 筆', b.duplicateCount === 1)
check('批次:第二個 22099131 標記為重複', b.rows[2].duplicate === true)
check('批次:99999999 無效', b.rows[3].result.valid === false)

if (fail) {
  console.error(`\n${fail} 個測試未通過`)
  process.exit(1)
} else {
  console.log('\n全部通過 ✅')
}
