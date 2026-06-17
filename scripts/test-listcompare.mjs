/*
  名單比對 / 去重引擎的回歸測試(無需測試框架,node 直接跑)。
  用 esbuild 即時把 TS 轉成 ESM 再 import,斷言去重 / 比對 / 正規化結果。
  執行:node scripts/test-listcompare.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `listcompare-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/listCompare.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { normalizeKey, parseList, dedupe, compare, defaultOptions } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

const opt = (o = {}) => ({ ...defaultOptions, ...o })

// --- parseList:空行與 trim ---
check('空行被略過', parseList('a\n\n  \nb', opt()).length === 2)
check('trim 後保留去空白樣子', parseList('  hi  \n', opt()).join('|') === 'hi')
check('關閉 trim 保留原樣', parseList('  hi  ', opt({ trim: false }))[0] === '  hi  ')

// --- normalizeKey ---
check('ignoreCase 大小寫同鍵', normalizeKey('ABC', opt({ ignoreCase: true })) === 'abc')
check('ignoreWidth 全形轉半形', normalizeKey('ＡＢＣ１２３', opt({ ignoreWidth: true })) === 'ABC123')
check('ignoreWidth 全形空白轉半形', normalizeKey('a　b', opt({ ignoreWidth: true, trim: false })) === 'a b')
check('collapseSpace 縮多空白', normalizeKey('a   b', opt({ collapseSpace: true })) === 'a b')

// --- dedupe ---
const d = dedupe('王小明\n李大華\n王小明\n王小明\n李大華', opt())
check('去重:總筆數 5', d.total === 5)
check('去重:不重複 2 筆', d.uniqueCount === 2)
check('去重:移除 3 筆', d.removed === 3)
check('去重:保留首次順序', d.unique.join('|') === '王小明|李大華')
check('去重:重複群組 2 組', d.duplicateGroups === 2)
check('去重:王小明出現 3 次且排最前', d.duplicates[0].value === '王小明' && d.duplicates[0].count === 3)
check('去重:李大華出現 2 次', d.duplicates[1].count === 2)

const dCase = dedupe('Apple\napple\nAPPLE', opt({ ignoreCase: true }))
check('去重(不分大小寫):視為 1 筆', dCase.uniqueCount === 1)
check('去重(不分大小寫):保留首次樣子 Apple', dCase.unique[0] === 'Apple')

const dNone = dedupe('a\nb\nc', opt())
check('全不重複:duplicates 空', dNone.duplicates.length === 0 && dNone.removed === 0)

// --- compare ---
const c = compare('a\nb\nc\nd', 'c\nd\ne\nf', opt())
check('比對:交集 c,d', c.both.slice().sort().join(',') === 'c,d')
check('比對:只在 A = a,b', c.onlyA.slice().sort().join(',') === 'a,b')
check('比對:只在 B = e,f', c.onlyB.slice().sort().join(',') === 'e,f')
check('比對:聯集 6 筆', c.union.length === 6)
check('比對:A 不重複 4 筆', c.countA === 4)
check('比對:B 不重複 4 筆', c.countB === 4)

// 比對前各自先去重
const c2 = compare('x\nx\ny', 'y\ny\nz', opt())
check('比對:A 內部重複先去掉(countA=2)', c2.countA === 2)
check('比對:交集 y', c2.both.join(',') === 'y')

// 不分大小寫比對 + 顯示用 A 的樣子
const c3 = compare('Tom\nJerry', 'tom\nSpike', opt({ ignoreCase: true }))
check('比對(不分大小寫):交集視 Tom/tom 相同', c3.both.length === 1)
check('比對(不分大小寫):交集顯示 A 的樣子 Tom', c3.both[0] === 'Tom')
check('比對(不分大小寫):只在 B = Spike', c3.onlyB.join(',') === 'Spike')

// 無交集
const c4 = compare('1\n2', '3\n4', opt())
check('無交集:both 空、聯集 4 筆', c4.both.length === 0 && c4.union.length === 4)

if (fail) {
  console.error(`\n${fail} 個測試未通過`)
  process.exit(1)
} else {
  console.log('\n全部通過 ✅')
}
