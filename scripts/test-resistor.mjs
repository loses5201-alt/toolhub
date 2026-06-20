/*
  電阻色環 / SMD 引擎回歸測試(node 直接跑)。
  執行:node scripts/test-resistor.mjs
  oracle(IEC 60062 標準色碼,公認範例):
   1) 棕黑紅金 = 1kΩ ±5%;黃紫紅金 = 4.7kΩ ±5%;棕黑黑棕棕 = 1kΩ ±1%(5 環)。
   2) encodeValue → decodeBands 來回一致(多組阻值)。
   3) SMD:472=4.7k、4702=47k、4R7=4.7Ω、R47=0.47Ω;formatOhms 單位。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `resistor-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/resistor.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { decodeBands, encodeValue, parseSmd, formatOhms } = await import('file://' + out)

let pass = 0
let fail = 0
function ok(name, cond) {
  if (cond) pass++
  else {
    fail++
    console.error('✗', name)
  }
}

// 1) 公認色環範例
const r1k = decodeBands(['brown', 'black', 'red', 'gold'])
ok('棕黑紅金 = 1000Ω ±5%', r1k.ohms === 1000 && r1k.tolerance === 5)
const r47k = decodeBands(['yellow', 'violet', 'red', 'gold'])
ok('黃紫紅金 = 4700Ω ±5%', r47k.ohms === 4700 && r47k.tolerance === 5)
const r5b = decodeBands(['brown', 'black', 'black', 'brown', 'brown'])
ok('棕黑黑棕棕(5環) = 1000Ω ±1%', r5b.ohms === 1000 && r5b.tolerance === 1)
const r220 = decodeBands(['red', 'red', 'brown', 'gold'])
ok('紅紅棕金 = 220Ω ±5%', r220.ohms === 220 && r220.tolerance === 5)
const r1M = decodeBands(['brown', 'black', 'green', 'gold'])
ok('棕黑綠金 = 1MΩ', r1M.ohms === 1_000_000)
const r4r7 = decodeBands(['yellow', 'violet', 'gold', 'gold'])
ok('黃紫金金 = 4.7Ω ±5%', Math.abs(r4r7.ohms - 4.7) < 1e-9)
// 6 環溫度係數
const r6 = decodeBands(['brown', 'black', 'black', 'brown', 'brown', 'red'])
ok('6 環溫度係數 red = 50 ppm/K', r6.ohms === 1000 && r6.tempco === 50)

// 錯誤情況
ok('3 環報錯', 'error' in decodeBands(['brown', 'black', 'red']))
ok('未知色報錯', 'error' in decodeBands(['pink', 'black', 'red', 'gold']))
ok('數字環是金色報錯', 'error' in decodeBands(['gold', 'black', 'red', 'gold']))

// 2) encode → decode 來回
function roundtrip(ohms, bands, tol) {
  const enc = encodeValue(ohms, bands, tol)
  if ('error' in enc) return false
  const dec = decodeBands(enc)
  if ('error' in dec) return false
  return Math.abs(dec.ohms - ohms) < ohms * 1e-9 + 1e-9 && dec.tolerance === tol
}
for (const ohms of [10, 47, 100, 220, 330, 1000, 4700, 10000, 47000, 100000, 1_000_000, 2_200_000]) {
  ok(`encode→decode 4 環 ${ohms}Ω`, roundtrip(ohms, 4, 5))
}
for (const ohms of [100, 105, 470, 4700, 49900, 332000]) {
  ok(`encode→decode 5 環 ${ohms}Ω`, roundtrip(ohms, 5, 1))
}
// encode 已知:4700 4環 ±5% = 黃紫紅金
const enc47 = encodeValue(4700, 4, 5)
ok('encode 4700 4環 = 黃紫紅金', JSON.stringify(enc47) === JSON.stringify(['yellow', 'violet', 'red', 'gold']))
// 無法精確表示
ok('encode 12345 4 環(2位)報錯或最接近', 'error' in encodeValue(12345, 4, 5))
ok('encode 0 報錯', 'error' in encodeValue(0, 4, 5))

// 3) SMD
ok('SMD 472 = 4700', parseSmd('472') === 4700)
ok('SMD 103 = 10000', parseSmd('103') === 10000)
ok('SMD 4702 = 47000', parseSmd('4702') === 47000)
ok('SMD 4R7 = 4.7', Math.abs(parseSmd('4R7') - 4.7) < 1e-9)
ok('SMD R47 = 0.47', Math.abs(parseSmd('R47') - 0.47) < 1e-9)
ok('SMD 100 = 10', parseSmd('100') === 10)
ok('SMD 亂碼 null', parseSmd('XYZ') === null)

// formatOhms
ok('format 1000 = 1 kΩ', formatOhms(1000) === '1 kΩ')
ok('format 4700 = 4.7 kΩ', formatOhms(4700) === '4.7 kΩ')
ok('format 1e6 = 1 MΩ', formatOhms(1_000_000) === '1 MΩ')
ok('format 220 = 220 Ω', formatOhms(220) === '220 Ω')
ok('format 4.7 = 4.7 Ω', formatOhms(4.7) === '4.7 Ω')

console.log(`\n電阻:${pass} 通過,${fail} 失敗`)
if (fail) process.exit(1)
