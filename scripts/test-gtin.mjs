/*
  GTIN / 商品條碼檢查碼引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-gtin.mjs
  oracle:GS1 標準 mod-10 演算法與已知有效條碼:
    EAN-13 4006381333931、UPC-A 036000291452、EAN-8 96385074、GTIN-14 10614141000415。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `gtin-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/gtin.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { digitsOnly, computeCheckDigit, validateGtin, completeGtin, lookupPrefix } = await import(
  'file://' + out
)

let fail = 0
function eq(note, got, want) {
  const g = JSON.stringify(got)
  const w = JSON.stringify(want)
  if (g === w) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}\n   got : ${g}\n   want: ${w}`)
  }
}

// ── digitsOnly ──
eq('去非數字', digitsOnly('4-006 381,333931'), '4006381333931')
eq('空輸入', digitsOnly(''), '')

// ── computeCheckDigit(以已知有效碼的前置部分為 oracle)──
eq('EAN-13 檢查碼', computeCheckDigit('400638133393'), 1)
eq('UPC-A 檢查碼', computeCheckDigit('03600029145'), 2)
eq('EAN-8 檢查碼', computeCheckDigit('9638507'), 4)
eq('GTIN-14 檢查碼', computeCheckDigit('1061414100041'), 5)
eq('全零檢查碼為 0', computeCheckDigit('0000000'), 0)

// ── validateGtin:有效 ──
{
  const r = validateGtin('4006381333931')
  eq('EAN-13 有效', r.valid, true)
  eq('EAN-13 類型', r.type, 'EAN-13')
  eq('EAN-13 dataPart', r.dataPart, '400638133393')
  eq('EAN-13 expected', r.expectedCheck, 1)
}
eq('UPC-A 有效', validateGtin('036000291452').valid, true)
eq('UPC-A 類型', validateGtin('036000291452').type, 'UPC-A')
eq('EAN-8 有效', validateGtin('96385074').valid, true)
eq('EAN-8 類型', validateGtin('96385074').type, 'EAN-8')
eq('GTIN-14 有效', validateGtin('10614141000415').valid, true)
eq('GTIN-14 類型', validateGtin('10614141000415').type, 'GTIN-14')
eq('含連字號仍有效', validateGtin('4-006381-333931').valid, true)

// ── validateGtin:無效 ──
{
  const r = validateGtin('4006381333930') // 改最後一碼
  eq('檢查碼錯誤無效', r.valid, false)
  eq('回報期望檢查碼', r.expectedCheck, 1)
  eq('回報輸入檢查碼', r.givenCheck, 0)
}
{
  const r = validateGtin('123456789') // 9 碼
  eq('長度不符無效', r.valid, false)
  eq('長度不符 type=null', r.type, null)
}
eq('空輸入無效', validateGtin('').valid, false)

// ── completeGtin ──
{
  const r = completeGtin('400638133393') // 12 碼前置 → EAN-13
  eq('補檢查碼 full', r.full, '4006381333931')
  eq('補檢查碼 check', r.check, 1)
  eq('補檢查碼無錯誤', r.error, '')
}
eq('UPC-A 前置補碼', completeGtin('03600029145').full, '036000291452')
eq('EAN-8 前置補碼', completeGtin('9638507').full, '96385074')
{
  const r = completeGtin('123') // 長度不符
  eq('前置長度不符報錯', r.full, '')
  eq('前置長度不符 error 非空', r.error.length > 0, true)
}

// round-trip:補碼後再驗證應為有效
for (const p of ['400638133393', '03600029145', '9638507', '1061414100041']) {
  const full = completeGtin(p).full
  eq(`補碼→驗證有效 ${p}`, validateGtin(full).valid, true)
}

// ── lookupPrefix ──
eq('471 = 臺灣', lookupPrefix('4710088012345')?.label, '臺灣')
eq('690 = 中國大陸', lookupPrefix('690')?.label, '中國大陸')
eq('978 = 書籍 ISBN', lookupPrefix('9789861234567')?.label, '書籍(ISBN / Bookland)')
eq('00 = 美加 UPC', lookupPrefix('003600029145')?.label, '美國、加拿大(UPC)')
eq('471 code 取前三碼', lookupPrefix('4710088012345')?.code, '471')
eq('不足 3 碼回 null', lookupPrefix('47'), null)

console.log(fail === 0 ? '\n✅ 全數通過' : `\n❌ ${fail} 筆失敗`)
process.exit(fail === 0 ? 0 : 1)
