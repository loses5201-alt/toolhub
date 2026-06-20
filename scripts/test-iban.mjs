/*
  IBAN 驗證引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-iban.mjs
  oracle 取自 ISO 13616 / SWIFT IBAN registry 的官方範例。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `iban-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/iban.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { normalizeIban, mod97, validateIban, formatIban, computeCheckDigits } = await import(
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

// ── 正規化 / 格式化 ──
eq('normalize 去空白大寫', normalizeIban('gb82 west 1234 5698 7654 32'), 'GB82WEST12345698765432')
eq('format 每4碼一組', formatIban('GB82WEST12345698765432'), 'GB82 WEST 1234 5698 7654 32')

// ── mod97 ──
eq('mod97 有效 IBAN 餘 1', mod97('WEST12345698765432GB82'), 1)

// ── 官方有效範例(SWIFT IBAN registry)──
const VALID = [
  'GB82 WEST 1234 5698 7654 32',
  'DE89 3704 0044 0532 0130 00',
  'FR14 2004 1010 0505 0001 3M02 606',
  'NL91 ABNA 0417 1643 00',
  'CH93 0076 2011 6238 5295 7',
  'BE68 5390 0754 7034',
  'ES91 2100 0418 4502 0005 1332',
  'IT60 X054 2811 1010 0000 0123 456',
  'SA03 8000 0000 6080 1016 7519',
  'NO93 8601 1117 947',
  'TR33 0006 1005 1978 6457 8413 26',
]
for (const v of VALID) eq(`有效 ${v.slice(0, 7)}…`, validateIban(v).valid, true)

// ── 各欄位拆解 ──
const gb = validateIban('GB82 WEST 1234 5698 7654 32')
eq('GB 國別', gb.country, 'GB')
eq('GB 檢查碼', gb.checkDigits, '82')
eq('GB BBAN', gb.bban, 'WEST12345698765432')
eq('GB 國名', gb.countryName, '英國')
eq('GB 預期長度', gb.expectedLength, 22)

// ── 無效情形 ──
eq('改一碼校驗失敗', validateIban('GB82 WEST 1234 5698 7654 33').valid, false)
eq('長度不符', validateIban('DE89 3704 0044 0532 0130').valid, false)
eq('未知國別', validateIban('ZZ00 1234').valid, false)
eq('檢查碼非數字', validateIban('GBAA WEST12345698765432').valid, false)
eq('太短', validateIban('GB').valid, false)
eq('含非法字元', validateIban('GB82 WEST 1234 5698 7654 3@').valid, false)
eq('錯誤訊息含 mod', validateIban('GB82 WEST 1234 5698 7654 33').errors.some((e) => e.includes('mod-97')), true)

// ── 反算檢查碼 ──
eq('computeCheckDigits GB', computeCheckDigits('GB00WEST12345698765432'), '82')
eq('computeCheckDigits DE', computeCheckDigits('DE00370400440532013000'), '89')
eq('computeCheckDigits 非法', computeCheckDigits('12WEST'), null)

if (fail) {
  console.error(`\n${fail} 個測試失敗`)
  process.exit(1)
}
console.log('\n全部 IBAN 測試通過')
