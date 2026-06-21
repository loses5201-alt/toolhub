/*
  CBOR(RFC 8949)解碼引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-cbor.mjs
  oracle:RFC 8949 Appendix A 的標準編碼測試向量(hex → 期望解碼值),逐項比對型別與值。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `cbor-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/cbor.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { decodeCbor, parseCborInput } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else { fail++; console.error(`✗ ${note}`) }
}
function hx(s) {
  const clean = s.replace(/\s+/g, '')
  const b = new Uint8Array(clean.length / 2)
  for (let i = 0; i < b.length; i++) b[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  return b
}
const top = (s) => decodeCbor(hx(s)).items[0]

// --- 整數(RFC 8949 Appendix A)---
check('00 → uint 0', top('00').type === 'uint' && top('00').value === '0')
check('17 → uint 23', top('17').value === '23')
check('1818 → uint 24', top('1818').value === '24')
check('1903e8 → uint 1000', top('1903e8').value === '1000')
check('1a000f4240 → 1000000', top('1a000f4240').value === '1000000')
check('1bffffffffffffffff → 18446744073709551615', top('1bffffffffffffffff').value === '18446744073709551615')
check('20 → nint -1', top('20').type === 'nint' && top('20').value === '-1')
check('29 → nint -10', top('29').value === '-10')
check('3903e7 → nint -1000', top('3903e7').value === '-1000')

// --- 浮點與簡單值 ---
check('f90000 → float 0', top('f90000').type === 'float' && top('f90000').value === '0')
check('f93c00 → float 1', top('f93c00').value === '1')
check('f93e00 → float 1.5', top('f93e00').value === '1.5')
check('f9c400 → float -4', top('f9c400').value === '-4')
check('f97e00 → NaN', top('f97e00').value === 'NaN')
check('f97c00 → Infinity', top('f97c00').value === 'Infinity')
check('fb3ff199999999999a → 1.1(float64)', top('fb3ff199999999999a').value === '1.1')
check('fa47c35000 → 100000(float32)', top('fa47c35000').value === '100000')
check('f4 → false', top('f4').type === 'bool' && top('f4').value === 'false')
check('f5 → true', top('f5').value === 'true')
check('f6 → null', top('f6').type === 'null')
check('f7 → undefined', top('f7').type === 'undefined')
check('f0 → 簡單值 16', top('f0').type === 'simple' && top('f0').value === '簡單值 16')

// --- 字串 ---
check("40 → 空 bytes h''", top('40').type === 'bytes' && top('40').value === "h''")
check("4401020304 → bytes 01020304", top('4401020304').value === "h'01020304'")
check('60 → 空字串 ""', top('60').type === 'text' && top('60').value === '""')
check('6161 → "a"', top('6161').value === '"a"')
check('6449455446 → "IETF"', top('6449455446').value === '"IETF"')
check('62c3bc → "ü"(UTF-8)', top('62c3bc').value === '"ü"')

// --- 陣列 / map ---
{
  const a = top('83010203')
  check('83010203 → 陣列 3 項', a.type === 'array' && a.children.length === 3 && a.children[1].value === '2')
}
{
  const a = top('80')
  check('80 → 空陣列', a.type === 'array' && a.children.length === 0)
}
{
  const a = top('8301820203820405')
  check('巢狀陣列 [1,[2,3],[4,5]]', a.children[1].children[1].value === '3' && a.children[2].children[0].value === '4')
}
{
  const m = top('a201020304')
  check('a201020304 → map {1:2,3:4}', m.type === 'map' && m.entries.length === 2 && m.entries[0].key.value === '1' && m.entries[0].value.value === '2')
}
{
  const m = top('a26161016162820203')
  check('map {"a":1,"b":[2,3]}', m.entries[1].key.value === '"b"' && m.entries[1].value.type === 'array' && m.entries[1].value.children[0].value === '2')
}

// --- 不定長 ---
check('9fff → 不定長空陣列', top('9fff').type === 'array' && top('9fff').children.length === 0)
{
  const a = top('9f018202039f0405ffff')
  check('不定長陣列 [1,[2,3],[4,5]]', a.children.length === 3 && a.children[2].children[1].value === '5')
}
{
  const m = top('bf61610161629f0203ffff')
  check('不定長 map {"a":1,"b":[2,3]}', m.type === 'map' && m.entries[1].value.children[1].value === '3')
}
check("5f42010243030405ff → 不定長 bytes 串接", top('5f42010243030405ff').value === "h'0102030405'")
check('7f657374726561646d696e67ff → 不定長 text "streaming"', top('7f657374726561646d696e67ff').value === '"streaming"')

// --- 標籤 tag ---
{
  const t = top('c074323031332d30332d32315432303a30343a30305a')
  check('tag 0 日期時間', t.type === 'tag' && t.value.startsWith('標籤 0') && t.children[0].value === '"2013-03-21T20:04:00Z"')
}
{
  const t = top('c11a514b67b0')
  check('tag 1 Unix 時間戳', t.value.startsWith('標籤 1') && t.children[0].value === '1363896240')
}
{
  // tag 2 正 bignum h'0100...' = 18446744073709551616
  const t = top('c249010000000000000000')
  check('tag 2 bignum 還原整數', t.value.includes('= 18446744073709551616'))
}
{
  // tag 3 負 bignum
  const t = top('c349010000000000000000')
  check('tag 3 負 bignum 還原整數', t.value.includes('= -18446744073709551617'))
}

// --- 錯誤路徑 ---
check('空輸入 → error', !!decodeCbor(new Uint8Array([])).error)
{
  const r = decodeCbor(hx('1818')) // 完整 → 無 error
  check('完整輸入無 error', !r.error)
}
{
  const r = decodeCbor(hx('18')) // ai 24 但缺後續位元組
  check('截斷引數 → error', !!r.error)
}
{
  const r = decodeCbor(hx('8302')) // 宣告 3 項只給 1 項
  check('陣列項目不足 → error,保留已解析', !!r.error)
}
{
  const r = decodeCbor(hx('0001')) // CBOR 序列:兩個頂層項目
  check('CBOR 序列兩項', r.items.length === 2 && r.items[1].value === '1')
}

// --- parseCborInput ---
{
  const a = parseCborInput('83 01 02 03')
  check('hex 解析', a.bytes && a.format === 'hex' && a.bytes.length === 4)
  const b = parseCborInput('gwECAw==') // base64 of 83010203
  check('base64 解析', b.bytes && b.format === 'base64' && b.bytes[0] === 0x83)
  check('空輸入回 error', !!parseCborInput('   ').error)
}

console.log(fail ? `\n✗ ${fail} 個測試失敗` : '\n✓ 全部 CBOR 測試通過')
process.exit(fail ? 1 : 0)
