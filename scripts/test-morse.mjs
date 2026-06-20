/*
  摩斯密碼轉換引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-morse.mjs
  oracle:ITU-R M.1677-1 國際摩斯電碼標準碼表與經典範例(SOS、HELLO WORLD)。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `morse-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/morse.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { MORSE_MAP, encodeMorse, decodeMorse, looksLikeMorse, morseToTones } = await import(
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

// ── 碼表正確性(ITU 標準幾個關鍵字元)──
eq('A=.-', MORSE_MAP.A, '.-')
eq('E=.', MORSE_MAP.E, '.')
eq('T=-', MORSE_MAP.T, '-')
eq('O=---', MORSE_MAP.O, '---')
eq('S=...', MORSE_MAP.S, '...')
eq('0=-----', MORSE_MAP['0'], '-----')
eq('5=.....', MORSE_MAP['5'], '.....')
eq('?=..--..', MORSE_MAP['?'], '..--..')
eq('碼表共 26 字母', Object.keys(MORSE_MAP).filter((k) => /[A-Z]/.test(k)).length, 26)
eq('碼表含 10 數字', Object.keys(MORSE_MAP).filter((k) => /[0-9]/.test(k)).length, 10)

// ── 編碼 ──
eq('SOS', encodeMorse('SOS').morse, '... --- ...')
eq('HELLO', encodeMorse('HELLO').morse, '.... . .-.. .-.. ---')
eq(
  'HELLO WORLD',
  encodeMorse('HELLO WORLD').morse,
  '.... . .-.. .-.. --- / .-- --- .-. .-.. -..',
)
eq('小寫轉大寫', encodeMorse('sos').morse, '... --- ...')
eq('數字與標點', encodeMorse('A1?').morse, '.- .---- ..--..')
eq('多重空白歸一單字', encodeMorse('A   B').morse, '.- / -...')
eq('前後空白修剪', encodeMorse('  HI  ').morse, '.... ..')

// 不支援字元回報並略過
{
  const r = encodeMorse('A€B')
  eq('略過不支援字元', r.morse, '.- -...')
  eq('回報不支援字元', r.unsupported, ['€'])
}
eq('空字串', encodeMorse('').morse, '')

// ── 解碼 ──
eq('解碼 SOS', decodeMorse('... --- ...').text, 'SOS')
eq('解碼 HELLO WORLD', decodeMorse('.... . .-.. .-.. --- / .-- --- .-. .-.. -..').text, 'HELLO WORLD')
// 以連續空白(2+)分界:HI + WELLO(W E L L O)
eq('解碼多空白當單字界', decodeMorse('.... ..   .-- . .-.. .-.. ---').text, 'HI WELLO')
eq('解碼空白分界 2', decodeMorse('.... ..   .-- .. -.').text, 'HI WIN')
eq('解碼全形點(・)', decodeMorse('・・・').text, 'S')
eq('解碼全形劃(−)', decodeMorse('−−−').text, 'O')
eq('解碼前後空白修剪', decodeMorse('   ... --- ...   ').text, 'SOS')

// 不支援碼回報
{
  const r = decodeMorse('... ........ ...')
  eq('未知碼以佔位', r.text, 'S�S')
  eq('回報未知碼', r.unsupported, ['........'])
}
eq('解碼空字串', decodeMorse('').text, '')

// ── round-trip ──
for (const s of ['HELLO WORLD', 'THE QUICK BROWN FOX', 'ABC 123', 'SOS', 'A.B,C?']) {
  const enc = encodeMorse(s).morse
  const dec = decodeMorse(enc).text
  eq(`往返一致 "${s}"`, dec, s.toUpperCase().replace(/\s+/g, ' ').trim())
}

// ── looksLikeMorse ──
eq('看起來像摩斯', looksLikeMorse('... --- ...'), true)
eq('一般文字不是摩斯', looksLikeMorse('hello'), false)
eq('空字串不是摩斯', looksLikeMorse('  '), false)
eq('含斜線仍是摩斯', looksLikeMorse('.- / -...'), true)

// ── morseToTones 時序 ──
{
  // 'E' = '.' → 單一個 1 單位的發聲
  const t = morseToTones('.')
  eq('E 時序', t, [{ on: true, units: 1 }])
}
{
  // 'A' = '.-' → 點(1) + 符內間隔(1) + 劃(3)
  const t = morseToTones('.-')
  eq('A 時序', t, [
    { on: true, units: 1 },
    { on: false, units: 1 },
    { on: true, units: 3 },
  ])
}
{
  // 'E E'(字母間隔 3):. (1) + 字母間(3) + . (1)
  const t = morseToTones('. .')
  eq('字母間隔 3 單位', t, [
    { on: true, units: 1 },
    { on: false, units: 3 },
    { on: true, units: 1 },
  ])
}
{
  // 'E / E'(單字間隔 7)
  const t = morseToTones('. / .')
  eq('單字間隔 7 單位', t, [
    { on: true, units: 1 },
    { on: false, units: 7 },
    { on: true, units: 1 },
  ])
}

console.log(fail === 0 ? '\n✅ 全數通過' : `\n❌ ${fail} 筆失敗`)
process.exit(fail === 0 ? 0 : 1)
