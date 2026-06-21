/*
  拼讀 / 電話報號引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-phonetic.mjs
  oracle:ICAO/NATO 拼讀字母表與台灣電話報號口語(0洞1么7拐9勾),逐項比對。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `phonetic-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/phonetic.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { spell, spellLine, unspell, NATO, DIGIT_TW } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else { fail++; console.error(`✗ ${note}`) }
}

// --- NATO 表 ---
check('NATO A=Alpha', NATO.A === 'Alpha')
check('NATO Z=Zulu', NATO.Z === 'Zulu')
check('NATO 共 26 字母', Object.keys(NATO).length === 26)

// --- spell 字母 ---
const a = spell('Ab')
check('spell 大寫字母', a[0].label === 'Alpha' && a[0].note === '大寫')
check('spell 小寫字母', a[1].label === 'Bravo' && a[1].note === '小寫')
check('spell kind letter', a[0].kind === 'letter')

// --- spell 數字(英文 / 台灣)---
check('spell 數字英文', spell('07', 'nato').map((s) => s.label).join(' ') === 'Zero Seven')
check('spell 數字台灣口語', spell('079', 'tw').map((s) => s.label).join(' ') === '洞 拐 勾')
check('DIGIT_TW 么', DIGIT_TW['1'] === '么')
check('spell kind digit', spell('5')[0].kind === 'digit')

// --- 標點 ---
check('spell 連字號→槓', spell('-')[0].label === '槓')
check('spell at→小老U', spell('@')[0].label === '小老鼠')
check('spell 空格', spell(' ')[0].label === '(空格)' && spell(' ')[0].kind === 'punct')

// --- spellLine ---
check('spellLine 混合', spellLine('A1', 'nato') === 'Alpha One')
check('spellLine 台灣', spellLine('A1', 'tw') === 'Alpha 么')

// --- unspell 反向 ---
check('unspell NATO', unspell('Alpha Bravo Charlie') === 'ABC')
check('unspell 含 X-ray(去連字號)', unspell('X-ray Yankee') === 'XY')
check('unspell 大小寫不敏感', unspell('alpha BRAVO') === 'AB')
check('unspell 英文數字', unspell('Zero Seven') === '07')
check('unspell 台灣數字', unspell('洞 拐 勾') === '079')
check('unspell 逗號分隔', unspell('Alpha,Bravo') === 'AB')
check('unspell 純數字保留', unspell('5 6') === '56')
check('unspell 無法辨識→?', unspell('Alpha foobar') === 'A?')
check('unspell 單一字母直接收', unspell('A B') === 'AB')

// --- 往返一致 ---
check('spellLine→unspell 往返', unspell(spellLine('ABC123', 'nato')) === 'ABC123')

if (fail) { console.error(`\n${fail} 項測試失敗`); process.exit(1) }
else console.log('\n所有拼讀 / 電話報號測試通過')
