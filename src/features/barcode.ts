/*
  條碼工坊的純邏輯引擎 —— 與 DOM / JsBarcode 無關,故可在 Node 跑回歸測試。
  負責:GTIN 系列(EAN-13 / EAN-8 / UPC-A / ITF-14)的檢查碼計算,
  以及各條碼格式的輸入驗證、正規化(把要交給 JsBarcode 渲染的最終字串算出來)。
  渲染本身交給 JsBarcode(在 Index.vue 動態載入),這裡只管「值對不對」。
*/

export type BarcodeFormat = 'CODE128' | 'CODE39' | 'EAN13' | 'EAN8' | 'UPC' | 'ITF14'

// GS1 標準檢查碼:由最右側資料位起,交替乘 3、1,加總後取與 10 的補數。
// 適用 EAN-13(12 碼本體)、EAN-8(7)、UPC-A(11)、ITF-14(13)。
export function gtinCheckDigit(body: string): number {
  let sum = 0
  let weight = 3
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * weight
    weight = weight === 3 ? 1 : 3
  }
  return (10 - (sum % 10)) % 10
}

export interface ValidationResult {
  ok: boolean
  value: string // 通過驗證後,要交給 JsBarcode 渲染的最終字串
  message?: string // 失敗的錯誤原因,或成功時的提示(例:已補上檢查碼)
  autoCheck?: boolean // 是否自動補上了檢查碼
}

// GTIN 家族各自的「完整長度」(含檢查碼);本體長度即少 1。
const GTIN_FULL: Record<string, number> = {
  EAN13: 13,
  EAN8: 8,
  UPC: 12,
  ITF14: 14,
}

// CODE39 可用字元集(僅大寫):A–Z 0–9 與 - . $ / + % 及空白。
const CODE39_RE = /^[0-9A-Z\-.$/+% ]*$/

function fail(message: string): ValidationResult {
  return { ok: false, value: '', message }
}

function validateGtin(format: string, raw: string): ValidationResult {
  const full = GTIN_FULL[format]
  const body = full - 1
  if (!/^\d+$/.test(raw)) return fail('此格式只能輸入數字')
  if (raw.length === body) {
    const check = gtinCheckDigit(raw)
    return { ok: true, value: raw + check, autoCheck: true, message: `已自動補上檢查碼 ${check}` }
  }
  if (raw.length === full) {
    const expected = gtinCheckDigit(raw.slice(0, body))
    if (Number(raw[full - 1]) === expected) return { ok: true, value: raw }
    return fail(`檢查碼錯誤:最後一碼應為 ${expected}`)
  }
  return fail(`需 ${body} 位數字(自動算檢查碼)或完整 ${full} 位數字`)
}

// 主驗證:依格式回傳可渲染的最終字串或友善錯誤訊息。
export function validateBarcode(format: BarcodeFormat, input: string): ValidationResult {
  const raw = input.trim()
  if (!raw) return fail('請先輸入要做成條碼的內容')

  if (format === 'CODE128') {
    // CODE128 支援完整 ASCII(0x00–0x7F)。
    for (const ch of raw) {
      if (ch.charCodeAt(0) > 127) return fail('CODE128 僅支援英數與半形符號(不支援中文)')
    }
    return { ok: true, value: raw }
  }

  if (format === 'CODE39') {
    const up = raw.toUpperCase()
    if (!CODE39_RE.test(up)) return fail('CODE39 僅支援 A–Z 0–9 與 - . $ / + % 及空白')
    return { ok: true, value: up, message: up !== raw ? '小寫已自動轉為大寫(CODE39 僅大寫)' : undefined }
  }

  if (format in GTIN_FULL) return validateGtin(format, raw)

  return fail('未知的條碼格式')
}
