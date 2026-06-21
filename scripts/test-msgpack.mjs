/*
  MessagePack 解碼引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-msgpack.mjs
  oracle:依 MessagePack 官方 spec 手構的標準編碼(各格式族前置位元組),逐項比對型別與值。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `msgpack-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/msgpack.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { decodeMsgpack, parseMsgpackInput } = await import('file://' + out)

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
const top = (s) => decodeMsgpack(hx(s)).items[0]

// --- 整數 ---
check('00 → uint 0', top('00').type === 'uint' && top('00').value === '0')
check('7f → fixint 127', top('7f').value === '127')
check('ff → 負 fixint -1', top('ff').type === 'int' && top('ff').value === '-1')
check('e0 → 負 fixint -32', top('e0').value === '-32')
check('cc ff → uint8 255', top('ccff').value === '255')
check('cd 0100 → uint16 256', top('cd0100').value === '256')
check('ce 00010000 → uint32 65536', top('ce00010000').value === '65536')
check('cf ffffffffffffffff → uint64', top('cfffffffffffffffff'.slice(0, 18)).value === '18446744073709551615')
check('d0 ff → int8 -1', top('d0ff').type === 'int' && top('d0ff').value === '-1')
check('d1 ff00 → int16 -256', top('d1ff00').value === '-256')
check('d2 ffffffff → int32 -1', top('d2ffffffff').value === '-1')
check('d3 ffffffffffffffff → int64 -1', top('d3ffffffffffffffff').value === '-1')

// --- float ---
check('ca 3fc00000 → float32 1.5', top('ca3fc00000').type === 'float' && top('ca3fc00000').value === '1.5')
check('cb 3ff8000000000000 → float64 1.5', top('cb3ff8000000000000').value === '1.5')

// --- nil / bool ---
check('c0 → nil', top('c0').type === 'nil')
check('c2 → false', top('c2').type === 'bool' && top('c2').value === 'false')
check('c3 → true', top('c3').value === 'true')

// --- 字串 / bin ---
check('a1 61 → fixstr "a"', top('a161').type === 'str' && top('a161').value === '"a"')
check('a0 → 空 fixstr', top('a0').value === '""')
check('d9 05 68656c6c6f → str8 "hello"', top('d90568656c6c6f').value === '"hello"')
check('str UTF-8 "ü"', top('a2c3bc').value === '"ü"')
{
  const n = top('c402 0102')
  check('c4 02 0102 → bin8', n.type === 'bin' && n.value.includes('0x0102'))
}

// --- 陣列 / map ---
{
  const a = top('93 01 02 03')
  check('93 010203 → fixarray [1,2,3]', a.type === 'array' && a.children.length === 3 && a.children[2].value === '3')
}
check('90 → 空陣列', top('90').type === 'array' && top('90').children.length === 0)
{
  const a = top('92 01 91 02')
  check('巢狀 [1,[2]]', a.children[1].type === 'array' && a.children[1].children[0].value === '2')
}
{
  const m = top('81 01 02')
  check('81 0102 → fixmap {1:2}', m.type === 'map' && m.entries.length === 1 && m.entries[0].key.value === '1' && m.entries[0].value.value === '2')
}
{
  const m = top('81 a161 01')
  check('fixmap {"a":1}', m.entries[0].key.value === '"a"' && m.entries[0].value.value === '1')
}
{
  const a = top('dc 0001 05')
  check('dc 0001 05 → array16 [5]', a.type === 'array' && a.children.length === 1 && a.children[0].value === '5')
}
{
  const m = top('de 0001 a161 01')
  check('de 0001 … → map16 {"a":1}', m.type === 'map' && m.entries[0].key.value === '"a"')
}

// --- ext / timestamp ---
{
  const n = top('d4 05 01')
  check('d4 05 01 → fixext1 type 5', n.type === 'ext' && n.value.includes('ext type 5'))
}
{
  // timestamp 32:sec = 1363896240 = 0x514b67b0
  const n = top('d6 ff 514b67b0')
  check('d6 ff … → timestamp 2013-03-21', n.type === 'timestamp' && n.value.includes('2013-03-21T20:04:00'))
}
{
  // ext type -2(非 timestamp)
  const n = top('d4 fe 07')
  check('d4 fe 07 → ext type -2', n.type === 'ext' && n.value.includes('ext type -2'))
}

// --- 串接 / 錯誤路徑 ---
{
  const r = decodeMsgpack(hx('00 01'))
  check('串接兩個頂層物件', r.items.length === 2 && r.items[1].value === '1')
}
check('空輸入 → error', !!decodeMsgpack(new Uint8Array([])).error)
{
  const r = decodeMsgpack(hx('c1'))
  check('0xc1 保留值 → error', !!r.error)
}
{
  const r = decodeMsgpack(hx('cc'))
  check('截斷 uint8 → error', !!r.error)
}
{
  const r = decodeMsgpack(hx('93 01 02')) // 宣告 3 項只給 2
  check('陣列項目不足 → error,保留已解析', !!r.error)
}

// --- parseMsgpackInput ---
{
  const a = parseMsgpackInput('93 01 02 03')
  check('hex 解析', a.bytes && a.format === 'hex' && a.bytes.length === 4)
  const b = parseMsgpackInput('kwECAw==') // base64 of 93010203
  check('base64 解析', b.bytes && b.format === 'base64' && b.bytes[0] === 0x93)
  check('空輸入回 error', !!parseMsgpackInput('  ').error)
}

console.log(fail ? `\n✗ ${fail} 個測試失敗` : '\n✓ 全部 MessagePack 測試通過')
process.exit(fail ? 1 : 0)
