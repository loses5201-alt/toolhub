/*
  vCard(.vcf)解析引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-vcardparse.mjs
  oracle:RFC 6350(vCard 3.0/4.0)結構、折行、跳脫與 vCard 2.1 QUOTED-PRINTABLE 規則,以手構樣本逐欄比對。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `vcard-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/vcardParse.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { parseVcards, unfoldLines, parseLine, unescapeText } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else { fail++; console.error(`✗ ${note}`) }
}

// --- unfoldLines ---
const uf = unfoldLines('NOTE:Hello\n World\nFN:Bob')
check('折行:續行接回(RFC 6350 移除單一前導空白、不補空格)', uf[0] === 'NOTE:HelloWorld')
check('折行:正常行不變', uf[1] === 'FN:Bob')

// --- parseLine ---
const pl = parseLine('TEL;TYPE=CELL,HOME:0912345678')
check('parseLine name', pl.name === 'TEL')
check('parseLine types', pl.types.includes('CELL') && pl.types.includes('HOME'))
check('parseLine value', pl.value === '0912345678')
check('parseLine group 前綴去除', parseLine('item1.EMAIL:a@b.com').name === 'EMAIL')
check('parseLine 2.1 簡寫 type', parseLine('TEL;HOME;VOICE:123').types.includes('HOME'))
const qpLine = parseLine('FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=E6=B8=AC=E8=A9=A6')
check('parseLine QUOTED-PRINTABLE 解碼', qpLine.value === '測試')

// --- unescapeText ---
check('unescape \\n→換行', unescapeText('a\\nb') === 'a\nb')
check('unescape \\, 與 \\;', unescapeText('a\\,b\\;c') === 'a,b;c')

// --- 單張 vCard 3.0 ---
const one = `BEGIN:VCARD
VERSION:3.0
N:王;小明;;;
FN:王小明
ORG:某某公司;研發部
TITLE:工程師
TEL;TYPE=CELL:0912345678
TEL;TYPE=WORK:02-12345678
EMAIL;TYPE=INTERNET:ming@example.com
ADR;TYPE=HOME:;;信義路五段7號;台北市;;110;台灣
NOTE:第一行\\n第二行
END:VCARD`
const [c] = parseVcards(one)
check('FN', c.fn === '王小明')
check('N 結構', c.n[0] === '王' && c.n[1] === '小明')
check('ORG 合併', c.org === '某某公司 · 研發部')
check('TITLE', c.title === '工程師')
check('TEL 兩支', c.tels.length === 2 && c.tels[0].value === '0912345678')
check('TEL 類型', c.tels[1].types.includes('WORK'))
check('EMAIL', c.emails[0].value === 'ming@example.com')
check('ADR 合併非空欄位', c.adrs[0].value === '信義路五段7號, 台北市, 110, 台灣')
check('NOTE 跳脫換行', c.note === '第一行\n第二行')

// --- 多張 + 從 N 推導 FN ---
const many = `BEGIN:VCARD
VERSION:3.0
FN:Alice
END:VCARD
BEGIN:VCARD
VERSION:4.0
N:Smith;Bob;;Dr;
END:VCARD`
const list = parseVcards(many)
check('兩張名片', list.length === 2)
check('第一張 FN', list[0].fn === 'Alice')
check('第二張由 N 推導 FN(prefix given family)', list[1].fn === 'Dr Bob Smith')

// --- 折行的長 NOTE ---
const folded = `BEGIN:VCARD
VERSION:3.0
FN:Long
NOTE:這是一段很長的備
 註會被折行
END:VCARD`
check('折行 NOTE 還原', parseVcards(folded)[0].note === '這是一段很長的備註會被折行')

// --- 邊界 ---
check('空字串回空', parseVcards('').length === 0)
check('無 VCARD 回空', parseVcards('hello world').length === 0)
check('raw 保留', parseVcards(one)[0].raw.startsWith('BEGIN:VCARD') && parseVcards(one)[0].raw.endsWith('END:VCARD'))

if (fail) { console.error(`\n${fail} 項測試失敗`); process.exit(1) }
else console.log('\n所有 vCard 解析測試通過')
