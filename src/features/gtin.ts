/*
  GTIN / 商品條碼檢查碼引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  支援 EAN-8、UPC-A(12 碼)、EAN-13、GTIN-14(ITF-14)。
  採 GS1 標準 mod-10 檢查碼:由最右側資料碼起,權重交替 3、1、3、1…,
  總和取 10 的補數即檢查碼。可驗證完整碼、或由前置碼算出缺少的檢查碼。
  另解讀 EAN-13 的 GS1 國別/用途前置碼(教育用,非即時資料查詢)。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

export type GtinType = 'EAN-8' | 'UPC-A' | 'EAN-13' | 'GTIN-14'

const TYPE_BY_LEN: Record<number, GtinType> = {
  8: 'EAN-8',
  12: 'UPC-A',
  13: 'EAN-13',
  14: 'GTIN-14',
}

/** 只保留數字字元。 */
export function digitsOnly(s: string): string {
  return (s || '').replace(/\D/g, '')
}

/**
 * 由「資料碼(不含檢查碼)」計算 GS1 mod-10 檢查碼。
 * 由最右側起權重 3,1,3,1…。回傳 0–9。
 */
export function computeCheckDigit(dataDigits: string): number {
  const d = digitsOnly(dataDigits)
  let sum = 0
  // 從最右邊往左,最右權重 3
  for (let i = 0; i < d.length; i++) {
    const digit = Number(d[d.length - 1 - i])
    sum += digit * (i % 2 === 0 ? 3 : 1)
  }
  return (10 - (sum % 10)) % 10
}

export interface GtinResult {
  valid: boolean
  type: GtinType | null
  normalized: string // 純數字
  dataPart: string // 不含檢查碼
  givenCheck: number | null // 輸入帶的檢查碼
  expectedCheck: number | null // 正確的檢查碼
  errors: string[]
}

/**
 * 驗證完整的 GTIN(含檢查碼)。長度需為 8/12/13/14。
 */
export function validateGtin(input: string): GtinResult {
  const normalized = digitsOnly(input)
  const errors: string[] = []
  const result: GtinResult = {
    valid: false,
    type: TYPE_BY_LEN[normalized.length] ?? null,
    normalized,
    dataPart: '',
    givenCheck: null,
    expectedCheck: null,
    errors,
  }
  if (!normalized) {
    errors.push('請輸入條碼數字')
    return result
  }
  if (!(normalized.length in TYPE_BY_LEN)) {
    errors.push(`長度需為 8(EAN-8)、12(UPC-A)、13(EAN-13)或 14(GTIN-14),目前 ${normalized.length} 碼`)
    return result
  }
  const dataPart = normalized.slice(0, -1)
  const givenCheck = Number(normalized.slice(-1))
  const expectedCheck = computeCheckDigit(dataPart)
  result.dataPart = dataPart
  result.givenCheck = givenCheck
  result.expectedCheck = expectedCheck
  if (givenCheck !== expectedCheck) {
    errors.push(`檢查碼錯誤:應為 ${expectedCheck},實際為 ${givenCheck}`)
    return result
  }
  result.valid = true
  return result
}

/**
 * 由「不含檢查碼的前置碼」補上檢查碼,回傳完整 GTIN。
 * 前置碼長度需為 7/11/12/13(對應 8/12/13/14 碼)。
 */
export function completeGtin(prefix: string): { full: string; check: number; error: string } {
  const d = digitsOnly(prefix)
  const validDataLens = [7, 11, 12, 13]
  if (!d) return { full: '', check: -1, error: '請輸入前置碼數字' }
  if (!validDataLens.includes(d.length))
    return {
      full: '',
      check: -1,
      error: `前置碼需為 7、11、12 或 13 碼(目前 ${d.length} 碼)`,
    }
  const check = computeCheckDigit(d)
  return { full: d + check, check, error: '' }
}

// GS1 前置碼 → 國別 / 用途(EAN-13 前 3 碼,教育用對照,非完整清單)
interface PrefixRange {
  from: number
  to: number
  label: string
}
const GS1_PREFIXES: PrefixRange[] = [
  { from: 0, to: 19, label: '美國、加拿大(UPC)' },
  { from: 20, to: 29, label: '店內 / 內部使用(不對外流通)' },
  { from: 30, to: 39, label: '美國(藥品 NDC)' },
  { from: 40, to: 49, label: '公司內部使用' },
  { from: 50, to: 59, label: '優惠券' },
  { from: 60, to: 139, label: '美國、加拿大' },
  { from: 200, to: 299, label: '店內 / 內部使用(不對外流通)' },
  { from: 300, to: 379, label: '法國、摩納哥' },
  { from: 380, to: 380, label: '保加利亞' },
  { from: 383, to: 383, label: '斯洛維尼亞' },
  { from: 385, to: 385, label: '克羅埃西亞' },
  { from: 387, to: 387, label: '波士尼亞與赫塞哥維納' },
  { from: 400, to: 440, label: '德國' },
  { from: 450, to: 459, label: '日本' },
  { from: 460, to: 469, label: '俄羅斯' },
  { from: 471, to: 471, label: '臺灣' },
  { from: 474, to: 474, label: '愛沙尼亞' },
  { from: 480, to: 480, label: '菲律賓' },
  { from: 484, to: 484, label: '摩爾多瓦' },
  { from: 485, to: 485, label: '亞美尼亞' },
  { from: 489, to: 489, label: '香港' },
  { from: 490, to: 499, label: '日本' },
  { from: 500, to: 509, label: '英國' },
  { from: 520, to: 521, label: '希臘' },
  { from: 528, to: 528, label: '黎巴嫩' },
  { from: 529, to: 529, label: '賽普勒斯' },
  { from: 531, to: 531, label: '北馬其頓' },
  { from: 535, to: 535, label: '馬爾他' },
  { from: 539, to: 539, label: '愛爾蘭' },
  { from: 540, to: 549, label: '比利時、盧森堡' },
  { from: 560, to: 560, label: '葡萄牙' },
  { from: 569, to: 569, label: '冰島' },
  { from: 570, to: 579, label: '丹麥、法羅群島、格陵蘭' },
  { from: 590, to: 590, label: '波蘭' },
  { from: 594, to: 594, label: '羅馬尼亞' },
  { from: 599, to: 599, label: '匈牙利' },
  { from: 600, to: 601, label: '南非' },
  { from: 608, to: 608, label: '巴林' },
  { from: 609, to: 609, label: '模里西斯' },
  { from: 611, to: 611, label: '摩洛哥' },
  { from: 613, to: 613, label: '阿爾及利亞' },
  { from: 615, to: 615, label: '伊拉克' },
  { from: 616, to: 616, label: '肯亞' },
  { from: 619, to: 619, label: '突尼西亞' },
  { from: 620, to: 620, label: '敘利亞' },
  { from: 621, to: 621, label: '埃及' },
  { from: 625, to: 625, label: '約旦' },
  { from: 626, to: 626, label: '伊朗' },
  { from: 627, to: 627, label: '科威特' },
  { from: 628, to: 628, label: '沙烏地阿拉伯' },
  { from: 629, to: 629, label: '阿拉伯聯合大公國' },
  { from: 640, to: 649, label: '芬蘭' },
  { from: 690, to: 699, label: '中國大陸' },
  { from: 700, to: 709, label: '挪威' },
  { from: 729, to: 729, label: '以色列' },
  { from: 730, to: 739, label: '瑞典' },
  { from: 740, to: 745, label: '中美洲各國' },
  { from: 746, to: 746, label: '多明尼加' },
  { from: 750, to: 750, label: '墨西哥' },
  { from: 754, to: 755, label: '加拿大' },
  { from: 759, to: 759, label: '委內瑞拉' },
  { from: 760, to: 769, label: '瑞士、列支敦士登' },
  { from: 770, to: 771, label: '哥倫比亞' },
  { from: 773, to: 773, label: '烏拉圭' },
  { from: 775, to: 775, label: '秘魯' },
  { from: 777, to: 777, label: '玻利維亞' },
  { from: 778, to: 779, label: '阿根廷' },
  { from: 780, to: 780, label: '智利' },
  { from: 784, to: 784, label: '巴拉圭' },
  { from: 786, to: 786, label: '厄瓜多' },
  { from: 789, to: 790, label: '巴西' },
  { from: 800, to: 839, label: '義大利' },
  { from: 840, to: 849, label: '西班牙、安道爾' },
  { from: 850, to: 850, label: '古巴' },
  { from: 858, to: 858, label: '斯洛伐克' },
  { from: 859, to: 859, label: '捷克' },
  { from: 860, to: 860, label: '塞爾維亞' },
  { from: 865, to: 865, label: '蒙古' },
  { from: 867, to: 867, label: '北韓' },
  { from: 868, to: 869, label: '土耳其' },
  { from: 870, to: 879, label: '荷蘭' },
  { from: 880, to: 880, label: '南韓' },
  { from: 884, to: 884, label: '柬埔寨' },
  { from: 885, to: 885, label: '泰國' },
  { from: 888, to: 888, label: '新加坡' },
  { from: 890, to: 890, label: '印度' },
  { from: 893, to: 893, label: '越南' },
  { from: 896, to: 896, label: '巴基斯坦' },
  { from: 899, to: 899, label: '印尼' },
  { from: 900, to: 919, label: '奧地利' },
  { from: 930, to: 939, label: '澳大利亞' },
  { from: 940, to: 949, label: '紐西蘭' },
  { from: 955, to: 955, label: '馬來西亞' },
  { from: 958, to: 958, label: '澳門' },
  { from: 977, to: 977, label: '連續出版品(ISSN 期刊)' },
  { from: 978, to: 979, label: '書籍(ISBN / Bookland)' },
  { from: 980, to: 980, label: '退款收據' },
  { from: 981, to: 984, label: 'GS1 代金券' },
  { from: 990, to: 999, label: 'GS1 代金券' },
]

/**
 * 解讀 EAN-13 的 GS1 國別/用途前置碼。輸入完整 13 碼或前 3 碼皆可。
 * 回傳對應說明,查不到回 null。
 */
export function lookupPrefix(input: string): { code: string; label: string } | null {
  const d = digitsOnly(input)
  if (d.length < 3) return null
  const n = Number(d.slice(0, 3))
  for (const r of GS1_PREFIXES) {
    if (n >= r.from && n <= r.to) {
      return { code: d.slice(0, 3), label: r.label }
    }
  }
  return null
}
