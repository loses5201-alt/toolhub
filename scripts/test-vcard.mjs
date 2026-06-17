/*
  vCard(.vcf)聯絡人產生引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-vcard.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `vcard-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/vcard.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { escapeText, buildVCard, buildVCards, tableToContacts, isUsableContact } = await import(
  'file://' + out
)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// --- escapeText ---
check('逸出反斜線', escapeText('a\\b') === 'a\\\\b')
check('逸出逗號分號', escapeText('a,b;c') === 'a\\,b\\;c')
check('逸出換行', escapeText('a\nb') === 'a\\nb')
check('CRLF 正規化為 \\n', escapeText('a\r\nb') === 'a\\nb')
check('反斜線先處理不重複逸出', escapeText('\\,') === '\\\\\\,')
check('無特殊字元原樣', escapeText('王小明') === '王小明')

// --- buildVCard 結構 ---
const v1 = buildVCard({ name: '王小明', cell: '0912345678', email: 'a@b.com' })
check('含 BEGIN/END', v1.startsWith('BEGIN:VCARD') && v1.endsWith('END:VCARD'))
check('版本 3.0', v1.includes('VERSION:3.0'))
check('CRLF 行尾', v1.includes('\r\n') && !/[^\r]\n/.test(v1))
check('FN 顯示名', v1.includes('FN:王小明'))
check('全名時 N 放姓欄', v1.includes('N:王小明;;;;'))
check('手機 TEL CELL', v1.includes('TEL;TYPE=CELL,VOICE:0912345678'))
check('EMAIL INTERNET', v1.includes('EMAIL;TYPE=INTERNET:a@b.com'))
check('未填欄位不輸出', !v1.includes('ORG:') && !v1.includes('ADR'))

// 姓/名分開
const v2 = buildVCard({ lastName: '王', firstName: '小明' })
check('姓名分開 N', v2.includes('N:王;小明;;;'))
check('姓名分開 FN 合併', v2.includes('FN:王小明'))

// 全欄位
const v3 = buildVCard({
  name: '李美麗',
  cell: '0922000111',
  phone: '02-12345678',
  email: 'mei@example.com',
  org: '好棒公司',
  title: '經理',
  url: 'https://example.com',
  address: '台北市信義區',
  birthday: '1990-05-20',
  note: '重要客戶',
})
check('市話 TEL HOME', v3.includes('TEL;TYPE=HOME,VOICE:02-12345678'))
check('ORG', v3.includes('ORG:好棒公司'))
check('TITLE', v3.includes('TITLE:經理'))
check('ADR 放街道欄', v3.includes('ADR;TYPE=HOME:;;台北市信義區;;;;'))
check('URL 不逸出', v3.includes('URL:https://example.com'))
check('BDAY', v3.includes('BDAY:1990-05-20'))
check('NOTE', v3.includes('NOTE:重要客戶'))

// 逸出進到輸出
const v4 = buildVCard({ name: '甲,乙', note: '備註;含分號' })
check('FN 內逗號被逸出', v4.includes('FN:甲\\,乙'))
check('NOTE 內分號被逸出', v4.includes('NOTE:備註\\;含分號'))

// 顯示名 fallback 與略過
check('無名但有公司→FN 用公司', buildVCard({ org: '某公司' }).includes('FN:某公司'))
check('完全空白→空字串', buildVCard({}) === '')
check('isUsableContact 空白為 false', isUsableContact({}) === false)
check('isUsableContact 有手機為 true', isUsableContact({ cell: '0900000000' }) === true)

// --- buildVCards 批次 ---
const many = buildVCards([{ name: 'A' }, {}, { name: 'B' }])
check('批次略過空白卡', (many.match(/BEGIN:VCARD/g) || []).length === 2)
check('批次結尾含 CRLF', many.endsWith('END:VCARD\r\n'))
check('批次全空白→空字串', buildVCards([{}, {}]) === '')

// --- tableToContacts 對應 ---
const t1 = tableToContacts({
  headers: ['姓名', '手機', 'Email', '無關欄'],
  rows: [
    ['王小明', '0912345678', 'a@b.com', 'xxx'],
    ['李小華', '0922000111', 'c@d.com', 'yyy'],
  ],
})
check('對應到 3 欄', t1.mapping.length === 3)
check('未對應欄回報', t1.unmatched.join(',') === '無關欄')
check('產生 2 筆', t1.contacts.length === 2)
check('可用 2 筆', t1.usable === 2)
check('欄位值正確', t1.contacts[0].name === '王小明' && t1.contacts[0].cell === '0912345678')

// 英文欄名 + 大小寫 + 別名
const t2 = tableToContacts({
  headers: ['Name', 'MOBILE', 'company', 'job title'],
  rows: [['John', '0900', 'ACME', 'CEO']],
})
check('英文/大小寫對應', t2.mapping.length === 4)
check(
  '別名映射正確',
  t2.contacts[0].name === 'John' &&
    t2.contacts[0].cell === '0900' &&
    t2.contacts[0].org === 'ACME' &&
    t2.contacts[0].title === 'CEO',
)

// 重複對應同欄位只取第一個
const t3 = tableToContacts({ headers: ['手機', '行動電話'], rows: [['111', '222']] })
check('同欄位重複→第二個列為未對應', t3.unmatched.join(',') === '行動電話')
check('同欄位重複→取第一個', t3.contacts[0].cell === '111')

// 空白列略過
const t4 = tableToContacts({ headers: ['姓名'], rows: [['甲'], ['  '], ['乙']] })
check('全空白列被略過', t4.contacts.length === 2)

// 端到端:表格→vcf
const e2e = buildVCards(tableToContacts({ headers: ['姓名', '電話'], rows: [['測試', '02-111']] }).contacts)
check('端到端含 FN 與市話', e2e.includes('FN:測試') && e2e.includes('TEL;TYPE=HOME,VOICE:02-111'))

if (fail) {
  console.error(`\n${fail} 個測試失敗`)
  process.exit(1)
}
console.log('\n所有 vcard 測試通過')
