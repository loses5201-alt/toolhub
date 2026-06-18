/*
  表格資料 → SQL 語法產生器 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  把貼上的 CSV/TSV(第一列為欄位名)轉成 INSERT 語句,並可一併產生 CREATE TABLE。
  難的地方在「乾淨正確」:字串引號要跳脫(' → '')、空值轉 NULL、數字不加引號、
  但開頭是 0 的「數字」(電話、統編、郵遞區號)要當字串保留、各資料庫方言的識別字引號與布林寫法不同。
  線上轉 SQL 的服務常要你上傳可能含個資的整份資料;本引擎全程在瀏覽器處理、不上傳。
*/
import { parseCSV } from '../tools/data-convert/csv'

export type Dialect = 'mysql' | 'postgres' | 'sqlite' | 'standard'
export type ColType = 'int' | 'decimal' | 'bool' | 'string'

export interface Table {
  headers: string[]
  rows: string[][]
}

export interface SqlOptions {
  tableName?: string
  dialect?: Dialect
  /** 多列合併成一句 INSERT(... ),(... );每 batchSize 筆切一句 */
  multiRow?: boolean
  batchSize?: number
  /** 空字串視為 NULL(預設 true) */
  emptyAsNull?: boolean
  /** 自動判斷數字欄位不加引號(預設 true);關閉則全部當字串 */
  inferTypes?: boolean
  /** 一併輸出 CREATE TABLE */
  createTable?: boolean
}

const DEFAULTS: Required<Omit<SqlOptions, 'tableName'>> = {
  dialect: 'mysql',
  multiRow: true,
  batchSize: 100,
  emptyAsNull: true,
  inferTypes: true,
  createTable: false,
}

/** 解析 CSV/TSV(第一列為表頭)。 */
export function parseTable(text: string, delimiter = ','): Table {
  const rows = parseCSV(text, delimiter).filter((r) => !(r.length === 1 && r[0] === ''))
  if (rows.length === 0) return { headers: [], rows: [] }
  const headers = rows[0].map((h, i) => h.trim() || `col${i + 1}`)
  return { headers, rows: rows.slice(1) }
}

const INT_RE = /^-?\d+$/
const DEC_RE = /^-?(?:\d+\.\d*|\.\d+|\d+)$/

function isNullish(v: string | undefined): boolean {
  return v == null || v.trim() === ''
}

/** 一個值若可安全當數字輸出(不加引號)。開頭 0 的多位整數、過長整數一律當字串。 */
function looksNumeric(v: string): boolean {
  const s = v.trim()
  if (!DEC_RE.test(s)) return false
  // 純整數但有前導 0(且不只一位)→ 保留為字串(電話/統編/郵遞區號)
  const digits = s.replace(/^-/, '')
  if (INT_RE.test(s)) {
    if (digits.length > 1 && digits[0] === '0') return false
    if (digits.length > 18) return false // 超過 BIGINT 安全範圍
  }
  return true
}

function isBoolToken(v: string): boolean {
  const s = v.trim().toLowerCase()
  return s === 'true' || s === 'false'
}

/** 依整欄所有非空值推斷型別。 */
export function inferColumnType(values: string[]): ColType {
  const nonEmpty = values.filter((v) => !isNullish(v))
  if (nonEmpty.length === 0) return 'string'
  if (nonEmpty.every((v) => isBoolToken(v))) return 'bool'
  if (nonEmpty.every((v) => looksNumeric(v))) {
    return nonEmpty.every((v) => INT_RE.test(v.trim())) ? 'int' : 'decimal'
  }
  return 'string'
}

function columnValues(table: Table, idx: number): string[] {
  return table.rows.map((r) => r[idx] ?? '')
}

/** 各欄型別(inferTypes 關閉時全部 string)。 */
export function inferTypes(table: Table, enabled = true): ColType[] {
  return table.headers.map((_, i) => (enabled ? inferColumnType(columnValues(table, i)) : 'string'))
}

/** 識別字(資料表 / 欄位名)依方言加引號。 */
export function quoteIdent(name: string, dialect: Dialect): string {
  if (dialect === 'mysql') return '`' + name.replace(/`/g, '``') + '`'
  return '"' + name.replace(/"/g, '""') + '"' // postgres / sqlite / standard
}

/** 字串值加單引號並跳脫。MySQL 需額外處理反斜線。 */
function quoteString(v: string, dialect: Dialect): string {
  let s = v.replace(/'/g, "''")
  if (dialect === 'mysql') s = s.replace(/\\/g, '\\\\')
  return "'" + s + "'"
}

function boolLiteral(v: string, dialect: Dialect): string {
  const t = v.trim().toLowerCase() === 'true'
  if (dialect === 'postgres' || dialect === 'standard') return t ? 'TRUE' : 'FALSE'
  return t ? '1' : '0' // mysql / sqlite
}

/** 單一儲存格 → SQL 字面值。 */
export function formatValue(raw: string | undefined, type: ColType, opts: Required<Omit<SqlOptions, 'tableName'>>): string {
  const v = raw ?? ''
  if (isNullish(v)) {
    // 數字/布林欄的空值必為 NULL;字串欄依設定
    if (type !== 'string' || opts.emptyAsNull) return 'NULL'
    return "''"
  }
  if (type === 'int' || type === 'decimal') {
    return looksNumeric(v) ? v.trim() : quoteString(v, opts.dialect)
  }
  if (type === 'bool') {
    return isBoolToken(v) ? boolLiteral(v, opts.dialect) : quoteString(v, opts.dialect)
  }
  return quoteString(v, opts.dialect)
}

function sqlType(type: ColType, maxLen: number, dialect: Dialect): string {
  switch (type) {
    case 'int':
      return dialect === 'mysql' ? 'INT' : 'INTEGER'
    case 'decimal':
      return dialect === 'sqlite' ? 'REAL' : dialect === 'postgres' ? 'NUMERIC' : 'DECIMAL(20,6)'
    case 'bool':
      if (dialect === 'postgres' || dialect === 'standard') return 'BOOLEAN'
      return dialect === 'sqlite' ? 'INTEGER' : 'TINYINT(1)'
    default: {
      if (dialect === 'sqlite') return 'TEXT'
      const tier = [50, 100, 255].find((t) => maxLen <= t)
      if (!tier) return dialect === 'postgres' ? 'TEXT' : 'TEXT'
      return dialect === 'postgres' ? `VARCHAR(${tier})` : `VARCHAR(${tier})`
    }
  }
}

/** 產生 CREATE TABLE 語句。 */
export function generateCreateTable(table: Table, options: SqlOptions = {}): string {
  const opts = { ...DEFAULTS, ...options }
  const name = (options.tableName || 'my_table').trim() || 'my_table'
  const types = inferTypes(table, opts.inferTypes)
  const cols = table.headers.map((h, i) => {
    const maxLen = Math.max(1, ...columnValues(table, i).map((v) => v.length))
    return `  ${quoteIdent(h, opts.dialect)} ${sqlType(types[i], maxLen, opts.dialect)}`
  })
  return `CREATE TABLE ${quoteIdent(name, opts.dialect)} (\n${cols.join(',\n')}\n);`
}

/** 產生 INSERT 語句(主函式)。 */
export function generateInserts(table: Table, options: SqlOptions = {}): string {
  const opts = { ...DEFAULTS, ...options }
  const name = (options.tableName || 'my_table').trim() || 'my_table'
  if (table.headers.length === 0) return ''
  const qname = quoteIdent(name, opts.dialect)
  const cols = table.headers.map((h) => quoteIdent(h, opts.dialect)).join(', ')
  const types = inferTypes(table, opts.inferTypes)
  const tuples = table.rows.map(
    (r) => '(' + table.headers.map((_, i) => formatValue(r[i], types[i], opts)).join(', ') + ')',
  )
  if (tuples.length === 0) return ''
  const prefix = `INSERT INTO ${qname} (${cols}) VALUES`
  const out: string[] = []
  if (opts.multiRow) {
    const size = Math.max(1, opts.batchSize)
    for (let i = 0; i < tuples.length; i += size) {
      const chunk = tuples.slice(i, i + size)
      out.push(`${prefix}\n  ${chunk.join(',\n  ')};`)
    }
  } else {
    for (const t of tuples) out.push(`${prefix} ${t};`)
  }
  return out.join('\n')
}

/** 一次產生(可選 CREATE TABLE + INSERT)。 */
export function generateSQL(table: Table, options: SqlOptions = {}): string {
  const parts: string[] = []
  if (options.createTable) parts.push(generateCreateTable(table, options))
  const inserts = generateInserts(table, options)
  if (inserts) parts.push(inserts)
  return parts.join('\n\n')
}
