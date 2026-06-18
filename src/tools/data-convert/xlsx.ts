/*
  Excel(.xlsx/.xls)讀寫 —— 全程在瀏覽器處理,不上傳檔案。
  以 SheetJS 解析/產生試算表。此檔只被「動態 import」載入,
  會被打包成獨立 sheet-vendor chunk,不拖累首頁與其他工具。
*/
import * as XLSX from 'xlsx'

/** 讀取 Excel 檔(第一個工作表)→ 物件陣列(以第一列為表頭) */
export function excelToObjects(buf: ArrayBuffer): Record<string, unknown>[] {
  const wb = XLSX.read(buf, { type: 'array' })
  const first = wb.SheetNames[0]
  if (!first) return []
  const ws = wb.Sheets[first]
  // defval:'' 讓空白儲存格也保留欄位;raw:false 讓日期等顯示為文字
  return XLSX.utils.sheet_to_json(ws, { defval: '', raw: false })
}

/** 列出 Excel 檔的所有工作表名稱 */
export function excelSheetNames(buf: ArrayBuffer): string[] {
  return XLSX.read(buf, { type: 'array', bookSheets: true }).SheetNames ?? []
}

/** 物件陣列 → .xlsx 檔(Blob),供下載 */
export function objectsToExcelBlob(
  records: Record<string, unknown>[],
  sheetName = '工作表1',
): Blob {
  const ws = XLSX.utils.json_to_sheet(records)
  const wb = XLSX.utils.book_new()
  // 工作表名稱長度上限 31 字
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31) || '工作表1')
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/** 多組資料 → 單一 .xlsx,每組一個工作表(供表格拆分輸出)。 */
export function sheetsToExcelBlob(
  sheets: { name: string; records: Record<string, unknown>[] }[],
): Blob {
  const wb = XLSX.utils.book_new()
  const used = new Set<string>()
  sheets.forEach((s, i) => {
    // Excel 工作表名:長度上限 31、不可含 []:*?/\、需唯一
    let base = (s.name || `工作表${i + 1}`).replace(/[[\]:*?/\\]/g, '_').slice(0, 31) || `工作表${i + 1}`
    let name = base
    let n = 2
    while (used.has(name.toLowerCase())) {
      const suffix = ` (${n++})`
      name = base.slice(0, 31 - suffix.length) + suffix
    }
    used.add(name.toLowerCase())
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.records), name)
  })
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}
