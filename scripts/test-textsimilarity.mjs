/*
  文字相似度引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-textsimilarity.mjs
  oracle:Levenshtein 距離的經典手算值(kitten→sitting=3 等),以及 Jaccard/Dice 的定義式。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `textsim-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/textSimilarity.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { levenshtein, similarityRatio, tokenize, jaccard, dice, compare } =
  await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else { fail++; console.error(`✗ ${note}`) }
}
const near = (a, b) => Math.abs(a - b) < 1e-9

// --- Levenshtein 經典值 ---
check('kitten→sitting = 3', levenshtein('kitten', 'sitting') === 3)
check('flaw→lawn = 2', levenshtein('flaw', 'lawn') === 2)
check('sunday→saturday = 3', levenshtein('sunday', 'saturday') === 3)
check('相同字串 = 0', levenshtein('abc', 'abc') === 0)
check('空對 abc = 3', levenshtein('', 'abc') === 3)
check('abc 對空 = 3', levenshtein('abc', '') === 3)
check('對稱性', levenshtein('book', 'back') === levenshtein('back', 'book'))
check('純插入', levenshtein('cat', 'cats') === 1)

// --- 相似度比率 ---
check('相同 ratio = 1', similarityRatio('hello', 'hello') === 1)
check('兩空 ratio = 1', similarityRatio('', '') === 1)
check('kitten/sitting ratio = 1-3/7', near(similarityRatio('kitten', 'sitting'), 1 - 3 / 7))
check('完全不同 ratio = 0', similarityRatio('aaaa', 'bbbb') === 0)

// --- tokenize ---
check('英文分詞', JSON.stringify(tokenize('Hello, World!')) === JSON.stringify(['hello', 'world']))
check('標點與多空白', JSON.stringify(tokenize('a   b\t\nc')) === JSON.stringify(['a', 'b', 'c']))
check('空字串回空', tokenize('   ').length === 0)
check('純中文連寫逐字', JSON.stringify(tokenize('台北市')) === JSON.stringify(['台', '北', '市']))

// --- Jaccard / Dice ---
const A = new Set(['a', 'b', 'c'])
const B = new Set(['b', 'c', 'd'])
check('Jaccard {a,b,c}∩{b,c,d} = 2/4', near(jaccard(A, B), 0.5))
check('Dice = 2*2/(3+3)', near(dice(A, B), 2 / 3))
check('Jaccard 相同 = 1', jaccard(A, new Set(['a', 'b', 'c'])) === 1)
check('Jaccard 無交集 = 0', jaccard(new Set(['x']), new Set(['y'])) === 0)
check('Jaccard 兩空 = 1', jaccard(new Set(), new Set()) === 1)
check('Dice 兩空 = 1', dice(new Set(), new Set()) === 1)

// --- compare 綜合 ---
const r = compare('the quick brown fox', 'the quick red fox')
check('compare distance', typeof r.distance === 'number' && r.distance > 0)
check('compare ratio 介於 0~1', r.ratio > 0 && r.ratio < 1)
check('compare 共同詞含 the/quick/fox', ['the', 'quick', 'fox'].every((w) => r.commonWords.includes(w)))
check('compare onlyA = brown', r.onlyA.includes('brown') && !r.onlyA.includes('red'))
check('compare onlyB = red', r.onlyB.includes('red') && !r.onlyB.includes('brown'))
const r2 = compare('一樣的句子', '一樣的句子')
check('compare 相同 ratio = 1', r2.ratio === 1 && r2.jaccardWords === 1)

console.log(fail ? `\n${fail} 項失敗` : '\n全部通過')
process.exit(fail ? 1 : 0)
