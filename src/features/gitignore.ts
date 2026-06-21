// .gitignore 規則測試引擎 —— 依 git 官方 gitignore 規則,判斷某路徑是否被忽略,
// 並指出「最後命中(last match wins)」的是哪一條規則。純函式、無 DOM,可在 Node 測試。
//
// 實作的 git 規則:
//  - 空行 / # 開頭為註解(\# 可轉義為實際 # 開頭樣式)
//  - ! 前綴為「反向(重新納入)」;但父目錄被忽略時無法重新納入其下檔案
//  - 結尾 / 只比對目錄
//  - 開頭 / 或樣式中間含 / → 錨定於根;否則比對任意層級的「basename」
//  - * 不跨 /、? 單一非 / 字元、[abc] 字元集合
//  - **:「**/」開頭=任意層、「/**」結尾=底下全部、「/**/」中間=零或多層目錄
//  - 由上而下逐層評估:父目錄被忽略且未被重新納入 → 其下一律忽略

export interface GitignoreRule {
  line: number // 1-based 行號
  raw: string // 原始行(已去尾端空白)
  pattern: string // 清理後的樣式(去 ! 與結尾 /)
  negate: boolean // ! 反向
  dirOnly: boolean // 結尾 / 只比對目錄
  anchored: boolean // 是否錨定於根
  regex: RegExp
}

function escapeRegexChar(c: string): string {
  return /[.+^${}()|\\]/.test(c) ? '\\' + c : c
}

// 把 gitignore 樣式(已去錨定/目錄旗標)編譯成比對「路徑字串」的正規式 body
function globToRegexBody(p: string): string {
  let out = ''
  let i = 0
  while (i < p.length) {
    const c = p[i]
    if (c === '\\') {
      // 反斜線轉義:下一字元視為字面
      const next = p[i + 1]
      if (next !== undefined) {
        out += escapeRegexChar(next)
        i += 2
      } else {
        out += '\\\\'
        i += 1
      }
    } else if (c === '*') {
      if (p[i + 1] === '*') {
        // ** 序列
        if (p[i + 2] === '/') {
          out += '(?:.*/)?' // **/ → 零或多層目錄
          i += 3
        } else {
          out += '.*' // ** → 跨 / 任意
          i += 2
        }
      } else {
        out += '[^/]*' // * → 不跨 /
        i += 1
      }
    } else if (c === '?') {
      out += '[^/]'
      i += 1
    } else if (c === '[') {
      // 字元集合:複製到對應 ]
      let j = i + 1
      let cls = '['
      if (p[j] === '!') {
        cls += '^'
        j++
      } else if (p[j] === '^') {
        cls += '\\^'
        j++
      }
      if (p[j] === ']') {
        cls += '\\]'
        j++
      }
      while (j < p.length && p[j] !== ']') {
        cls += p[j] === '\\' ? '\\\\' : p[j]
        j++
      }
      if (j < p.length) {
        cls += ']'
        out += cls
        i = j + 1
      } else {
        // 未閉合 [ → 當字面
        out += '\\['
        i += 1
      }
    } else {
      out += escapeRegexChar(c)
      i += 1
    }
  }
  return out
}

// 去除未轉義的尾端空白(轉義的 \<space> 保留為空白)
function stripTrailingSpaces(line: string): string {
  let end = line.length
  while (end > 0 && (line[end - 1] === ' ' || line[end - 1] === '\t')) {
    // 計算前面連續反斜線數;奇數表示此空白被轉義
    let bs = 0
    let k = end - 2
    while (k >= 0 && line[k] === '\\') {
      bs++
      k--
    }
    if (bs % 2 === 1) break
    end--
  }
  return line.slice(0, end)
}

export function parseGitignoreLine(raw: string, line: number): GitignoreRule | null {
  let s = raw.replace(/\r$/, '')
  if (s === '') return null
  if (s[0] === '#') return null // 註解
  s = stripTrailingSpaces(s)
  if (s === '') return null

  let negate = false
  if (s[0] === '!') {
    negate = true
    s = s.slice(1)
  } else if (s[0] === '\\' && (s[1] === '#' || s[1] === '!')) {
    s = s.slice(1) // 轉義的開頭 # 或 !
  }

  let dirOnly = false
  if (s.endsWith('/')) {
    dirOnly = true
    s = s.slice(0, -1)
  }
  if (s === '') return null

  let anchored = false
  if (s.startsWith('/')) {
    anchored = true
    s = s.slice(1)
  }
  if (s.includes('/')) anchored = true

  const body = globToRegexBody(s)
  // 錨定:比對自根起的完整路徑;非錨定:比對任意層級的最後幾段(basename 或子路徑)
  const source = anchored ? `^${body}$` : `(?:^|.*/)${body}$`
  return { line, raw: s, pattern: s, negate, dirOnly, anchored, regex: new RegExp(source) }
}

export function parseGitignore(text: string): GitignoreRule[] {
  const rules: GitignoreRule[] = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const r = parseGitignoreLine(lines[i], i + 1)
    if (r) rules.push(r)
  }
  return rules
}

export interface MatchResult {
  ignored: boolean
  rule: GitignoreRule | null // 決定結果的規則(last match wins)
}

// 對單一路徑做逐層評估。path 用 / 分隔;isDir 表示該路徑本身是目錄。
export function matchPath(rules: GitignoreRule[], path: string, isDir: boolean): MatchResult {
  const clean = path.replace(/^\/+/, '').replace(/\/+$/, '')
  if (clean === '') return { ignored: false, rule: null }
  const segments = clean.split('/')

  let ignored = false
  let decidingRule: GitignoreRule | null = null

  for (let i = 0; i < segments.length; i++) {
    const isLast = i === segments.length - 1
    const partial = segments.slice(0, i + 1).join('/')
    const partialIsDir = isLast ? isDir : true

    for (const rule of rules) {
      if (rule.dirOnly && !partialIsDir) continue
      if (rule.regex.test(partial)) {
        ignored = !rule.negate
        decidingRule = rule
      }
    }

    // 父目錄被忽略且未被重新納入 → 其下一律忽略,停止下探
    if (!isLast && ignored) {
      return { ignored: true, rule: decidingRule }
    }
  }

  return { ignored, rule: decidingRule }
}

export interface PathInput {
  path: string
  isDir: boolean
}

// 解析使用者輸入的路徑清單:每行一個,結尾 / 視為目錄
export function parsePaths(text: string): PathInput[] {
  const out: PathInput[] = []
  for (const lineRaw of text.split('\n')) {
    const line = lineRaw.trim()
    if (!line || line.startsWith('#')) continue
    const isDir = line.endsWith('/')
    out.push({ path: line.replace(/\/+$/, ''), isDir })
  }
  return out
}

export interface EvalRow {
  path: string
  isDir: boolean
  ignored: boolean
  rule: GitignoreRule | null
}

export function evaluateGitignore(gitignoreText: string, pathsText: string): {
  rules: GitignoreRule[]
  rows: EvalRow[]
} {
  const rules = parseGitignore(gitignoreText)
  const rows = parsePaths(pathsText).map((p) => {
    const m = matchPath(rules, p.path, p.isDir)
    return { path: p.path, isDir: p.isDir, ignored: m.ignored, rule: m.rule }
  })
  return { rules, rows }
}
