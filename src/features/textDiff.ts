/*
  文字差異比對引擎 —— 零相依、純函式,全程在瀏覽器執行。
  用標準 LCS(最長共同子序列)動態規劃,先做行層級差異,
  再對「一刪一增」的配對行做詞層級差異,標出真正改動的字。
  與 UI 分離,方便回歸測試(scripts/test-textdiff.mjs)。
*/

export type Op = '=' | '-' | '+'

export interface TokenDiff {
  op: Op
  text: string
}

export interface DiffLine {
  op: Op
  // 行內詞層級標示(僅在配對的修改行才有,否則為整行單一 token)
  tokens: TokenDiff[]
  // 原始行號(從 1 起算;不存在的一側為 null)
  oldNo: number | null
  newNo: number | null
}

export interface DiffOptions {
  ignoreCase?: boolean
  ignoreWhitespace?: boolean // 比較時忽略前後空白與連續空白(顯示仍用原文)
}

export interface DiffResult {
  lines: DiffLine[]
  added: number
  removed: number
  unchanged: number
}

// 比較用的正規化鍵:不改動顯示文字,只影響「視為相同」的判斷
function normLine(s: string, opt: DiffOptions): string {
  let k = s
  if (opt.ignoreWhitespace) k = k.replace(/\s+/g, ' ').trim()
  if (opt.ignoreCase) k = k.toLowerCase()
  return k
}

// 泛型 LCS 差異:回傳依序排列的操作。keyFn 決定兩元素是否相等。
function lcsDiff<T>(a: T[], b: T[], keyFn: (x: T) => string): Array<{ op: Op; a?: T; b?: T }> {
  const n = a.length
  const m = b.length
  const ka = a.map(keyFn)
  const kb = b.map(keyFn)
  // dp[i][j] = a[i..]、b[j..] 的 LCS 長度
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = ka[i] === kb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const out: Array<{ op: Op; a?: T; b?: T }> = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (ka[i] === kb[j]) {
      out.push({ op: '=', a: a[i], b: b[j] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ op: '-', a: a[i] })
      i++
    } else {
      out.push({ op: '+', b: b[j] })
      j++
    }
  }
  while (i < n) out.push({ op: '-', a: a[i++] })
  while (j < m) out.push({ op: '+', b: b[j++] })
  return out
}

// 詞層級切分:CJK 逐字、拉丁文連續字母數字為一詞、空白與標點各自成 token,
// 這樣中英文混排都能標出最小的改動單位。
function tokenize(s: string): string[] {
  return s.match(/[A-Za-z0-9]+|\s+|[一-鿿㐀-䶿]|[^\sA-Za-z0-9]/g) || []
}

// 對一刪一增的配對行做行內詞差異
function wordDiff(oldLine: string, newLine: string, opt: DiffOptions): { del: TokenDiff[]; add: TokenDiff[] } {
  const at = tokenize(oldLine)
  const bt = tokenize(newLine)
  const keyFn = (t: string) => (opt.ignoreCase ? t.toLowerCase() : t)
  const ops = lcsDiff(at, bt, keyFn)
  const del: TokenDiff[] = []
  const add: TokenDiff[] = []
  for (const o of ops) {
    if (o.op === '=') {
      del.push({ op: '=', text: o.a as string })
      add.push({ op: '=', text: o.b as string })
    } else if (o.op === '-') {
      del.push({ op: '-', text: o.a as string })
    } else {
      add.push({ op: '+', text: o.b as string })
    }
  }
  return { del, add }
}

export function diffText(oldText: string, newText: string, opt: DiffOptions = {}): DiffResult {
  const a = oldText.replace(/\r\n?/g, '\n').split('\n')
  const b = newText.replace(/\r\n?/g, '\n').split('\n')
  const ops = lcsDiff(a, b, (s) => normLine(s, opt))

  const lines: DiffLine[] = []
  let added = 0
  let removed = 0
  let unchanged = 0
  let oldNo = 0
  let newNo = 0

  // 暫存連續的刪除/新增,遇到相同行或結尾時一次沖出(可配對做詞差異)
  let pendDel: string[] = []
  let pendAdd: string[] = []

  function flush() {
    // 能配對的部分做行內詞差異,其餘整行標示
    const pairs = Math.min(pendDel.length, pendAdd.length)
    for (let k = 0; k < pairs; k++) {
      const wd = wordDiff(pendDel[k], pendAdd[k], opt)
      lines.push({ op: '-', tokens: wd.del, oldNo: ++oldNo, newNo: null })
      lines.push({ op: '+', tokens: wd.add, oldNo: null, newNo: ++newNo })
      removed++
      added++
    }
    for (let k = pairs; k < pendDel.length; k++) {
      lines.push({ op: '-', tokens: [{ op: '-', text: pendDel[k] }], oldNo: ++oldNo, newNo: null })
      removed++
    }
    for (let k = pairs; k < pendAdd.length; k++) {
      lines.push({ op: '+', tokens: [{ op: '+', text: pendAdd[k] }], oldNo: null, newNo: ++newNo })
      added++
    }
    pendDel = []
    pendAdd = []
  }

  for (const o of ops) {
    if (o.op === '-') pendDel.push(o.a as string)
    else if (o.op === '+') pendAdd.push(o.b as string)
    else {
      flush()
      lines.push({ op: '=', tokens: [{ op: '=', text: o.a as string }], oldNo: ++oldNo, newNo: ++newNo })
      unchanged++
    }
  }
  flush()

  return { lines, added, removed, unchanged }
}
