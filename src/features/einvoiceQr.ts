/*
  台灣電子發票證明聯「左方 QR 條碼」解析引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  依財政部「電子發票證明聯二維條碼規格」:前 77 個字元為固定欄位,之後以冒號分隔額外資訊。
  固定欄位(共 77 字):
    [0:10]  發票字軌號碼(2 英文 + 8 數字)
    [10:17] 開立日期(民國年 3 + 月 2 + 日 2)
    [17:21] 隨機碼(4 碼)
    [21:29] 銷售額(未稅,8 碼十六進位)
    [29:37] 總計額(含稅,8 碼十六進位)
    [37:45] 買方統一編號(無則 00000000)
    [45:53] 賣方統一編號
    [53:77] 加密驗證資訊(24 碼,AES 加密後 Base64;此處僅顯示不驗證)
  本工具把 QR 內容(用相機/本站 QR 解碼工具掃出的文字)轉成可讀欄位,方便核對發票。
  全程在你的瀏覽器解析,不連網、不上傳。
*/

export interface EinvoiceResult {
  ok: boolean
  error?: string
  invoiceNumber: string // 發票號碼,如 AB-12345678
  invoiceNumberRaw: string
  dateRoc: string // 民國 113/05/20
  dateAd: string // 西元 2024-05-20
  randomCode: string
  amountSalesUntaxed: number // 銷售額(未稅)
  amountTotal: number // 總計額(含稅)
  buyerVat: string // 買方統編('' 表個人)
  sellerVat: string // 賣方統編
  encrypted: string // 加密驗證資訊(原樣)
  itemCountInQr?: number // 二維碼記載品目筆數
  itemCountTotal?: number // 整張發票品目總筆數
  encodingParam?: string // 中文編碼參數 0=Big5 1=UTF-8 2=Base64
  tail: string // 77 字之後的原始字串
}

function hexToInt(s: string): number {
  if (!/^[0-9a-fA-F]+$/.test(s)) return NaN
  return parseInt(s, 16)
}

/** 民國日期(YYYMMDD)→ { roc, ad }。 */
export function parseRocDate(s: string): { roc: string; ad: string } | null {
  if (!/^\d{7}$/.test(s)) return null
  const y = parseInt(s.slice(0, 3), 10)
  const mo = parseInt(s.slice(3, 5), 10)
  const d = parseInt(s.slice(5, 7), 10)
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const adY = y + 1911
  const pad = (n: number) => String(n).padStart(2, '0')
  return { roc: `民國 ${y}/${pad(mo)}/${pad(d)}`, ad: `${adY}-${pad(mo)}-${pad(d)}` }
}

/** 解析電子發票左方 QR 條碼字串。 */
export function parseEinvoiceQr(input: string): EinvoiceResult {
  const text = (input || '').trim()
  const blank: EinvoiceResult = {
    ok: false,
    invoiceNumber: '',
    invoiceNumberRaw: '',
    dateRoc: '',
    dateAd: '',
    randomCode: '',
    amountSalesUntaxed: 0,
    amountTotal: 0,
    buyerVat: '',
    sellerVat: '',
    encrypted: '',
    tail: '',
  }
  if (!text) return { ...blank, error: '請貼上發票 QR 條碼掃描出的內容。' }
  if (text.startsWith('**')) {
    return { ...blank, error: '這看起來是「右方」QR 條碼(以 ** 開頭,只放品項續傳),請掃描左方那個主條碼。' }
  }
  if (text.length < 77) {
    return { ...blank, error: `長度不足(僅 ${text.length} 字),不像完整的電子發票左方 QR(固定欄位需 77 字)。` }
  }

  const invoiceNumberRaw = text.slice(0, 10)
  if (!/^[A-Z]{2}\d{8}$/.test(invoiceNumberRaw)) {
    return { ...blank, error: '前 10 碼不是「2 英文字母 + 8 數字」的發票字軌號碼,可能不是電子發票 QR。' }
  }
  const dateStr = text.slice(10, 17)
  const date = parseRocDate(dateStr)
  const randomCode = text.slice(17, 21)
  const salesHex = text.slice(21, 29)
  const totalHex = text.slice(29, 37)
  const buyerVat = text.slice(37, 45)
  const sellerVat = text.slice(45, 53)
  const encrypted = text.slice(53, 77)
  const tail = text.slice(77)

  const sales = hexToInt(salesHex)
  const total = hexToInt(totalHex)

  const result: EinvoiceResult = {
    ...blank,
    ok: true,
    invoiceNumber: `${invoiceNumberRaw.slice(0, 2)}-${invoiceNumberRaw.slice(2)}`,
    invoiceNumberRaw,
    dateRoc: date ? date.roc : `(無法解析:${dateStr})`,
    dateAd: date ? date.ad : '',
    randomCode,
    amountSalesUntaxed: isNaN(sales) ? 0 : sales,
    amountTotal: isNaN(total) ? 0 : total,
    buyerVat: /^0{8}$/.test(buyerVat) ? '' : buyerVat,
    sellerVat,
    encrypted,
    tail,
  }

  // 解析冒號分隔的額外資訊(若格式相符):自定區 : 品目筆數 : 品目總筆數 : 編碼參數 : 品項…
  if (tail) {
    const parts = tail.replace(/^:/, '').split(':')
    // parts[0]=營業人自定區, [1]=記載品目筆數, [2]=品目總筆數, [3]=中文編碼參數
    if (parts.length >= 4) {
      if (/^\d+$/.test(parts[1])) result.itemCountInQr = parseInt(parts[1], 10)
      if (/^\d+$/.test(parts[2])) result.itemCountTotal = parseInt(parts[2], 10)
      if (/^[0-2]$/.test(parts[3])) result.encodingParam = parts[3]
    }
  }
  return result
}

/** 中文編碼參數說明。 */
export function encodingLabel(p: string | undefined): string {
  if (p === '0') return 'Big5'
  if (p === '1') return 'UTF-8'
  if (p === '2') return 'Base64'
  return '未知'
}
