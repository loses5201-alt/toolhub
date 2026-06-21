// 同形字 / 混合文字偵測 回歸測試
import { execSync } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'homoglyph-'))
const entry = join(dir, 'entry.mjs')
const src = join(process.cwd(), 'src/features/homoglyph.ts').replace(/\\/g, '\\\\')
writeFileSync(entry, `export { analyzeText, scriptOf, confusableTarget } from '${src}'`)
const outFile = join(dir, 'bundle.mjs')
execSync(`npx esbuild ${entry} --bundle --format=esm --platform=node --outfile=${outFile}`, {
  stdio: ['ignore', 'ignore', 'inherit'],
})
const { analyzeText, scriptOf, confusableTarget } = await import('file://' + outFile)

let pass = 0
let fail = 0
function ok(cond, msg) {
  if (cond) pass++
  else {
    fail++
    console.error('✗', msg)
  }
}

// ── scriptOf ──
ok(scriptOf('a'.codePointAt(0)) === 'Latin', 'a → Latin')
ok(scriptOf('Z'.codePointAt(0)) === 'Latin', 'Z → Latin')
ok(scriptOf('5'.codePointAt(0)) === 'Common', '數字 → Common')
ok(scriptOf(' '.codePointAt(0)) === 'Common', '空白 → Common')
ok(scriptOf('а'.codePointAt(0)) === 'Cyrillic', '西里爾 а → Cyrillic')
ok(scriptOf('ο'.codePointAt(0)) === 'Greek', '希臘 ο → Greek')
ok(scriptOf('中'.codePointAt(0)) === 'Han', '中 → Han')
ok(scriptOf('あ'.codePointAt(0)) === 'Hiragana', 'あ → Hiragana')
ok(scriptOf('カ'.codePointAt(0)) === 'Katakana', 'カ → Katakana')
ok(scriptOf('한'.codePointAt(0)) === 'Hangul', '한 → Hangul')
ok(scriptOf('ａ'.codePointAt(0)) === 'Fullwidth', '全形 ａ → Fullwidth')
ok(scriptOf('.'.codePointAt(0)) === 'Common', '. → Common')

// ── confusableTarget ──
ok(confusableTarget('а') === 'a', '西里爾 а → a')
ok(confusableTarget('О') === 'O', '西里爾 О → O')
ok(confusableTarget('ο') === 'o', '希臘 ο → o')
ok(confusableTarget('ａ') === 'a', '全形 ａ → a')
ok(confusableTarget('１') === '1', '全形 １ → 1')
ok(confusableTarget('a') === null, '正常 a 非同形字')
ok(confusableTarget('中') === null, '中 非同形字')

// ── 純拉丁:無可疑 ──
const r1 = analyzeText('paypal.com')
ok(r1.suspicious === false, '純拉丁不可疑')
ok(r1.confusableCount === 0, '純拉丁無同形字')
ok(r1.mixedTokenCount === 0, '純拉丁無混合詞')
ok(r1.skeleton === 'paypal.com', '純拉丁 skeleton 不變')
ok(r1.scripts.includes('Latin'), '偵測到 Latin')

// ── 西里爾 а 冒充的 paypаl ──
const r2 = analyzeText('paypаl.com') // 第 5 個 а 為西里爾
ok(r2.suspicious === true, '混入西里爾 → 可疑')
ok(r2.confusableCount === 1, '一個同形字')
ok(r2.skeleton === 'paypal.com', 'skeleton 還原成 paypal.com')
ok(r2.scripts.includes('Cyrillic') && r2.scripts.includes('Latin'), '同時含 Latin 與 Cyrillic')
ok(r2.tokens[0].mixed === true, '該詞被標記混合')
ok(r2.tokens[0].hasConfusable === true, '該詞含同形字')
const susp = r2.chars.filter((c) => c.suspicious)
ok(susp.length === 1 && susp[0].target === 'a' && susp[0].script === 'Cyrillic', '可疑字資訊正確')
ok(susp[0].hex === 'U+0430', 'а 的碼位 U+0430')

// ── 全形字母 ──
const r3 = analyzeText('ＡＢＣ')
ok(r3.confusableCount === 3, '三個全形同形字')
ok(r3.skeleton === 'ABC', '全形還原 ABC')
ok(r3.suspicious === true, '全形 → 可疑')

// ── 中英混合是正常的(不應誤判)──
const r4 = analyzeText('蘋果 Apple 官網')
ok(r4.confusableCount === 0, '正常中英無同形字')
// 各詞分開:'蘋果' 與 'Apple' 各為單一語系,不算同一詞混合
ok(r4.mixedTokenCount === 0, '空白分開的中英不算混合詞')
ok(r4.scripts.includes('Han') && r4.scripts.includes('Latin'), '偵測到 Han 與 Latin')

// ── 同一詞內中英相連(常見且正常,不應因此判同形字)──
const r5 = analyzeText('iPhone手機')
ok(r5.confusableCount === 0, 'iPhone手機 無同形字')
ok(r5.tokens.length === 1, '相連視為一詞')
ok(r5.tokens[0].mixed === true, '一詞含 Latin+Han → mixed(供提示)')

// ── 希臘 ο 冒充 ──
const r6 = analyzeText('gοοgle') // 兩個希臘 ο
ok(r6.confusableCount === 2, '兩個希臘同形字')
ok(r6.skeleton === 'google', 'skeleton 還原 google')

// ── 空字串 ──
const r7 = analyzeText('')
ok(r7.suspicious === false && r7.chars.length === 0 && r7.tokens.length === 0, '空字串安全')

// ── 多詞,部分可疑 ──
const r8 = analyzeText('正常 раypal 詐騙')
ok(r8.suspicious === true, '含西里爾詞 → 可疑')
ok(r8.mixedTokenCount === 1, '只有一個混合詞')

// ── 表情符號 / 其他不誤判為同形字 ──
const r9 = analyzeText('hello 😀')
ok(r9.confusableCount === 0, 'emoji 不算同形字')

console.log(`homoglyph: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
