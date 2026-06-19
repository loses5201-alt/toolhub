/*
  羅馬數字轉換引擎回歸測試(node 直接跑)。
  執行:node scripts/test-roman.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `roman-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/roman.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { toRoman, fromRoman, ROMAN_MIN, ROMAN_MAX } = await import('file://' + out)

let fail = 0
let pass = 0
function eq(a, b, msg) {
  if (a === b) pass++
  else {
    fail++
    console.error(`✗ FAIL: ${msg} — got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`)
  }
}
function ok(c, msg) {
  if (c) pass++
  else {
    fail++
    console.error('✗ FAIL:', msg)
  }
}

// 已知對照
const known = [
  [1, 'I'],
  [3, 'III'],
  [4, 'IV'],
  [9, 'IX'],
  [14, 'XIV'],
  [40, 'XL'],
  [49, 'XLIX'],
  [90, 'XC'],
  [400, 'CD'],
  [500, 'D'],
  [900, 'CM'],
  [944, 'CMXLIV'],
  [1000, 'M'],
  [1994, 'MCMXCIV'],
  [2024, 'MMXXIV'],
  [3549, 'MMMDXLIX'],
  [3888, 'MMMDCCCLXXXVIII'],
  [3999, 'MMMCMXCIX'],
]
for (const [n, r] of known) {
  const t = toRoman(n)
  ok(t.ok, `toRoman ${n} ok`)
  eq(t.value, r, `toRoman ${n} -> ${r}`)
  const f = fromRoman(r)
  ok(f.ok, `fromRoman ${r} ok`)
  eq(f.value, n, `fromRoman ${r} -> ${n}`)
}

// 範圍檢查
ok(!toRoman(0).ok, 'toRoman 0 invalid')
ok(!toRoman(4000).ok, 'toRoman 4000 invalid')
ok(!toRoman(-5).ok, 'toRoman negative invalid')
ok(!toRoman(3.5).ok, 'toRoman non-integer invalid')
ok(toRoman(ROMAN_MIN).ok && toRoman(ROMAN_MAX).ok, 'boundaries ok')

// 嚴格驗證:拒絕非規範寫法
ok(!fromRoman('IIII').ok, 'reject IIII')
ok(!fromRoman('VV').ok, 'reject VV')
ok(!fromRoman('IC').ok, 'reject IC')
ok(!fromRoman('IL').ok, 'reject IL')
ok(!fromRoman('MMMM').ok, 'reject MMMM (>3999)')
ok(!fromRoman('XM').ok, 'reject XM')
ok(!fromRoman('').ok, 'reject empty')
ok(!fromRoman('ABC').ok, 'reject invalid letters')
ok(!fromRoman('VX').ok, 'reject VX')

// 大小寫與空白容忍
{
  const f = fromRoman(' mcmxciv ')
  ok(f.ok, 'lowercase + spaces ok')
  eq(f.value, 1994, 'lowercase parse')
}

// 全範圍往返一致(1..3999)
let roundtripFail = 0
for (let n = ROMAN_MIN; n <= ROMAN_MAX; n++) {
  const r = toRoman(n)
  if (!r.ok) {
    roundtripFail++
    continue
  }
  const f = fromRoman(r.value)
  if (!f.ok || f.value !== n) roundtripFail++
}
eq(roundtripFail, 0, 'full-range 1..3999 roundtrip consistent')

console.log(`\nroman: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
