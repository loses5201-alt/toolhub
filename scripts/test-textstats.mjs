/*
  文字統計引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-textstats.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `textstats-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/textStats.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { analyzeText, formatDuration } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// --- 空字串:全為 0 ---
const e = analyzeText('')
check('空字串 chars=0', e.chars === 0)
check('空字串 lines=0', e.lines === 0)
check('空字串 paragraphs=0', e.paragraphs === 0)
check('空字串 totalWords=0', e.totalWords === 0)
check('空字串 bytes=0', e.bytes === 0)
check('null 視為空字串', analyzeText(null).chars === 0)

// --- 純中文:逐字計,不靠空白 ---
const c = analyzeText('你好世界')
check('中文 4 字 cjkChars=4', c.cjkChars === 4)
check('中文 chars=4', c.chars === 4)
check('中文 totalWords=4', c.totalWords === 4)
check('中文 latinWords=0', c.latinWords === 0)
check('中文 UTF-8 位元組=12', c.bytes === 12) // 每漢字 3 bytes

// --- 純英文:以空白/詞切 ---
const en = analyzeText('Hello world foo')
check('英文 3 詞', en.latinWords === 3)
check('英文 cjkChars=0', en.cjkChars === 0)
check("含 ' 的縮寫算 1 詞", analyzeText("don't").latinWords === 1)
check('含連字號算 1 詞', analyzeText('well-known').latinWords === 1)
check('英文 chars 含空白=15', en.chars === 15)
check('英文 charsNoSpaces=13', en.charsNoSpaces === 13)

// --- 中英混合 ---
const mix = analyzeText('我有 3 個 apple 和 banana。')
check('混合 中文字=4(我有個和)', mix.cjkChars === 4)
check('混合 英文詞=2', mix.latinWords === 2)
check('混合 數字串=1', mix.numbers === 1)
check('混合 totalWords=6', mix.totalWords === 6)
check('混合 句末標點(。)→ sentences=1', mix.sentences === 1)

// --- 數字串 ---
check('小數 3.14 算 1 個數字串', analyzeText('3.14').numbers === 1)
check('千分位 1,000 算 1 個', analyzeText('1,000').numbers === 1)
check('兩組數字 算 2', analyzeText('12 34').numbers === 2)
check('小數點不被當成句號', analyzeText('價格 3.14 元').sentences === 0)

// --- 標點 ---
const p = analyzeText('Hi, world! 你好,世界。')
check('標點計數 >=4', p.punctuation >= 4)
check('英文 ! 句末 → 至少 1 句', p.sentences >= 1)

// --- 行/段落 ---
const multi = analyzeText('第一段第一行\n第一段第二行\n\n第二段\n\n\n第三段')
check('行數含空行', multi.lines === 7)
check('非空行數=4', multi.nonEmptyLines === 4)
check('段落數=3', multi.paragraphs === 3)
check('單行無換行 lines=1', analyzeText('abc').lines === 1)
check('結尾換行 lines 計入', analyzeText('a\n').lines === 2)
check('純空白 paragraphs=0', analyzeText('   \n  \n').paragraphs === 0)

// --- 空白與全形空白都算空白 ---
const sp = analyzeText('a b　c d') // 半形、全形、NBSP
check('含空白 chars=7', sp.chars === 7)
check('不含空白 charsNoSpaces=4', sp.charsNoSpaces === 4)

// --- emoji:碼位計為 1 字元 ---
const em = analyzeText('a😀b')
check('emoji 視為 1 字元 chars=3', em.chars === 3)
check('emoji 不算中文字', em.cjkChars === 0)

// --- 句數:多種句末標點 ---
check('多句 中文', analyzeText('今天天氣好。你呢?我很好!').sentences === 3)
check('刪節號…算一句', analyzeText('嗯…').sentences === 1)

// --- 閱讀/朗讀時間:單調且合理 ---
const big = analyzeText('字'.repeat(600))
check('600 中文字 默讀約 120 秒', big.readingSeconds === 120)
check('朗讀比默讀久', big.speakingSeconds > big.readingSeconds)
check('字越多閱讀時間越長', analyzeText('字'.repeat(1200)).readingSeconds > big.readingSeconds)

// --- formatDuration ---
check('formatDuration 30 秒', formatDuration(30) === '30 秒')
check('formatDuration 整分', formatDuration(120) === '2 分')
check('formatDuration 分+秒', formatDuration(125) === '2 分 5 秒')
check('formatDuration 負數歸 0', formatDuration(-5) === '0 秒')

if (fail) {
  console.error(`\n${fail} 個測試未通過`)
  process.exit(1)
}
console.log('\n全部 textstats 測試通過')
