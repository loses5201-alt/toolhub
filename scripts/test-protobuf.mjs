/*
  Protobuf wire format 解碼引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-protobuf.mjs
  oracle:測試內以標準 wire format 規則手動編碼(encodeVarint / tag / fixed),逐項比對
  欄位編號、wire type、解碼值、巢狀與各種詮釋。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `protobuf-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/protobuf.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { decodeProto, parseProtoInput } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else { fail++; console.error(`✗ ${note}`) }
}

// --- oracle 編碼器(標準 protobuf wire format)---
function encodeVarint(n) {
  let v = BigInt(n)
  const out = []
  while (true) {
    const b = Number(v & 0x7fn)
    v >>= 7n
    if (v === 0n) { out.push(b); break }
    out.push(b | 0x80)
  }
  return out
}
const tag = (field, wire) => encodeVarint((field << 3) | wire)
function lenField(field, bytes) { return [...tag(field, 2), ...encodeVarint(bytes.length), ...bytes] }
function fixed64LE(field, view) { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, view, true); return [...tag(field, 1), ...b] }
function fixed32LE(field, view) { const b = new Uint8Array(4); new DataView(b.buffer).setFloat32(0, view, true); return [...tag(field, 5), ...b] }
const U = (...a) => Uint8Array.from(a.flat())
const dec = (...a) => decodeProto(U(...a))

// --- varint ---
{
  const r = dec(tag(1, 0), encodeVarint(150))
  check('varint 欄位編號 1', r.nodes[0].fieldNumber === 1)
  check('varint wireType 0', r.nodes[0].wireType === 0 && r.nodes[0].wireTypeName === 'varint')
  check('varint 值 150', r.nodes[0].value === '150')
  check('varint byteLength 3', r.nodes[0].byteLength === 3)
  check('varint 無 error', !r.error)
}
{
  // u=1 → bool:true、zigzag:-1
  const r = dec(tag(1, 0), encodeVarint(1))
  check('varint 1 值', r.nodes[0].value === '1')
  check('varint 1 → bool:true', r.nodes[0].alt.includes('bool:true'))
  check('varint 1 → zigzag -1', r.nodes[0].alt.includes('sint(zigzag):-1'))
}
{
  // 大 varint:全 1(64 bit)→ 有號 int64 -1
  const r = dec(tag(2, 0), Array(9).fill(0xff), [0x01])
  check('varint 欄位 2', r.nodes[0].fieldNumber === 2)
  check('varint 最大值 uint', r.nodes[0].value === (2n ** 64n - 1n).toString())
  check('varint 最大值 → 有號 -1', r.nodes[0].alt.includes('有號 int64:-1'))
}

// --- length-delimited 字串 ---
{
  const s = [...Buffer.from('testing', 'utf-8')]
  const r = dec(lenField(2, s))
  check('字串 wireType 2 (len)', r.nodes[0].wireType === 2 && r.nodes[0].wireTypeName === 'len')
  check('字串值 "testing"', r.nodes[0].value === '"testing"')
  check('字串無 children', !r.nodes[0].children)
}
{
  const r = dec(lenField(3, []))
  check('空 length-delimited → 空字串', r.nodes[0].value === '空字串')
}

// --- 巢狀訊息 ---
{
  const inner = [...tag(1, 0), ...encodeVarint(150)]
  const r = dec(lenField(3, inner))
  check('巢狀 wireType 2', r.nodes[0].wireType === 2)
  check('巢狀標示為訊息', r.nodes[0].value === '訊息(3 位元組)')
  check('巢狀有 children', Array.isArray(r.nodes[0].children) && r.nodes[0].children.length === 1)
  check('巢狀子欄位 1 = 150', r.nodes[0].children[0].fieldNumber === 1 && r.nodes[0].children[0].value === '150')
}

// --- 64-bit / 32-bit ---
{
  const r = dec(fixed64LE(4, 1.5))
  check('fixed64 wireType 1', r.nodes[0].wireType === 1 && r.nodes[0].wireTypeName === '64-bit')
  check('fixed64 → double 1.5', r.nodes[0].alt.includes('double:1.5'))
  check('fixed64 byteLength 9', r.nodes[0].byteLength === 9)
}
{
  const r = dec(fixed32LE(5, 1.5))
  check('fixed32 wireType 5', r.nodes[0].wireType === 5 && r.nodes[0].wireTypeName === '32-bit')
  check('fixed32 → float 1.5', r.nodes[0].alt.includes('float:1.5'))
  check('fixed32 byteLength 5', r.nodes[0].byteLength === 5)
}

// --- 非 UTF-8 bytes ---
{
  const r = dec(lenField(6, [0xff, 0xfe]))
  check('非文字 length-delimited → bytes', r.nodes[0].value.startsWith('2 位元組:0xfffe'))
  check('bytes 無 children', !r.nodes[0].children)
}

// --- 多欄位 ---
{
  const r = dec(tag(1, 0), encodeVarint(150), lenField(2, [...Buffer.from('hi', 'utf-8')]))
  check('多欄位:解出 2 筆', r.nodes.length === 2)
}

// --- 錯誤路徑 ---
{
  const r = dec(tag(1, 0)) // varint tag 但缺值
  check('截斷 varint → error', !!r.error && r.nodes.length === 0)
}
{
  const r = dec(tag(1, 0), encodeVarint(150), tag(1, 0)) // 第二欄缺值
  check('部分解析:保留已成功 1 筆 + error', r.nodes.length === 1 && !!r.error)
}
{
  const r = decodeProto(Uint8Array.from([]))
  check('空輸入 → error', !!r.error)
}

// --- parseProtoInput ---
{
  const hex = parseProtoInput('08 96 01')
  check('hex 解析', hex.bytes && hex.format === 'hex' && hex.bytes.length === 3)
  const b64 = parseProtoInput('CJYB') // base64 of [8,150,1]
  check('base64 解析', b64.bytes && b64.format === 'base64' && b64.bytes[1] === 150)
  check('空輸入回 error', parseProtoInput('  ').error)
  // 同一份資料 hex 與 base64 解碼結果一致
  const a = decodeProto(parseProtoInput('08 96 01').bytes)
  const c = decodeProto(parseProtoInput('CJYB').bytes)
  check('hex 與 base64 解碼一致', a.nodes[0].value === c.nodes[0].value)
}

console.log(fail ? `\n✗ ${fail} 個測試失敗` : '\n✓ 全部 protobuf 測試通過')
process.exit(fail ? 1 : 0)
