/*
  表格合併核心 —— 純函式、無 DOM,可在 Node 測。
  把兩份表格依「對應欄(key)」合併,等同 Excel VLOOKUP / SQL JOIN:
  例如左邊是客戶名單、右邊是訂單金額,依 Email 對起來併成一張。
  複用 tableClean 的 Table 型別與解析/序列化。全程瀏覽器、不上傳。
*/
import type { Table } from './tableClean'

export type JoinType = 'left' | 'inner'

export interface MergeOpts {
  leftKey: number // 左表 key 欄索引
  rightKey: number // 右表 key 欄索引
  type?: JoinType // left=保留所有左列;inner=只留有對到的列
  caseSensitive?: boolean // key 是否區分英文大小寫(預設否)
  trimKey?: boolean // 比對前去除 key 前後空白(預設是)
  includeRightKey?: boolean // 是否把右表的 key 欄也帶進結果(預設否,避免重複)
}

export interface MergeResult {
  table: Table
  matched: number // 左列成功對到右表的筆數
  unmatched: number // 左列找不到對應的筆數
  rightDuplicates: number // 右表中 key 重複、被略過的筆數(VLOOKUP 取第一筆)
}

function normKey(v: string, opts: MergeOpts): string {
  let s = v ?? ''
  if (opts.trimKey ?? true) s = s.replace(/^[\s　]+|[\s　]+$/g, '')
  if (!(opts.caseSensitive ?? false)) s = s.toLowerCase()
  return s
}

/**
 * 合併兩表。右表以 key 建索引(同 key 取第一筆,VLOOKUP 行為)。
 * 右表欄名與左表衝突時自動加「(2)」避免覆蓋。
 */
export function mergeTables(left: Table, right: Table, opts: MergeOpts): MergeResult {
  const type = opts.type ?? 'left'
  const includeRightKey = opts.includeRightKey ?? false

  // 右表要帶進來的欄位索引(預設排除 key 欄)
  const rightCols = right.headers
    .map((_, i) => i)
    .filter((i) => includeRightKey || i !== opts.rightKey)

  // 右表索引:key → 第一筆對應列;統計重複
  const index = new Map<string, string[]>()
  let rightDuplicates = 0
  for (const r of right.rows) {
    const key = normKey(r[opts.rightKey] ?? '', opts)
    if (index.has(key)) {
      rightDuplicates++
      continue
    }
    index.set(key, r)
  }

  // 結果表頭:左表全部 + 右表選定欄(衝突改名)
  const usedNames = new Set(left.headers)
  const rightHeaderNames = rightCols.map((i) => {
    let name = right.headers[i]
    if (usedNames.has(name)) {
      let n = 2
      while (usedNames.has(`${name}(${n})`)) n++
      name = `${name}(${n})`
    }
    usedNames.add(name)
    return name
  })
  const headers = [...left.headers, ...rightHeaderNames]

  const rows: string[][] = []
  let matched = 0
  let unmatched = 0
  for (const lrow of left.rows) {
    const key = normKey(lrow[opts.leftKey] ?? '', opts)
    const match = index.get(key)
    if (match) {
      matched++
      rows.push([...lrow, ...rightCols.map((i) => match[i] ?? '')])
    } else {
      unmatched++
      if (type === 'left') {
        rows.push([...lrow, ...rightCols.map(() => '')])
      }
      // inner join:跳過沒對到的左列
    }
  }

  return { table: { headers, rows }, matched, unmatched, rightDuplicates }
}
