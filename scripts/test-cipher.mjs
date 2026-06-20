/*
  古典密碼引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-cipher.mjs
  oracle:經典範例 —— 凱撒 +3 HELLO→KHOOR、ROT13 Hello→Uryyb、
  Vigenère ATTACKATDAWN(key LEMON)→LXFOPVEFRNHR、Atbash ABC→ZYX、A1Z26。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `cipher-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/cipher.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const {
  caesar,
  rot13,
  rot47,
  atbash,
  vigenere,
  a1z26Encode,
  a1z26Decode,
  caesarBruteForce,
} = await import('file://' + out)

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

// ── 凱撒 ──
eq('凱撒 +3 HELLO', caesar('HELLO', 3), 'KHOOR')
eq('凱撒 +3 解回', caesar('KHOOR', 3, true), 'HELLO')
eq('凱撒保留大小寫與標點', caesar('Hello, World!', 3), 'Khoor, Zruog!')
eq('凱撒環繞 XYZ+3', caesar('XYZ', 3), 'ABC')
eq('凱撒負位移', caesar('ABC', -1), 'ZAB')
eq('凱撒 +26 不變', caesar('Test', 26), 'Test')

// ── ROT13(自反)──
eq('ROT13 Hello', rot13('Hello'), 'Uryyb')
eq('ROT13 自反', rot13(rot13('The quick brown fox')), 'The quick brown fox')
eq('ROT13 = 凱撒 13', rot13('abcXYZ'), caesar('abcXYZ', 13))

// ── ROT47(自反)──
eq('ROT47 A→p', rot47('A'), 'p')
eq('ROT47 a→2', rot47('a'), '2')
eq('ROT47 自反', rot47(rot47('Hello World! 123')), 'Hello World! 123')
eq('ROT47 空白原樣', rot47(' '), ' ')

// ── Atbash(自反)──
eq('Atbash ABC', atbash('ABC'), 'ZYX')
eq('Atbash 小寫', atbash('abc'), 'zyx')
eq('Atbash 自反', atbash(atbash('Hello, World')), 'Hello, World')
eq('Atbash A↔Z', atbash('AZ'), 'ZA')

// ── Vigenère(經典 oracle)──
eq('Vigenère ATTACKATDAWN/LEMON', vigenere('ATTACKATDAWN', 'LEMON'), 'LXFOPVEFRNHR')
eq('Vigenère 解密還原', vigenere('LXFOPVEFRNHR', 'LEMON', true), 'ATTACKATDAWN')
eq('Vigenère HELLO/KEY', vigenere('HELLO', 'KEY'), 'RIJVS')
// 'Hi There' key ab: H+a=H,i+b=j,(space),T+a=T,h+b=i,e+a=e,r+b=s,e+a=e → "Hj Tiese"
eq('Vigenère 逐字母消耗金鑰(空白不消耗)', vigenere('Hi There', 'ab'), 'Hj Tiese')
eq('Vigenère 空金鑰原樣', vigenere('Hello', ''), 'Hello')
eq('Vigenère 金鑰忽略非字母', vigenere('HELLO', 'K-E-Y'), 'RIJVS')

// ── A1Z26 ──
eq('A1Z26 編碼 ABC', a1z26Encode('ABC'), '1 2 3')
eq('A1Z26 編碼含空白', a1z26Encode('AB CD'), '1 2 / 3 4')
eq('A1Z26 解碼', a1z26Decode('1 2 3'), 'ABC')
eq('A1Z26 解碼斜線為空白', a1z26Decode('8 9 / 20 8 5 18 5'), 'HI THERE')
eq('A1Z26 編解往返', a1z26Decode(a1z26Encode('HELLO WORLD')), 'HELLO WORLD')
eq('A1Z26 逗號分隔', a1z26Decode('1,2,3'), 'ABC')
eq('A1Z26 超界以 ? ', a1z26Decode('27'), '?')

// ── 凱撒暴力破解 ──
{
  const rows = caesarBruteForce('KHOOR')
  eq('暴力破解 25 列', rows.length, 25)
  // shift 3 解回 HELLO
  const r3 = rows.find((r) => r.shift === 3)
  eq('暴力破解含正解', r3.text, 'HELLO')
}

console.log(fail === 0 ? '\n✅ 全數通過' : `\n❌ ${fail} 筆失敗`)
process.exit(fail === 0 ? 0 : 1)
