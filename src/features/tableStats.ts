/*
  表格統計 / 樞紐核心 —— 純函式、無 DOM,可在 Node 測。
  把一份表格「依某欄分組,對另一欄做統計」(等同 Excel 樞紐分析 / SQL GROUP BY):
  例如依「地區」分組,加總「金額」;或依「狀態」分組,數筆數。
  複用 tableClean 的 Table 型別。全程瀏覽器、不上傳。
*/
import type { Table } from './tableClean'

export type Agg = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinct'

export const aggLabels: Record<Agg, string> = {
  count: '筆數',
  sum: '加總',
  avg: '平均',
  min: '最小',
  max: '最大',
  distinct: '不重複數',
}

export interface StatsOpts {
  groupCol: number // 分組欄索引;< 0 表示不分組(全部視為一組)
  valueCol: number // 被統計的欄索引(count 時可忽略)
  agg: Agg
}

/** 解析含千分位逗號 / 前後空白的數值;非數值回 null。 */
export function parseNum(s: string): number | null {
  const t = (s ?? '').replace(/,/g, '').replace(/[\s　]/g, '')
  if (t === '') return null
  const n = Number(t)
  return isNaN(n) ? null : n
}

/** 數值格式化:整數不帶小數,其餘最多 4 位且去尾零。 */
export function formatNum(n: number): string {
  if (!isFinite(n)) return ''
  if (Number.isInteger(n)) return String(n)
  return parseFloat(n.toFixed(4)).toString()
}

function aggregate(values: string[], agg: Agg): string {
  if (agg === 'count') return String(values.length)
  if (agg === 'distinct') return String(new Set(values).size)
  const nums = values.map(parseNum).filter((n): n is number => n !== null)
  if (nums.length === 0) return '' // 該組沒有可用數值
  switch (agg) {
    case 'sum':
      return formatNum(nums.reduce((a, b) => a + b, 0))
    case 'avg':
      return formatNum(nums.reduce((a, b) => a + b, 0) / nums.length)
    case 'min':
      return formatNum(Math.min(...nums))
    case 'max':
      return formatNum(Math.max(...nums))
    default:
      return ''
  }
}

export interface StatsResult {
  table: Table // 兩欄:[分組欄名/「全部」, 統計欄名]
  groups: number // 分組數
}

/**
 * 依 groupCol 分組(維持首次出現順序),對 valueCol 套用 agg。
 */
export function computeStats(src: Table, opts: StatsOpts): StatsResult {
  const grouped = opts.groupCol >= 0
  // 分組鍵(維持首次出現順序)→ 該組 valueCol 的值清單
  const order: string[] = []
  const buckets = new Map<string, string[]>()
  for (const r of src.rows) {
    const key = grouped ? (r[opts.groupCol] ?? '') : '全部'
    if (!buckets.has(key)) {
      buckets.set(key, [])
      order.push(key)
    }
    buckets.get(key)!.push(r[opts.valueCol] ?? '')
  }

  const groupName = grouped ? src.headers[opts.groupCol] ?? '分組' : '全部'
  const valueName = src.headers[opts.valueCol] ?? '值'
  const statHeader =
    opts.agg === 'count' ? aggLabels.count : `${valueName} ${aggLabels[opts.agg]}`

  const rows = order.map((key) => [key, aggregate(buckets.get(key)!, opts.agg)])
  return { table: { headers: [groupName, statHeader], rows }, groups: order.length }
}
