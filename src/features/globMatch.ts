/*
  Glob 比對引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  把 glob 樣式(如「雙星號斜線星號 .js」、src 下的雙星號、[abc]、{a,b})編譯成正規表達式,測試路徑是否符合。
  用於驗證 tsconfig 的 include/exclude、CI 的 path filter、.dockerignore 等的樣式對不對。

  語意(minimatch 常見子集):
    *      比對單一路徑段內任意字元(不跨 /)
    **     globstar:在路徑段邊界時可跨多層目錄;否則等同 *
    ?      單一字元(不跨 /)
    [abc]  字元集(支援範圍 a-z 與開頭 ! / ^ 取反)
    {a,b}  擇一(可巢狀)
  全程在你的瀏覽器,不連網、不上傳。
*/

export interface GlobOptions {
  nocase?: boolean // 不分大小寫
}

const REGEX_SPECIAL = new Set(['.', '+', '^', '$', '(', ')', '=', '!', '|', '\\'])

function escapeChar(c: string): string {
  return REGEX_SPECIAL.has(c) ? '\\' + c : c
}

/** 把任意字元轉成正規表達式中的字面值(跳脫所有 metacharacter,供 \ 跳脫的 glob 字元用)。 */
function escapeLiteral(c: string): string {
  return /[.*+?^${}()|[\]\\]/.test(c) ? '\\' + c : c
}

/** 找出與 open 位置 '{' 對應的 '}',支援巢狀;找不到回 -1。 */
function matchBrace(s: string, open: number): number {
  let depth = 0
  for (let i = open; i < s.length; i++) {
    if (s[i] === '\\') {
      i++
      continue
    }
    if (s[i] === '{') depth++
    else if (s[i] === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/** 在大括號內以頂層逗號切分(不切在巢狀 {} 內)。 */
function splitBrace(s: string): string[] {
  const out: string[] = []
  let depth = 0
  let last = 0
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\') {
      i++
      continue
    }
    if (s[i] === '{') depth++
    else if (s[i] === '}') depth--
    else if (s[i] === ',' && depth === 0) {
      out.push(s.slice(last, i))
      last = i + 1
    }
  }
  out.push(s.slice(last))
  return out
}

/** 把 glob 字串(片段)轉成正規表達式本體(不含 ^ $)。 */
function translate(glob: string): string {
  let re = ''
  let i = 0
  const n = glob.length
  while (i < n) {
    const c = glob[i]
    if (c === '\\') {
      // 跳脫下一個字元為字面值
      const next = glob[i + 1]
      if (next !== undefined) {
        re += escapeLiteral(next)
        i += 2
      } else {
        re += '\\\\'
        i++
      }
      continue
    }
    if (c === '*') {
      if (glob[i + 1] === '*') {
        // globstar:吃掉連續的 *
        let j = i + 2
        while (glob[j] === '*') j++
        const before = i === 0 || glob[i - 1] === '/'
        const afterSlash = glob[j] === '/'
        const atEnd = j >= n
        if (before && afterSlash) {
          re += '(?:[^/]*/)*' // **/ → 零或多個目錄段
          i = j + 1
        } else if (before && atEnd) {
          re += '.*' // 結尾 ** → 任意(含 /)
          i = j
        } else {
          re += '[^/]*' // 非段邊界,退化成 *
          i = j
        }
      } else {
        re += '[^/]*'
        i++
      }
      continue
    }
    if (c === '?') {
      re += '[^/]'
      i++
      continue
    }
    if (c === '[') {
      // 字元集
      let j = i + 1
      let neg = false
      if (glob[j] === '!' || glob[j] === '^') {
        neg = true
        j++
      }
      // ']' 緊接開頭視為字面
      let body = ''
      if (glob[j] === ']') {
        body += '\\]'
        j++
      }
      while (j < n && glob[j] !== ']') {
        const ch = glob[j]
        if (ch === '\\') {
          body += '\\' + (glob[j + 1] ?? '')
          j += 2
          continue
        }
        body += ch
        j++
      }
      if (j >= n) {
        // 沒有閉合,當作字面 '['
        re += '\\['
        i++
        continue
      }
      re += '[' + (neg ? '^' : '') + body + ']'
      i = j + 1
      continue
    }
    if (c === '{') {
      const close = matchBrace(glob, i)
      if (close === -1) {
        re += '\\{'
        i++
        continue
      }
      const inner = glob.slice(i + 1, close)
      const parts = splitBrace(inner)
      re += '(?:' + parts.map(translate).join('|') + ')'
      i = close + 1
      continue
    }
    re += escapeChar(c)
    i++
  }
  return re
}

/** 把整個 glob 樣式編譯成 RegExp(完整比對)。 */
export function globToRegExp(glob: string, opts: GlobOptions = {}): RegExp {
  return new RegExp('^' + translate(glob) + '$', opts.nocase ? 'i' : '')
}

/** 測試單一 glob 是否符合路徑。 */
export function matchGlob(glob: string, path: string, opts: GlobOptions = {}): boolean {
  return globToRegExp(glob, opts).test(path)
}

export interface PathResult {
  path: string
  matched: boolean
  matchedBy: string[] // 符合的樣式清單
}

/** 過濾出有效樣式(去空白、略過空行與 # 註解)。 */
export function cleanPatterns(input: string): string[] {
  return input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'))
}

/**
 * 多個樣式 × 多個路徑:每個路徑列出符合哪些樣式(只要符合任一即 matched)。
 */
export function testPaths(patternsInput: string, pathsInput: string, opts: GlobOptions = {}): PathResult[] {
  const patterns = cleanPatterns(patternsInput)
  const compiled = patterns.map((p) => {
    try {
      return { p, re: globToRegExp(p, opts) }
    } catch {
      return { p, re: null as RegExp | null }
    }
  })
  const paths = pathsInput
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  return paths.map((path) => {
    const matchedBy = compiled.filter((c) => c.re && c.re.test(path)).map((c) => c.p)
    return { path, matched: matchedBy.length > 0, matchedBy }
  })
}
