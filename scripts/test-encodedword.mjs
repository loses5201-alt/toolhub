/*
  MIME encoded-word(RFC 2047)解碼引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-encodedword.mjs
  oracle 取自 RFC 2047 §8 範例與已知 Base64 / Quoted-Printable 向量。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `encodedword-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/encodedWord.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { base64ToBytes, qEncodingToBytes, decodeWord, decodeMimeHeader } = await import(
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

// ── base64 / Q 位元組 ──
eq('base64 Hello', Array.from(base64ToBytes('SGVsbG8=')), [72, 101, 108, 108, 111])
eq('base64 忽略空白', Array.from(base64ToBytes('SGVs bG8=')), [72, 101, 108, 108, 111])
eq('Q 底線變空格', Array.from(qEncodingToBytes('a_b')), [97, 32, 98])
eq('Q =XX 還原位元組', Array.from(qEncodingToBytes('=E4=BD=A0')), [0xe4, 0xbd, 0xa0])
eq('Q 字面與落單等號', Array.from(qEncodingToBytes('A=ZZ')), [65, 0x3d, 90, 90])

// ── 單一 encoded-word ──
eq('UTF-8 B 你好', decodeWord('UTF-8', 'B', '5L2g5aW9').text, '你好')
eq('UTF-8 Q 你好', decodeWord('UTF-8', 'Q', '=E4=BD=A0=E5=A5=BD').text, '你好')
eq('UTF-8 B Hello World', decodeWord('UTF-8', 'B', 'SGVsbG8gV29ybGQ=').text, 'Hello World')
// RFC 2047 §8 經典範例
eq('ISO-8859-1 Q Keld', decodeWord('ISO-8859-1', 'Q', 'Keld_J=F8rn_Simonsen').text, 'Keld Jørn Simonsen')
eq('ISO-8859-1 Q Patrik', decodeWord('ISO-8859-1', 'Q', 'Patrik_F=E4ltstr=F6m').text, 'Patrik Fältström')
eq('Big5 B 中文', decodeWord('Big5', 'B', 'pKSk5Q==').text, '中文') // A4 A4 A4 E5
eq('字元集大小寫', decodeWord('utf-8', 'b', 'SGk=').text, 'Hi')
eq('RFC2231 語言後綴去除', decodeWord('UTF-8*zh-tw', 'B', 'SGk=').text, 'Hi')
eq('不支援字元集', decodeWord('NO-SUCH', 'B', 'SGk=').ok, false)

// ── 完整標頭 ──
eq('純文字原樣', decodeMimeHeader('Hello world').text, 'Hello world')
eq('純文字 hadEncoded', decodeMimeHeader('Hello').hadEncoded, false)
eq('單字', decodeMimeHeader('=?UTF-8?B?5L2g5aW9?=').text, '你好')
eq('前後夾文字', decodeMimeHeader('Re: =?UTF-8?B?5L2g5aW9?= 謝謝').text, 'Re: 你好 謝謝')
// 相鄰兩個 encoded-word 之間的空白應移除(RFC 2047 §6.2)
eq(
  '相鄰空白移除',
  decodeMimeHeader('=?UTF-8?B?5L2g?= =?UTF-8?B?5aW9?=').text,
  '你好',
)
// 非相鄰(文字與字之間)的空白保留
eq(
  '文字間空白保留',
  decodeMimeHeader('a =?UTF-8?B?5aW9?=').text,
  'a 好',
)
eq('混合字元集', decodeMimeHeader('=?ISO-8859-1?Q?Fr=E9d=E9ric?=').text, 'Frédéric')
eq('segments 數', decodeMimeHeader('Re: =?UTF-8?B?5L2g5aW9?=').segments.length, 2)
eq(
  'segment 標記字元集',
  decodeMimeHeader('=?UTF-8?B?SGk=?=').segments[0].charset,
  'UTF-8',
)
eq('hadEncoded true', decodeMimeHeader('=?UTF-8?B?SGk=?=').hadEncoded, true)

if (fail) {
  console.error(`\n${fail} 個測試失敗`)
  process.exit(1)
}
console.log('\n全部 encoded-word 測試通過')
