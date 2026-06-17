/*
  公平抽籤 / 洗牌 / 分組引擎的回歸測試(無需測試框架,node 直接跑)。
  注入確定性亂數來驗證輸出,並以大量取樣驗證 cryptoRandInt 的範圍與無偏差。
  執行:node scripts/test-randomdraw.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `randomdraw-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/randomDraw.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const {
  cryptoRandInt,
  shuffle,
  drawWinners,
  makeGroupsByCount,
  makeGroupsBySize,
  parseNames,
} = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

const sorted = (a) => a.slice().sort()
const sameMultiset = (a, b) => a.length === b.length && sorted(a).join('|') === sorted(b).join('|')

// 確定性亂數:rand(n) 一律回傳 0(每次都交換到最前/發到第 0 組)
const zero = () => 0
// 確定性亂數:rand(n) 一律回傳 n-1(等同不交換,維持原序)
const last = (n) => n - 1

// --- parseNames ---
check('parseNames 去空白略過空行', parseNames(' a \n\n b \n').join('|') === 'a|b')

// --- shuffle:permutation 不變多重集合、不改原陣列 ---
const orig = ['a', 'b', 'c', 'd', 'e']
const sh = shuffle(orig, cryptoRandInt)
check('shuffle 是排列(多重集合不變)', sameMultiset(sh, orig))
check('shuffle 不改動原陣列', orig.join('') === 'abcde')
check('shuffle rand=last 維持原序', shuffle(orig, last).join('') === 'abcde')

// --- drawWinners ---
const w = drawWinners(['1', '2', '3', '4', '5'], 2, last)
check('drawWinners 抽出指定數量', w.length === 2)
check('drawWinners 結果為原名單子集', w.every((x) => ['1', '2', '3', '4', '5'].includes(x)))
check('drawWinners 不重複', new Set(w).size === w.length)
check('drawWinners 超量時回傳全部', drawWinners(['a', 'b'], 9, last).length === 2)
check('drawWinners 抽 0 位回傳空', drawWinners(['a', 'b'], 0, last).length === 0)

// --- makeGroupsByCount:覆蓋全員、組數正確、人數最多差 1 ---
const g = makeGroupsByCount(['a', 'b', 'c', 'd', 'e'], 2, last) // last→維持原序
check('byCount 組數正確', g.length === 2)
check('byCount 全員都分到(不漏不重)', sameMultiset(g.flat(), ['a', 'b', 'c', 'd', 'e']))
const sizes = g.map((x) => x.length).sort()
check('byCount 各組人數最多差 1', sizes[sizes.length - 1] - sizes[0] <= 1)
check('byCount round-robin(原序 a,c,e | b,d)', g[0].join('') === 'ace' && g[1].join('') === 'bd')
check('byCount 人少於組數時有空組', makeGroupsByCount(['x'], 3, last).filter((x) => x.length === 0).length === 2)

// --- makeGroupsBySize ---
const gs = makeGroupsBySize(['a', 'b', 'c', 'd', 'e'], 2, last)
check('bySize 切塊數正確', gs.length === 3)
check('bySize 前面組滿 size', gs[0].length === 2 && gs[1].length === 2)
check('bySize 最後一組可不足', gs[2].length === 1)
check('bySize 全員都分到', sameMultiset(gs.flat(), ['a', 'b', 'c', 'd', 'e']))

// --- cryptoRandInt:範圍 + 無偏差(統計) ---
check('cryptoRandInt(1) 恆為 0', cryptoRandInt(1) === 0)
let inRange = true
const counts = new Array(6).fill(0)
const N = 60000
for (let i = 0; i < N; i++) {
  const r = cryptoRandInt(6)
  if (r < 0 || r >= 6) inRange = false
  counts[r]++
}
check('cryptoRandInt 結果恆在 [0,n)', inRange)
// 期望各約 10000,容許 ±8%
const expect = N / 6
const uniform = counts.every((c) => Math.abs(c - expect) < expect * 0.08)
check('cryptoRandInt 分佈接近均勻(±8%)', uniform)

if (fail) {
  console.error(`\n${fail} 個測試未通過`)
  process.exit(1)
} else {
  console.log('\n全部通過 ✅')
}
