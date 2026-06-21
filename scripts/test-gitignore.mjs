// .gitignore 測試引擎 回歸測試
import { execSync } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'gitignore-'))
const entry = join(dir, 'entry.mjs')
const src = join(process.cwd(), 'src/features/gitignore.ts').replace(/\\/g, '\\\\')
writeFileSync(entry, `export { parseGitignore, matchPath, parsePaths, evaluateGitignore } from '${src}'`)
const outFile = join(dir, 'bundle.mjs')
execSync(`npx esbuild ${entry} --bundle --format=esm --platform=node --outfile=${outFile}`, {
  stdio: ['ignore', 'ignore', 'inherit'],
})
const { parseGitignore, matchPath, parsePaths, evaluateGitignore } = await import('file://' + outFile)

let pass = 0
let fail = 0
function ok(cond, msg) {
  if (cond) pass++
  else {
    fail++
    console.error('✗', msg)
  }
}
// 便利:給 gitignore 文字 + 路徑 + 是否目錄 → 是否忽略
function ign(rules, path, isDir = false) {
  return matchPath(parseGitignore(rules), path, isDir).ignored
}

// ── 解析:註解、空行 ──
const r1 = parseGitignore('# comment\n\n  \nfoo\n')
ok(r1.length === 1 && r1[0].pattern === 'foo', '略過註解與空行,留 foo')
ok(parseGitignore('').length === 0, '空輸入無規則')

// ── 基本 basename 比對(非錨定,任意層級)──
ok(ign('foo', 'foo'), 'foo 比對根 foo')
ok(ign('foo', 'a/b/foo'), 'foo 比對任意層 foo(非錨定)')
ok(ign('foo', 'a/foo/x'), 'foo 目錄下檔案(父目錄 foo 被忽略)')
ok(!ign('foo', 'foobar'), 'foo 不比對 foobar')
ok(!ign('foo', 'a/barfoo'), 'foo 不比對 barfoo')

// ── 錨定(開頭 /)──
ok(ign('/foo', 'foo'), '/foo 比對根 foo')
ok(!ign('/foo', 'a/foo'), '/foo 不比對子層 foo')

// ── 中間含 / → 錨定 ──
ok(ign('a/foo', 'a/foo'), 'a/foo 比對 a/foo')
ok(!ign('a/foo', 'x/a/foo'), 'a/foo 不比對 x/a/foo(錨定根)')

// ── 目錄專屬(結尾 /)──
ok(ign('build/', 'build', true), 'build/ 比對目錄 build')
ok(!ign('build/', 'build', false), 'build/ 不比對檔案 build')
ok(ign('build/', 'build/out.js', false), 'build/ → 其下檔案被忽略')

// ── * 不跨 / ──
ok(ign('*.log', 'error.log'), '*.log 比對 error.log')
ok(ign('*.log', 'logs/error.log'), '*.log 任意層比對')
ok(!ign('*.log', 'error.log.txt'), '*.log 不比對 error.log.txt')
ok(ign('a/*.js', 'a/x.js'), 'a/*.js 比對 a/x.js')
ok(!ign('a/*.js', 'a/b/x.js'), 'a/*.js 中 * 不跨 /')

// ── ? 與 [] ──
ok(ign('file?.txt', 'file1.txt'), '? 比對單一字元')
ok(!ign('file?.txt', 'file10.txt'), '? 只比對單一字元')
ok(ign('*.[oa]', 'main.o'), '[oa] 比對 .o')
ok(ign('*.[oa]', 'lib.a'), '[oa] 比對 .a')
ok(!ign('*.[oa]', 'main.c'), '[oa] 不比對 .c')
ok(ign('foo[0-9]', 'foo3'), '[0-9] 範圍')
ok(ign('*.[!o]', 'main.c'), '[!o] 否定字元集')
ok(!ign('*.[!o]', 'main.o'), '[!o] 排除 o')

// ── ** 樣式 ──
ok(ign('**/foo', 'foo'), '**/foo 比對根 foo')
ok(ign('**/foo', 'a/b/foo'), '**/foo 比對深層 foo')
ok(ign('a/**/b', 'a/b'), 'a/**/b 零層')
ok(ign('a/**/b', 'a/x/b'), 'a/**/b 一層')
ok(ign('a/**/b', 'a/x/y/b'), 'a/**/b 多層')
ok(ign('logs/**', 'logs/x/y.txt'), 'logs/** 比對其下任意')
ok(!ign('logs/**', 'logs'), 'logs/** 不比對 logs 本身')

// ── 反向(! 重新納入),last match wins ──
const negRules = '*.log\n!important.log'
ok(ign(negRules, 'debug.log'), '*.log 忽略 debug.log')
ok(!ign(negRules, 'important.log'), '!important.log 重新納入')
// 順序相反 → 後者 *.log 勝
ok(ign('!important.log\n*.log', 'important.log'), 'last match wins:*.log 後出現勝')

// ── 父目錄被忽略 → 無法重新納入其下檔案 ──
const dirNeg = 'node_modules/\n!node_modules/keep.js'
ok(ign(dirNeg, 'node_modules/keep.js', false), '父目錄被忽略時 ! 無法重新納入子檔')
// 但若先重新納入目錄,再排除目錄內其它 → 可運作
const reinc = 'dist/\n!dist/\ndist/*\n!dist/keep.txt'
ok(!ign(reinc, 'dist/keep.txt', false), '先重新納入目錄再保留特定檔')
ok(ign(reinc, 'dist/other.txt', false), 'dist/* 忽略其它檔')

// ── decidingRule 行號正確 ──
const rules2 = parseGitignore('*.log\n!keep.log')
const m = matchPath(rules2, 'keep.log', false)
ok(m.ignored === false && m.rule && m.rule.line === 2, '決定規則為第 2 行 !keep.log')

// ── 轉義開頭 # ──
ok(ign('\\#notcomment', '#notcomment'), '\\# 轉義為實際 # 樣式')

// ── 尾端空白處理 ──
const trail = parseGitignore('foo   \nbar\\ ')
ok(trail[0].pattern === 'foo', '去未轉義尾端空白')
ok(trail[1].regex.test('bar '), '轉義的尾端空白 → 比對含空白檔名')
ok(!trail[1].regex.test('bar'), '轉義尾端空白:不比對無空白')

// ── parsePaths:結尾 / = 目錄 ──
const ps = parsePaths('src/\nfile.txt\n# skip\n\n  a/b/  ')
ok(ps.length === 3, 'parsePaths 略過註解空行')
ok(ps[0].path === 'src' && ps[0].isDir === true, 'src/ 視為目錄')
ok(ps[1].path === 'file.txt' && ps[1].isDir === false, 'file.txt 為檔案')

// ── evaluateGitignore 整合 ──
const ev = evaluateGitignore('*.log\n!keep.log\nbuild/', 'a.log\nkeep.log\nbuild/\nbuild/x.o\nsrc/main.js')
ok(ev.rows.length === 5, '5 列結果')
ok(ev.rows[0].ignored === true, 'a.log 忽略')
ok(ev.rows[1].ignored === false, 'keep.log 保留')
ok(ev.rows[4].ignored === false, 'src/main.js 保留')

// ── 空路徑 ──
ok(matchPath(parseGitignore('foo'), '', false).ignored === false, '空路徑不忽略')

console.log(`\ngitignore: ${pass} 通過, ${fail} 失敗`)
if (fail) process.exit(1)
