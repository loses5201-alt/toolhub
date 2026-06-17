/*
  JSON 攤平核心 —— 純函式、無 DOM,可在 Node 測。
  把巢狀 JSON(物件中有物件、陣列)壓平成一層,鍵用路徑表示
  (a.b、a[0].c),好轉成 CSV / Excel 一列一筆。
  data-convert 只吃「已經是扁平的物件陣列」,巢狀 API 回傳就靠這支處理。
  全程瀏覽器、不上傳。複用 data-convert 的 objectsToCSV 輸出。
*/
import { objectsToCSV } from '../tools/data-convert/csv'

type Json = null | boolean | number | string | Json[] | { [k: string]: Json }

function isPlainObject(v: unknown): v is Record<string, Json> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** 把基本型別轉成字串欄位值(null/undefined → 空字串)。 */
function primitiveToString(v: Json): string {
  if (v === null) return ''
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return String(v)
}

/**
 * 把一個 JSON 值攤平寫進 out。
 * - 物件:key 以 prefix.key 串接
 * - 陣列:key 以 prefix[i] 串接
 * - 基本型別:寫入 out[prefix];prefix 為空(頂層就是純值)時用 'value'
 * 空物件 / 空陣列:寫入一個標記欄,避免整列消失。
 */
export function flattenInto(value: Json, prefix: string, out: Record<string, string>): void {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      out[prefix || 'value'] = ''
      return
    }
    value.forEach((item, i) => flattenInto(item, `${prefix}[${i}]`, out))
  } else if (isPlainObject(value)) {
    const keys = Object.keys(value)
    if (keys.length === 0) {
      out[prefix || 'value'] = ''
      return
    }
    for (const k of keys) {
      flattenInto(value[k], prefix ? `${prefix}.${k}` : k, out)
    }
  } else {
    out[prefix || 'value'] = primitiveToString(value)
  }
}

/** 攤平單一 JSON 值成一筆扁平物件。 */
export function flattenOne(value: Json): Record<string, string> {
  const out: Record<string, string> = {}
  flattenInto(value, '', out)
  return out
}

export interface FlattenResult {
  ok: boolean
  error?: string
  rows: Record<string, string>[]
}

/**
 * 解析並攤平 JSON 文字。
 * - 頂層是陣列:每個元素 → 一列。
 * - 頂層是物件/純值:整體 → 一列。
 */
export function flattenJson(text: string): FlattenResult {
  const t = (text ?? '').trim()
  if (t === '') return { ok: false, error: '請貼上 JSON', rows: [] }
  let data: Json
  try {
    data = JSON.parse(t)
  } catch (e) {
    return { ok: false, error: 'JSON 解析錯誤:' + (e as Error).message, rows: [] }
  }
  const rows = Array.isArray(data) ? data.map((el) => flattenOne(el)) : [flattenOne(data)]
  return { ok: true, rows }
}

/** 攤平結果 → CSV(欄位為所有列出現過的鍵聯集,首見順序)。 */
export function flattenedToCSV(rows: Record<string, string>[], delimiter = ','): string {
  return objectsToCSV(rows, delimiter)
}
