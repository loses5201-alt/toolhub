/*
  ASN.1 / DER 解碼引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-asn1.mjs
  oracle:手構的標準 DER TLV 編碼(X.690),逐項比對 tag/長度/解碼值與 OID 名稱。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `asn1-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/asn1.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { decodeDer, decodeOid, parseDerInput, oidName } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else { fail++; console.error(`✗ ${note}`) }
}
const U = (...a) => Uint8Array.from(a)
const dec = (arr) => decodeDer(U(...arr))

// --- 基本型別 ---
check('INTEGER 5', dec([0x02, 0x01, 0x05]).nodes[0].value === '5 (0x05)')
check('INTEGER 256(雙位元組)', dec([0x02, 0x02, 0x01, 0x00]).nodes[0].value === '256 (0x0100)')
check('INTEGER 負數 -1', dec([0x02, 0x01, 0xff]).nodes[0].value === '-1 (0xff)')
check('BOOLEAN TRUE', dec([0x01, 0x01, 0xff]).nodes[0].value === 'TRUE')
check('BOOLEAN FALSE', dec([0x01, 0x01, 0x00]).nodes[0].value === 'FALSE')
check('NULL', dec([0x05, 0x00]).nodes[0].value === 'NULL')
const n0 = dec([0x05, 0x00]).nodes[0]
check('NULL tagName', n0.tagName === 'NULL' && n0.length === 0)

// --- 字串 ---
check('UTF8String Hi', dec([0x0c, 0x02, 0x48, 0x69]).nodes[0].value === 'Hi')
check('PrintableString US', dec([0x13, 0x02, 0x55, 0x53]).nodes[0].value === 'US')
check('字串 tagName', dec([0x0c, 0x02, 0x48, 0x69]).nodes[0].tagName === 'UTF8String')

// --- OID ---
check('decodeOid sha256WithRSA', decodeOid(U(0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0b), 0, 9) === '1.2.840.113549.1.1.11')
const oidNode = dec([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0b]).nodes[0]
check('OID node 含名稱', oidNode.value === '1.2.840.113549.1.1.11 — sha256WithRSAEncryption')
check('oidName 查表', oidName('2.5.4.3') === 'commonName (CN)')
check('oidName 未知回空', oidName('1.2.3.4.5') === '')
check('OID 1.3.101.112 Ed25519', dec([0x06, 0x03, 0x2b, 0x65, 0x70]).nodes[0].value.includes('Ed25519'))

// --- SEQUENCE 巢狀 ---
const seq = dec([0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x02])
check('SEQUENCE tagName', seq.nodes[0].tagName === 'SEQUENCE' && seq.nodes[0].constructed === true)
check('SEQUENCE 子節點數', seq.nodes[0].children.length === 2)
check('SEQUENCE 子值', seq.nodes[0].children[0].value === '1 (0x01)' && seq.nodes[0].children[1].value === '2 (0x02)')

// --- AlgorithmIdentifier = SEQUENCE{ OID, NULL } ---
const alg = dec([0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0b, 0x05, 0x00])
check('AlgId OID', alg.nodes[0].children[0].value.includes('sha256WithRSAEncryption'))
check('AlgId NULL', alg.nodes[0].children[1].value === 'NULL')

// --- 長式長度 ---
const big = [0x04, 0x81, 0xc8, ...new Array(200).fill(0x41)]
const bigN = dec(big).nodes[0]
check('長式長度 length=200', bigN.length === 200)
check('長式長度 headerLength=3', bigN.headerLength === 3)
check('OCTET STRING tagName', bigN.tagName === 'OCTET STRING')

// --- context tag ---
const ctx = dec([0xa0, 0x03, 0x02, 0x01, 0x05])
check('context [0] tagName', ctx.nodes[0].tagName === '[0]' && ctx.nodes[0].tagClass === 'context')
check('context 子節點', ctx.nodes[0].children[0].value === '5 (0x05)')

// --- BIT STRING / OCTET STRING 內嵌 DER ---
const bit = dec([0x03, 0x06, 0x00, 0x30, 0x03, 0x02, 0x01, 0x07])
check('BIT STRING 未使用 bit', bit.nodes[0].value === '未使用 0 bit')
check('BIT STRING 內嵌 SEQUENCE', bit.nodes[0].children && bit.nodes[0].children[0].tagName === 'SEQUENCE')
const oct = dec([0x04, 0x05, 0x30, 0x03, 0x02, 0x01, 0x05])
check('OCTET STRING 內嵌 SEQUENCE', oct.nodes[0].children && oct.nodes[0].children[0].children[0].value === '5 (0x05)')
const octRaw = dec([0x04, 0x03, 0x02, 0x01, 0x05]) // 內含 INTEGER(基本型別)不誤遞迴
check('OCTET STRING 不誤判基本型別', !octRaw.nodes[0].children)

// --- 錯誤:BER 不定長度 ---
const ber = dec([0x30, 0x80, 0x00, 0x00])
check('BER 不定長度報錯', !!ber.error && ber.error.includes('不定長度'))

// --- parseDerInput:hex / base64 / PEM ---
check('parseDerInput hex', (() => { const r = parseDerInput('020105'); return r.format === 'hex' && r.bytes[0] === 2 && r.bytes[2] === 5 })())
check('parseDerInput base64', (() => { const r = parseDerInput(Buffer.from([2, 1, 5]).toString('base64')); return r.format === 'base64' && r.bytes.length === 3 })())
const pem = `-----BEGIN CERTIFICATE-----\n${Buffer.from([0x30, 0x03, 0x02, 0x01, 0x07]).toString('base64')}\n-----END CERTIFICATE-----`
check('parseDerInput PEM', (() => { const r = parseDerInput(pem); return r.format === 'PEM' && r.bytes[0] === 0x30 })())
check('parseDerInput 空輸入報錯', !!parseDerInput('').error)
check('parseDerInput PEM→decode', decodeDer(parseDerInput(pem).bytes).nodes[0].children[0].value === '7 (0x07)')

if (fail) { console.error(`\n${fail} 項測試失敗`); process.exit(1) }
else console.log('\n所有 ASN.1 / DER 解碼測試通過')
