/*
  文字個資遮蔽引擎的回歸測試(無需測試框架,node 直接跑)。
  用 esbuild 即時把 TS 轉成 ESM 再 import,斷言偵測/檢查碼/Luhn/遮蔽結果。
  執行:node scripts/test-piimask.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `piimask-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/piiMask.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { maskPii, isValidTwId, isValidLuhn } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

const allOn = { kinds: { id: true, mobile: true, creditcard: true, email: true }, keepTail: false }

// 檢查碼 / Luhn 基礎
check('A123456789 為有效身分證', isValidTwId('A123456789'))
check('A123456788 檢查碼錯誤', !isValidTwId('A123456788'))
check('4111111111111111 通過 Luhn', isValidLuhn('4111111111111111'))
check('4111111111111112 不通過 Luhn', !isValidLuhn('4111111111111112'))

// 全遮蔽:身分證、手機、Email
const r1 = maskPii('我的身分證 A123456789,手機 0912-345-678,信箱 wang@mail.com', allOn)
check('身分證被遮(原文消失)', !r1.text.includes('A123456789'))
check('手機數字被遮', !/0912/.test(r1.text) || !r1.text.includes('345'))
check('Email 帳號被遮', !r1.text.includes('wang@mail.com'))
check('身分證計數=1', r1.counts.id === 1)
check('手機計數=1', r1.counts.mobile === 1)
check('Email 計數=1', r1.counts.email === 1)
check('分隔符與其他文字保留', r1.text.includes('我的身分證') && r1.text.includes('手機'))

// 信用卡(Luhn 通過)被遮、計數
const r2 = maskPii('卡號 4111 1111 1111 1111 請保密', allOn)
check('有效信用卡被遮', !r2.text.includes('4111'))
check('信用卡計數=1', r2.counts.creditcard === 1)

// 無效資料不遮蔽(避免誤判)
const r3 = maskPii('訂單編號 123456,假號 A123456788,亂碼卡 1234 5678 9012 3456', allOn)
check('一般訂單編號不被遮', r3.text.includes('123456'))
check('檢查碼錯的身分證不被遮', r3.text.includes('A123456788'))
check('非 Luhn 的卡號不被遮', r3.text.includes('1234 5678 9012 3456'))
check('無有效個資時計數全為 0', r3.counts.id === 0 && r3.counts.creditcard === 0)

// 保留末 4 碼
const r4 = maskPii('手機 0912345678', { ...allOn, keepTail: true })
check('保留末 4 碼:結尾為 5678', r4.text.endsWith('5678'))
check('保留末 4 碼:仍有被遮的 ●', r4.text.includes('●'))

// 關閉某類別則不遮
const r5 = maskPii('A123456789', { kinds: { id: false, mobile: true, creditcard: true, email: true }, keepTail: false })
check('關閉身分證類別後不遮', r5.text === 'A123456789' && r5.counts.id === 0)

console.log(fail === 0 ? '\n全部通過 ✅' : `\n${fail} 項失敗 ❌`)
process.exit(fail === 0 ? 0 : 1)
