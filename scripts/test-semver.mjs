/*
  語意化版本引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-semver.mjs
  oracle 向量取自 semver.org 規範與 node-semver 的經典測試案例。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `semver-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/semver.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const {
  parseSemver,
  compareVersions,
  sortVersions,
  diffLevel,
  expandComparatorSet,
  satisfies,
} = await import('file://' + out)

let fail = 0
function eq(note, got, want) {
  const g = JSON.stringify(got)
  const w = JSON.stringify(want)
  if (g === w) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}\n   got : ${g}\n   want: ${w}`)
  }
}

// ── 解析 ──
eq('parse 基本', parseSemver('1.2.3')?.version, '1.2.3')
eq('parse v 前綴', parseSemver('v2.0.0')?.major, 2)
eq('parse prerelease', parseSemver('1.0.0-alpha.1')?.prerelease, ['alpha', 1])
eq('parse build 不入 version', parseSemver('1.0.0+build.5')?.version, '1.0.0')
eq('parse prerelease+build', parseSemver('1.0.0-rc.1+x')?.version, '1.0.0-rc.1')
eq('parse 數字識別碼', parseSemver('1.0.0-0')?.prerelease, [0])
eq('parse 無效缺段', parseSemver('1.2'), null)
eq('parse 無效文字', parseSemver('abc'), null)
eq('parse 空白容忍', parseSemver('  1.2.3  ')?.version, '1.2.3')

// ── 比較(semver.org §11 經典遞增序)──
const order = [
  '1.0.0-alpha',
  '1.0.0-alpha.1',
  '1.0.0-alpha.beta',
  '1.0.0-beta',
  '1.0.0-beta.2',
  '1.0.0-beta.11',
  '1.0.0-rc.1',
  '1.0.0',
]
for (let i = 0; i < order.length - 1; i++) {
  eq(`order ${order[i]} < ${order[i + 1]}`, compareVersions(order[i], order[i + 1]), -1)
}
eq('numeric < alpha 識別碼', compareVersions('1.0.0-1', '1.0.0-alpha'), -1)
eq('相同相等', compareVersions('1.2.3', '1.2.3'), 0)
eq('build 不影響比較', compareVersions('1.0.0+a', '1.0.0+b'), 0)
eq('major 主導', compareVersions('2.0.0', '1.9.9'), 1)
eq('prerelease 較短先', compareVersions('1.0.0-alpha', '1.0.0-alpha.1'), -1)
eq('無效回 null', compareVersions('1.2.3', 'x'), null)

eq('sortVersions', sortVersions(['1.2.0', '1.0.0', '1.0.0-rc.1', '2.0.0']), [
  '1.0.0-rc.1',
  '1.0.0',
  '1.2.0',
  '2.0.0',
])

eq('diff major', diffLevel('1.0.0', '2.0.0'), 'major')
eq('diff minor', diffLevel('1.1.0', '1.2.0'), 'minor')
eq('diff patch', diffLevel('1.2.3', '1.2.4'), 'patch')
eq('diff prerelease', diffLevel('1.0.0-a', '1.0.0-b'), 'prerelease')
eq('diff 相同', diffLevel('1.2.3', '1.2.3'), null)

// ── 範圍展開(對照 node-semver 文件)──
eq('caret 1.2.3', expandComparatorSet('^1.2.3'), ['>=1.2.3', '<2.0.0'])
eq('caret 0.2.3', expandComparatorSet('^0.2.3'), ['>=0.2.3', '<0.3.0'])
eq('caret 0.0.3', expandComparatorSet('^0.0.3'), ['>=0.0.3', '<0.0.4'])
eq('caret 1.2.x', expandComparatorSet('^1.2.x'), ['>=1.2.0', '<2.0.0'])
eq('caret 0.0.x', expandComparatorSet('^0.0.x'), ['>=0.0.0', '<0.1.0'])
eq('caret 0.x', expandComparatorSet('^0.x'), ['>=0.0.0', '<1.0.0'])
eq('caret 1.2.3-beta.2', expandComparatorSet('^1.2.3-beta.2'), ['>=1.2.3-beta.2', '<2.0.0'])
eq('tilde 1.2.3', expandComparatorSet('~1.2.3'), ['>=1.2.3', '<1.3.0'])
eq('tilde 1.2', expandComparatorSet('~1.2'), ['>=1.2.0', '<1.3.0'])
eq('tilde 1', expandComparatorSet('~1'), ['>=1.0.0', '<2.0.0'])
eq('tilde 0.2.3', expandComparatorSet('~0.2.3'), ['>=0.2.3', '<0.3.0'])
eq('xrange 1.2.x', expandComparatorSet('1.2.x'), ['>=1.2.0', '<1.3.0'])
eq('xrange 1.x', expandComparatorSet('1.x'), ['>=1.0.0', '<2.0.0'])
eq('xrange *', expandComparatorSet('*'), ['>=0.0.0'])
eq('xrange 1', expandComparatorSet('1'), ['>=1.0.0', '<2.0.0'])
eq('exact 1.2.3', expandComparatorSet('1.2.3'), ['=1.2.3'])
eq('>=1.2', expandComparatorSet('>=1.2'), ['>=1.2.0'])
eq('>1', expandComparatorSet('>1'), ['>=2.0.0'])
eq('<=1.2', expandComparatorSet('<=1.2'), ['<1.3.0'])
eq('<1', expandComparatorSet('<1'), ['<1.0.0'])
eq('>1.2', expandComparatorSet('>1.2'), ['>=1.3.0'])
eq('運算子後空白', expandComparatorSet('>= 1.2.3'), ['>=1.2.3'])
eq('hyphen 完整', expandComparatorSet('1.2.3 - 2.3.4'), ['>=1.2.3', '<=2.3.4'])
eq('hyphen 下界部分', expandComparatorSet('1.2 - 2.3.4'), ['>=1.2.0', '<=2.3.4'])
eq('hyphen 上界部分', expandComparatorSet('1.2.3 - 2.3'), ['>=1.2.3', '<2.4.0'])
eq('hyphen 上界 major', expandComparatorSet('1.2.3 - 2'), ['>=1.2.3', '<3.0.0'])
eq('AND 兩段', expandComparatorSet('>=1.2.3 <1.5.0'), ['>=1.2.3', '<1.5.0'])

// ── satisfies(對照 node-semver 行為)──
const sat = (v, r) => satisfies(v, r).satisfies
eq('1.2.5 ^1.2.3', sat('1.2.5', '^1.2.3'), true)
eq('2.0.0 ^1.2.3 否', sat('2.0.0', '^1.2.3'), false)
eq('1.2.3 ^1.2.3', sat('1.2.3', '^1.2.3'), true)
eq('0.2.9 ^0.2.3', sat('0.2.9', '^0.2.3'), true)
eq('0.3.0 ^0.2.3 否', sat('0.3.0', '^0.2.3'), false)
eq('1.2.9 ~1.2.3', sat('1.2.9', '~1.2.3'), true)
eq('1.3.0 ~1.2.3 否', sat('1.3.0', '~1.2.3'), false)
eq('1.2.7 1.2.x', sat('1.2.7', '1.2.x'), true)
eq('1.3.0 1.2.x 否', sat('1.3.0', '1.2.x'), false)
eq('任意 *', sat('99.99.99', '*'), true)
eq('OR 命中第二段', sat('2.5.0', '^1.0.0 || ^2.0.0'), true)
eq('OR 都不中', sat('3.0.0', '^1.0.0 || ^2.0.0'), false)
eq('AND 範圍內', sat('1.4.0', '>=1.2.3 <1.5.0'), true)
eq('AND 範圍外', sat('1.5.0', '>=1.2.3 <1.5.0'), false)
eq('hyphen 內', sat('2.0.0', '1.2.3 - 2.3.4'), true)
eq('hyphen 邊界含', sat('2.3.4', '1.2.3 - 2.3.4'), true)
eq('hyphen 外', sat('2.3.5', '1.2.3 - 2.3.4'), false)
eq('exact 命中', sat('1.2.3', '1.2.3'), true)
eq('exact 不中', sat('1.2.4', '1.2.3'), false)
eq('>=', sat('1.0.0', '>=1.0.0'), true)
eq('< 邊界', sat('2.0.0', '<2.0.0'), false)

// prerelease 過濾規則(node-semver includePrerelease=false)
eq('prerelease 不漏入 caret', sat('1.2.4-beta.1', '^1.2.3'), false)
eq('prerelease 同 patch 帶 pre 才可', sat('1.2.3-beta.2', '>=1.2.3-beta.1 <1.3.0'), true)
eq('prerelease 不同 patch 比較子無 pre', sat('1.2.4-alpha', '>=1.2.3-beta.1 <1.3.0'), false)
eq('正式版照常符合帶 pre 範圍', sat('1.2.5', '>=1.2.3-beta.1 <1.3.0'), true)
eq('prerelease 未授權不符無 pre 比較子', sat('3.4.5-pre.1', '<=3.4.5'), false)

// 無效輸入
eq('無效版本', satisfies('abc', '^1.0.0').valid, false)
eq('無效範圍', satisfies('1.0.0', '>=>').valid, false)

if (fail) {
  console.error(`\n${fail} 個測試失敗`)
  process.exit(1)
}
console.log('\n全部 semver 測試通過')
