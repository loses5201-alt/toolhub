/*
  GraphQL 格式化 / 壓縮 —— 對外整合介面。純函式、無 DOM,可在 Node 測試。
  支援 executable 文件(query / mutation / subscription / fragment)與 SDL
  (type / interface / enum / input / union / scalar / schema / directive)。
  解析成 AST 後重新輸出 pretty(2 空白縮排)或 minify(壓縮)。
  註解(# ...)依 GraphQL 慣例不保留;區塊 / 一般字串統一以雙引號輸出。
  正確性保證:parse(print(x)) 結構應與 parse(x) 相等(往返)。
*/
import { parseGraphql, type Node } from './graphql/parse'
import { printGraphql } from './graphql/print'

export { parseGraphql }
export type { Node }

/** 格式化(美化)GraphQL,2 空白縮排。解析失敗時擲出 Error。 */
export function formatGraphql(src: string): string {
  return printGraphql(parseGraphql(src), { minify: false })
}

/** 壓縮 GraphQL,去除多餘空白與換行。解析失敗時擲出 Error。 */
export function minifyGraphql(src: string): string {
  return printGraphql(parseGraphql(src), { minify: true })
}
