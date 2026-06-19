/*
  Unicode 正規化 / 比對引擎回歸測試(node 直接跑)。
  執行:node scripts/test-unicodenormalize.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `unicodenorm-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/unicodeNormalize.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { normalizeAll, listCodePoints, analyzeText, compareStrings } =
  await import('file://' + out)

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

const composed = 'é' // U+00E9
const decomposed = 'é' // e + 組合尖音符

// normalizeAll
{
  const r = normalizeAll(decomposed)
  const nfc = r.find((x) => x.form === 'NFC')
  const nfd = r.find((x) => x.form === 'NFD')
  eq(nfc.text, composed, 'NFC composes e+acute -> é')
  eq(nfc.codePoints, 1, 'NFC é codePoints 1')
  eq(nfc.codeUnits, 1, 'NFC é codeUnits 1')
  ok(nfc.changed, 'NFC changed from decomposed')
  eq(nfd.text, decomposed, 'NFD keeps decomposed')
  eq(nfd.codePoints, 2, 'NFD codePoints 2')
  ok(!nfd.changed, 'NFD unchanged from decomposed input')
}

// NFKC 相容字:全形 Ａ -> A、① -> 1、ﬁ -> fi、㎏ -> kg
{
  const r = normalizeAll('Ａ①ﬁ㎏')
  const nfkc = r.find((x) => x.form === 'NFKC')
  eq(nfkc.text, 'A1fikg', 'NFKC compatibility decompositions')
  ok(nfkc.changed, 'NFKC changed')
  const nfc = r.find((x) => x.form === 'NFC')
  ok(!nfc.changed, 'NFC does not touch compatibility chars')
}

// listCodePoints
{
  const cps = listCodePoints(decomposed)
  eq(cps.length, 2, 'codepoints length 2')
  eq(cps[0].hex, 'U+0065', 'first cp e')
  eq(cps[1].hex, 'U+0301', 'second cp combining acute')
  ok(cps[1].combining, 'combining flagged')
  ok(!cps[0].combining, 'base not combining')
}
// emoji 代理對算一個碼點
{
  const cps = listCodePoints('😀')
  eq(cps.length, 1, 'emoji 1 codepoint')
  eq(cps[0].hex, 'U+1F600', 'emoji hex')
}

// analyzeText
{
  const s = analyzeText('café́Ａ​') // 含組合符、全形 A、零寬空格
  ok(s.combiningMarks >= 1, 'combining marks counted')
  eq(s.fullWidth, 1, 'full width counted')
  eq(s.zeroWidth, 1, 'zero width counted')
}
{
  const s = analyzeText('😀')
  eq(s.codePoints, 1, 'emoji codePoints 1')
  eq(s.codeUnits, 2, 'emoji codeUnits 2 (surrogate pair)')
}

// compareStrings
{
  const c = compareStrings(composed, decomposed)
  ok(!c.rawEqual, 'composed vs decomposed raw not equal')
  ok(c.nfcEqual, 'composed vs decomposed NFC equal')
  ok(c.nfdEqual, 'NFD equal too')
  ok(c.verdict.includes('NFC'), 'verdict mentions NFC')
}
{
  const c = compareStrings('Ａ', 'A') // 全形 vs 半形
  ok(!c.rawEqual, 'fullwidth raw not equal')
  ok(!c.nfcEqual, 'fullwidth NFC not equal')
  ok(c.nfkcEqual, 'fullwidth NFKC equal')
}
{
  const c = compareStrings('abc', 'abc')
  ok(c.rawEqual, 'identical raw equal')
  eq(c.firstDiff, -1, 'identical firstDiff -1')
}
{
  const c = compareStrings('abcXdef', 'abcYdef')
  ok(!c.rawEqual, 'diff not equal')
  ok(!c.nfkcEqual, 'genuine diff not nfkc equal')
  eq(c.firstDiff, 3, 'firstDiff at index 3')
}
{
  // 較短字串:firstDiff 指向較短結束處
  const c = compareStrings('abc', 'abcd')
  eq(c.firstDiff, 3, 'firstDiff at shorter end')
}

console.log(`\nunicodeNormalize: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
