/*
  數獨引擎回歸測試(node 直接跑)。
  執行:node scripts/test-sudoku.mjs
  oracle:
   1) 一道已知的經典題與其唯一解(逐格比對)。
   2) 求解結果必滿足數獨規則(每列/行/宮 1–9 各一次),且解是題目的超集。
   3) countSolutions:已知唯一解題 = 1;移走一格使其多解 ≥ 2;違規盤面 = 0。
   4) generate:產生的題目唯一解、解正確、提示數隨難度遞減,且題目是解的子集。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `sudoku-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/sudoku.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const {
  parseGrid,
  solve,
  countSolutions,
  isValid,
  findConflicts,
  generate,
  generateSolved,
  makeRng,
  gridToString,
} = await import('file://' + out)

let pass = 0
let fail = 0
function ok(name, cond) {
  if (cond) pass++
  else {
    fail++
    console.error('✗', name)
  }
}

// 經典題與唯一解(出自常見公開範例)。
const PUZZLE =
  '53..7....' +
  '6..195...' +
  '.98....6.' +
  '8...6...3' +
  '4..8.3..1' +
  '7...2...6' +
  '.6....28.' +
  '...419..5' +
  '....8..79'
const SOLUTION =
  '534678912' +
  '672195348' +
  '198342567' +
  '859761423' +
  '426853791' +
  '713924856' +
  '961537284' +
  '287419635' +
  '345286179'

// 1) 解析
const p = parseGrid(PUZZLE)
ok('parse: 無錯誤', p.error === null)
ok('parse: 81 格', p.grid && p.grid.length === 81)
ok('parse: 提示數 30', p.filled === 30)
ok('parse: 字數不足會報錯', parseGrid('12345').error !== null)
ok('parse: 空白報錯', parseGrid('   \n  ').error !== null)
ok('parse: 接受 . 0 _ 為空格', (() => {
  const g = parseGrid('5'.padEnd(81, '0')).grid
  return g && g[0] === 5 && g[1] === 0
})())

// 2) 求解
const sol = solve(p.grid)
ok('solve: 有解', sol !== null)
ok('solve: 等於已知唯一解', sol && gridToString(sol) === SOLUTION)
// 解需為題目的超集(題目已填處不變)
ok(
  'solve: 保留題目已填格',
  sol && p.grid.every((v, i) => v === 0 || v === sol[i]),
)

// 解的合法性:每列、每行、每宮都是 1–9 各一次
function lineComplete(vals) {
  if (vals.length !== 9) return false
  const set = new Set(vals)
  return set.size === 9 && [...set].every((v) => v >= 1 && v <= 9)
}
function fullyValid(g) {
  for (let r = 0; r < 9; r++) {
    const row = g.slice(r * 9, r * 9 + 9)
    const col = Array.from({ length: 9 }, (_, k) => g[k * 9 + r])
    if (!lineComplete(row) || !lineComplete(col)) return false
  }
  for (let br = 0; br < 3; br++)
    for (let bc = 0; bc < 3; bc++) {
      const box = []
      for (let dr = 0; dr < 3; dr++)
        for (let dc = 0; dc < 3; dc++) box.push(g[(br * 3 + dr) * 9 + bc * 3 + dc])
      if (!lineComplete(box)) return false
    }
  return true
}
ok('solve: 解滿足數獨規則', sol && fullyValid(sol))

// 3) 解的個數
ok('count: 經典題唯一解', countSolutions(p.grid, 2) === 1)
// 把題目第一個提示拿掉 → 仍唯一?不一定;改用空盤面驗證「多解」
ok('count: 空盤面多解(>=2)', countSolutions(new Array(81).fill(0), 2) >= 2)
ok('count: 完整解唯一', countSolutions(parseGrid(SOLUTION).grid, 2) === 1)

// 違規盤面:同列兩個 5
const bad = p.grid.slice()
bad[1] = 5 // (0,0)=5,(0,1)=5 衝突
ok('isValid: 偵測同列重複為違規', isValid(bad) === false)
ok('findConflicts: 標出衝突格', findConflicts(bad).has(0) && findConflicts(bad).has(1))
ok('count: 違規盤面 0 解', countSolutions(bad, 2) === 0)
ok('solve: 違規盤面回 null', solve(bad) === null)
ok('isValid: 經典題本身合法', isValid(p.grid) === true)

// 4) 產生器(用固定種子,可重現)
const rng = makeRng(12345)
const full = generateSolved(rng)
ok('generateSolved: 終盤合法完整', fullyValid(full))

for (const diff of ['easy', 'medium', 'hard']) {
  const r = makeRng(diff.length * 999 + 7)
  const { puzzle, solution: s, clues } = generate(diff, r)
  ok(`generate(${diff}): 唯一解`, countSolutions(puzzle, 2) === 1)
  ok(`generate(${diff}): 解正確`, gridToString(solve(puzzle)) === gridToString(s))
  ok(`generate(${diff}): 解合法完整`, fullyValid(s))
  ok(
    `generate(${diff}): 題目是解的子集`,
    puzzle.every((v, i) => v === 0 || v === s[i]),
  )
  const actualClues = puzzle.filter((v) => v !== 0).length
  ok(`generate(${diff}): clues 數一致`, actualClues === clues)
}

// 難度:easy 提示數應 >= hard 提示數
const e = generate('easy', makeRng(1)).clues
const h = generate('hard', makeRng(1)).clues
ok('generate: easy 提示數 >= hard 提示數', e >= h)

console.log(`\n數獨:${pass} 通過,${fail} 失敗`)
if (fail) process.exit(1)
