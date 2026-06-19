/*
  Glob 比對引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-globmatch.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `globmatch-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/globMatch.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { matchGlob, globToRegExp, cleanPatterns, testPaths } = await import('file://' + out)

let fail = 0
function m(glob, path, want) {
  const got = matchGlob(glob, path)
  const note = `${glob}  vs  ${path}`
  if (got === want) console.log(`✓ ${note} → ${got}`)
  else {
    fail++
    console.error(`✗ ${note}\n   got : ${got}\n   want: ${want}`)
  }
}
function eq(note, got, want) {
  if (got === want) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}\n   got : ${JSON.stringify(got)}\n   want: ${JSON.stringify(want)}`)
  }
}

// --- * 不跨 / ---
m('*.js', 'a.js', true)
m('*.js', 'foo.js', true)
m('*.js', 'a.ts', false)
m('*.js', 'dir/a.js', false)
m('*', 'abc', true)
m('*', 'a/b', false)
m('src/*.js', 'src/a.js', true)
m('src/*.js', 'src/sub/a.js', false)

// --- ? 單一字元 ---
m('?.js', 'a.js', true)
m('?.js', 'ab.js', false)
m('a?c', 'abc', true)
m('a?c', 'a/c', false)

// --- ** globstar ---
m('**/*.js', 'a.js', true)
m('**/*.js', 'src/a.js', true)
m('**/*.js', 'src/x/y/a.js', true)
m('**/*.js', 'a.ts', false)
m('src/**', 'src/a', true)
m('src/**', 'src/a/b/c', true)
m('src/**', 'src/', true)
m('src/**', 'other/a', false)
m('a/**/b', 'a/b', true)
m('a/**/b', 'a/x/b', true)
m('a/**/b', 'a/x/y/b', true)
m('a/**/b', 'a/b/c', false)
m('**', 'anything/at/all', true)
m('**', 'single', true)

// --- 非段邊界的 ** 退化成 * ---
m('a**b', 'axxb', true)
m('a**b', 'ax/xb', false)

// --- [字元集] ---
m('[abc].txt', 'a.txt', true)
m('[abc].txt', 'd.txt', false)
m('[a-z].txt', 'm.txt', true)
m('[a-z].txt', 'M.txt', false)
m('[!abc].txt', 'd.txt', true)
m('[!abc].txt', 'a.txt', false)
m('file[0-9].log', 'file7.log', true)
m('file[0-9].log', 'fileX.log', false)

// --- {擇一} ---
m('*.{js,ts}', 'a.js', true)
m('*.{js,ts}', 'a.ts', true)
m('*.{js,ts}', 'a.css', false)
m('{src,test}/**', 'test/a/b', true)
m('{src,test}/**', 'lib/a', false)
m('file.{c,cpp,h}', 'file.cpp', true)
// 巢狀大括號
m('{a,{b,c}}.txt', 'c.txt', true)
m('{a,{b,c}}.txt', 'd.txt', false)

// --- 點與特殊字元為字面 ---
m('a.b.c', 'a.b.c', true)
m('a.b.c', 'aXbXc', false)
m('foo+bar', 'foo+bar', true)
m('(x)', '(x)', true)

// --- 跳脫 ---
m('a\\*b', 'a*b', true)
m('a\\*b', 'axxb', false)

// --- 不分大小寫選項 ---
eq('nocase 比對', globToRegExp('*.JS', { nocase: true }).test('a.js'), true)
eq('預設分大小寫', globToRegExp('*.JS').test('a.js'), false)

// --- cleanPatterns ---
eq('去空行與註解', JSON.stringify(cleanPatterns('*.js\n\n# comment\n  src/**  \n')), JSON.stringify(['*.js', 'src/**']))

// --- testPaths ---
const res = testPaths('*.js\nsrc/**', 'a.js\nsrc/x/y.ts\nREADME.md')
eq('a.js 符合', res[0].matched, true)
eq('a.js 由 *.js 命中', JSON.stringify(res[0].matchedBy), JSON.stringify(['*.js']))
eq('src/x/y.ts 由 src/** 命中', JSON.stringify(res[1].matchedBy), JSON.stringify(['src/**']))
eq('README.md 不符合', res[2].matched, false)

// 多樣式同時命中
const res2 = testPaths('**/*.js\nsrc/**', 'src/a.js')
eq('src/a.js 兩樣式皆命中', res2[0].matchedBy.length, 2)

if (fail) {
  console.error(`\n${fail} 個測試未通過`)
  process.exit(1)
} else {
  console.log('\n全部 globMatch 測試通過')
}
