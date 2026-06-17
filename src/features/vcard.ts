/*
  vCard(.vcf)聯絡人產生引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  把單一聯絡人,或一份 Excel/CSV 通訊錄(第一列為欄位名),產生符合 vCard 3.0 的 .vcf,
  直接匯入 iPhone / Android / Google / Apple / Outlook 聯絡人。線上 CSV→vCard 轉換器
  常要你把含姓名電話的個資名單上傳到別人伺服器;本引擎全程在瀏覽器處理、不上傳。
  採 vCard 3.0(相容性最佳),CRLF 行尾;為避免折行截斷中文,不做 line folding(RFC 為 SHOULD)。
*/

export interface Contact {
  name?: string // 全名(FN)
  lastName?: string // 姓
  firstName?: string // 名
  cell?: string // 手機
  phone?: string // 市話/其他電話
  email?: string
  org?: string // 公司/單位
  title?: string // 職稱
  url?: string // 網址
  address?: string // 地址
  birthday?: string // 生日(YYYY-MM-DD 最佳)
  note?: string // 備註
}

export interface Table {
  headers: string[]
  rows: string[][]
}

const CRLF = '\r\n'

/** 逸出 vCard 文字值:反斜線、換行、逗號、分號(RFC 6350 §3.4)。順序:先處理反斜線。 */
export function escapeText(s: string): string {
  return s
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

/** 電話/網址等非文字型值:不做逸出,只去掉換行避免破壞單行結構。 */
function oneLine(s: string): string {
  return s.replace(/[\r\n]+/g, ' ').trim()
}

function pick(c: Contact): { fn: string; nFamily: string; nGiven: string } {
  const family = (c.lastName ?? '').trim()
  const given = (c.firstName ?? '').trim()
  const name = (c.name ?? '').trim()
  // FN(顯示名)優先序:全名 → 姓+名 → 公司 → 手機/市話 → email
  const fn =
    name ||
    `${family}${given}`.trim() ||
    (c.org ?? '').trim() ||
    (c.cell ?? '').trim() ||
    (c.phone ?? '').trim() ||
    (c.email ?? '').trim()
  return { fn, nFamily: family, nGiven: given }
}

/** 此聯絡人是否有足以建卡的內容(至少有顯示名)。 */
export function isUsableContact(c: Contact): boolean {
  return pick(c).fn !== ''
}

/** 產生單一 vCard(不含結尾 CRLF)。無可用顯示名時回傳空字串。 */
export function buildVCard(c: Contact): string {
  const { fn, nFamily, nGiven } = pick(c)
  if (!fn) return ''

  const lines: string[] = ['BEGIN:VCARD', 'VERSION:3.0']

  // N(結構化姓名):分號分隔 姓;名;中間名;前綴;後綴。只有全名時整個放「姓」欄。
  if (nFamily || nGiven) {
    lines.push(`N:${escapeText(nFamily)};${escapeText(nGiven)};;;`)
  } else {
    lines.push(`N:${escapeText(fn)};;;;`)
  }
  lines.push(`FN:${escapeText(fn)}`)

  const cell = (c.cell ?? '').trim()
  if (cell) lines.push(`TEL;TYPE=CELL,VOICE:${oneLine(cell)}`)
  const phone = (c.phone ?? '').trim()
  if (phone) lines.push(`TEL;TYPE=HOME,VOICE:${oneLine(phone)}`)

  const email = (c.email ?? '').trim()
  if (email) lines.push(`EMAIL;TYPE=INTERNET:${oneLine(email)}`)

  const org = (c.org ?? '').trim()
  if (org) lines.push(`ORG:${escapeText(org)}`)
  const title = (c.title ?? '').trim()
  if (title) lines.push(`TITLE:${escapeText(title)}`)

  const address = (c.address ?? '').trim()
  if (address) lines.push(`ADR;TYPE=HOME:;;${escapeText(address)};;;;`)

  const url = (c.url ?? '').trim()
  if (url) lines.push(`URL:${oneLine(url)}`)

  const birthday = (c.birthday ?? '').trim()
  if (birthday) lines.push(`BDAY:${oneLine(birthday)}`)

  const note = (c.note ?? '').trim()
  if (note) lines.push(`NOTE:${escapeText(note)}`)

  lines.push('END:VCARD')
  return lines.join(CRLF)
}

/** 產生多張 vCard(略過無顯示名者),回傳完整 .vcf 內容(結尾含 CRLF)。 */
export function buildVCards(contacts: Contact[]): string {
  const cards = contacts.map(buildVCard).filter((v) => v !== '')
  if (cards.length === 0) return ''
  return cards.join(CRLF) + CRLF
}

// 欄位名 → Contact 欄位的對照(含常見中英文同義詞,比對時轉小寫去空白)。
const FIELD_ALIASES: Record<keyof Contact, string[]> = {
  name: ['姓名', '名字', '全名', '聯絡人', '聯絡人姓名', 'name', 'fullname', 'full name'],
  lastName: ['姓', '姓氏', 'lastname', 'last name', 'family', 'family name', 'surname'],
  firstName: ['名', 'firstname', 'first name', 'given', 'given name'],
  cell: ['手機', '行動電話', '手機號碼', '行動', 'mobile', 'cell', 'cellphone', 'cell phone'],
  phone: ['電話', '市話', '室內電話', '住家電話', '公司電話', '聯絡電話', 'tel', 'phone', 'telephone'],
  email: ['email', 'e-mail', 'mail', '信箱', '電子郵件', '郵件', '電郵', '電子信箱'],
  org: ['公司', '單位', '機關', '組織', '服務單位', '公司名稱', 'org', 'organization', 'company'],
  title: ['職稱', '職位', '頭銜', 'title', 'job', 'job title', 'position'],
  url: ['網址', '網站', '個人網站', 'url', 'website', 'web', 'homepage'],
  address: ['地址', '住址', '通訊地址', '聯絡地址', 'address', 'addr'],
  birthday: ['生日', '出生日期', '生辰', 'birthday', 'bday', 'birth', 'dob'],
  note: ['備註', '註記', '說明', '附註', 'note', 'notes', 'memo', 'remark'],
}

function matchField(header: string): keyof Contact | null {
  const key = header.trim().toLowerCase().replace(/\s+/g, ' ')
  for (const field of Object.keys(FIELD_ALIASES) as (keyof Contact)[]) {
    if (FIELD_ALIASES[field].includes(key)) return field
  }
  return null
}

export interface TableMapResult {
  contacts: Contact[]
  mapping: { header: string; field: keyof Contact }[] // 有對應到的欄位
  unmatched: string[] // 沒對應到、被忽略的欄位名
  usable: number // 可建卡的聯絡人數
}

/**
 * 把表格(第一列欄位名)轉成聯絡人陣列。依欄位名同義詞自動對應到 vCard 欄位。
 * 同一個 vCard 欄位若有多個來源欄,取第一個有對應的;未對應的欄位回報在 unmatched。
 */
export function tableToContacts(table: Table): TableMapResult {
  const mapping: { header: string; field: keyof Contact }[] = []
  const unmatched: string[] = []
  const colField: (keyof Contact | null)[] = []
  const used = new Set<keyof Contact>()

  table.headers.forEach((h) => {
    if (h.trim() === '') {
      colField.push(null)
      return
    }
    const f = matchField(h)
    if (f && !used.has(f)) {
      used.add(f)
      colField.push(f)
      mapping.push({ header: h, field: f })
    } else {
      colField.push(null)
      unmatched.push(h)
    }
  })

  const contacts: Contact[] = table.rows
    .filter((r) => r.some((c) => (c ?? '').trim() !== ''))
    .map((cells) => {
      const c: Contact = {}
      colField.forEach((field, i) => {
        if (field) {
          const v = (cells[i] ?? '').trim()
          if (v) c[field] = v
        }
      })
      return c
    })

  return {
    contacts,
    mapping,
    unmatched,
    usable: contacts.filter(isUsableContact).length,
  }
}
