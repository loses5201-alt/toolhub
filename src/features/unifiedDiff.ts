/*
  Unified diff(統一差異 / .patch)產生引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  把「原始」與「修改後」兩段文字比對,輸出標準的 unified diff 格式(--- / +++ /
  @@ 區塊 / 前綴 空白·-·+),可直接存成 .patch、貼進 PR 說明、或用 patch / git apply 套用。
  與「文字比對(text-diff)」互補:那支是視覺逐行對照,這支產出可機器套用的 patch 文字。
  演算法:逐行 LCS → difflib 式 grouped opcodes(含 context 上下文行)。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

export interface UnifiedDiffOptions {
  oldName?: string
  newName?: string
  context?: number // 每個區塊前後保留的上下文行數(預設 3)
  ignoreCase?: boolean
  ignoreTrailingSpace?: boolean
}

export interface UnifiedDiffResult {
  patch: string
  added: number // 新增行數
  removed: number // 刪除行數
  hunks: number // 區塊數
  identical: boolean
}

type Op = 'equal' | 'delete' | 'insert'
type Opcode = [tag: 'equal' | 'delete' | 'insert' | 'replace', i1: number, i2: number, j1: number, j2: number]

function splitLines(s: string): string[] {
  return s.replace(/\r\n?/g, '\n').split('\n')
}

function normLine(s: string, opt: UnifiedDiffOptions): string {
  let r = s
  if (opt.ignoreTrailingSpace) r = r.replace(/[ \t]+$/, '')
  if (opt.ignoreCase) r = r.toLowerCase()
  return r
}

/** 逐行 LCS,回傳對齊操作序列(forward order)。 */
function lcsOps(a: string[], b: string[]): Op[] {
  const n = a.length
  const m = b.length
  // dp[i][j] = a[i..] 與 b[j..] 的 LCS 長度
  const dp: Int32Array[] = Array.from({ length: n + 1 }, () => new Int32Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    const row = dp[i]
    const next = dp[i + 1]
    for (let j = m - 1; j >= 0; j--) {
      row[j] = a[i] === b[j] ? next[j + 1] + 1 : Math.max(next[j], row[j + 1])
    }
  }
  const ops: Op[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push('equal')
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push('delete')
      i++
    } else {
      ops.push('insert')
      j++
    }
  }
  while (i < n) {
    ops.push('delete')
    i++
  }
  while (j < m) {
    ops.push('insert')
    j++
  }
  return ops
}

/** 把操作序列壓成 opcodes 區塊(equal / delete / insert / replace)。 */
function toOpcodes(ops: Op[]): Opcode[] {
  const out: Opcode[] = []
  let i = 0
  let j = 0
  let k = 0
  while (k < ops.length) {
    if (ops[k] === 'equal') {
      const i1 = i
      const j1 = j
      while (k < ops.length && ops[k] === 'equal') {
        i++
        j++
        k++
      }
      out.push(['equal', i1, i, j1, j])
    } else {
      const i1 = i
      const j1 = j
      let hasDel = false
      let hasIns = false
      while (k < ops.length && ops[k] !== 'equal') {
        if (ops[k] === 'delete') {
          i++
          hasDel = true
        } else {
          j++
          hasIns = true
        }
        k++
      }
      const tag = hasDel && hasIns ? 'replace' : hasDel ? 'delete' : 'insert'
      out.push([tag, i1, i, j1, j])
    }
  }
  return out
}

/** 依 context 把 opcodes 切成數個群組(港 Python difflib.get_grouped_opcodes)。 */
function groupOpcodes(codes: Opcode[], n: number): Opcode[][] {
  let work: Opcode[] = codes.slice()
  if (work.length === 0) return []
  // 修剪首尾的大段 equal,只留 n 行上下文
  const first = work[0]
  if (first[0] === 'equal') {
    work[0] = ['equal', Math.max(first[1], first[2] - n), first[2], Math.max(first[3], first[4] - n), first[4]]
  }
  const last = work[work.length - 1]
  if (last[0] === 'equal') {
    work[work.length - 1] = ['equal', last[1], Math.min(last[2], last[1] + n), last[3], Math.min(last[4], last[3] + n)]
  }

  const groups: Opcode[][] = []
  let group: Opcode[] = []
  for (const code of work) {
    const [tag, i1, i2, j1, j2] = code
    // 中間的大段 equal:切斷成「結尾上下文 + 新群組開頭上下文」
    if (tag === 'equal' && i2 - i1 > n * 2) {
      group.push(['equal', i1, Math.min(i2, i1 + n), j1, Math.min(j2, j1 + n)])
      groups.push(group)
      group = [['equal', Math.max(i1, i2 - n), i2, Math.max(j1, j2 - n), j2]]
      continue
    }
    group.push(code)
  }
  if (group.length && !(group.length === 1 && group[0][0] === 'equal')) {
    groups.push(group)
  }
  return groups
}

/** difflib 式 range 格式化:start/stop(0-based, exclusive)→ "beginning,length"。 */
function formatRange(start: number, stop: number): string {
  let beginning = start + 1
  const length = stop - start
  if (length === 1) return String(beginning)
  if (length === 0) beginning -= 1 // 空範圍起點在前一行
  return `${beginning},${length}`
}

/** 產生 unified diff 文字與統計。 */
export function unifiedDiff(
  oldText: string,
  newText: string,
  opt: UnifiedDiffOptions = {},
): UnifiedDiffResult {
  const context = opt.context == null ? 3 : Math.max(0, Math.floor(opt.context))
  const aRaw = splitLines(oldText)
  const bRaw = splitLines(newText)
  const a = aRaw.map((s) => normLine(s, opt))
  const b = bRaw.map((s) => normLine(s, opt))

  const ops = lcsOps(a, b)
  const codes = toOpcodes(ops)
  const groups = groupOpcodes(codes, context)

  let added = 0
  let removed = 0
  const lines: string[] = []

  for (const group of groups) {
    const gi1 = group[0][1]
    const gi2 = group[group.length - 1][2]
    const gj1 = group[0][3]
    const gj2 = group[group.length - 1][4]
    lines.push(`@@ -${formatRange(gi1, gi2)} +${formatRange(gj1, gj2)} @@`)
    for (const [tag, i1, i2, j1, j2] of group) {
      if (tag === 'equal') {
        for (let k = i1; k < i2; k++) lines.push(' ' + aRaw[k])
        continue
      }
      if (tag === 'delete' || tag === 'replace') {
        for (let k = i1; k < i2; k++) {
          lines.push('-' + aRaw[k])
          removed++
        }
      }
      if (tag === 'insert' || tag === 'replace') {
        for (let k = j1; k < j2; k++) {
          lines.push('+' + bRaw[k])
          added++
        }
      }
    }
  }

  const identical = groups.length === 0
  let patch = ''
  if (!identical) {
    const oldName = opt.oldName || 'original'
    const newName = opt.newName || 'modified'
    patch = `--- ${oldName}\n+++ ${newName}\n` + lines.join('\n') + '\n'
  }

  return { patch, added, removed, hunks: groups.length, identical }
}
