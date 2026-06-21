/*
  Apple plist 解析引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-plist.mjs
  oracle:測試內自帶一支獨立的「二進位 plist 編碼器」(buildBplist,依 CFBinaryPlist 格式手寫),
  把已知 JS 結構編碼成 bplist00 位元組,再用引擎解回來比對 —— 編碼器與解碼器邏輯互相獨立,可互為驗證。
  XML plist 部分以手構符合規範的 XML 文字為 oracle。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `plist-test-${Date.now()}.mjs`)
await build({ entryPoints: ['src/features/plist.ts'], bundle: true, format: 'esm', outfile: out, logLevel: 'silent' })
const { decodeBinaryPlist, parseXmlPlist, parsePlistText, plistToJson } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else { fail++; console.error(`✗ ${note}`) }
}

/* ---------- 獨立的二進位 plist 編碼器(oracle)---------- */
// 值標記:{__int}, {__real}, {__date:秒}, {__data:Uint8Array}, {__uid}, 字串 / 布林 / 陣列 / 物件 / null
function byteWidth(n) { return n < 256 ? 1 : n < 65536 ? 2 : n < 16777216 ? 3 : 4 }
function writeUintBE(arr, value, n) { for (let i = n - 1; i >= 0; i--) arr.push(Number((BigInt(value) >> BigInt(i * 8)) & 0xffn)) }
function f64be(v) { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, v, false); return [...b] }
function encInt(v) {
  v = BigInt(v)
  let n
  if (v >= 0n) n = v < 256n ? 1 : v < 65536n ? 2 : v < 4294967296n ? 4 : 8
  else n = 8
  const exp = { 1: 0, 2: 1, 4: 2, 8: 3 }[n]
  const bytes = [0x10 | exp]
  const uv = v < 0n ? (1n << BigInt(n * 8)) + v : v
  for (let i = n - 1; i >= 0; i--) bytes.push(Number((uv >> BigInt(i * 8)) & 0xffn))
  return bytes
}
function header(high, count) { return count < 15 ? [high << 4 | count] : [high << 4 | 0xf, ...encInt(count)] }

function buildBplist(root) {
  const nodes = []
  function intern(node) {
    const idx = nodes.length
    const rec = {}
    nodes.push(rec)
    if (node === null) rec.kind = 'null'
    else if (typeof node === 'boolean') { rec.kind = 'bool'; rec.v = node }
    else if (typeof node === 'string') { rec.kind = 'string'; rec.v = node }
    else if (node && node.__int !== undefined) { rec.kind = 'int'; rec.v = node.__int }
    else if (node && node.__real !== undefined) { rec.kind = 'real'; rec.v = node.__real }
    else if (node && node.__date !== undefined) { rec.kind = 'date'; rec.v = node.__date }
    else if (node && node.__data !== undefined) { rec.kind = 'data'; rec.v = node.__data }
    else if (node && node.__uid !== undefined) { rec.kind = 'uid'; rec.v = node.__uid }
    else if (Array.isArray(node)) { rec.kind = 'array'; rec.refs = node.map(intern) }
    else { const keys = Object.keys(node); rec.kind = 'dict'; rec.keyRefs = keys.map((k) => intern(k)); rec.valRefs = keys.map((k) => intern(node[k])) }
    return idx
  }
  const topIdx = intern(root)
  const refSize = byteWidth(nodes.length)
  function encRec(rec) {
    const b = []
    switch (rec.kind) {
      case 'null': return [0x00]
      case 'bool': return [rec.v ? 0x09 : 0x08]
      case 'int': return encInt(rec.v)
      case 'real': return [0x23, ...f64be(rec.v)]
      case 'date': return [0x33, ...f64be(rec.v)]
      case 'data': { b.push(...header(0x4, rec.v.length)); b.push(...rec.v); return b }
      case 'string': {
        const ascii = [...rec.v].every((c) => c.charCodeAt(0) < 128)
        if (ascii) { b.push(...header(0x5, rec.v.length)); for (const c of rec.v) b.push(c.charCodeAt(0)); return b }
        b.push(...header(0x6, rec.v.length)) // count = UTF-16 碼元數
        for (let i = 0; i < rec.v.length; i++) { const cu = rec.v.charCodeAt(i); b.push(cu >> 8, cu & 0xff) }
        return b
      }
      case 'uid': { const n = byteWidth(rec.v); b.push(0x80 | (n - 1)); writeUintBE(b, rec.v, n); return b }
      case 'array': { b.push(...header(0xa, rec.refs.length)); for (const r of rec.refs) writeUintBE(b, r, refSize); return b }
      case 'dict': {
        b.push(...header(0xd, rec.keyRefs.length))
        for (const r of rec.keyRefs) writeUintBE(b, r, refSize)
        for (const r of rec.valRefs) writeUintBE(b, r, refSize)
        return b
      }
    }
    return b
  }
  const out = [...'bplist00'].map((c) => c.charCodeAt(0))
  const offsets = []
  for (const rec of nodes) { offsets.push(out.length); out.push(...encRec(rec)) }
  const offsetTableOffset = out.length
  const offsetIntSize = byteWidth(offsetTableOffset)
  for (const off of offsets) writeUintBE(out, off, offsetIntSize)
  for (let i = 0; i < 6; i++) out.push(0) // unused + sortVersion
  out.push(offsetIntSize, refSize)
  writeUintBE(out, nodes.length, 8)
  writeUintBE(out, topIdx, 8)
  writeUintBE(out, offsetTableOffset, 8)
  return new Uint8Array(out)
}

/* ---------- 深度比對(處理 BigInt)---------- */
function eq(a, b) {
  if (typeof a === 'bigint' || typeof b === 'bigint') return BigInt(a) === BigInt(b)
  if (a === b) return true
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a), kb = Object.keys(b)
    if (ka.length !== kb.length) return false
    return ka.every((k) => eq(a[k], b[k]))
  }
  return false
}
// 把含 __標記 的 oracle 值轉成「引擎 raw 應有的樣子」
function expectRaw(node) {
  if (node === null || typeof node === 'boolean' || typeof node === 'string') return node
  if (node.__int !== undefined) return BigInt(node.__int)
  if (node.__real !== undefined) return node.__real
  if (node.__date !== undefined) return new Date((node.__date + 978307200) * 1000).toISOString()
  if (node.__data !== undefined) return [...node.__data].map((x) => x.toString(16).padStart(2, '0')).join('')
  if (node.__uid !== undefined) return { 'CF$UID': node.__uid }
  if (Array.isArray(node)) return node.map(expectRaw)
  const o = {}; for (const k of Object.keys(node)) o[k] = expectRaw(node[k]); return o
}
function roundtrip(note, value) {
  const bytes = buildBplist(value)
  const { root, error } = decodeBinaryPlist(bytes)
  check(note, !error && root && eq(plistToJson(root), expectRaw(value)))
}

/* ---------- 二進位 plist 案例 ---------- */
roundtrip('字串 "hello"', 'hello')
roundtrip('整數 42', { __int: 42 })
roundtrip('整數 300(2 位元組)', { __int: 300 })
roundtrip('整數 70000(4 位元組)', { __int: 70000 })
roundtrip('整數 -5(帶號 8 位元組)', { __int: -5 })
roundtrip('整數 5000000000(>32 位元)', { __int: 5000000000 })
roundtrip('浮點 1.5', { __real: 1.5 })
roundtrip('浮點 -0.25', { __real: -0.25 })
roundtrip('布林 true', true)
roundtrip('布林 false', false)
roundtrip('null', null)
roundtrip('簡單 dict', { name: 'Bob', age: { __int: 30 } })
roundtrip('簡單 array', [{ __int: 1 }, { __int: 2 }, { __int: 3 }])
roundtrip('巢狀 dict + array', { list: [true, false], info: { k: 'v', n: { __int: 7 } } })
roundtrip('data 位元組', { blob: { __data: new Uint8Array([0xde, 0xad, 0xbe, 0xef]) } })
roundtrip('date(Apple 絕對時間 0 = 2001-01-01)', { ts: { __date: 0 } })
roundtrip('date 任意秒', { ts: { __date: 700000000 } })
roundtrip('UID(NSKeyedArchiver)', { obj: { __uid: 5 } })
roundtrip('Unicode 字串(台北)', '台北')
roundtrip('Unicode 字串(emoji 與中文混合)', { t: '你好🌟世界' })
roundtrip('空 dict', {})
roundtrip('空 array', [])
roundtrip('空字串', '')
roundtrip('長字串(觸發 0xf 長度欄位)', 'abcdefghijklmnopqrstuvwxyz0123456789')
roundtrip('大陣列(20 項,觸發 0xf)', Array.from({ length: 20 }, (_, i) => ({ __int: i })))
roundtrip('多鍵 dict(觸發 0xf)', Object.fromEntries(Array.from({ length: 18 }, (_, i) => [`k${i}`, { __int: i }])))
roundtrip('頂層整數', { __int: 123456 })

// trailer / 標頭錯誤
check('非 bplist 標頭 → 錯誤', !!decodeBinaryPlist(new Uint8Array(40).fill(65)).error)
check('資料太短 → 錯誤', !!decodeBinaryPlist(new Uint8Array([0x62, 0x70])).error)
{
  // 損壞偏移表:把 offsetTableOffset 指到資料外
  const good = buildBplist({ a: { __int: 1 } })
  const bad = good.slice()
  bad[bad.length - 1] = 0xff // 破壞 offsetTableOffset 低位
  check('偏移表超出範圍 → 錯誤', !!decodeBinaryPlist(bad).error)
}

/* ---------- XML plist 案例 ---------- */
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.example.app</string>
  <key>Count</key>
  <integer>42</integer>
  <key>Ratio</key>
  <real>0.5</real>
  <key>Enabled</key>
  <true/>
  <key>Hidden</key>
  <false/>
  <key>Tags</key>
  <array>
    <string>a</string>
    <string>b</string>
  </array>
  <key>Nested</key>
  <dict>
    <key>x</key>
    <integer>1</integer>
  </dict>
  <key>Empty</key>
  <dict/>
  <key>Note</key>
  <string>Tom &amp; Jerry &lt;3</string>
</dict>
</plist>`
{
  const { root, error } = parseXmlPlist(XML)
  check('XML:無錯誤', !error && root)
  const j = plistToJson(root)
  check('XML:string', j.Label === 'com.example.app')
  check('XML:integer 為 BigInt 42', eq(j.Count, 42n))
  check('XML:real 0.5', j.Ratio === 0.5)
  check('XML:true/false 自閉合', j.Enabled === true && j.Hidden === false)
  check('XML:array', Array.isArray(j.Tags) && j.Tags.length === 2 && j.Tags[1] === 'b')
  check('XML:巢狀 dict', j.Nested && eq(j.Nested.x, 1n))
  check('XML:空 dict 自閉合', j.Empty && Object.keys(j.Empty).length === 0)
  check('XML:實體解碼(& 與 <)', j.Note === 'Tom & Jerry <3')
}
{
  const { root } = parseXmlPlist('<plist version="1.0"><array><integer>1</integer><integer>2</integer></array></plist>')
  check('XML:頂層為 array', Array.isArray(plistToJson(root)) && plistToJson(root).length === 2)
}
{
  const { root } = parseXmlPlist('<plist><dict><key>e</key><string></string></dict></plist>')
  check('XML:空字串元素', plistToJson(root).e === '')
}
check('XML:缺 plist 根 → 錯誤', !!parseXmlPlist('<foo></foo>').error)

/* ---------- 統一入口 parsePlistText ---------- */
check('parsePlistText:辨識 XML', parsePlistText(XML).format === 'XML plist' && !parsePlistText(XML).error)
{
  const bytes = buildBplist({ hi: 'there' })
  const hex = [...bytes].map((x) => x.toString(16).padStart(2, '0')).join('')
  const r = parsePlistText(hex)
  check('parsePlistText:辨識二進位(hex)', r.format === '二進位 plist' && !r.error && r.root && plistToJson(r.root).hi === 'there')
  const b64 = Buffer.from(bytes).toString('base64')
  const r2 = parsePlistText(b64)
  check('parsePlistText:辨識二進位(base64)', r2.format === '二進位 plist' && !r2.error && plistToJson(r2.root).hi === 'there')
}
check('parsePlistText:空輸入 → 錯誤', !!parsePlistText('   ').error)
check('parsePlistText:亂碼 → 錯誤', !!parsePlistText('@@@ not plist @@@').error)

console.log(fail === 0 ? '\n全部通過 🎉' : `\n${fail} 項失敗`)
process.exit(fail ? 1 : 0)
