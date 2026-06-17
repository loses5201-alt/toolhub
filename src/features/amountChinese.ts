/*
  金額轉國字大寫引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  把阿拉伯數字金額轉成中文大寫(壹貳參肆…拾佰仟萬億兆),用於支票、本票、合約、收據,
  讓金額不易被竄改(把 1 改 7、加個 0)。同時輸出「元角分整」的金額寫法與純數字大寫。
  全程在你的瀏覽器計算,不上傳。
*/

const DIGITS = ['零', '壹', '貳', '參', '肆', '伍', '陸', '柒', '捌', '玖']
const SMALL_UNITS = ['', '拾', '佰', '仟'] // 組內位數(個/拾/佰/仟)
const BIG_UNITS = ['', '萬', '億', '兆'] // 每四位一節的節單位

/** 轉換 1~4 位數的「節」,處理節內的零(零壹佰貳拾參 之類)。 */
function convertGroup(group: string): string {
  let result = ''
  const len = group.length
  let zeroFlag = false
  for (let i = 0; i < len; i++) {
    const d = Number(group[i])
    const pos = len - 1 - i // 0=個位,1=拾,2=佰,3=仟
    if (d === 0) {
      zeroFlag = true
    } else {
      if (zeroFlag) {
        result += '零'
        zeroFlag = false
      }
      result += DIGITS[d] + SMALL_UNITS[pos]
    }
  }
  return result
}

/** 把僅含數字的整數字串轉成中文大寫(輸入需為去前導零後的數字)。 */
function integerToChinese(numStr: string): string {
  const trimmed = numStr.replace(/^0+/, '')
  if (trimmed === '') return '零'
  // 由右往左每四位切一節
  const groups: string[] = []
  for (let end = trimmed.length; end > 0; end -= 4) {
    groups.unshift(trimmed.slice(Math.max(0, end - 4), end))
  }
  const n = groups.length
  if (n > BIG_UNITS.length) {
    throw new Error('OVERFLOW')
  }
  let result = ''
  for (let i = 0; i < n; i++) {
    const g = groups[i]
    const bigUnitIndex = n - 1 - i
    if (Number(g) === 0) {
      // 整節為零:若不是最後一節,補一個「零」當連接(重複零最後會收斂)
      if (result && i < n - 1) result += '零'
    } else {
      result += convertGroup(g) + BIG_UNITS[bigUnitIndex]
    }
  }
  // 收斂多餘的零、去尾零
  return result.replace(/零{2,}/g, '零').replace(/零+$/, '')
}

export interface AmountResult {
  ok: boolean
  error?: string
  normalized: string // 正規化後的數字(去千分位、補/捨小數)
  currency: string // 金額寫法:○○元○角○分 / ○○元整
  digits: string // 純整數大寫(不含元角分)
}

/**
 * 金額轉大寫。
 * - 接受含千分位逗號、前後空白。
 * - 四捨五入到「分」(小數第 2 位)。
 * - 僅支援 0 以上、整數部分不超過「兆」級(16 位)。
 */
export function amountToChinese(input: string): AmountResult {
  const fail = (error: string): AmountResult =>
    ({ ok: false, error, normalized: '', currency: '', digits: '' })

  const clean = input.trim().replace(/,/g, '')
  if (clean === '') return fail('請輸入金額')
  if (!/^\d+(\.\d+)?$/.test(clean)) return fail('請輸入有效的金額(僅限數字,不可為負)')

  const [intRaw, fracRaw = ''] = clean.split('.')

  // 四捨五入到分:取小數前三位,依第三位進位
  const frac3 = (fracRaw + '000').slice(0, 3)
  let cents = Number(frac3.slice(0, 2))
  if (Number(frac3[2]) >= 5) cents += 1
  let intStr = intRaw
  if (cents === 100) {
    cents = 0
    intStr = (BigInt(intRaw) + 1n).toString() // 進位到整數,BigInt 避免大數誤差
  }
  const jiao = Math.floor(cents / 10)
  const fen = cents % 10

  let digits: string
  try {
    digits = integerToChinese(intStr)
  } catch {
    return fail('金額太大,超出可表示範圍(上限為兆級)')
  }

  const normalized = `${intStr.replace(/^0+/, '') || '0'}${cents ? '.' + String(cents).padStart(2, '0') : ''}`

  // 組金額寫法
  const intIsZero = digits === '零'
  let currency = ''
  if (!intIsZero) currency += digits + '元'

  if (jiao === 0 && fen === 0) {
    currency += '整'
    if (intIsZero) currency = '零元整'
  } else {
    // 角為零但分不為零時,需補「零」(例:壹佰元零伍分)
    if (jiao > 0) currency += DIGITS[jiao] + '角'
    else if (fen > 0 && !intIsZero) currency += '零'
    if (fen > 0) currency += DIGITS[fen] + '分'
  }

  return { ok: true, normalized, currency, digits }
}
