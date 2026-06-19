/*
  密碼強度檢測引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-passwordstrength.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `pwstrength-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/passwordStrength.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { estimateStrength, poolSize, humanTime } = await import('file://' + out)

let fail = 0
function eq(note, got, want) {
  if (got === want) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}\n   got : ${JSON.stringify(got)}\n   want: ${JSON.stringify(want)}`)
  }
}
function ok(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// --- poolSize ---
eq('pool 純小寫', poolSize('abc'), 26)
eq('pool 小寫+數字', poolSize('abc123'), 36)
eq('pool 大小寫+數字', poolSize('Abc123'), 62)
eq('pool 含符號', poolSize('Abc123!'), 95)
eq('pool 含空白', poolSize('a b'), 27)
eq('pool 空字串', poolSize(''), 0)

// --- 空字串 ---
let r = estimateStrength('')
eq('空 score', r.score, 0)
eq('空 length', r.length, 0)
eq('空 crackOffline', r.crackOffline, '—')

// --- 常見密碼 ---
r = estimateStrength('password')
eq('password isCommon', r.isCommon, true)
eq('password score 0', r.score, 0)
ok('password entropy 歸零', r.entropyBits === 0)
eq('password crackOffline 瞬間', r.crackOffline, '瞬間')

r = estimateStrength('123456')
eq('123456 isCommon', r.isCommon, true)
eq('123456 score 0', r.score, 0)

// --- 大小寫不敏感比對常見密碼 ---
r = estimateStrength('PASSWORD')
eq('PASSWORD 視為常見', r.isCommon, true)

// --- 全數字(生日樣式)有警告 ---
r = estimateStrength('19850312')
ok('全數字警告', r.warnings.some((w) => w.includes('全是數字')))

// --- 連續順序 ---
r = estimateStrength('abcdefgh')
ok('連續順序警告', r.warnings.some((w) => w.includes('連續順序')))

// --- 重複字元 ---
r = estimateStrength('aaa11122')
ok('重複字元警告', r.warnings.some((w) => w.includes('連續重複')))

// --- 鍵盤順序 ---
r = estimateStrength('qwerty99')
ok('鍵盤順序警告', r.warnings.some((w) => w.includes('鍵盤')))

// --- 強密碼 ---
r = estimateStrength('Tr0ub4dour&3xpl0it!Zq')
ok('強密碼 score>=3', r.score >= 3)
ok('強密碼無常見', !r.isCommon)
ok('強密碼 entropy 高', r.entropyBits > 80)
ok('強密碼離線非瞬間', r.crackOffline !== '瞬間')

// --- 普通密碼 ---
r = estimateStrength('Hello123')
ok('普通密碼 score 1-2', r.score >= 1 && r.score <= 2)

// --- 建議:短密碼建議加長 ---
r = estimateStrength('Ab1!')
ok('短密碼建議加長', r.suggestions.some((s) => s.includes('加長')))

// --- 建議:缺數字 ---
r = estimateStrength('abcdEFGH')
ok('缺數字建議', r.suggestions.some((s) => s.includes('數字')))

// --- raw vs effective:常見密碼 raw>0 但 effective=0 ---
r = estimateStrength('qwerty')
ok('qwerty raw>0', r.rawEntropyBits > 0)
ok('qwerty effective=0', r.entropyBits === 0)

// --- label 對應 ---
eq('label 非常弱', estimateStrength('').label, '非常弱')
ok('label 強密碼', ['強', '非常強'].includes(estimateStrength('Tr0ub4dour&3xpl0it!Zq').label))

// --- humanTime ---
eq('humanTime <1 瞬間', humanTime(0.5), '瞬間')
ok('humanTime 秒', humanTime(5).includes('秒'))
ok('humanTime 分鐘', humanTime(120).includes('分鐘'))
ok('humanTime 年', humanTime(60 * 60 * 24 * 400).includes('年'))
ok('humanTime 巨大', humanTime(1e30).includes('一百萬'))

// --- 越長越強(同字元集) ---
const short = estimateStrength('Xk9#mP2')
const long = estimateStrength('Xk9#mP2vQ7&nL4!w')
ok('越長 entropy 越高', long.entropyBits > short.entropyBits)

console.log(fail === 0 ? '\n全部通過 ✅' : `\n${fail} 筆失敗 ❌`)
process.exit(fail ? 1 : 0)
