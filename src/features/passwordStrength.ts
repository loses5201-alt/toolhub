/*
  密碼強度檢測引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  估算一組密碼有多容易被猜中:依字元種類算理論亂度(entropy),再因「常見密碼、連續、重複、
  鍵盤順序、純數字(像生日)」等弱點扣分,給出強度等級與破解時間估計,並提供改進建議。
  全程在你的瀏覽器,絕不連網、不上傳 —— 密碼是高敏資訊,本來就不該貼到任何一般網站。

  注意:破解時間是「攻擊者離線高速猜測」的粗略估計,僅供相對比較,非保證。
*/

export interface StrengthResult {
  length: number
  poolSize: number // 字元集大小
  entropyBits: number // 已扣弱點後的有效亂度
  rawEntropyBits: number // 未扣弱點的理論亂度
  score: 0 | 1 | 2 | 3 | 4 // 0 最弱、4 最強
  label: string
  isCommon: boolean
  warnings: string[]
  suggestions: string[]
  crackOffline: string // 離線高速(每秒 1e10 次)
  crackOnline: string // 線上節流(每秒 100 次)
}

// 最常見的弱密碼(節錄,涵蓋外洩榜常客);命中即視為極弱。
const COMMON = new Set([
  '123456', '123456789', '12345678', '12345', '1234567', '1234567890', '1234',
  'password', 'password1', 'passw0rd', 'qwerty', 'qwerty123', 'abc123', 'iloveyou',
  'admin', 'welcome', 'monkey', 'dragon', 'letmein', 'football', 'baseball',
  '111111', '000000', '666666', '888888', 'aaaaaa', 'asdfgh', 'zxcvbn', 'a1b2c3',
  'sunshine', 'princess', 'master', 'login', 'starwars', 'whatever', 'trustno1',
  'qazwsx', '1q2w3e4r', '1qaz2wsx', 'p@ssword', 'p@ssw0rd', 'superman', 'batman',
])

const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890']

function hasSequential(s: string): boolean {
  const low = s.toLowerCase()
  // 連續遞增/遞減 3 個以上(abc、321)
  let inc = 1
  let dec = 1
  for (let i = 1; i < low.length; i++) {
    const d = low.charCodeAt(i) - low.charCodeAt(i - 1)
    inc = d === 1 ? inc + 1 : 1
    dec = d === -1 ? dec + 1 : 1
    if (inc >= 3 || dec >= 3) return true
  }
  return false
}

function hasKeyboardRun(s: string): boolean {
  const low = s.toLowerCase()
  for (const row of KEYBOARD_ROWS) {
    for (let i = 0; i + 3 <= row.length; i++) {
      const seg = row.slice(i, i + 3)
      const rev = seg.split('').reverse().join('')
      if (low.includes(seg) || low.includes(rev)) return true
    }
  }
  return false
}

function hasRepeat(s: string): boolean {
  return /(.)\1\1/.test(s) // 同一字元連續 3 次以上
}

/** 計算字元集大小(出現過哪些類別)。 */
export function poolSize(pw: string): number {
  let pool = 0
  if (/[a-z]/.test(pw)) pool += 26
  if (/[A-Z]/.test(pw)) pool += 26
  if (/[0-9]/.test(pw)) pool += 10
  if (/[ ]/.test(pw)) pool += 1
  if (/[^a-zA-Z0-9 ]/.test(pw)) pool += 33 // 常見可打印符號約 33 個
  return pool
}

export function humanTime(seconds: number): string {
  if (seconds < 1) return '瞬間'
  const names = ['秒', '分鐘', '小時', '天', '年', '世紀']
  const div = [1, 60, 60, 24, 365, 100] // 每一階相對前一階的倍數
  let v = seconds
  let i = 0
  for (; i < div.length - 1; i++) {
    if (v < div[i + 1]) break
    v = v / div[i + 1]
  }
  if (v >= 1e6) return `超過一百萬${names[i]}`
  const rounded = v >= 100 ? Math.round(v) : Math.round(v * 10) / 10
  return `約 ${rounded.toLocaleString('zh-TW')} ${names[i]}`
}

const LABELS = ['非常弱', '弱', '普通', '強', '非常強']

/** 估算密碼強度。空字串回 score 0。 */
export function estimateStrength(input: string): StrengthResult {
  const pw = input || ''
  const len = pw.length
  const pool = poolSize(pw)
  const rawEntropy = len > 0 && pool > 0 ? len * Math.log2(pool) : 0

  const warnings: string[] = []
  const suggestions: string[] = []
  const lower = pw.toLowerCase()
  const isCommon = COMMON.has(lower)

  let penalty = 0 // 扣除的亂度位元(乘法效果以位元相加近似)
  if (isCommon) {
    warnings.push('這是外洩榜上的常見密碼,幾乎瞬間被破解')
    penalty += rawEntropy // 直接歸零
  }
  if (len > 0 && hasRepeat(pw)) {
    warnings.push('含連續重複字元(如 aaa、111)')
    penalty += 8
  }
  if (len > 0 && hasSequential(pw)) {
    warnings.push('含連續順序(如 abc、123、321)')
    penalty += 8
  }
  if (len > 0 && hasKeyboardRun(pw)) {
    warnings.push('含鍵盤相鄰順序(如 qwe、asd)')
    penalty += 8
  }
  if (len > 0 && /^\d+$/.test(pw)) {
    warnings.push('全是數字,容易被生日/電話等字典攻擊命中')
    penalty += 6
  }
  if (len > 0 && /^[a-z]+$/.test(pw)) {
    warnings.push('全是小寫英文字母,字元種類太少')
  }

  const entropy = Math.max(0, rawEntropy - penalty)

  // 等級門檻(粗略對應 NIST/常見指引)
  let score: StrengthResult['score']
  if (entropy < 28) score = 0
  else if (entropy < 36) score = 1
  else if (entropy < 60) score = 2
  else if (entropy < 128) score = 3
  else score = 4

  // 建議
  if (len < 12) suggestions.push('加長到至少 12–16 字(長度是最有效的防線)')
  if (!/[A-Z]/.test(pw) || !/[a-z]/.test(pw)) suggestions.push('混用大小寫字母')
  if (!/[0-9]/.test(pw)) suggestions.push('加入數字')
  if (!/[^a-zA-Z0-9]/.test(pw)) suggestions.push('加入符號(如 !@#$)')
  if (warnings.length > 0) suggestions.push('避免常見字、連續、重複與鍵盤順序')
  suggestions.push('每個網站用不同密碼,搭配密碼管理器最安全')

  // 破解時間:平均嘗試次數 = 2^entropy / 2
  const guesses = entropy > 0 ? Math.pow(2, entropy) / 2 : 0
  const offlineSec = guesses / 1e10 // 離線 GPU 高速
  const onlineSec = guesses / 100 // 線上有節流

  return {
    length: len,
    poolSize: pool,
    entropyBits: Math.round(entropy * 10) / 10,
    rawEntropyBits: Math.round(rawEntropy * 10) / 10,
    score,
    label: LABELS[score],
    isCommon,
    warnings,
    suggestions,
    crackOffline: len === 0 ? '—' : humanTime(offlineSec),
    crackOnline: len === 0 ? '—' : humanTime(onlineSec),
  }
}
