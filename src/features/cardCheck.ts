/*
  信用卡 / 金融卡卡號檢核引擎 —— 純函式、與 DOM 無關,可在 Node 跑回歸測試。
  用 Luhn 檢查碼驗證卡號是否「打對了」(抓出少打/多打/打錯一碼),
  並依卡號開頭(IIN/BIN)與長度判斷發卡組織(Visa / Mastercard / JCB 等)。
  全程本機計算 —— 明確聲明「檢查碼正確 ≠ 真有這張卡、≠ 卡片有效」,僅供格式核對。
*/

export type Brand =
  | 'Visa'
  | 'Mastercard'
  | 'American Express'
  | 'JCB'
  | 'UnionPay'
  | 'Discover'
  | 'Diners Club'
  | 'Unknown'

// Luhn(模 10)檢查碼驗證。輸入須為純數字字串。
export function luhnValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false
  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48
    if (double) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    double = !double
  }
  return sum % 10 === 0
}

interface BrandRule {
  brand: Brand
  lengths: number[]
  test: (d: string) => boolean
}

function inRange(prefix: string, lo: number, hi: number): boolean {
  const n = Number(prefix)
  return n >= lo && n <= hi
}

// 規則順序很重要:較專一的(如 UnionPay 62、Discover 6011)要排在前面。
const RULES: BrandRule[] = [
  { brand: 'American Express', lengths: [15], test: (d) => /^3[47]/.test(d) },
  { brand: 'Diners Club', lengths: [14, 15, 16, 17, 18, 19], test: (d) => /^3(0[0-5]|[689])/.test(d) },
  { brand: 'JCB', lengths: [16, 17, 18, 19], test: (d) => inRange(d.slice(0, 4), 3528, 3589) },
  { brand: 'Visa', lengths: [13, 16, 19], test: (d) => /^4/.test(d) },
  {
    brand: 'Mastercard',
    lengths: [16],
    test: (d) => inRange(d.slice(0, 2), 51, 55) || inRange(d.slice(0, 4), 2221, 2720),
  },
  { brand: 'UnionPay', lengths: [16, 17, 18, 19], test: (d) => /^62/.test(d) },
  {
    brand: 'Discover',
    lengths: [16, 17, 18, 19],
    test: (d) => /^65/.test(d) || /^6011/.test(d) || inRange(d.slice(0, 3), 644, 649),
  },
]

// 依開頭判斷發卡組織(不檢查長度;長度由 checkCard 另外核對提示)。
export function detectBrand(digits: string): Brand {
  for (const r of RULES) {
    if (r.test(digits)) return r.brand
  }
  return 'Unknown'
}

export interface CardResult {
  ok: boolean // Luhn 通過且長度符合該卡別
  digits: string // 去除空白/連字號後的純數字
  brand: Brand
  luhn: boolean // Luhn 檢查碼是否通過
  lengthOk: boolean // 長度是否符合該卡別常見長度(Unknown 時以 12–19 概估)
  formatted: string // 依卡別分組加空白,方便核對
  message: string // 友善說明
}

// 依卡別分組:AmEx 4-6-5,其餘每 4 碼一組。
export function formatCardNumber(digits: string, brand: Brand): string {
  if (!digits) return ''
  if (brand === 'American Express') {
    return [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10, 15)].filter(Boolean).join(' ')
  }
  return digits.match(/.{1,4}/g)?.join(' ') ?? digits
}

export function checkCard(input: string): CardResult {
  const digits = input.replace(/[\s-]/g, '')
  const brand = detectBrand(digits)
  const luhn = luhnValid(digits)
  const rule = RULES.find((r) => r.brand === brand)
  const lengthOk = rule ? rule.lengths.includes(digits.length) : digits.length >= 12 && digits.length <= 19
  const formatted = formatCardNumber(digits, brand)

  let message: string
  if (!digits) message = '請輸入卡號'
  else if (!/^\d+$/.test(digits)) message = '卡號只能包含數字、空白或連字號'
  else if (!lengthOk && rule) message = `長度不符:${brand} 卡號應為 ${rule.lengths.join(' 或 ')} 碼,你輸入了 ${digits.length} 碼`
  else if (!luhn) message = '檢查碼不通過 —— 卡號可能打錯了(少打、多打或某一碼錯誤)'
  else message = '卡號格式正確(檢查碼通過)'

  const ok = !!digits && /^\d+$/.test(digits) && luhn && lengthOk
  return { ok, digits, brand, luhn, lengthOk, formatted, message }
}
