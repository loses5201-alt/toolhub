/*
  Python pickle 反組譯器的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-pickle.mjs
  oracle:由 CPython 的 pickle.dumps() 實際產生的 pickle 位元組(以 base64 內嵌,涵蓋 protocol 0~5),
  解回來後比對重建的資料結構與 opcode 序列 —— 測試本身不需要 Python。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `pickle-test-${Date.now()}.mjs`)
await build({ entryPoints: ['src/features/pickle.ts'], bundle: true, format: 'esm', outfile: out, logLevel: 'silent' })
const { disassemblePickle, parsePickleInput } = await import('file://' + out)

let fail = 0
function check(note, cond) { if (cond) console.log(`✓ ${note}`); else { fail++; console.error(`✗ ${note}`) } }
const b64 = (s) => Uint8Array.from(Buffer.from(s, 'base64'))
const dec = (s) => disassemblePickle(b64(s))

// 把重建節點轉成可比對的 plain JS
function toPlain(n) {
  if (!n) return undefined
  switch (n.type) {
    case 'int': return BigInt(n.value)
    case 'float': return Number(n.value)
    case 'bool': return n.value === 'True'
    case 'none': return null
    case 'string': return n.value.replace(/^"|"$/g, '')
    case 'bytes': return '<bytes>'
    case 'list': case 'tuple': return (n.children || []).map(toPlain)
    case 'set': return (n.children || []).map(toPlain).sort((a, b) => String(a) < String(b) ? -1 : 1)
    case 'dict': { const o = {}; for (const e of n.entries || []) o[String(toPlain(e.key))] = toPlain(e.value); return o }
    default: return n.value
  }
}
function eq(a, b) {
  if (typeof a === 'bigint' || typeof b === 'bigint') { try { return BigInt(a) === BigInt(b) } catch { return false } }
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => eq(x, b[i]))
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a), kb = Object.keys(b)
    return ka.length === kb.length && ka.every((k) => eq(a[k], b[k]))
  }
  return false
}
function value(note, b64s, expected) {
  const r = dec(b64s)
  check(note, !r.error && eq(toPlain(r.value), expected))
}

/* ---------- 純量(protocol 0 與 2 並行驗證)---------- */
value('int 42 (p0)', 'STQyCi4=', 42n)
value('int 42 (p2)', 'gAJLKi4=', 42n)
value('int -5 (p2)', 'gAJK+////y4=', -5n)
value('bigint 10^20 (p2)', 'gAKKCQAAEGMtXsdrBS4=', 100000000000000000000n)
value('float 3.14 (p2)', 'gAJHQAkeuFHrhR8u', 3.14)
value('float 3.14 (p0)', 'RjMuMTQKLg==', 3.14)
value('True (p2)', 'gAKILg==', true)
value('False (p2)', 'gAKJLg==', false)
value('None (p2)', 'gAJOLg==', null)
value('str ascii (p2)', 'gAJYBQAAAGhlbGxvcQAu', 'hello')
value('str ascii (p0)', 'VmhlbGxvCnAwCi4=', 'hello')
value('str unicode 台北🌟 (p2)', 'gAJYCgAAAOWPsOWMl/CfjJ9xAC4=', '台北🌟')
check('bytes (p3) 型別', dec('gANDBN6tvu9xAC4=').value.type === 'bytes' && !dec('gANDBN6tvu9xAC4=').error)

/* ---------- 容器 ---------- */
value('list [1,2,3] (p2)', 'gAJdcQAoSwFLAksDZS4=', [1n, 2n, 3n])
value('list [1,2,3] (p0)', 'KGxwMApJMQphSTIKYUkzCmEu', [1n, 2n, 3n])
value('empty list (p2)', 'gAJdcQAu', [])
value('tuple (1,2,3) (p2)', 'gAJLAUsCSwOHcQAu', [1n, 2n, 3n])
value('tuple1 (1,) (p2)', 'gAJLAYVxAC4=', [1n])
value('empty tuple (p2)', 'gAIpLg==', [])
value('dict {a:1,b:2} (p2)', 'gAJ9cQAoWAEAAABhcQFLAVgBAAAAYnECSwJ1Lg==', { a: 1n, b: 2n })
value('dict {a:1,b:2} (p0)', 'KGRwMApWYQpwMQpJMQpzVmIKcDIKSTIKcy4=', { a: 1n, b: 2n })
value('empty dict (p2)', 'gAJ9cQAu', {})
value('set {1,2,3} (p4)', 'gASVCwAAAAAAAACPlChLAUsCSwOQLg==', [1n, 2n, 3n])
value('frozenset {1,2} (p4)', 'gASVCAAAAAAAAAAoSwFLApGULg==', [1n, 2n])

/* ---------- 巢狀(三種 protocol)---------- */
const NESTED = { list: [true, false], info: { k: 'v', n: 7n } }
value('nested (p2)', 'gAJ9cQAoWAQAAABsaXN0cQFdcQIoiIllWAQAAABpbmZvcQN9cQQoWAEAAABrcQVYAQAAAHZxBlgBAAAAbnEHSwd1dS4=', NESTED)
value('nested (p4)', 'gASVKwAAAAAAAAB9lCiMBGxpc3SUXZQoiIlljARpbmZvlH2UKIwBa5SMAXaUjAFulEsHdXUu', NESTED)
value('nested (p0)', 'KGRwMApWeApwMQoobHAyCkkxCmEobHAzCkkyCmFJMwphYXMu', { x: [1n, [2n, 3n]] })

/* ---------- GLOBAL / REDUCE(⚠️ 真正執行時會 import 並呼叫的危險 opcode)---------- */
{
  const r = dec('gAJjY29sbGVjdGlvbnMKT3JkZXJlZERpY3QKcQApUnEBWAEAAABhcQJLAXMu')
  const names = r.ops.map((o) => o.name)
  check('OrderedDict(p2):無錯誤', !r.error)
  check('OrderedDict(p2):含 GLOBAL', names.includes('GLOBAL'))
  check('OrderedDict(p2):含 REDUCE', names.includes('REDUCE'))
  check('OrderedDict(p2):GLOBAL 指向 collections.OrderedDict', r.ops.some((o) => o.name === 'GLOBAL' && o.arg.includes('OrderedDict')))
}
{
  const r = dec('gASVKQAAAAAAAACMC2NvbGxlY3Rpb25zlIwLT3JkZXJlZERpY3SUk5QpUpSMAWGUSwFzLg==')
  const names = r.ops.map((o) => o.name)
  check('OrderedDict(p4):含 STACK_GLOBAL', names.includes('STACK_GLOBAL'))
  check('OrderedDict(p4):含 MEMOIZE', names.includes('MEMOIZE'))
  check('OrderedDict(p4):重建 global 名稱', r.value && JSON.stringify(r.value).includes('collections.OrderedDict'))
}
{
  // complex(2+3j):__builtin__.complex + BINFLOAT*2 + TUPLE2 + REDUCE
  const r = dec('gAJjX19idWlsdGluX18KY29tcGxleApxAEdAAAAAAAAAAEdACAAAAAAAAIZxAVJxAi4=')
  const seq = r.ops.map((o) => o.name)
  check('complex(p2):opcode 序列正確', JSON.stringify(seq) === JSON.stringify(['PROTO', 'GLOBAL', 'BINPUT', 'BINFLOAT', 'BINFLOAT', 'TUPLE2', 'BINPUT', 'REDUCE', 'BINPUT', 'STOP']))
  check('complex(p2):BINFLOAT 解為 2.0 / 3.0', r.ops.filter((o) => o.name === 'BINFLOAT').map((o) => o.arg).join(',') === '2,3')
}
{
  const r = dec('gASVIAAAAAAAAACMCGRhdGV0aW1llIwEZGF0ZZSTlEMEB+QBApSFlFKULg==')
  check('datetime.date(p4):無錯誤且含 REDUCE', !r.error && r.ops.some((o) => o.name === 'REDUCE'))
}

/* ---------- protocol 偵測 ---------- */
check('protocol=0(無 PROTO opcode)', dec('STQyCi4=').protocol === null)
check('protocol=2', dec('gAJLKi4=').protocol === 2)
check('protocol=4', dec('gASVCwAAAAAAAACPlChLAUsCSwOQLg==').protocol === 4)

/* ---------- 錯誤路徑 ---------- */
check('未知 opcode → 錯誤', !!disassemblePickle(Uint8Array.from([0xff, 0x2e])).error)
check('缺 STOP → 錯誤', !!disassemblePickle(Uint8Array.from([0x4b, 0x01])).error)
check('截斷 BININT → 錯誤', !!disassemblePickle(Uint8Array.from([0x4a, 0x01, 0x02])).error)

/* ---------- parsePickleInput 格式偵測 ---------- */
check('parsePickleInput:base64', parsePickleInput('gAJLKi4=').format === 'base64')
check('parsePickleInput:hex', parsePickleInput('80024b2a2e').format === 'hex')
check('parsePickleInput:空 → 錯誤', !!parsePickleInput('  ').error)
{
  // protocol 0 文字 pickle 直接貼上(latin1 退回)
  const txt = Buffer.from('STQyCi4=', 'base64').toString('latin1')
  const p = parsePickleInput(txt)
  check('parsePickleInput:文字 pickle latin1 退回', p.bytes && disassemblePickle(p.bytes).value && disassemblePickle(p.bytes).value.value === '42')
}

console.log(fail === 0 ? '\n全部通過 🎉' : `\n${fail} 項失敗`)
process.exit(fail ? 1 : 0)
