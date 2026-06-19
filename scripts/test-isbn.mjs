/*
  ISBN 檢核 / 轉換引擎回歸測試(node 直接跑)。
  執行:node scripts/test-isbn.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `isbn-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/isbn.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const {
  normalizeIsbn,
  isbn10CheckDigit,
  isbn13CheckDigit,
  isValidIsbn10,
  isValidIsbn13,
  isbn10to13,
  isbn13to10,
  analyzeIsbn,
} = await import('file://' + out)

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

// normalize
eq(normalizeIsbn('978-0-306-40615-7'), '9780306406157', 'normalize hyphens')
eq(normalizeIsbn('0 306 40615 x'), '030640615X', 'normalize spaces + uppercase X')

// 檢查碼計算(已知書籍)
eq(isbn10CheckDigit('030640615'), '2', 'isbn10 check 0306406152')
eq(isbn13CheckDigit('978030640615'), '7', 'isbn13 check 9780306406157')
// 末位 X 的經典範例:0-8044-2957-X(Knuth? 通用測試)
eq(isbn10CheckDigit('080442957'), 'X', 'isbn10 check digit X case')

// 驗證合法(公開的真實 ISBN)
ok(isValidIsbn10('0306406152'), 'valid isbn10 0306406152')
ok(isValidIsbn10('0-306-40615-2'), 'valid isbn10 with hyphens')
ok(isValidIsbn13('9780306406157'), 'valid isbn13 9780306406157')
ok(isValidIsbn13('978-0-306-40615-7'), 'valid isbn13 hyphens')
ok(isValidIsbn10('080442957X'), 'valid isbn10 ending X')
// 另一本:《The C Programming Language》ISBN-13 9780131103627
ok(isValidIsbn13('9780131103627'), 'valid isbn13 K&R')

// 驗證不合法(改一碼)
ok(!isValidIsbn10('0306406153'), 'invalid isbn10 wrong check')
ok(!isValidIsbn13('9780306406158'), 'invalid isbn13 wrong check')
ok(!isValidIsbn10('030640615'), 'isbn10 wrong length')
ok(!isValidIsbn13('978030640615'), 'isbn13 wrong length')
ok(!isValidIsbn10('03064O6152'), 'isbn10 letter O not digit')
ok(!isValidIsbn10('X306406152'), 'isbn10 X only at end')

// 轉換
eq(isbn10to13('0306406152'), '9780306406157', 'isbn10 -> isbn13')
eq(isbn10to13('080442957X'), isbn10to13('0-8044-2957-X'), 'isbn10to13 ignores hyphens')
eq(isbn13to10('9780306406157'), '0306406152', 'isbn13 -> isbn10')
// 往返一致
ok(isValidIsbn13(isbn10to13('0306406152')), 'roundtrip 10->13 valid')
eq(isbn13to10(isbn10to13('0306406152')), '0306406152', 'roundtrip 10->13->10')
// 979 不可轉 ISBN-10
{
  // 造一個合法的 979 ISBN-13:979 0 000 00000 + 正確檢查碼
  const core = '979000000000'
  const ean = core + isbn13CheckDigit(core)
  ok(isValidIsbn13(ean), '979 ean valid')
  eq(isbn13to10(ean), null, '979 -> isbn10 null')
}
// 非法輸入轉換回 null
eq(isbn10to13('1234567890'), null, 'invalid isbn10 -> null')
eq(isbn13to10('1234567890123'), null, 'invalid isbn13 -> null')

// analyzeIsbn
{
  const a = analyzeIsbn('0306406152')
  eq(a.kind, 'isbn10', 'analyze kind isbn10')
  ok(a.valid, 'analyze valid')
  eq(a.isbn13, '9780306406157', 'analyze gives isbn13')
  eq(a.prefix, '978', 'analyze prefix 978')
}
{
  const a = analyzeIsbn('978-0-306-40615-7')
  eq(a.kind, 'isbn13', 'analyze kind isbn13')
  ok(a.valid, 'analyze isbn13 valid')
  eq(a.isbn10, '0306406152', 'analyze isbn13 gives isbn10')
}
{
  const a = analyzeIsbn('0306406153') // 壞檢查碼
  eq(a.kind, 'isbn10', 'analyze bad kind still isbn10')
  ok(!a.valid, 'analyze bad invalid')
  ok(a.note.includes('2'), 'analyze suggests correct check digit 2')
}
{
  const a = analyzeIsbn('hello')
  eq(a.kind, 'invalid', 'analyze garbage invalid')
  ok(!a.valid, 'analyze garbage not valid')
}

console.log(`\nisbn: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
