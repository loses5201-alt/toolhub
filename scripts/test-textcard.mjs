/*
  文字卡片排版引擎回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-textcard.mjs
  以「每字固定寬度」的假 measure 驗證斷行/硬切/自動字級邏輯,與真實字型無關。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `textcard-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/textCard.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { isCJK, tokenize, wrapParagraph, wrapText, fitFontSize } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// CJK 字元寬 1、其餘寬 0.5 的假量測;measureAt(size) 回傳依字級縮放的量測
function makeMeasure(unit) {
  return (s) => Array.from(s).reduce((w, ch) => w + (isCJK(ch) ? unit : unit * 0.5), 0)
}

// --- isCJK ---
check('isCJK 中文字', isCJK('中') && isCJK('文'))
check('isCJK 全形標點', isCJK('，') && isCJK('。'))
check('isCJK 非中文', !isCJK('a') && !isCJK('1') && !isCJK(' '))

// --- tokenize ---
const tk = tokenize('Hello 世界 foo')
check('tokenize 英數成詞、CJK 逐字、空白成段', tk.join('|') === 'Hello| |世|界| |foo')

// --- wrapParagraph(英數整詞不切) ---
const m1 = makeMeasure(1) // 英數每字 0.5,CJK 每字 1
// maxWidth=3 → "Hello"=2.5 放得下,加空白(0.5)=3,再加 world 超過 → 換行
const w1 = wrapParagraph('Hello world', 3, m1)
check('英數依單字斷行', w1.length === 2 && w1[0] === 'Hello' && w1[1] === 'world')
check('斷行後不留行首空白', !w1[1].startsWith(' '))

// --- wrapParagraph(CJK 逐字斷) ---
const w2 = wrapParagraph('一二三四五', 3, m1) // 每行最多 3 個 CJK 字
check('CJK 逐字斷行', w2.length === 2 && w2[0] === '一二三' && w2[1] === '四五')

// --- 超長英數單字硬切 ---
const w3 = wrapParagraph('abcdefghij', 2, m1) // 每字 0.5 → 一行放 4 字
check('超長單字硬切', w3.every((l) => l.length <= 4) && w3.join('') === 'abcdefghij')

// --- wrapText 處理換行 ---
const w4 = wrapText('一二\n三四五六', 2, m1)
check('保留明確換行 + 各段再斷', w4.length === 3 && w4[0] === '一二' && w4[1] === '三四' && w4[2] === '五六')

// --- 空字串 / 空行 ---
check('空字串得一空行', wrapText('', 5, m1).length === 1)
check('連續換行得空行', wrapText('a\n\nb', 5, m1).length === 3)

// --- maxWidth 充足時不斷行 ---
check('夠寬就一行', wrapText('短句子', 100, m1).length === 1)

// --- fitFontSize ---
// box 寬 10、高 10,行高 1。measureAt(size)=每 CJK 字寬 size*0.1
const measureAt = (size) => makeMeasure(size * 0.1)
const fs = fitFontSize('一二三四五', 10, 10, { min: 1, max: 100, lineHeight: 1 }, measureAt)
// 字級 s:寬 = 字數*s*0.1 ≤ 10 → 一行 ≤ 5 字需 5*s*0.1≤10 → s≤20;高:行數*s≤10
// s=20 → 一行寬=5*2=10 OK,高=1*20=20 >10 不行 → 變多行... 取得最大合適值
check('fitFontSize 回傳介於範圍內', fs >= 1 && fs <= 100)
check('fitFontSize 結果確實塞得下', (() => {
  const measure = measureAt(fs)
  const lines = wrapText('一二三四五', 10, measure)
  return lines.length * fs * 1 <= 10 && lines.every((l) => measure(l) <= 10)
})())
check('fitFontSize 再大一級就塞不下(已是最大)', (() => {
  const s = fs + 1
  const measure = measureAt(s)
  const lines = wrapText('一二三四五', 10, measure)
  const fits = lines.length * s <= 10 && lines.every((l) => measure(l) <= 10)
  return !fits
})())

// 極窄框仍回傳 min,不當掉
check('極窄框回傳 min', fitFontSize('一二三', 1, 1, { min: 8, max: 40, lineHeight: 1.3 }, measureAt) === 8)

if (fail) {
  console.error(`\n${fail} 項失敗`)
  process.exit(1)
}
console.log('\n全部通過')
