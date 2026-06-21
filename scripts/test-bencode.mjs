/*
  Bencode 解碼引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-bencode.mjs
  oracle:依 BitTorrent bencode 文法手構的標準編碼(ASCII 文字 / 二進位位元組),逐項比對型別與值。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `bencode-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/bencode.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { decodeBencode, parseBencodeInput } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else { fail++; console.error(`✗ ${note}`) }
}
const enc = (s) => new TextEncoder().encode(s)
const dec = (s) => decodeBencode(enc(s))
const top = (s) => dec(s).node

// --- 整數 ---
check('i42e → int 42', top('i42e').type === 'int' && top('i42e').value === '42')
check('i-7e → int -7', top('i-7e').value === '-7')
check('i0e → int 0', top('i0e').value === '0')
check('大整數不失真', top('i9999999999999999999e').value === '9999999999999999999')
check('i-0e → error', !!dec('i-0e').error || top('i-0e') === null)
check('i03e → 前導零 error', top('i03e') === null && !!dec('i03e').error)
check('i12(未結尾) → error', top('i12') === null)

// --- 字串 ---
check('4:spam → "spam"', top('4:spam').type === 'string' && top('4:spam').value === '"spam"')
check('0: → 空字串', top('0:').type === 'string' && top('0:').value === '""')
check('UTF-8 字串', top('6:café!!').value === '"café"' || top(`${enc('café').length}:café`) !== null)
check('4:ab(長度不足) → error', top('4:ab') === null && !!dec('4:ab').error)
check('00:(前導零長度) → error', top('00:') === null)
{
  // 二進位字串:4: + 0x00010203
  const bytes = new Uint8Array([0x34, 0x3a, 0x00, 0x01, 0x02, 0x03])
  const n = decodeBencode(bytes).node
  check('二進位字串 → bytes', n.type === 'bytes' && n.value.includes('0x00010203'))
}

// --- 清單 ---
{
  const n = top('l4:spami42ee')
  check('l4:spami42ee → 清單 ["spam",42]', n.type === 'list' && n.children.length === 2 && n.children[0].value === '"spam"' && n.children[1].value === '42')
}
check('le → 空清單', top('le').type === 'list' && top('le').children.length === 0)
{
  const n = top('ll1:aee')
  check('巢狀清單 [["a"]]', n.children[0].type === 'list' && n.children[0].children[0].value === '"a"')
}

// --- 字典 ---
{
  const n = top('d3:cow3:moo4:spam4:eggse')
  check('字典 {cow:moo, spam:eggs}', n.type === 'dict' && n.entries.length === 2 && n.entries[0].key === 'cow' && n.entries[0].value.value === '"moo"' && n.entries[1].key === 'spam')
}
check('de → 空字典', top('de').type === 'dict' && top('de').entries.length === 0)
{
  const n = top('d4:listl1:a1:bee')
  check('字典含清單 {list:["a","b"]}', n.entries[0].key === 'list' && n.entries[0].value.children[1].value === '"b"')
}
check('di1ee → 鍵非字串 error', top('di1ee') === null && !!dec('di1ee').error)

// --- 類 .torrent 結構 ---
{
  const t = 'd8:announce12:http://x.y/z4:infod4:name4:test12:piece lengthi16384eee'
  const n = top(t)
  check('.torrent 結構解析', n.type === 'dict' && n.entries[0].key === 'announce')
  const info = n.entries.find((e) => e.key === 'info').value
  check('info 子字典', info.type === 'dict' && info.entries.find((e) => e.key === 'name').value.value === '"test"')
  check('piece length 整數', info.entries.find((e) => e.key === 'piece length').value.value === '16384')
}

// --- 尾端多餘 / 空輸入 ---
{
  const r = dec('i1e2:ab')
  check('尾端多餘 → 標示 trailing', r.node && r.node.value === '1' && r.trailing === 4 && !!r.error)
}
check('空輸入 → error', !!decodeBencode(new Uint8Array([])).error)

// --- parseBencodeInput 格式偵測 ---
{
  const a = parseBencodeInput('4:spam')
  check('原始 bencode 文字', a.format === 'bencode 文字' && decodeBencode(a.bytes).node.value === '"spam"')
  const h = parseBencodeInput('69343265') // hex of "i42e"
  check('hex 偵測', h.format === 'hex' && decodeBencode(h.bytes).node.value === '42')
  const b = parseBencodeInput('aTQyZQ==') // base64 of "i42e"
  check('base64 偵測', b.format === 'base64' && decodeBencode(b.bytes).node.value === '42')
  check('空輸入回 error', !!parseBencodeInput('  ').error)
}

console.log(fail ? `\n✗ ${fail} 個測試失敗` : '\n✓ 全部 bencode 測試通過')
process.exit(fail ? 1 : 0)
