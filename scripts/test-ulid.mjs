/*
  ULID 解析引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-ulid.mjs
  oracle 以 ULID 規範的經典範例 01ARZ3NDEKTSV4RRFFQ69G5FAV 與 Crockford Base32 定義為準。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `ulid-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/ulid.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { ALPHABET, normalizeUlid, decodeTime, encodeTime, parseUlid } = await import(
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

// ── 字母表 / 正規化 ──
eq('字母表 32 字元', ALPHABET.length, 32)
eq('字母表排除 ILOU', /[ILOU]/.test(ALPHABET), false)
eq('normalize 去空白大寫', normalizeUlid('  01arz3ndek  '), '01ARZ3NDEK')

// ── 時間編解碼 round-trip ──
const EX = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const EX_TS = 1469922850259
eq('decodeTime 經典範例', decodeTime('01ARZ3NDEK'), EX_TS)
eq('encodeTime round-trip', encodeTime(EX_TS), '01ARZ3NDEK')
eq('decodeTime 全零', decodeTime('0000000000'), 0)
eq('encodeTime 0', encodeTime(0), '0000000000')
eq('encode/decode 任意值', decodeTime(encodeTime(1700000000000)), 1700000000000)

// ── 解析 ──
const p = parseUlid(EX)
eq('解析有效', p.valid, true)
eq('解析時間戳', p.timestampMs, EX_TS)
eq('解析 ISO', p.iso, '2016-07-30T23:54:10.259Z')
eq('解析亂數欄位', p.randomness, 'TSV4RRFFQ69G5FAV')
eq('解析小寫', parseUlid(EX.toLowerCase()).valid, true)
eq('全零 ULID 有效', parseUlid('00000000000000000000000000').valid, true)
eq('全零 ULID 時間 0', parseUlid('00000000000000000000000000').timestampMs, 0)
eq('最大時間 ULID 有效', parseUlid('7ZZZZZZZZZZZZZZZZZZZZZZZZZ').valid, true)

// Crockford 寬容:I/L→1, O→0
eq('寬容 O→0', parseUlid('O1ARZ3NDEKTSV4RRFFQ69G5FAV').valid, true)

// ── 無效 ──
eq('太短', parseUlid('01ARZ3NDEK').valid, false)
eq('太長', parseUlid(EX + 'A').valid, false)
eq('含 U 非法', parseUlid('01ARZ3NDEKTSV4RRFFQ69G5FAU').valid, false)
eq('第一碼溢位 8', parseUlid('81ARZ3NDEKTSV4RRFFQ69G5FAV').valid, false)
eq('第一碼溢位 Z', parseUlid('Z1ARZ3NDEKTSV4RRFFQ69G5FAV').valid, false)
eq('空字串', parseUlid('').valid, false)

if (fail) {
  console.error(`\n${fail} 個測試失敗`)
  process.exit(1)
}
console.log('\n全部 ULID 測試通過')
