/*
  電子發票左方 QR 解析引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-einvoiceqr.mjs
  oracle:依財政部電子發票二維條碼規格手構固定 77 字欄位 + 十六進位金額 / 民國日期手算。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `einv-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/einvoiceQr.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { parseEinvoiceQr, parseRocDate, encodingLabel } = await import('file://' + out)

let fail = 0
function eq(note, got, want) {
  if (got === want) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}\n   got : ${JSON.stringify(got)}\n   want: ${JSON.stringify(want)}`)
  }
}

// --- parseRocDate ---
eq('民國日期 → 西元', parseRocDate('1130520').ad, '2024-05-20')
eq('民國日期 roc 文字', parseRocDate('1130520').roc, '民國 113/05/20')
eq('非法日期 null', parseRocDate('1131320'), null)
eq('長度錯 null', parseRocDate('11305'), null)

// --- encodingLabel ---
eq('編碼 0 Big5', encodingLabel('0'), 'Big5')
eq('編碼 1 UTF-8', encodingLabel('1'), 'UTF-8')
eq('編碼 2 Base64', encodingLabel('2'), 'Base64')

// --- 構造一張發票左方 QR(77 字固定 + 冒號尾段)---
// 字軌 AB12345678 | 日期 1130520 | 隨機 1234 | 銷售額 hex 000003E8=1000 | 總計 hex 0000041A=1050
// 買方 00000000(個人) | 賣方 12345675 | 加密 24 字
const header =
  'AB12345678' + '1130520' + '1234' + '000003E8' + '0000041A' + '00000000' + '12345675' + 'ABCDEFGHIJKLMNOPQRSTUVWX'
eq('header 長度 77', header.length, 77)
const tail = ':自定:2:3:1:商品A:1:1000'
const r = parseEinvoiceQr(header + tail)

eq('ok', r.ok, true)
eq('發票號碼格式化', r.invoiceNumber, 'AB-12345678')
eq('發票號碼原始', r.invoiceNumberRaw, 'AB12345678')
eq('日期西元', r.dateAd, '2024-05-20')
eq('隨機碼', r.randomCode, '1234')
eq('銷售額 hex→dec', r.amountSalesUntaxed, 1000)
eq('總計額 hex→dec', r.amountTotal, 1050)
eq('買方統編個人→空', r.buyerVat, '')
eq('賣方統編', r.sellerVat, '12345675')
eq('加密 24 字', r.encrypted.length, 24)
eq('品目筆數', r.itemCountInQr, 2)
eq('品目總筆數', r.itemCountTotal, 3)
eq('編碼參數', r.encodingParam, '1')

// --- 買方統編非個人 ---
const header2 =
  'XY00000001' + '1120101' + '9999' + '00000064' + '00000064' + '53212539' + '12345675' + 'ABCDEFGHIJKLMNOPQRSTUVWX'
const r2 = parseEinvoiceQr(header2)
eq('買方統編保留', r2.buyerVat, '53212539')
eq('銷售額 100', r2.amountSalesUntaxed, 100)
eq('日期 112→2023', r2.dateAd, '2023-01-01')

// --- 錯誤情況 ---
eq('空輸入', parseEinvoiceQr('').ok, false)
eq('右方條碼提示', parseEinvoiceQr('**ABCDEF').error.includes('右方'), true)
eq('長度不足', parseEinvoiceQr('AB123').ok, false)
eq('字軌格式錯', parseEinvoiceQr('1234567890' + '1130520' + '1234' + '000003E8' + '0000041A' + '00000000' + '12345675' + 'ABCDEFGHIJKLMNOPQRSTUVWX').ok, false)

// --- 無 tail 也可解析 ---
eq('無 tail ok', parseEinvoiceQr(header).ok, true)
eq('無 tail itemCount undefined', parseEinvoiceQr(header).itemCountInQr, undefined)

// --- 前後空白容忍 ---
eq('去空白', parseEinvoiceQr('  ' + header + '  ').ok, true)

if (fail) {
  console.error(`\n${fail} 筆失敗`)
  process.exit(1)
}
console.log('\n全部通過 ✅')
