/*
  排列組合 / 機率引擎回歸測試(node 直接跑)。
  執行:node scripts/test-combinatorics.mjs
  oracle(已知組合數學值):
   1) 5!=120、0!=1、10!=3628800、20! 精確(BigInt)。
   2) P(5,2)=20、P(n,n)=n!、C(5,2)=10、C(52,5)=2598960、C(49,6)=13983816、對稱 C(n,r)=C(n,n−r)。
   3) 可重複排列 n^r、可重複組合 C(n+r−1,r);樂透機率分母 = C(pool,pick);千分位。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `comb-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/combinatorics.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const {
  factorial,
  permutations,
  combinations,
  permutationsWithRep,
  combinationsWithRep,
  lotteryOdds,
  groupDigits,
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

// 1) 階乘
ok('5! = 120', factorial(5) === 120n)
ok('0! = 1', factorial(0) === 1n)
ok('1! = 1', factorial(1) === 1n)
ok('10! = 3628800', factorial(10) === 3628800n)
ok('20! 精確 BigInt', factorial(20) === 2432902008176640000n)
ok('25! 精確(超過 double 範圍仍正確)', factorial(25) === 15511210043330985984000000n)
ok('負數階乘 null', factorial(-1) === null)
ok('小數階乘 null', factorial(2.5) === null)

// 2) 排列
ok('P(5,2) = 20', permutations(5, 2) === 20n)
ok('P(5,0) = 1', permutations(5, 0) === 1n)
ok('P(5,5) = 120 = 5!', permutations(5, 5) === 120n && permutations(5, 5) === factorial(5))
ok('P(10,3) = 720', permutations(10, 3) === 720n)
ok('P(n,r) r>n null', permutations(3, 5) === null)

// 3) 組合
ok('C(5,2) = 10', combinations(5, 2) === 10n)
ok('C(52,5) = 2598960', combinations(52, 5) === 2598960n)
ok('C(49,6) = 13983816(大樂透)', combinations(49, 6) === 13983816n)
ok('C(n,0) = 1', combinations(7, 0) === 1n)
ok('C(n,n) = 1', combinations(7, 7) === 1n)
ok('對稱 C(10,3)=C(10,7)=120', combinations(10, 3) === 120n && combinations(10, 7) === 120n)
ok('C(100,50) 精確', combinations(100, 50) === 100891344545564193334812497256n)
ok('C r>n null', combinations(3, 5) === null)

// 4) 可重複
ok('n^r:2^10 = 1024', permutationsWithRep(2, 10) === 1024n)
ok('n^r:10^3 = 1000', permutationsWithRep(10, 3) === 1000n)
ok('可重複組合 C(n+r-1,r):甜甜圈 4 種選 3 = C(6,3)=20', combinationsWithRep(4, 3) === 20n)
ok('可重複組合 n=0,r=0 = 1', combinationsWithRep(0, 0) === 1n)
ok('可重複組合 n=0,r>0 = 0', combinationsWithRep(0, 3) === 0n)

// 5) 樂透機率
const big = lotteryOdds(49, 6)
ok('大樂透 C(49,6)=13983816', big.total === 13983816n)
ok('大樂透 oddsText 含千分位', big.oddsText === '1 / 13,983,816')
ok('大樂透 機率 ≈ 1/13983816', Math.abs(big.probability - 1 / 13983816) < 1e-18)
ok('威力彩第一區 C(38,6)=2760681', lotteryOdds(38, 6).total === 2760681n)
ok('lotteryOdds pick>pool null', lotteryOdds(6, 49) === null)

// groupDigits
ok('groupDigits 1234567', groupDigits(1234567n) === '1,234,567')
ok('groupDigits 100', groupDigits(100n) === '100')
ok('groupDigits 1000', groupDigits(1000n) === '1,000')

console.log(`\n排列組合:${pass} 通過,${fail} 失敗`)
if (fail) process.exit(1)
