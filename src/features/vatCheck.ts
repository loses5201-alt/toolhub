/*
  統一編號(營利事業統一編號)檢核引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  依財政部公布的「統一編號編配及檢查碼邏輯」驗算 8 碼是否符合檢查碼規則,
  可抓出輸入打錯一碼、或一眼看穿隨便亂編的假統編(常見於假發票、人頭公司)。
  注意:檢查碼正確「只代表符合編碼規則」,不代表真的有這家公司登記存在。
*/

// 各位數加權乘數(財政部規定)
const WEIGHTS = [1, 2, 1, 2, 1, 2, 4, 1]

/**
 * 統一編號檢查碼核對。
 * 規則:每碼 × 對應乘數後,取乘積的「個位數 + 十位數」相加,8 碼總和能被 5 整除即有效。
 * 特例:第 7 碼為 7 時(7×4=28),該碼可視為加 0 或加 1,故 (總和+1) 能被 5 整除也視為有效。
 *
 * 2023 年起財政部將原本「被 10 整除」放寬為「被 5 整除」以擴充號碼池;
 * 既有合法統編皆滿足被 5 整除,故採用現行(被 5)規則。
 */
export function isValidVat(n: string): boolean {
  if (!/^\d{8}$/.test(n)) return false
  let sum = 0
  for (let i = 0; i < 8; i++) {
    const product = Number(n[i]) * WEIGHTS[i]
    sum += Math.floor(product / 10) + (product % 10)
  }
  if (sum % 5 === 0) return true
  // 第 7 碼(index 6)為 7 的特例
  if (n[6] === '7' && (sum + 1) % 5 === 0) return true
  return false
}

export interface VatResult {
  valid: boolean
  normalized: string // 抽出的 8 碼數字(若長度不符則為清理後字串)
  reason: string
}

/** 清理輸入:去掉空白、全形數字轉半形、移除常見分隔符(- 空格)。 */
export function normalizeVat(raw: string): string {
  return raw
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)) // 全形→半形
    .replace(/[\s\-‐-―]/g, '') // 空白與各種連字號
    .trim()
}

/** 檢核單一統一編號,回傳結果與白話原因。 */
export function checkVat(raw: string): VatResult {
  const n = normalizeVat(raw)
  if (n === '') return { valid: false, normalized: '', reason: '尚未輸入。' }
  if (!/^\d+$/.test(n)) {
    return { valid: false, normalized: n, reason: '含有非數字字元,統一編號應為 8 位數字。' }
  }
  if (n.length !== 8) {
    return {
      valid: false,
      normalized: n,
      reason: `長度為 ${n.length} 碼,統一編號應為 8 碼數字。`,
    }
  }
  const valid = isValidVat(n)
  return {
    valid,
    normalized: n,
    reason: valid
      ? '檢查碼正確,符合統一編號編碼規則。'
      : '檢查碼錯誤,可能打錯一碼或為無效/亂編號碼。',
  }
}

export interface BatchRow {
  raw: string
  result: VatResult
  duplicate: boolean // 是否與前面出現過的有效統編重複
}

export interface BatchSummary {
  rows: BatchRow[]
  total: number
  validCount: number
  invalidCount: number
  duplicateCount: number
}

/**
 * 批次檢核:可貼上一整串(換行、逗號、分號或空白分隔)的統編清單,
 * 一次驗算每一筆並標出無效與重複 —— 對帳、整理廠商名單時很實用。
 */
export function checkVatBatch(text: string): BatchSummary {
  const tokens = text
    .split(/[\s,;、，；]+/)
    .map((t) => t.trim())
    .filter((t) => t !== '')
  const rows: BatchRow[] = []
  const seen = new Set<string>()
  let validCount = 0
  let duplicateCount = 0
  for (const raw of tokens) {
    const result = checkVat(raw)
    let duplicate = false
    if (result.valid) {
      validCount++
      if (seen.has(result.normalized)) {
        duplicate = true
        duplicateCount++
      } else {
        seen.add(result.normalized)
      }
    }
    rows.push({ raw, result, duplicate })
  }
  return {
    rows,
    total: rows.length,
    validCount,
    invalidCount: rows.length - validCount,
    duplicateCount,
  }
}
