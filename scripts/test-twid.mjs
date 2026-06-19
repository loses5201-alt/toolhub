/*
  身分證字號(twId)引擎回歸測試。執行:node scripts/test-twid.mjs
  有效樣本的檢查碼為「人工依規則獨立算出」,而非用引擎反推,才能真正驗證引擎正確。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `twid-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/twId.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { isValidTwId, LETTER, REGION } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (!cond) {
    fail++
    console.error('❌', note)
  } else {
    console.log('✓', note)
  }
}

// --- 獨立算出的有效樣本 ---
// A123456789:A=10 → 1*1+0*9=1;1..9 加權 8..1,1 = 129;合 130 可被 10 整除
check('A123456789 有效(經典範例)', isValidTwId('A123456789'))
// B200000004:B=11 → 1+9=10;2*8 + 末碼4 = 20;合 30
check('B200000004 有效(一般字母)', isValidTwId('B200000004'))
// I100000003:I=34(特殊跳號)→ 3+36=39;1*8 + 末碼3 = 11;合 50
check('I100000003 有效(特殊字母 I=34)', isValidTwId('I100000003'))
// O100000004:O=35(特殊跳號)→ 3+45=48;1*8 + 末碼4 = 12;合 60
check('O100000004 有效(特殊字母 O=35)', isValidTwId('O100000004'))

// --- 改末碼即無效 ---
check('A123456780 無效(錯檢查碼)', !isValidTwId('A123456780'))
check('I100000004 無效(錯檢查碼)', !isValidTwId('I100000004'))

// --- 格式錯誤 ---
check('小寫字母無效', !isValidTwId('a123456789'))
check('長度不足無效', !isValidTwId('A12345678'))
check('長度過長無效', !isValidTwId('A1234567890'))
check('無字母開頭無效', !isValidTwId('1123456789'))
check('含非數字無效', !isValidTwId('A12345678X'))
check('空字串無效', !isValidTwId(''))

// --- 性別碼必須 1 或 2 ---
check('性別碼 0 無效', !isValidTwId('A023456789'))
check('性別碼 3 無效', !isValidTwId('A323456789'))

// --- 對每個前 9 碼,0~9 恰有一個檢查碼有效 ---
check('每前綴恰一個有效檢查碼(A12345678?)', (() => {
  let n = 0
  for (let d = 0; d <= 9; d++) if (isValidTwId('A12345678' + d)) n++
  return n === 1
})())
check('每前綴恰一個有效檢查碼(F13110409?)', (() => {
  let n = 0
  for (let d = 0; d <= 9; d++) if (isValidTwId('F13110409' + d)) n++
  return n === 1
})())

// --- 對照表 ---
check('LETTER 共 26 個字母', Object.keys(LETTER).length === 26)
check('特殊跳號 I=34 O=35 W=32 X=30 Z=33', LETTER.I === 34 && LETTER.O === 35 && LETTER.W === 32 && LETTER.X === 30 && LETTER.Z === 33)
check('常規 A=10 B=11', LETTER.A === 10 && LETTER.B === 11)
check('REGION 共 26 個、A=臺北市', Object.keys(REGION).length === 26 && REGION.A === '臺北市')

console.log(fail === 0 ? '\n全部通過 ✅' : `\n${fail} 筆失敗 ❌`)
process.exit(fail === 0 ? 0 : 1)
