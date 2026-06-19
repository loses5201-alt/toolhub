/*
  Hex 檢視器引擎回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-hexview.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `hexview-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/hexView.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const {
  byteToHex,
  offsetToHex,
  byteToAscii,
  hexDump,
  dumpToText,
  textToBytes,
  parseHex,
} = await import('file://' + out)

let fail = 0
let pass = 0
function ok(cond, msg) {
  if (cond) {
    pass++
  } else {
    fail++
    console.error('✗ FAIL:', msg)
  }
}
function eq(a, b, msg) {
  ok(a === b, `${msg} — got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`)
}

// byteToHex
eq(byteToHex(0), '00', 'byteToHex 0')
eq(byteToHex(255), 'ff', 'byteToHex 255')
eq(byteToHex(15), '0f', 'byteToHex 15')
eq(byteToHex(0xab), 'ab', 'byteToHex ab')

// offsetToHex
eq(offsetToHex(0), '00000000', 'offset 0')
eq(offsetToHex(16), '00000010', 'offset 16')
eq(offsetToHex(255), '000000ff', 'offset 255')
eq(offsetToHex(16, 4), '0010', 'offset width 4')

// byteToAscii
eq(byteToAscii(0x41), 'A', 'ascii A')
eq(byteToAscii(0x20), ' ', 'ascii space')
eq(byteToAscii(0x7e), '~', 'ascii tilde')
eq(byteToAscii(0x7f), '.', 'ascii 0x7f -> dot')
eq(byteToAscii(0x00), '.', 'ascii null -> dot')
eq(byteToAscii(0xff), '.', 'ascii 0xff -> dot')

// hexDump basics: "Hello" -> one row
{
  const d = hexDump(textToBytes('Hello'))
  eq(d.total, 5, 'Hello total 5')
  eq(d.shown, 5, 'Hello shown 5')
  eq(d.rows.length, 1, 'Hello 1 row')
  eq(d.rows[0].offset, '00000000', 'Hello offset')
  eq(d.rows[0].ascii, 'Hello', 'Hello ascii')
  ok(d.rows[0].hex.startsWith('48 65 6c 6c 6f'), 'Hello hex bytes')
  ok(!d.truncated, 'Hello not truncated')
}

// exactly 16 bytes -> single full row, no group double-space issue
{
  const bytes = new Uint8Array(16)
  for (let i = 0; i < 16; i++) bytes[i] = i
  const d = hexDump(bytes)
  eq(d.rows.length, 1, '16 bytes -> 1 row')
  // group space after 8th byte
  ok(d.rows[0].hex.includes('06 07  08 09'), '16 bytes group double space at 8')
  eq(d.rows[0].ascii.length, 16, '16 bytes ascii length 16')
}

// 17 bytes -> 2 rows, second offset 00000010
{
  const bytes = new Uint8Array(17)
  const d = hexDump(bytes)
  eq(d.rows.length, 2, '17 bytes -> 2 rows')
  eq(d.rows[1].offset, '00000010', '17 bytes second offset')
  eq(d.rows[1].ascii.length, 1, '17 bytes second row ascii length 1')
}

// uppercase
{
  const d = hexDump(new Uint8Array([0xab, 0xcd]), { uppercase: true })
  ok(d.rows[0].hex.startsWith('AB CD'), 'uppercase hex')
}

// custom bytesPerRow
{
  const d = hexDump(new Uint8Array([1, 2, 3, 4, 5]), { bytesPerRow: 4 })
  eq(d.rows.length, 2, 'perRow 4 -> 2 rows')
  eq(d.rows[0].ascii.length, 4, 'perRow 4 first ascii len')
  eq(d.rows[1].ascii.length, 1, 'perRow 4 second ascii len')
}

// no grouping
{
  const bytes = new Uint8Array(10)
  const d = hexDump(bytes, { groupSize: 0 })
  ok(!d.rows[0].hex.includes('  '), 'groupSize 0 -> no double space')
}

// empty input
{
  const d = hexDump(new Uint8Array(0))
  eq(d.rows.length, 0, 'empty -> 0 rows')
  eq(d.total, 0, 'empty total 0')
  ok(!d.truncated, 'empty not truncated')
}

// maxBytes truncation
{
  const bytes = new Uint8Array(100)
  const d = hexDump(bytes, { maxBytes: 20 })
  eq(d.total, 100, 'maxBytes total still 100')
  eq(d.shown, 20, 'maxBytes shown 20')
  ok(d.truncated, 'maxBytes truncated true')
  // 20 bytes / 16 per row = 2 rows
  eq(d.rows.length, 2, 'maxBytes 20 -> 2 rows')
}

// dumpToText format
{
  const d = hexDump(textToBytes('Hi'))
  const txt = dumpToText(d)
  ok(txt.startsWith('00000000  '), 'dumpToText starts with offset')
  ok(txt.includes('|Hi|'), 'dumpToText ascii block')
}

// parseHex roundtrip
{
  const b = parseHex('48 65 6c 6c 6f')
  ok(b !== null, 'parseHex not null')
  eq(b.length, 5, 'parseHex length 5')
  eq(b[0], 0x48, 'parseHex first byte')
  eq(new TextDecoder().decode(b), 'Hello', 'parseHex decodes Hello')
}
eq(parseHex('').length, 0, 'parseHex empty -> 0')
eq(parseHex('0xAB,0xCD').length, 2, 'parseHex 0x prefix + comma')
eq(parseHex('ab\ncd\n_ef').length, 3, 'parseHex newline/underscore')
eq(parseHex('abc'), null, 'parseHex odd length -> null')
eq(parseHex('zz'), null, 'parseHex non-hex -> null')

// textToBytes utf-8 (中文)
{
  const b = textToBytes('中')
  eq(b.length, 3, '中 utf-8 3 bytes')
  eq(b[0], 0xe4, '中 first byte e4')
}

console.log(`\nhexView: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
