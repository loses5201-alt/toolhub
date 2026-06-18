/*
  測試假資料產生器 —— 純函式、無 DOM,可在 Node 直接測試。
  產生「擬真但完全虛構」的台灣個資樣本(姓名、身分證、統編、手機、市話、Email、地址、生日、公司),
  給開發/測試/教學/示範填表單用 —— 不必、也不該拿真客戶資料去測試系統。
  重點:身分證字號與統一編號都帶「正確的檢查碼」,能通過一般系統的格式驗證,
  但不對應任何真實個人或公司(檢查碼正確 ≠ 真實存在)。
  用可指定種子的偽隨機(mulberry32),同一種子產生同一批資料,方便重現與回歸測試。
*/

import { LETTER } from './twId'

// ---- 可重現的偽隨機數產生器(mulberry32) ----
export type RNG = () => number

export function mulberry32(seed: number): RNG {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 由任意字串算出 32 位種子,讓使用者能用好記的文字當種子。 */
export function seedFromString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function randInt(rng: RNG, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

export function pick<T>(rng: RNG, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

// ---- 字庫 ----
const SURNAMES =
  '陳林黃張李王吳劉蔡楊許鄭謝郭洪曾邱廖賴徐周葉蘇莊呂江何蕭羅高潘簡朱鍾彭游詹胡施沈余趙盧梁顏柯翁魏孫戴范方宋鄧杜傅侯曹薛卓阮馬董温柳'.split(
    '',
  )
const GIVEN =
  '志明家豪俊傑建宏冠廷彥廷承恩柏宇宗翰瑋庭怡君雅婷淑芬美玲心怡欣怡詩涵子涵宜蓁佳蓉雅雯思妤婉婷俊宏志偉文雄淑惠秀英麗華建良志強'.split(
    '',
  )
const CITIES: { city: string; districts: string[] }[] = [
  { city: '臺北市', districts: ['中正區', '大安區', '信義區', '士林區', '內湖區', '松山區'] },
  { city: '新北市', districts: ['板橋區', '新莊區', '中和區', '三重區', '新店區', '土城區'] },
  { city: '桃園市', districts: ['桃園區', '中壢區', '平鎮區', '八德區', '龜山區'] },
  { city: '臺中市', districts: ['西屯區', '北屯區', '南屯區', '北區', '西區', '太平區'] },
  { city: '臺南市', districts: ['東區', '北區', '安平區', '永康區', '新營區'] },
  { city: '高雄市', districts: ['三民區', '左營區', '鳳山區', '前鎮區', '苓雅區', '楠梓區'] },
  { city: '新竹市', districts: ['東區', '北區', '香山區'] },
]
const ROADS = ['中山', '中正', '民生', '民權', '建國', '復興', '和平', '忠孝', '仁愛', '信義', '光明', '文化', '成功', '自由', '永康']
const ROAD_KIND = ['路', '街', '大道']
const EMAIL_DOMAINS = ['gmail.com', 'yahoo.com.tw', 'hotmail.com', 'outlook.com', 'icloud.com', 'msn.com']
const COMPANY_WORD = ['宏', '泰', '昇', '達', '盛', '鼎', '富', '陽', '光', '匯', '聯', '群', '新', '大', '安', '禾', '展', '亞']
const COMPANY_BIZ = ['科技', '實業', '貿易', '資訊', '工程', '企業', '生技', '電子', '建設', '行銷', '物流', '國際']
const COMPANY_SUFFIX = ['股份有限公司', '有限公司', '有限公司', '企業社']
const MOBILE_PREFIX = ['0910', '0911', '0912', '0918', '0920', '0921', '0928', '0932', '0937', '0952', '0958', '0963', '0972', '0987']
const AREA_CODES = ['02', '03', '037', '04', '049', '05', '06', '07', '08']

// ---- 各欄位產生器 ----

/** 產生一個檢查碼正確的身分證字號(性別碼可指定 1 男 / 2 女)。 */
export function genTwId(rng: RNG, gender?: 1 | 2): string {
  const letters = Object.keys(LETTER)
  const letter = pick(rng, letters)
  const code = LETTER[letter]
  const n1 = Math.floor(code / 10)
  const n2 = code % 10
  const d: number[] = []
  d.push(gender ?? (pick(rng, [1, 2]) as number))
  for (let i = 1; i < 8; i++) d.push(randInt(rng, 0, 9))
  // 後 9 碼權重 8,7,6,5,4,3,2,1,1;末碼權重 1,反推使總和被 10 整除
  const w = [8, 7, 6, 5, 4, 3, 2, 1]
  let partial = n1 * 1 + n2 * 9
  for (let i = 0; i < 8; i++) partial += d[i] * w[i]
  d.push((10 - (partial % 10)) % 10)
  return letter + d.join('')
}

const VAT_WEIGHTS = [1, 2, 1, 2, 1, 2, 4, 1]

/** 產生一個檢查碼正確的統一編號(8 碼,滿足現行「位元乘積數字和被 5 整除」)。 */
export function genVat(rng: RNG): string {
  const d: number[] = []
  for (let i = 0; i < 7; i++) d.push(randInt(rng, 0, 9))
  let partial = 0
  for (let i = 0; i < 7; i++) {
    const prod = d[i] * VAT_WEIGHTS[i]
    partial += Math.floor(prod / 10) + (prod % 10)
  }
  // 末碼權重 1,其貢獻即末碼本身;選一個使總和被 5 整除的個位數
  const base = (5 - (partial % 5)) % 5
  const options = base + 5 <= 9 ? [base, base + 5] : [base]
  d.push(pick(rng, options))
  return d.join('')
}

export function genMobile(rng: RNG): string {
  let s = pick(rng, MOBILE_PREFIX)
  for (let i = 0; i < 6; i++) s += randInt(rng, 0, 9)
  return s
}

export function genLandline(rng: RNG): string {
  const area = pick(rng, AREA_CODES)
  const len = area.length === 2 ? 8 : 7 // 都會 8 碼、其餘 7 碼
  let num = ''
  for (let i = 0; i < len; i++) num += randInt(rng, 0, 9)
  return `(${area})${num}`
}

export function genName(rng: RNG): string {
  const surname = pick(rng, SURNAMES)
  const len = rng() < 0.78 ? 2 : 1
  let given = ''
  for (let i = 0; i < len; i++) given += pick(rng, GIVEN)
  return surname + given
}

export function genEmail(rng: RNG): string {
  const len = randInt(rng, 5, 9)
  const chars = 'abcdefghijklmnopqrstuvwxyz'
  let local = pick(rng, chars.split(''))
  for (let i = 1; i < len; i++) {
    local += rng() < 0.25 ? String(randInt(rng, 0, 9)) : pick(rng, chars.split(''))
  }
  return `${local}@${pick(rng, EMAIL_DOMAINS)}`
}

/** 產生生日 YYYY-MM-DD,預設年齡介於 18~75 歲(以 2025 為基準年估算)。 */
export function genBirthday(rng: RNG, minAge = 18, maxAge = 75): string {
  const year = 2025 - randInt(rng, minAge, maxAge)
  const month = randInt(rng, 1, 12)
  const day = randInt(rng, 1, 28) // 取 28 以內避免月份天數判斷
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function genAddress(rng: RNG): string {
  const c = pick(rng, CITIES)
  const dist = pick(rng, c.districts)
  const road = pick(rng, ROADS) + pick(rng, ROAD_KIND)
  const sec = rng() < 0.4 ? `${randInt(rng, 1, 5)}段` : ''
  const no = randInt(rng, 1, 480)
  const floor = rng() < 0.6 ? `${randInt(rng, 2, 18)}樓` : ''
  return `${c.city}${dist}${road}${sec}${no}號${floor}`
}

export function genCompany(rng: RNG): string {
  const a = pick(rng, COMPANY_WORD)
  const b = pick(rng, COMPANY_WORD)
  const name = a === b ? a : a + b
  return name + pick(rng, COMPANY_BIZ) + pick(rng, COMPANY_SUFFIX)
}

// ---- 欄位定義與整批產生 ----
export interface FieldDef {
  key: string
  label: string
  gen: (rng: RNG, ctx: { gender: 1 | 2 }) => string
}

export const FIELDS: FieldDef[] = [
  { key: 'name', label: '姓名', gen: (r) => genName(r) },
  { key: 'gender', label: '性別', gen: (_r, c) => (c.gender === 1 ? '男' : '女') },
  { key: 'twId', label: '身分證字號', gen: (r, c) => genTwId(r, c.gender) },
  { key: 'birthday', label: '生日', gen: (r) => genBirthday(r) },
  { key: 'mobile', label: '手機', gen: (r) => genMobile(r) },
  { key: 'landline', label: '市話', gen: (r) => genLandline(r) },
  { key: 'email', label: 'Email', gen: (r) => genEmail(r) },
  { key: 'address', label: '地址', gen: (r) => genAddress(r) },
  { key: 'company', label: '公司名稱', gen: (r) => genCompany(r) },
  { key: 'vat', label: '統一編號', gen: (r) => genVat(r) },
]

export const FIELD_MAP: Record<string, FieldDef> = Object.fromEntries(
  FIELDS.map((f) => [f.key, f]),
)

export type FakeRow = Record<string, string>

export interface GenerateOptions {
  count: number
  seed: number
  fields: string[] // 欲產生的欄位 key(依此順序)
}

/** 依選項整批產生假資料列。每列各欄位獨立隨機,但性別碼與身分證一致。 */
export function generate(opts: GenerateOptions): FakeRow[] {
  const rng = mulberry32(opts.seed)
  const fields = opts.fields.filter((k) => FIELD_MAP[k])
  const rows: FakeRow[] = []
  const n = Math.max(0, Math.min(opts.count, 5000))
  for (let i = 0; i < n; i++) {
    const gender: 1 | 2 = pick(rng, [1, 2]) as 1 | 2
    const row: FakeRow = {}
    for (const key of fields) row[key] = FIELD_MAP[key].gen(rng, { gender })
    rows.push(row)
  }
  return rows
}

/** 把資料列轉成 CSV(含表頭,自動為含逗號/引號/換行的欄位加引號)。 */
export function rowsToCsv(rows: FakeRow[], fields: string[]): string {
  const esc = (v: string) =>
    /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v
  const header = fields.map((k) => esc(FIELD_MAP[k]?.label ?? k)).join(',')
  const body = rows.map((r) => fields.map((k) => esc(r[k] ?? '')).join(',')).join('\n')
  return body ? header + '\n' + body : header
}
