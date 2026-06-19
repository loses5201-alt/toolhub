/*
  CSS 選擇器優先級引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-specificity.mjs
  測試向量多取自 W3C Selectors / MDN specificity 範例。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `specificity-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/specificity.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { specificityOne, specLabel, compareSpec, splitTop, rankSelectors } = await import(
  'file://' + out
)

let fail = 0
function spec(note, selector, want) {
  const got = specLabel(specificityOne(selector))
  if (got === want) console.log(`✓ ${note}  「${selector}」= ${got}`)
  else {
    fail++
    console.error(`✗ ${note}  「${selector}」\n   got : ${got}\n   want: ${want}`)
  }
}
function eq(note, got, want) {
  if (got === want) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}\n   got : ${JSON.stringify(got)}\n   want: ${JSON.stringify(want)}`)
  }
}

// --- W3C / MDN 經典範例 ---
spec('通用', '*', '0,0,0')
spec('型別', 'li', '0,0,1')
spec('後代兩型別', 'ul li', '0,0,2')
spec('組合子不計分', 'ul ol+li', '0,0,3')
spec('屬性 + 通用', 'h1 + *[rel=up]', '0,1,1')
spec('型別 + class', 'ul ol li.red', '0,1,3')
spec('兩 class + 型別', 'li.red.level', '0,2,1')
spec('ID', '#x34y', '1,0,0')
spec('ID + :not(型別)', '#s12:not(FOO)', '1,0,1')
spec(':is 取最高引數', '.foo :is(.bar, #baz)', '1,1,0')
spec(':where 永遠 0', 'a:where(#id.cls)', '0,0,1')

// --- 虛擬元素 vs 虛擬類別 ---
spec('虛擬元素 ::before', 'div::before', '0,0,2')
spec('舊式單冒號虛擬元素', 'p:first-line', '0,0,2')
spec('虛擬類別 :hover', 'a:hover', '0,1,1')
spec(':nth-child 算虛擬類別', 'li:nth-child(2n+1)', '0,1,1')

// --- :not 與 :has 巢狀 ---
spec(':not 含 ID', 'div:not(#main)', '1,0,1')
spec(':has 取最高', 'section:has(h1, #x)', '1,0,1')
spec(':is 多層巢狀', ':is(:is(#a), .b)', '1,0,0')

// --- ID/class/型別混合 ---
spec('複雜混合', '#nav ul.menu > li.item a:hover', '1,3,3')
spec('多屬性', 'input[type="text"][required]', '0,2,1')
spec('連續 class', '.a.b.c.d', '0,4,0')
spec('連續 ID', '#a#b', '2,0,0')

// --- compareSpec ---
eq('a 大於 b 多', compareSpec({ a: 1, b: 0, c: 0 }, { a: 0, b: 9, c: 9 }) > 0, true)
eq('同 a 比 b', compareSpec({ a: 1, b: 2, c: 0 }, { a: 1, b: 1, c: 9 }) > 0, true)
eq('完全相同為 0', compareSpec({ a: 1, b: 1, c: 1 }, { a: 1, b: 1, c: 1 }), 0)

// --- splitTop ---
eq('頂層逗號切分', JSON.stringify(splitTop('.a, .b, .c')), JSON.stringify(['.a', '.b', '.c']))
eq('括號內逗號不切', JSON.stringify(splitTop(':is(.a, .b), .c')), JSON.stringify([':is(.a, .b)', '.c']))
eq('中括號內逗號不切', JSON.stringify(splitTop('[a="x,y"], .c')), JSON.stringify(['[a="x,y"]', '.c']))

// --- rankSelectors ---
const ranked = rankSelectors('#id\n.cls\ndiv\n.a.b')
eq('排名第一是 #id', ranked[0].selector, '#id')
eq('#id 名次 1', ranked[0].rank, 1)
eq('.a.b 高於 .cls', specLabel(specificityOne('.a.b')), '0,2,0')
// .a.b (0,2,0) > .cls (0,1,0) > div (0,0,1)
eq('排名順序', ranked.map((r) => r.selector).join('>'), '#id>.a.b>.cls>div')

// 同分同名次
const tied = rankSelectors('.a\n.b\n#x')
eq('#x 名次 1', tied[0].rank, 1)
eq('.a 名次 2', tied[1].rank, 2)
eq('.b 同名次 2', tied[2].rank, 2)

// 多選擇器一行(逗號)展開
const multi = rankSelectors('.a, #b, div')
eq('一行逗號展開為 3 筆', multi.length, 3)

if (fail) {
  console.error(`\n${fail} 個測試未通過`)
  process.exit(1)
} else {
  console.log('\n全部 specificity 測試通過')
}
