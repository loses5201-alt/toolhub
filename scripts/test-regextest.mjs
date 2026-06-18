/*
  正規表達式測試引擎回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-regextest.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `regextest-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/regexTest.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { runRegex, explainPattern, applyReplace, normalizeFlags, LIBRARY } = await import(
  'file://' + out
)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// --- normalizeFlags ---
check('normalizeFlags 補上 g', normalizeFlags('') === 'g')
check('normalizeFlags 去重保序', normalizeFlags('iig') === 'gi')
check('normalizeFlags 過濾非法字元', normalizeFlags('iz!') === 'gi')

// --- runRegex 基本 ---
const r1 = runRegex('\\d+', '', 'a12b345')
check('runRegex 命中數', r1.ok && r1.matches.length === 2)
check('runRegex 第一處內容', r1.matches[0].match === '12')
check('runRegex 第一處位置', r1.matches[0].index === 1)
check('runRegex 第二處內容', r1.matches[1].match === '345')

// 捕獲群組(編號)
const r2 = runRegex('(\\d{4})-(\\d{2})', '', '2026-06 與 2030-12')
check('runRegex 兩處', r2.matches.length === 2)
check('runRegex 群組1', r2.matches[0].groups[0].value === '2026')
check('runRegex 群組2', r2.matches[0].groups[1].value === '06')
check('runRegex 群組名稱為數字字串', r2.matches[0].groups[0].name === '1')

// 具名群組
const r3 = runRegex('(?<year>\\d{4})', '', '2026')
check('runRegex 具名群組值', r3.matches[0].groups.some((g) => g.name === 'year' && g.value === '2026'))

// 不分大小寫旗標
const r4 = runRegex('abc', 'i', 'xABCy')
check('runRegex i 旗標命中', r4.matches.length === 1 && r4.matches[0].match === 'ABC')

// 語法錯誤
const r5 = runRegex('(', '', 'x')
check('runRegex 語法錯誤回 ok=false', r5.ok === false && typeof r5.error === 'string')

// 空 pattern
check('runRegex 空 pattern 不命中', runRegex('', '', 'abc').matches.length === 0)

// 零寬命中不會無限迴圈(^ 在多行)
const r6 = runRegex('^', 'm', 'a\nb\nc')
check('runRegex 零寬命中數(每行行首)', r6.matches.length === 3)
check('runRegex 零寬命中長度為 0', r6.matches[0].length === 0)

// 中文字
const r7 = runRegex('[\\u4e00-\\u9fff]+', '', 'Hi 世界 yo 測試')
check('runRegex 中文兩段', r7.matches.length === 2 && r7.matches[0].match === '世界')

// --- applyReplace ---
const rep1 = applyReplace('(\\d{4})-(\\d{2})', '', '2026-06', '$2/$1')
check('applyReplace 群組換位', rep1.ok && rep1.result === '06/2026')
const rep2 = applyReplace('a', 'g', 'aaa', 'b')
check('applyReplace 全域取代', rep2.result === 'bbb')
const rep3 = applyReplace('(', '', 'x', 'y')
check('applyReplace 語法錯誤回 ok=false', rep3.ok === false)

// --- explainPattern ---
function joined(p) {
  return explainPattern(p)
    .map((t) => t.text)
    .join('|')
}
const e1 = explainPattern('\\d{4}')
check('explain \\d{4} 一個 token', e1.length === 1 && e1[0].text === '\\d{4}')
check('explain \\d{4} 含「剛好出現 4 次」', e1[0].explain.includes('剛好出現 4 次'))
check('explain \\d 解釋為數字', e1[0].explain.includes('數字'))

const e2 = explainPattern('a+')
check('explain a+ 量詞合併', e2.length === 1 && e2[0].text === 'a+' && e2[0].explain.includes('1 次以上'))

const e3 = explainPattern('[A-Z]')
check('explain 字元集合範圍', e3[0].explain.includes('A 到 Z'))

const e4 = explainPattern('[^0-9]')
check('explain 否定字元集合', e4[0].explain.includes('不是'))

const e5 = explainPattern('(ab)')
check('explain 群組深度', e5[0].explain.includes('捕獲群組') && e5[0].depth === 0)
check('explain 群組內字元縮排', e5.some((t) => t.text === 'a' && t.depth === 1))
check('explain 群組結束', e5.some((t) => t.text === ')' && t.explain.includes('結束')))

const e6 = explainPattern('(?:x)?')
check('explain 非捕獲群組', e6[0].explain.includes('非捕獲'))
check('explain 群組後量詞', e6.some((t) => t.text === ')?' && t.explain.includes('整組')))

const e7 = explainPattern('^a|b$')
check('explain 含開頭', e7.some((t) => t.text === '^' && t.explain.includes('開頭')))
check('explain 含或', e7.some((t) => t.text === '|' && t.explain.includes('或')))
check('explain 含結尾', e7.some((t) => t.text === '$' && t.explain.includes('結尾')))

const e8 = explainPattern('a{2,5}')
check('explain {2,5} 範圍', e8[0].explain.includes('2 到 5 次'))
const e9 = explainPattern('a{2,}')
check('explain {2,} 以上', e9[0].explain.includes('2 次以上'))
const e10 = explainPattern('a*?')
check('explain 惰性量詞', e10[0].text === 'a*?' && e10[0].explain.includes('惰性'))

const e11 = explainPattern('\\.')
check('explain 跳脫點號為字面', e11[0].explain.includes('字面'))
const e12 = explainPattern('.')
check('explain 點號為任意字元', e12[0].explain.includes('任意一個字元'))

const e13 = explainPattern('(?<name>\\w)')
check('explain 具名群組', e13[0].explain.includes('具名') && e13[0].explain.includes('name'))

// --- LIBRARY 自洽:每筆 pattern 可編譯,且能在自己的 sample 命中至少一次 ---
let libOk = true
for (const item of LIBRARY) {
  try {
    const res = runRegex(item.pattern, item.flags, item.sample)
    if (!res.ok || res.matches.length === 0) {
      libOk = false
      console.error(`  樣式庫「${item.name}」在 sample 上沒有命中`)
    }
  } catch {
    libOk = false
    console.error(`  樣式庫「${item.name}」pattern 無法編譯`)
  }
}
check(`樣式庫 ${LIBRARY.length} 筆皆可編譯且命中各自範例`, libOk)
// 抽查台灣手機樣式
const phone = LIBRARY.find((i) => i.name === '台灣手機號碼')
const pr = runRegex(phone.pattern, phone.flags, '0912-345-678 0987654321')
check('樣式庫 手機抓到兩個', pr.matches.length === 2)

console.log(fail ? `\n${fail} 個測試失敗` : '\n全部通過')
process.exit(fail ? 1 : 0)
