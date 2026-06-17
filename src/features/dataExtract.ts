/*
  文字資料抽取核心 —— 純函式、無 DOM,可在 Node 測。
  從一大段雜亂文字(轉寄的信、文件、貼上的網頁)裡,自動抽出
  Email、網址、台灣手機、有效統一編號,各自去重。
  統編以既有 isValidVat 做檢查碼驗證 → 高精度,不會把隨機 8 碼數字當統編。
  全程瀏覽器、不上傳。
*/
import { isValidVat } from './vatCheck'

/** 去重並保留首次出現順序;normalize 用於比較鍵(不影響輸出值)。 */
function dedupe(items: string[], normalize: (s: string) => string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const it of items) {
    const key = normalize(it)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(it)
  }
  return out
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
// 只吃 RFC 3986 的 URL 安全字元(ASCII),遇到中文/全形標點等就停 → 不會把後面的中文吃進網址
const URL_RE = /https?:\/\/[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]+/gi
const MOBILE_RE = /(?:\+?886[-\s]?|0)9\d{2}[-\s.]?\d{3}[-\s.]?\d{3}/g
// 前後不可再接數字,避免從長串數字裡誤抓 8 碼
const VAT_RE = /(?<!\d)\d{8}(?!\d)/g

/** Email:去重(比較時忽略大小寫,輸出保留原樣)。 */
export function extractEmails(text: string): string[] {
  return dedupe(text.match(EMAIL_RE) ?? [], (s) => s.toLowerCase())
}

/** 網址:去除網址尾端常見的標點(中英文句號/括號等)。 */
export function extractUrls(text: string): string[] {
  const raw = text.match(URL_RE) ?? []
  const trimmed = raw.map((u) => u.replace(/[.,;:!?。,、）)】\]]+$/u, ''))
  return dedupe(trimmed, (s) => s)
}

/** 把手機號正規化成 09 開頭 10 碼(去分隔、+886/886 轉 0);非 10 碼回原字串。 */
export function normalizeMobile(raw: string): string {
  let d = raw.replace(/\D/g, '')
  if (d.startsWith('886')) d = '0' + d.slice(3)
  return d
}

/** 台灣手機:正規化成 09xxxxxxxx,只留正好 10 碼且 09 開頭者,去重。 */
export function extractMobiles(text: string): string[] {
  const raw = text.match(MOBILE_RE) ?? []
  const norm = raw.map(normalizeMobile).filter((d) => /^09\d{8}$/.test(d))
  return dedupe(norm, (s) => s)
}

/** 統一編號:抽出獨立 8 碼數字,經檢查碼驗證,去重。 */
export function extractVats(text: string): string[] {
  const cand = text.match(VAT_RE) ?? []
  return dedupe(cand.filter(isValidVat), (s) => s)
}

export interface ExtractResult {
  emails: string[]
  urls: string[]
  mobiles: string[]
  vats: string[]
}

/** 一次抽出全部類別。 */
export function extractAll(text: string): ExtractResult {
  const t = text ?? ''
  return {
    emails: extractEmails(t),
    urls: extractUrls(t),
    mobiles: extractMobiles(t),
    vats: extractVats(t),
  }
}
