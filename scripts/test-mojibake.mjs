/*
  亂碼修復引擎回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-mojibake.mjs
  亂碼樣本以「UTF-8 位元組被當成 latin1 解讀」程序產生(Buffer latin1),
  與真實世界此類亂碼的成因一致。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `mojibake-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/mojibake.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { reencodeToBytes, fixOnce, suspicionScore, fixMojibake } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// 產生「UTF-8 → 被當 latin1 讀」的亂碼字串(latin1: 位元組 = 碼位)
const garble = (s) => Buffer.from(s, 'utf-8').toString('latin1')

// --- 基本歐語符號 ---
check('café 亂碼還原', fixMojibake(garble('café')).fixed === 'café')
check('don’t 彎引號還原', fixMojibake(garble('don’t')).fixed === 'don’t')
check('€20 歐元符號還原', fixMojibake(garble('€20')).fixed === '€20')
check('破折號 — 還原', fixMojibake(garble('a — b')).fixed === 'a — b')

// --- 中文(最重要) ---
check('中文還原', fixMojibake(garble('中文')).fixed === '中文')
check('繁中句子還原', fixMojibake(garble('你好,世界!')).fixed === '你好,世界!')
check('中英混合還原', fixMojibake(garble('測試 test 123')).fixed === '測試 test 123')
check('emoji 還原', fixMojibake(garble('讚👍')).fixed === '讚👍')

// --- changed / rounds 旗標 ---
const r1 = fixMojibake(garble('中文'))
check('changed=true', r1.changed === true)
check('rounds>=1', r1.rounds >= 1)

// --- 純 ASCII 不應被改 ---
const rAscii = fixMojibake('Hello, world! 123')
check('純 ASCII 不變', rAscii.fixed === 'Hello, world!' + ' 123' && rAscii.changed === false)

// --- 已正確的中文不應被破壞 ---
const rOk = fixMojibake('這是正常的中文,不該被改壞。')
check('正常中文保持不變', rOk.fixed === '這是正常的中文,不該被改壞。' && rOk.changed === false)

// --- 雙重亂碼(被錯誤編碼兩次)---
const dbl = garble(garble('中文'))
const rDbl = fixMojibake(dbl)
check('雙重亂碼還原', rDbl.fixed === '中文')
check('雙重亂碼 rounds=2', rDbl.rounds === 2)

// --- reencodeToBytes ---
check('reencode 純 ASCII', reencodeToBytes('AB')[0] === 65 && reencodeToBytes('AB')[1] === 66)
check('reencode 遇正常中文回 null', reencodeToBytes('中') === null)
check('reencode 1252 特殊字(€→0x80)', reencodeToBytes('€')[0] === 0x80)

// --- fixOnce 對非此類亂碼回 null ---
check('fixOnce 正常中文回 null', fixOnce('中文') === null)
check('fixOnce 空字串回 null', fixOnce('') === null)

// --- suspicionScore ---
check('suspicion:亂碼分數高於還原後', suspicionScore(garble('中文字句')) > suspicionScore('中文字句'))
check('suspicion:正常中文為 0', suspicionScore('中文') === 0)
check('suspicion:含 U+FFFD 計入', suspicionScore('a�') === 1)

// --- 不會把已正確內容越修越糟(嫌疑分數不降則停)---
const rPunct = fixMojibake('“引號”與—破折號')
check('正常全形標點不被破壞', rPunct.changed === false)

console.log(fail === 0 ? '\n全部通過 ✅' : `\n${fail} 筆失敗 ❌`)
process.exit(fail === 0 ? 0 : 1)
