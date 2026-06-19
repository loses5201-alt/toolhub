/*
  中文排版「盤古之白」引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  在中日韓文字(CJK)與英文字母/數字之間自動補上一個半形空格,讓中英混排更易讀:
    "在GitHub上有100顆星"  →  "在 GitHub 上有 100 顆星"
  規則明確、可重複套用(idempotent,已經有空格不會再加),保留換行與其他標點。
  全程在你的瀏覽器,不連網、不上傳。
*/

// CJK 文字範圍:中日韓統一表意文字 + 擴充 A、日文假名、注音、部首等
const CJK =
  '\\u2e80-\\u2eff\\u3040-\\u318f\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff'

const reCjkThenAlnum = new RegExp(`([${CJK}])([A-Za-z0-9])`, 'g')
const reAlnumThenCjk = new RegExp(`([A-Za-z0-9])([${CJK}])`, 'g')

/** 在 CJK 與英數之間補空格。 */
export function addSpacing(text: string): string {
  if (text == null) return ''
  return String(text).replace(reCjkThenAlnum, '$1 $2').replace(reAlnumThenCjk, '$1 $2')
}

/** 回傳處理後字串與「補了幾個空格」(供 UI 顯示)。 */
export function addSpacingWithCount(text: string): { result: string; added: number } {
  const result = addSpacing(text)
  // 兩字串長度差即為新增的空格數(只會新增半形空格、不刪字)
  const added = result.length - (text == null ? 0 : String(text).length)
  return { result, added }
}
