/*
  條碼引擎回歸測試(無需測試框架,node 直接跑)。
  用 esbuild 即時把 TS 轉成 ESM 再 import,斷言 GTIN 檢查碼與各格式驗證/正規化。
  執行:node scripts/test-barcode.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `barcode-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/barcode.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { gtinCheckDigit, validateBarcode } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// --- GTIN 檢查碼(以已知真實條碼核算)---
check('EAN-13 978030640615 → 7', gtinCheckDigit('978030640615') === 7)
check('EAN-13 400638133393 → 1', gtinCheckDigit('400638133393') === 1)
check('EAN-8  9638507 → 4', gtinCheckDigit('9638507') === 4)
check('UPC-A  03600029145 → 2', gtinCheckDigit('03600029145') === 2)
check('ITF-14 0001234567890 → 5', gtinCheckDigit('0001234567890') === 5)
check('全 0 本體檢查碼為 0', gtinCheckDigit('000000000000') === 0)

// --- EAN13:補檢查碼 / 驗證 / 長度錯誤 ---
let r = validateBarcode('EAN13', '978030640615')
check('EAN13 給 12 碼 → 自動補檢查碼', r.ok && r.value === '9780306406157' && r.autoCheck === true)
r = validateBarcode('EAN13', '9780306406157')
check('EAN13 給正確 13 碼 → 通過', r.ok && r.value === '9780306406157' && !r.autoCheck)
r = validateBarcode('EAN13', '9780306406158')
check('EAN13 檢查碼錯 → 失敗且提示正確碼', !r.ok && /應為 7/.test(r.message))
r = validateBarcode('EAN13', '12345')
check('EAN13 長度錯 → 失敗', !r.ok)
r = validateBarcode('EAN13', '97803064061a')
check('EAN13 含非數字 → 失敗', !r.ok && /數字/.test(r.message))

// --- EAN8 / UPC / ITF14 ---
r = validateBarcode('EAN8', '9638507')
check('EAN8 給 7 碼 → 補 4', r.ok && r.value === '96385074')
r = validateBarcode('UPC', '03600029145')
check('UPC 給 11 碼 → 補 2', r.ok && r.value === '036000291452')
r = validateBarcode('ITF14', '0001234567890')
check('ITF14 給 13 碼 → 補 5', r.ok && r.value === '00012345678905')
r = validateBarcode('ITF14', '00012345678905')
check('ITF14 給正確 14 碼 → 通過', r.ok && !r.autoCheck)

// --- CODE128 ---
r = validateBarcode('CODE128', 'ABC-123/xyz')
check('CODE128 ASCII → 通過', r.ok && r.value === 'ABC-123/xyz')
r = validateBarcode('CODE128', '產品A')
check('CODE128 含中文 → 失敗', !r.ok && /中文/.test(r.message))

// --- CODE39 ---
r = validateBarcode('CODE39', 'abc-12')
check('CODE39 小寫 → 自動轉大寫並提示', r.ok && r.value === 'ABC-12' && /大寫/.test(r.message))
r = validateBarcode('CODE39', 'ABC 12$')
check('CODE39 合法符號 → 通過', r.ok && r.value === 'ABC 12$')
r = validateBarcode('CODE39', 'ABC@12')
check('CODE39 非法符號 → 失敗', !r.ok)

// --- 共通:空輸入 ---
r = validateBarcode('CODE128', '   ')
check('空白輸入 → 失敗並提示', !r.ok && /請先輸入/.test(r.message))

if (fail) {
  console.error(`\n${fail} 項失敗`)
  process.exit(1)
}
console.log('\n條碼引擎全部通過')
