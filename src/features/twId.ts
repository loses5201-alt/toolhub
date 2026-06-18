/*
  身分證字號(中華民國國民身分證)共用引擎 —— 純函式、無 DOM,可在 Node 直接測試。
  抽出檢查碼驗算 + 首碼字母對應表,供「身分證字號檢核」與「測試假資料產生器」共用,
  避免兩處各自維護一份對照表而走鐘。
  注意:檢查碼正確「只代表符合編碼規則」,不代表真的有這個人。
*/

// 首碼英文字母對應的兩位數(內政部規定,非單純 A=10 連號:I/O/W/X/Z 等跳號)
export const LETTER: Record<string, number> = {
  A: 10, B: 11, C: 12, D: 13, E: 14, F: 15, G: 16, H: 17, I: 34, J: 18,
  K: 19, L: 20, M: 21, N: 22, O: 35, P: 23, Q: 24, R: 25, S: 26, T: 27,
  U: 28, V: 29, W: 32, X: 30, Y: 31, Z: 33,
}

// 首碼字母對應的初領縣市
export const REGION: Record<string, string> = {
  A: '臺北市', B: '臺中市', C: '基隆市', D: '臺南市', E: '高雄市', F: '新北市',
  G: '宜蘭縣', H: '桃園市', I: '嘉義市', J: '新竹縣', K: '苗栗縣', L: '臺中縣',
  M: '南投縣', N: '彰化縣', O: '新竹市', P: '雲林縣', Q: '嘉義縣', R: '臺南縣',
  S: '高雄縣', T: '屏東縣', U: '花蓮縣', V: '臺東縣', W: '金門縣', X: '澎湖縣',
  Y: '陽明山管理局', Z: '連江縣',
}

// 後 9 碼的加權乘數;字母拆成的兩位數權重為 1、9
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 1, 1]

/**
 * 身分證字號檢查碼核對。
 * 規則:首碼字母換成兩位數(權重 1、9),其後 9 碼依權重 8,7,6,5,4,3,2,1,1 加權,
 * 全部相加能被 10 整除即有效。第 2 碼(性別碼)須為 1(男)或 2(女)。
 */
export function isValidTwId(raw: string): boolean {
  if (!/^[A-Z][0-9]{9}$/.test(raw)) return false
  const code = LETTER[raw[0]]
  if (code === undefined) return false
  if (raw[1] !== '1' && raw[1] !== '2') return false
  const digits = raw.slice(1).split('').map(Number)
  let sum = Math.floor(code / 10) * 1 + (code % 10) * 9
  for (let i = 0; i < 9; i++) sum += digits[i] * WEIGHTS[i]
  return sum % 10 === 0
}
