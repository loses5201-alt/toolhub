/*
  金額轉英文大寫引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  把阿拉伯數字金額轉成英文文字寫法,用於外銷發票(commercial invoice)、
  外幣支票(cheque)、信用狀、合約 —— 這些單據金額一律要寫成英文文字以防竄改。
  與 amountChinese(中文大寫)互補,給做外銷/外幣往來的人用。
  全程在你的瀏覽器計算,不上傳。
*/

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
]
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
// 每三位一節的節單位(short scale:thousand / million / billion / trillion)
const SCALES = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion']

/** 轉換 0~999 的整數為英文字(不含節單位)。 */
function threeDigitsToWords(n: number): string {
  const parts: string[] = []
  const hundred = Math.floor(n / 100)
  const rest = n % 100
  if (hundred) parts.push(ONES[hundred] + ' hundred')
  if (rest) {
    if (rest < 20) parts.push(ONES[rest])
    else {
      const t = Math.floor(rest / 10)
      const o = rest % 10
      parts.push(o ? TENS[t] + '-' + ONES[o] : TENS[t])
    }
  }
  return parts.join(' ')
}

/** 把非負整數轉成英文字(小寫,單字以空白分隔)。 */
export function integerToEnglish(num: number): string {
  if (!Number.isFinite(num) || num < 0) throw new Error('需為非負整數')
  let n = Math.floor(num)
  if (n === 0) return 'zero'
  // 由右往左每三位切一節
  const groups: number[] = []
  while (n > 0) {
    groups.push(n % 1000)
    n = Math.floor(n / 1000)
  }
  if (groups.length > SCALES.length) throw new Error('金額過大')
  const parts: string[] = []
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i]
    if (g === 0) continue
    const words = threeDigitsToWords(g)
    parts.push(SCALES[i] ? words + ' ' + SCALES[i] : words)
  }
  return parts.join(' ')
}

export interface EnglishAmount {
  /** 純文字寫法,例:one thousand two hundred thirty-four and 56/100 */
  words: string
  /** 支票/發票常用寫法(全大寫、加幣別與 ONLY) */
  cheque: string
  /** 是否有小數(分) */
  hasCents: boolean
}

export interface EnglishOptions {
  /** 幣別代碼或名稱,例:US DOLLARS、USD、NT DOLLARS(預設不加) */
  currency?: string
  /** 小數的呈現:'fraction' = and 56/100(支票常見);'words' = and fifty-six cents */
  centsStyle?: 'fraction' | 'words'
}

/**
  把金額(數字或數字字串)轉成英文大寫。
  - 整數位轉成英文字
  - 小數固定取兩位(四捨五入),fraction 模式輸出 NN/100,words 模式輸出 ... cents
*/
export function amountToEnglish(input: number | string, opts: EnglishOptions = {}): EnglishAmount {
  const raw = typeof input === 'string' ? input.trim().replace(/,/g, '') : String(input)
  if (raw === '' || !/^\d+(\.\d+)?$/.test(raw)) {
    throw new Error('請輸入有效的非負金額(例:1234.56)')
  }
  const value = Number(raw)
  if (!Number.isFinite(value)) throw new Error('金額無效')

  // 四捨五入到兩位小數,避免浮點誤差
  const cents = Math.round(value * 100)
  const intPart = Math.floor(cents / 100)
  const fracPart = cents % 100
  const hasCents = fracPart > 0
  const centsStyle = opts.centsStyle ?? 'fraction'

  const intWords = integerToEnglish(intPart)
  const centsStr = String(fracPart).padStart(2, '0')

  // 純文字寫法
  let words = intWords
  if (centsStyle === 'fraction') {
    words += ' and ' + centsStr + '/100'
  } else if (hasCents) {
    words += ' and ' + integerToEnglish(fracPart) + (fracPart === 1 ? ' cent' : ' cents')
  }

  // 支票/發票寫法
  const cur = (opts.currency || '').trim()
  const intTitle = titleCase(intWords)
  let cheque = (cur ? cur.toUpperCase() + ' ' : '') + intTitle.toUpperCase()
  if (centsStyle === 'fraction') {
    cheque += ' AND ' + centsStr + '/100'
  } else if (hasCents) {
    cheque += ' AND ' + integerToEnglish(fracPart).toUpperCase() + (fracPart === 1 ? ' CENT' : ' CENTS')
  }
  cheque += ' ONLY'

  return { words, cheque, hasCents }
}

/** 每個單字首字母大寫(連字號詞如 thirty-four 兩段都大寫)。 */
function titleCase(s: string): string {
  return s.replace(/[a-z]+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1))
}
