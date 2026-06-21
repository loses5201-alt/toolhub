/*
  數論工具箱引擎回歸測試(node 直接跑)。
  執行:node scripts/test-numbertheory.mjs
  oracle(初等數論已知結果與手算):
   1) gcd/lcm:gcd(12,18)=6、lcm(4,6)=12、互質=1、與 0 的邊界。
   2) isPrime:小質數/合數、Carmichael 數 561/1105 非質數、Mersenne 2^31−1 與 2^61−1 為質數、
      已知大合數可被分解。
   3) factorize:12=2²·3、360=2³·3²·5、97 為質數、1 與 0 回空、大半質數 p·q。
   4) τ(因數個數)、σ(因數和)、φ(歐拉函數):τ(12)=6、σ(28)=56、φ(12)=4、φ(p)=p−1。
   5) divisors:28→[1,2,4,7,14,28];nextPrime/prevPrime;完美數 6/28、虧數 8、盈數 12。
   6) formatFactorization 上標格式。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `numbertheory-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/numberTheory.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const {
  parseBigInt,
  gcd,
  lcm,
  gcdMany,
  lcmMany,
  isPrime,
  factorize,
  tau,
  sigma,
  eulerTotient,
  divisors,
  nextPrime,
  prevPrime,
  classifyNumber,
  formatFactorization,
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
const eqArr = (a, b) => a.length === b.length && a.every((v, i) => v === b[i])
const factStr = (n) =>
  factorize(BigInt(n))
    .map((f) => `${f.prime}^${f.exp}`)
    .join('*')

// 1) parse
ok('parseBigInt "1,234" = 1234', parseBigInt('1,234') === 1234n)
ok('parseBigInt "  42 " = 42', parseBigInt('  42 ') === 42n)
ok('parseBigInt "-5" → null', parseBigInt('-5') === null)
ok('parseBigInt "abc" → null', parseBigInt('abc') === null)
ok('parseBigInt "" → null', parseBigInt('') === null)

// 1b) gcd/lcm
ok('gcd(12,18)=6', gcd(12n, 18n) === 6n)
ok('gcd(17,13)=1', gcd(17n, 13n) === 1n)
ok('gcd(0,5)=5', gcd(0n, 5n) === 5n)
ok('lcm(4,6)=12', lcm(4n, 6n) === 12n)
ok('lcm(21,6)=42', lcm(21n, 6n) === 42n)
ok('lcm(0,5)=0', lcm(0n, 5n) === 0n)
ok('gcdMany([24,36,60])=12', gcdMany([24n, 36n, 60n]) === 12n)
ok('lcmMany([2,3,4])=12', lcmMany([2n, 3n, 4n]) === 12n)

// 2) isPrime
ok('isPrime(2) true', isPrime(2n) === true)
ok('isPrime(1) false', isPrime(1n) === false)
ok('isPrime(0) false', isPrime(0n) === false)
ok('isPrime(97) true', isPrime(97n) === true)
ok('isPrime(91=7*13) false', isPrime(91n) === false)
ok('isPrime(561 Carmichael) false', isPrime(561n) === false)
ok('isPrime(1105 Carmichael) false', isPrime(1105n) === false)
ok('isPrime(7919) true', isPrime(7919n) === true)
ok('isPrime(2^31-1 Mersenne) true', isPrime(2147483647n) === true)
ok('isPrime(2^61-1 Mersenne) true', isPrime(2305843009213693951n) === true)
ok('isPrime(2^31-1+0=...648 even) false', isPrime(2147483648n) === false)
ok('isPrime(big composite) false', isPrime(1000000007n * 1000000009n) === false)
ok('isPrime(1000000007) true', isPrime(1000000007n) === true)

// 3) factorize
ok('factorize(12)=2^2*3', factStr(12) === '2^2*3^1')
ok('factorize(360)=2^3*3^2*5', factStr(360) === '2^3*3^2*5^1')
ok('factorize(97)=97^1', factStr(97) === '97^1')
ok('factorize(1)=[]', factorize(1n).length === 0)
ok('factorize(0)=[]', factorize(0n).length === 0)
ok('factorize(1024)=2^10', factStr(1024) === '2^10')
ok(
  'factorize big semiprime p*q',
  (() => {
    const p = 1000000007n
    const q = 1000000009n
    const f = factorize(p * q)
    return f.length === 2 && f[0].prime === p && f[0].exp === 1 && f[1].prime === q && f[1].exp === 1
  })(),
)
ok(
  'factorize 取回原數 (重組)',
  (() => {
    const n = 8675309n * 2n * 2n * 3n
    const prod = factorize(n).reduce((acc, f) => acc * f.prime ** BigInt(f.exp), 1n)
    return prod === n
  })(),
)

// 4) tau / sigma / phi
ok('tau(12)=6', tau(factorize(12n)) === 6n)
ok('tau(prime)=2', tau(factorize(13n)) === 2n)
ok('sigma(28)=56 (perfect)', sigma(factorize(28n)) === 56n)
ok('sigma(6)=12', sigma(factorize(6n)) === 12n)
ok('sigma(12)=28', sigma(factorize(12n)) === 28n)
ok('phi(12)=4', eulerTotient(12n) === 4n)
ok('phi(1)=1', eulerTotient(1n) === 1n)
ok('phi(prime 17)=16', eulerTotient(17n) === 16n)
ok('phi(10)=4', eulerTotient(10n) === 4n)
ok('phi(36)=12', eulerTotient(36n) === 12n)

// 5) divisors / nextPrime / prevPrime / classify
ok('divisors(28)=[1,2,4,7,14,28]', eqArr(divisors(factorize(28n)).divisors, [1n, 2n, 4n, 7n, 14n, 28n]))
ok('divisors(1)=[1]', eqArr(divisors(factorize(1n)).divisors, [1n]))
ok('divisors total = tau', divisors(factorize(360n)).total === tau(factorize(360n)))
ok('nextPrime(13)=17', nextPrime(13n) === 17n)
ok('nextPrime(14)=17', nextPrime(14n) === 17n)
ok('nextPrime(1)=2', nextPrime(1n) === 2n)
ok('nextPrime(2)=3', nextPrime(2n) === 3n)
ok('prevPrime(17)=13', prevPrime(17n) === 13n)
ok('prevPrime(2)=null', prevPrime(2n) === null)
ok('prevPrime(3)=2', prevPrime(3n) === 2n)
ok('classify(6)=perfect', classifyNumber(6n) === 'perfect')
ok('classify(28)=perfect', classifyNumber(28n) === 'perfect')
ok('classify(8)=deficient', classifyNumber(8n) === 'deficient')
ok('classify(12)=abundant', classifyNumber(12n) === 'abundant')
ok('classify(1)=deficient', classifyNumber(1n) === 'deficient')

// 6) format
ok('format 360 = 2³ × 3² × 5', formatFactorization(factorize(360n)) === '2³ × 3² × 5')
ok('format 97 = 97', formatFactorization(factorize(97n)) === '97')
ok('format 1 = ""', formatFactorization(factorize(1n)) === '')

console.log(`\n數論工具箱:${pass} 通過,${fail} 失敗`)
if (fail) process.exit(1)
