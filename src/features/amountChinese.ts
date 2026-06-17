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

/* ────────────────────────────────────────────────────────────
   反向:中文數字 → 阿拉伯數字
   支援大寫(壹貳參…拾佰仟)與一般(一二三…十百千)、兩=2、〇/零=0、
   萬/万、億/亿、兆,以及阿拉伯數字混用(如「5萬」)、小數「點/点」。
   讀支票/合約大寫金額或老文件時用,核對是否與阿拉伯數字一致。
   ──────────────────────────────────────────────────────────── */
const CN_DIGIT: Record<string, number> = {
  零: 0, 〇: 0, 一: 1, 壹: 1, 二: 2, 貳: 2, 两: 2, 兩: 2, 三: 3, 參: 3, 叁: 3,
  四: 4, 肆: 4, 五: 5, 伍: 5, 六: 6, 陸: 6, 七: 7, 柒: 7, 八: 8, 捌: 8, 九: 9, 玖: 9,
}
const CN_SMALL_UNIT: Record<string, number> = { 十: 10, 拾: 10, 百: 100, 佰: 100, 千: 1000, 仟: 1000 }
const CN_BIG_UNIT: Record<string, number> = { 萬: 1e4, 万: 1e4, 億: 1e8, 亿: 1e8, 兆: 1e12 }

export interface ParseChineseResult {
  ok: boolean
  error?: string
  value: number // 解析出的數字
}

/** 解析整數部分的中文數字(不含小數)。回傳 number 或丟錯。 */
function parseChineseInteger(s: string): number {
  let total = 0 // 已結算(含 萬/億/兆 節)的總和
  let section = 0 // 目前 < 萬 的節內累計
  let number = 0 // 待結算的個位數字
  let sawAny = false
  for (const ch of s) {
    if (ch in CN_DIGIT) {
      number = CN_DIGIT[ch]
      sawAny = true
    } else if (/[0-9]/.test(ch)) {
      number = Number(ch)
      sawAny = true
    } else if (ch in CN_SMALL_UNIT) {
      const u = CN_SMALL_UNIT[ch]
      if (number === 0) number = 1 // 「十」「拾」開頭視為 1×
      section += number * u
      number = 0
      sawAny = true
    } else if (ch in CN_BIG_UNIT) {
      section = (section + number) * CN_BIG_UNIT[ch]
      total += section
      section = 0
      number = 0
      sawAny = true
    } else {
      throw new Error(`無法辨識的字:「${ch}」`)
    }
  }
  if (!sawAny) throw new Error('沒有可解析的數字')
  return total + section + number
}

/**
 * 中文數字字串 → 阿拉伯數字。
 * 接受前後空白;支援「點/点」帶一段小數(逐字數字,如 三點一四 = 3.14)。
 */
export function chineseToNumber(input: string): ParseChineseResult {
  const fail = (error: string): ParseChineseResult => ({ ok: false, error, value: 0 })
  const clean = (input ?? '').trim().replace(/[\s　]/g, '')
  if (clean === '') return fail('請輸入中文數字')

  const parts = clean.split(/[點点]/)
  if (parts.length > 2) return fail('小數點(點)只能有一個')

  try {
    const intPart = parts[0] === '' ? 0 : parseChineseInteger(parts[0])
    if (parts.length === 1) return { ok: true, value: intPart }
    // 小數部分:逐字當數字串接
    let frac = ''
    for (const ch of parts[1]) {
      if (ch in CN_DIGIT) frac += String(CN_DIGIT[ch])
      else if (/[0-9]/.test(ch)) frac += ch
      else return fail(`小數部分無法辨識的字:「${ch}」`)
    }
    if (frac === '') return fail('小數點後沒有數字')
    return { ok: true, value: Number(`${intPart}.${frac}`) }
  } catch (e) {
    return fail((e as Error).message)
  }
}
