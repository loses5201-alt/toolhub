/*
  IBAN(國際銀行帳號,ISO 13616)驗證 / 格式化引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  IBAN 結構:2 碼國別 + 2 碼檢查碼 + 該國銀行帳號(BBAN)。
  驗證採 mod-97-10(ISO 7064):把前 4 碼搬到尾端,字母換成 A=10…Z=35,整串對 97 取餘須等於 1。
  另依各國固定長度表檢查總長度。全程在你的瀏覽器計算,不連網、不上傳。
*/

// IBAN 註冊處各國總長度(常用國別子集)
export const IBAN_LENGTHS: Record<string, number> = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22, BR: 29,
  BY: 28, CH: 21, CR: 22, CY: 28, CZ: 24, DE: 22, DK: 18, DO: 28, EE: 20, EG: 29,
  ES: 24, FI: 18, FO: 18, FR: 27, GB: 22, GE: 22, GI: 23, GL: 18, GR: 27, GT: 28,
  HR: 21, HU: 28, IE: 22, IL: 23, IQ: 23, IS: 26, IT: 27, JO: 30, KW: 30, KZ: 20,
  LB: 28, LC: 32, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MD: 24, ME: 22, MK: 19,
  MR: 27, MT: 31, MU: 30, NL: 18, NO: 15, PK: 24, PL: 28, PS: 29, PT: 25, QA: 29,
  RO: 24, RS: 22, SA: 24, SC: 31, SE: 24, SI: 19, SK: 24, SM: 27, ST: 25, SV: 28,
  TL: 23, TN: 24, TR: 26, UA: 29, VA: 22, VG: 24, XK: 20,
}

export const COUNTRY_NAMES: Record<string, string> = {
  AD: '安道爾', AE: '阿聯', AT: '奧地利', BE: '比利時', BG: '保加利亞', BH: '巴林',
  CH: '瑞士', CY: '賽普勒斯', CZ: '捷克', DE: '德國', DK: '丹麥', EE: '愛沙尼亞',
  EG: '埃及', ES: '西班牙', FI: '芬蘭', FR: '法國', GB: '英國', GR: '希臘',
  HR: '克羅埃西亞', HU: '匈牙利', IE: '愛爾蘭', IL: '以色列', IS: '冰島', IT: '義大利',
  KW: '科威特', LI: '列支敦士登', LT: '立陶宛', LU: '盧森堡', LV: '拉脫維亞', MC: '摩納哥',
  MT: '馬爾他', NL: '荷蘭', NO: '挪威', PL: '波蘭', PT: '葡萄牙', QA: '卡達',
  RO: '羅馬尼亞', RS: '塞爾維亞', SA: '沙烏地阿拉伯', SE: '瑞典', SI: '斯洛維尼亞',
  SK: '斯洛伐克', SM: '聖馬利諾', TR: '土耳其', UA: '烏克蘭', VA: '梵蒂岡',
}

/** 去除空白與標點並轉大寫。 */
export function normalizeIban(input: string): string {
  return (input || '').replace(/[\s-]/g, '').toUpperCase()
}

/** mod-97-10:回傳整串(已搬移前 4 碼)對 97 的餘數。 */
export function mod97(rearranged: string): number {
  // 把每個字母換成兩位數字,逐塊取餘以避免大數溢位
  let remainder = 0
  for (const ch of rearranged) {
    let part: string
    if (ch >= '0' && ch <= '9') part = ch
    else if (ch >= 'A' && ch <= 'Z') part = String(ch.charCodeAt(0) - 55) // A=10
    else return -1 // 非法字元
    for (const d of part) {
      remainder = (remainder * 10 + (d.charCodeAt(0) - 48)) % 97
    }
  }
  return remainder
}

export interface IbanResult {
  valid: boolean
  normalized: string
  formatted: string
  country: string
  countryName?: string
  checkDigits: string
  bban: string
  expectedLength?: number
  errors: string[]
}

/** 每 4 碼一組的可讀格式。 */
export function formatIban(normalized: string): string {
  return normalized.replace(/(.{4})/g, '$1 ').trim()
}

/** 驗證 IBAN,回傳結構化結果(含錯誤原因)。 */
export function validateIban(input: string): IbanResult {
  const normalized = normalizeIban(input)
  const errors: string[] = []
  const country = normalized.slice(0, 2)
  const checkDigits = normalized.slice(2, 4)
  const bban = normalized.slice(4)
  const res: IbanResult = {
    valid: false,
    normalized,
    formatted: formatIban(normalized),
    country,
    countryName: COUNTRY_NAMES[country],
    checkDigits,
    bban,
    expectedLength: IBAN_LENGTHS[country],
    errors,
  }
  if (normalized.length < 4) {
    errors.push('長度太短(至少 4 碼:國別 + 檢查碼)')
    return res
  }
  if (!/^[A-Z]{2}$/.test(country)) errors.push('前 2 碼必須是英文國別代碼')
  if (!/^[0-9]{2}$/.test(checkDigits)) errors.push('第 3、4 碼必須是數字檢查碼')
  if (!/^[0-9A-Z]+$/.test(normalized)) errors.push('含非法字元(只能是英數字)')
  const expected = IBAN_LENGTHS[country]
  if (expected === undefined) {
    errors.push(`未知或不支援的國別代碼:${country || '(空)'}`)
  } else if (normalized.length !== expected) {
    errors.push(`長度應為 ${expected} 碼(${country}),目前 ${normalized.length} 碼`)
  }
  if (errors.length === 0) {
    const rearranged = normalized.slice(4) + normalized.slice(0, 4)
    if (mod97(rearranged) !== 1) errors.push('檢查碼驗證失敗(mod-97 ≠ 1),帳號可能輸入錯誤')
  }
  res.valid = errors.length === 0
  return res
}

/** 由不含檢查碼的 IBAN(國別 + 「00」+ BBAN)推算正確的兩碼檢查碼。 */
export function computeCheckDigits(countryAndBban: string): string | null {
  const s = normalizeIban(countryAndBban)
  if (!/^[A-Z]{2}[0-9A-Z]+$/.test(s)) return null
  const country = s.slice(0, 2)
  const bban = s.slice(4) // 略過原本檢查碼位置
  const rearranged = bban + country + '00'
  const r = mod97(rearranged)
  if (r < 0) return null
  const check = 98 - r
  return check.toString().padStart(2, '0')
}
