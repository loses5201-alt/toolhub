/*
  SQL 格式化 / 美化引擎(純函式、無 DOM,可在 Node 直接測)。
  目標:把擠成一行或排版凌亂的 SQL 整理成可讀、可預期、穩定(idempotent)的格式;
  或反向壓成單行(minify)。全程在使用者瀏覽器執行,不上傳。

  設計重點:
  - tokenizer 正確保留字串('' 與反斜線跳脫)、識別字("" / `` 跳脫)、行註解與區塊註解、
    數字(含 0x、小數、指數)、參數(@x :x $1 ?),所以格式化「絕不改動」字面內容。
  - 格式化採「主要子句各自換行、其後參數接續,頂層逗號斷行、AND/OR 換行」的風格;
    子查詢與 CREATE 欄位定義用區塊括號縮排。關鍵字大小寫可選 upper/lower/preserve。
  限制:這是排版器,不解析語義;少數冷門語法(如 LEFT() 字串函式、一元負號)排版會略有出入。
*/

export type KeywordCase = 'upper' | 'lower' | 'preserve'
export interface SqlFormatOptions {
  keywordCase?: KeywordCase
  indent?: number
}
export interface SqlFormatResult {
  ok: boolean
  output: string
  error?: string
}

type TokKind = 'lc' | 'bc' | 'str' | 'id' | 'num' | 'word' | 'param' | 'punct'
interface Tok {
  t: TokKind
  v: string
}

// 語法關鍵字(用於大小寫轉換,以及「關鍵字後接 ( 要留空格」的判斷)。不含一般函式名。
const KEYWORDS = new Set(
  (
    'SELECT FROM WHERE GROUP BY ORDER HAVING LIMIT OFFSET FETCH INSERT INTO VALUES UPDATE SET ' +
    'DELETE CREATE TABLE VIEW INDEX SEQUENCE ALTER DROP TRUNCATE ADD COLUMN RENAME TO AS ' +
    'DISTINCT ALL ANY SOME EXISTS UNION INTERSECT EXCEPT WITH RECURSIVE RETURNING WINDOW OVER PARTITION ' +
    'JOIN INNER LEFT RIGHT FULL OUTER CROSS NATURAL ON USING AND OR NOT IN IS NULL LIKE ILIKE ' +
    'BETWEEN CASE WHEN THEN ELSE END ASC DESC NULLS FIRST LAST PRIMARY KEY FOREIGN REFERENCES ' +
    'UNIQUE DEFAULT CHECK CONSTRAINT CASCADE RESTRICT GENERATED ALWAYS IDENTITY AUTO_INCREMENT ' +
    'IF REPLACE TEMPORARY TEMP COLLATE GRANT REVOKE BEGIN COMMIT ROLLBACK FILTER WITHIN'
  ).split(/\s+/),
)

const JOIN_WORDS = new Set(['INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS', 'NATURAL', 'OUTER', 'JOIN'])
const SETOPS = new Set(['UNION', 'INTERSECT', 'EXCEPT'])
// 單字子句:各自換行,其後參數接續同一行
const CLAUSE = new Set([
  'SELECT', 'FROM', 'WHERE', 'HAVING', 'LIMIT', 'OFFSET', 'FETCH', 'VALUES', 'SET',
  'RETURNING', 'WINDOW', 'INSERT', 'UPDATE', 'WITH',
])
const GLUE_OPS = new Set(['::', '->', '->>', ':='])
const MULTI_OPS = ['->>', '->', '>=', '<=', '<>', '!=', '||', '::', ':=']

function isWordStart(c: string): boolean {
  return /[A-Za-z_À-￿]/.test(c)
}
function isWordChar(c: string): boolean {
  return /[A-Za-z0-9_$À-￿]/.test(c)
}

export function tokenizeSql(sql: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  const n = sql.length
  while (i < n) {
    const c = sql[i]
    if (/\s/.test(c)) {
      i++
      continue
    }
    // 行註解 -- 與 #
    if ((c === '-' && sql[i + 1] === '-') || c === '#') {
      let j = i
      while (j < n && sql[j] !== '\n') j++
      toks.push({ t: 'lc', v: sql.slice(i, j).replace(/\s+$/, '') })
      i = j
      continue
    }
    // 區塊註解
    if (c === '/' && sql[i + 1] === '*') {
      let j = i + 2
      while (j < n && !(sql[j] === '*' && sql[j + 1] === '/')) j++
      if (j >= n) throw new Error('區塊註解 /* 沒有對應的 */ 結尾')
      j += 2
      toks.push({ t: 'bc', v: sql.slice(i, j) })
      i = j
      continue
    }
    // 字串:單引號(支援 '' 與 \' 跳脫)
    if (c === "'") {
      let j = i + 1
      while (j < n) {
        if (sql[j] === '\\') {
          j += 2
          continue
        }
        if (sql[j] === "'") {
          if (sql[j + 1] === "'") {
            j += 2
            continue
          }
          j++
          break
        }
        j++
      }
      if (j > n || sql[j - 1] !== "'") throw new Error("字串沒有對應的單引號 ' 結尾")
      toks.push({ t: 'str', v: sql.slice(i, j) })
      i = j
      continue
    }
    // 識別字:雙引號("" 跳脫)、反引號(`` 跳脫)
    if (c === '"' || c === '`') {
      const q = c
      let j = i + 1
      while (j < n) {
        if (sql[j] === q) {
          if (sql[j + 1] === q) {
            j += 2
            continue
          }
          j++
          break
        }
        j++
      }
      if (sql[j - 1] !== q) throw new Error(`識別字沒有對應的 ${q} 結尾`)
      toks.push({ t: 'id', v: sql.slice(i, j) })
      i = j
      continue
    }
    // 多字元運算子(在參數 : 之前判斷,避免吃掉 :: := )
    let matchedOp = ''
    for (const op of MULTI_OPS) {
      if (sql.startsWith(op, i)) {
        matchedOp = op
        break
      }
    }
    if (matchedOp) {
      toks.push({ t: 'punct', v: matchedOp })
      i += matchedOp.length
      continue
    }
    // 參數:@name :name $1 $name
    if (c === '@' || c === '$' || (c === ':' && isWordChar(sql[i + 1] || ''))) {
      let j = i + 1
      while (j < n && isWordChar(sql[j])) j++
      toks.push({ t: 'param', v: sql.slice(i, j) })
      i = j
      continue
    }
    // 數字
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(sql[i + 1] || ''))) {
      let j = i
      if (c === '0' && (sql[i + 1] === 'x' || sql[i + 1] === 'X')) {
        j = i + 2
        while (j < n && /[0-9a-fA-F]/.test(sql[j])) j++
      } else {
        while (j < n && /[0-9_]/.test(sql[j])) j++
        if (sql[j] === '.') {
          j++
          while (j < n && /[0-9_]/.test(sql[j])) j++
        }
        if (sql[j] === 'e' || sql[j] === 'E') {
          let k = j + 1
          if (sql[k] === '+' || sql[k] === '-') k++
          if (/[0-9]/.test(sql[k] || '')) {
            j = k
            while (j < n && /[0-9]/.test(sql[j])) j++
          }
        }
      }
      toks.push({ t: 'num', v: sql.slice(i, j) })
      i = j
      continue
    }
    // 一般字(關鍵字或識別字)
    if (isWordStart(c)) {
      let j = i + 1
      while (j < n && isWordChar(sql[j])) j++
      toks.push({ t: 'word', v: sql.slice(i, j) })
      i = j
      continue
    }
    // 其餘單一符號
    toks.push({ t: 'punct', v: c })
    i++
  }
  return toks
}

function caseWord(v: string, c: KeywordCase): string {
  return c === 'upper' ? v.toUpperCase() : c === 'lower' ? v.toLowerCase() : v
}

interface Prev {
  text: string
  kind: TokKind | 'comment'
  upper?: string
}

// 兩個 token 之間是否需要空格
function needSpace(prev: Prev, text: string): boolean {
  if (GLUE_OPS.has(text) || GLUE_OPS.has(prev.text)) return false
  if (text === ',' || text === ';' || text === ')' || text === '.') return false
  if (prev.text === '(' || prev.text === '.') return false
  if (text === '(') return prev.kind === 'word' && !!prev.upper && KEYWORDS.has(prev.upper)
  return true
}

export function formatSql(sql: string, opts: SqlFormatOptions = {}): SqlFormatResult {
  const kc = opts.keywordCase ?? 'upper'
  const unit = Math.max(1, Math.min(8, opts.indent ?? 2))
  let toks: Tok[]
  try {
    toks = tokenizeSql(sql)
  } catch (e) {
    return { ok: false, output: '', error: e instanceof Error ? e.message : String(e) }
  }
  if (toks.length === 0) return { ok: true, output: '' }

  const lines: string[] = []
  let cur = ''
  let lineHasContent = false
  let prev: Prev | null = null
  let level = 0
  let argLevel = 0
  let parenDepth = 0
  let commaBreakDepth = 0
  let betweenCount = 0
  let pendingNewline = false
  let atStmtStart = true
  let inCreate = false
  const stack: { block: boolean; level: number; argLevel: number; commaBreakDepth: number }[] = []
  const pad = (lvl: number) => ' '.repeat(unit * lvl)

  function newlineTo(target: number) {
    if (lineHasContent) lines.push(cur.replace(/\s+$/, ''))
    cur = pad(target)
    lineHasContent = false
    prev = null
  }
  function emit(disp: string, kind: TokKind | 'comment', upper?: string, force?: 'space' | 'nospace') {
    if (pendingNewline) {
      newlineTo(level)
      pendingNewline = false
    }
    let sp = ''
    if (lineHasContent) {
      if (force === 'nospace') sp = ''
      else if (force === 'space') sp = ' '
      else sp = prev && needSpace(prev, disp) ? ' ' : ''
    }
    cur += sp + disp
    lineHasContent = true
    prev = { text: disp, kind, upper }
    atStmtStart = false
  }
  function emitWord(v: string, upper: string) {
    emit(KEYWORDS.has(upper) ? caseWord(v, kc) : v, 'word', upper)
  }
  function nextMeaningful(from: number): Tok | null {
    for (let k = from; k < toks.length; k++) if (toks[k].t !== 'lc' && toks[k].t !== 'bc') return toks[k]
    return null
  }
  function endStatement() {
    if (lineHasContent) lines.push(cur.replace(/\s+$/, ''))
    lines.push('')
    cur = ''
    lineHasContent = false
    prev = null
    level = argLevel = parenDepth = commaBreakDepth = betweenCount = 0
    stack.length = 0
    pendingNewline = false
    atStmtStart = true
    inCreate = false
  }

  for (let i = 0; i < toks.length; i++) {
    const tk = toks[i]
    if (tk.t === 'lc' || tk.t === 'bc') {
      emit(tk.v, 'comment')
      if (tk.t === 'lc') pendingNewline = true
      continue
    }
    if (tk.t === 'word') {
      const upper = tk.v.toUpperCase()
      // JOIN 片語
      if (JOIN_WORDS.has(upper)) {
        let j = i
        const phrase: Tok[] = []
        while (j < toks.length && toks[j].t === 'word' && JOIN_WORDS.has(toks[j].v.toUpperCase())) {
          phrase.push(toks[j])
          j++
        }
        if (phrase.some((p) => p.v.toUpperCase() === 'JOIN')) {
          newlineTo(level)
          for (const p of phrase) emitWord(p.v, p.v.toUpperCase())
          argLevel = level + 1
          commaBreakDepth = parenDepth
          i = j - 1
          continue
        }
      }
      // DELETE FROM
      if (upper === 'DELETE') {
        newlineTo(level)
        emitWord(tk.v, upper)
        const nx = toks[i + 1]
        if (nx && nx.t === 'word' && nx.v.toUpperCase() === 'FROM') {
          emitWord(nx.v, 'FROM')
          i++
        }
        argLevel = level + 1
        commaBreakDepth = parenDepth
        continue
      }
      // GROUP BY / ORDER BY
      if ((upper === 'GROUP' || upper === 'ORDER') && toks[i + 1]?.t === 'word' && toks[i + 1].v.toUpperCase() === 'BY') {
        newlineTo(level)
        emitWord(tk.v, upper)
        emitWord(toks[i + 1].v, 'BY')
        argLevel = level + 1
        commaBreakDepth = parenDepth
        i++
        continue
      }
      // 集合運算 UNION / INTERSECT / EXCEPT [ALL|DISTINCT]
      if (SETOPS.has(upper)) {
        newlineTo(level)
        emitWord(tk.v, upper)
        const nx = toks[i + 1]
        if (nx && nx.t === 'word' && (nx.v.toUpperCase() === 'ALL' || nx.v.toUpperCase() === 'DISTINCT')) {
          emitWord(nx.v, nx.v.toUpperCase())
          i++
        }
        argLevel = level + 1
        commaBreakDepth = parenDepth
        continue
      }
      // 單字子句
      if (CLAUSE.has(upper)) {
        newlineTo(level)
        emitWord(tk.v, upper)
        argLevel = level + 1
        commaBreakDepth = parenDepth
        continue
      }
      // 邏輯運算
      if (upper === 'AND' && betweenCount > 0) {
        emitWord(tk.v, upper)
        betweenCount--
        continue
      }
      if (upper === 'AND' || upper === 'OR') {
        newlineTo(argLevel)
        emitWord(tk.v, upper)
        continue
      }
      if (upper === 'BETWEEN') {
        emitWord(tk.v, upper)
        betweenCount++
        continue
      }
      if (upper === 'CREATE' && atStmtStart) inCreate = true
      emitWord(tk.v, upper)
      continue
    }
    if (tk.t === 'punct') {
      const t = tk.v
      if (t === '(') {
        const nx = nextMeaningful(i + 1)
        const isSub = !!nx && nx.t === 'word' && (nx.v.toUpperCase() === 'SELECT' || nx.v.toUpperCase() === 'WITH')
        const isDef = inCreate && parenDepth === 0
        if (isSub || isDef) {
          const force = lineHasContent && !cur.endsWith('(') ? 'space' : undefined
          emit('(', 'punct', undefined, force)
          stack.push({ block: true, level, argLevel, commaBreakDepth })
          parenDepth++
          level++
          commaBreakDepth = parenDepth
          argLevel = level
          pendingNewline = true
        } else {
          emit('(', 'punct')
          stack.push({ block: false, level, argLevel, commaBreakDepth })
          parenDepth++
        }
        continue
      }
      if (t === ')') {
        const st = stack.pop()
        parenDepth = Math.max(0, parenDepth - 1)
        if (st && st.block) {
          newlineTo(st.level)
          emit(')', 'punct', undefined, 'nospace')
        } else {
          emit(')', 'punct')
        }
        if (st) {
          level = st.level
          argLevel = st.argLevel
          commaBreakDepth = st.commaBreakDepth
        }
        continue
      }
      if (t === ',') {
        emit(',', 'punct')
        if (parenDepth === commaBreakDepth) newlineTo(argLevel)
        continue
      }
      if (t === ';') {
        emit(';', 'punct')
        endStatement()
        continue
      }
      emit(t, 'punct')
      continue
    }
    // str / id / num / param
    emit(tk.v, tk.t)
  }
  if (lineHasContent) lines.push(cur.replace(/\s+$/, ''))

  // 收尾:去頭尾空白行、壓掉連續空白行
  const cleaned: string[] = []
  for (const ln of lines) {
    if (ln === '' && (cleaned.length === 0 || cleaned[cleaned.length - 1] === '')) continue
    cleaned.push(ln)
  }
  while (cleaned.length && cleaned[cleaned.length - 1] === '') cleaned.pop()
  return { ok: true, output: cleaned.join('\n') }
}

export function minifySql(sql: string, opts: SqlFormatOptions = {}): SqlFormatResult {
  const kc = opts.keywordCase ?? 'upper'
  let toks: Tok[]
  try {
    toks = tokenizeSql(sql)
  } catch (e) {
    return { ok: false, output: '', error: e instanceof Error ? e.message : String(e) }
  }
  let out = ''
  let prev: Prev | null = null
  for (const tk of toks) {
    if (tk.t === 'lc' || tk.t === 'bc') continue // 壓縮時移除註解
    const upper = tk.t === 'word' ? tk.v.toUpperCase() : undefined
    const disp = tk.t === 'word' && upper && KEYWORDS.has(upper) ? caseWord(tk.v, kc) : tk.v
    if (prev && needSpace(prev, disp)) out += ' '
    out += disp
    prev = { text: disp, kind: tk.t, upper }
  }
  return { ok: true, output: out }
}
