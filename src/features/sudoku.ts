/*
  數獨(Sudoku)引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  提供:
   - parseGrid:把貼上的盤面文字(81 格,1–9 為填入、0/./空白/_/× 為空格)解析成陣列。
   - findConflicts:找出違反「同列/同行/同九宮格不可重複」的格子(供 UI 標紅)。
   - solve:回溯法 + MRV(最少候選優先)解題,回傳唯一解或 null(無解)。
   - countSolutions:數解的個數(最多數到上限),用來判斷「是否唯一解」。
   - generate:先用隨機回溯排滿一個合法終盤,再依難度挖洞,每挖一格都確認仍為唯一解。
   - gridToString / gridToLines:把盤面輸出成文字。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

export type Grid = number[] // 長度 81,0 = 空格,1–9 = 已填

export interface ParseResult {
  grid: Grid | null
  error: string | null
  filled: number // 已填入的格數
}

const SIZE = 9
const CELLS = 81

/** 把任意文字解析成 81 格盤面。接受 1–9 為數字,0 . _ * × 空白 為空格,其餘字元忽略。 */
export function parseGrid(input: string): ParseResult {
  const cells: number[] = []
  for (const ch of input) {
    if (ch >= '1' && ch <= '9') cells.push(ch.charCodeAt(0) - 48)
    else if (ch === '0' || ch === '.' || ch === '_' || ch === '*' || ch === '×' || ch === 'x' || ch === 'X')
      cells.push(0)
    // 其他字元(換行、分隔線、空白)一律忽略
  }
  if (cells.length === 0) return { grid: null, error: '看不到任何盤面內容', filled: 0 }
  if (cells.length !== CELLS)
    return {
      grid: null,
      error: `需要剛好 81 格,目前讀到 ${cells.length} 格(用 0 或 . 代表空格,每列 9 個數字)`,
      filled: 0,
    }
  const filled = cells.filter((c) => c !== 0).length
  return { grid: cells, error: null, filled }
}

function rowOf(i: number): number {
  return Math.floor(i / SIZE)
}
function colOf(i: number): number {
  return i % SIZE
}

/** 在不看自己的前提下,某格放 v 是否與同列/行/宮衝突。 */
function conflictsAt(grid: Grid, idx: number, v: number): boolean {
  const r = rowOf(idx)
  const c = colOf(idx)
  const br = Math.floor(r / 3) * 3
  const bc = Math.floor(c / 3) * 3
  for (let k = 0; k < SIZE; k++) {
    if (grid[r * SIZE + k] === v && r * SIZE + k !== idx) return true
    if (grid[k * SIZE + c] === v && k * SIZE + c !== idx) return true
  }
  for (let dr = 0; dr < 3; dr++) {
    for (let dc = 0; dc < 3; dc++) {
      const j = (br + dr) * SIZE + (bc + dc)
      if (grid[j] === v && j !== idx) return true
    }
  }
  return false
}

/** 找出所有違反規則的格子索引(已填的格子中互相衝突者)。 */
export function findConflicts(grid: Grid): Set<number> {
  const bad = new Set<number>()
  for (let i = 0; i < CELLS; i++) {
    const v = grid[i]
    if (v === 0) continue
    if (conflictsAt(grid, i, v)) bad.add(i)
  }
  return bad
}

/** 盤面目前的填入是否合法(沒有任何衝突)。 */
export function isValid(grid: Grid): boolean {
  return findConflicts(grid).size === 0
}

// 算某格目前可填哪些數字(候選),回傳 bit mask 與數量。
function candidatesMask(grid: Grid, idx: number): number {
  let used = 0
  const r = rowOf(idx)
  const c = colOf(idx)
  const br = Math.floor(r / 3) * 3
  const bc = Math.floor(c / 3) * 3
  for (let k = 0; k < SIZE; k++) {
    used |= 1 << grid[r * SIZE + k]
    used |= 1 << grid[k * SIZE + c]
  }
  for (let dr = 0; dr < 3; dr++)
    for (let dc = 0; dc < 3; dc++) used |= 1 << grid[(br + dr) * SIZE + (bc + dc)]
  // 取 1–9 中未被使用者
  return ~used & 0b1111111110
}

function popcount(m: number): number {
  let n = 0
  while (m) {
    m &= m - 1
    n++
  }
  return n
}

// 找候選最少(MRV)的空格;回傳索引,-1 代表沒有空格(已完成)。
function pickCell(grid: Grid): { idx: number; mask: number } {
  let best = -1
  let bestCount = 10
  let bestMask = 0
  for (let i = 0; i < CELLS; i++) {
    if (grid[i] !== 0) continue
    const mask = candidatesMask(grid, i)
    const cnt = popcount(mask)
    if (cnt < bestCount) {
      bestCount = cnt
      best = i
      bestMask = mask
      if (cnt <= 1) break // 0(死路)或 1(唯一)已是最佳,提早結束
    }
  }
  return { idx: best, mask: bestMask }
}

// 內部回溯:最多找 limit 個解,shuffle 為候選順序函式(可選,用於隨機產生)。
function backtrack(
  grid: Grid,
  limit: number,
  found: Grid[],
  order?: (vals: number[]) => number[],
): void {
  if (found.length >= limit) return
  const { idx, mask } = pickCell(grid)
  if (idx === -1) {
    found.push(grid.slice())
    return
  }
  if (mask === 0) return // 此空格無候選 → 死路
  let vals: number[] = []
  for (let v = 1; v <= 9; v++) if (mask & (1 << v)) vals.push(v)
  if (order) vals = order(vals)
  for (const v of vals) {
    grid[idx] = v
    backtrack(grid, limit, found, order)
    grid[idx] = 0
    if (found.length >= limit) return
  }
}

/** 解題。回傳唯一解陣列;若盤面本身違規或無解則回傳 null。 */
export function solve(grid: Grid): Grid | null {
  if (!isValid(grid)) return null
  const work = grid.slice()
  const found: Grid[] = []
  backtrack(work, 1, found)
  return found.length ? found[0] : null
}

/** 數解的個數,最多數到 limit(預設 2,用於判斷唯一解)。盤面違規回傳 0。 */
export function countSolutions(grid: Grid, limit = 2): number {
  if (!isValid(grid)) return 0
  const work = grid.slice()
  const found: Grid[] = []
  backtrack(work, limit, found)
  return found.length
}

// 簡單的可注入亂數(Mulberry32),讓產生過程可重現、好測試。
export function makeRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 產生一個隨機合法終盤(81 格全填)。 */
export function generateSolved(rng: () => number = Math.random): Grid {
  const grid: Grid = new Array(CELLS).fill(0)
  const found: Grid[] = []
  backtrack(grid, 1, found, (vals) => shuffle(vals, rng))
  return found[0]
}

export type Difficulty = 'easy' | 'medium' | 'hard'

// 各難度大約保留的提示數(線索越少越難)。
const CLUE_TARGET: Record<Difficulty, number> = { easy: 40, medium: 32, hard: 26 }

export interface Puzzle {
  puzzle: Grid // 含空格的題目
  solution: Grid // 唯一解
  clues: number // 提示數
}

/**
 * 產生一道唯一解的數獨題。先排滿終盤,再以隨機順序挖洞,
 * 每挖一格都用 countSolutions 確認仍為唯一解;挖到目標線索數或無法再挖為止。
 */
export function generate(difficulty: Difficulty = 'medium', rng: () => number = Math.random): Puzzle {
  const solution = generateSolved(rng)
  const puzzle = solution.slice()
  const target = CLUE_TARGET[difficulty]
  const order = shuffle(
    Array.from({ length: CELLS }, (_, i) => i),
    rng,
  )
  let clues = CELLS
  for (const idx of order) {
    if (clues <= target) break
    const backup = puzzle[idx]
    if (backup === 0) continue
    puzzle[idx] = 0
    if (countSolutions(puzzle, 2) !== 1) {
      puzzle[idx] = backup // 挖了會多解 → 還原
    } else {
      clues--
    }
  }
  return { puzzle, solution, clues }
}

/** 盤面轉成 81 字元字串(空格用 dot 表示)。 */
export function gridToString(grid: Grid, dot = '.'): string {
  return grid.map((v) => (v === 0 ? dot : String(v))).join('')
}

/** 盤面轉成 9 行、每行 9 字的可讀文字。 */
export function gridToLines(grid: Grid, dot = '.'): string {
  const lines: string[] = []
  for (let r = 0; r < SIZE; r++) {
    lines.push(
      grid
        .slice(r * SIZE, r * SIZE + SIZE)
        .map((v) => (v === 0 ? dot : String(v)))
        .join(''),
    )
  }
  return lines.join('\n')
}
