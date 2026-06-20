// 反向正則產生器回歸測試 —— 以原生 RegExp 為 oracle 反向核對。
import { execSync } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'regexgen-'))
const entry = join(dir, 'entry.mjs')
const src = join(process.cwd(), 'src/features/regexGen.ts').replace(/\\/g, '\\\\')
writeFileSync(entry, `export { generateSamples, parseRegex } from '${src}'`)
const outFile = join(dir, 'bundle.mjs')
execSync(`npx esbuild ${entry} --bundle --format=esm --platform=node --outfile=${outFile}`, {
  stdio: ['ignore', 'ignore', 'inherit'],
})
const { generateSamples, parseRegex } = await import('file://' + outFile)

let pass = 0
let fail = 0
function ok(cond, msg) {
  if (cond) pass++
  else {
    fail++
    console.error('✗', msg)
  }
}

// 產生 N 筆,逐筆用「整串完全符合」核對
function check(pattern, n = 25, anchored = true) {
  let re
  try {
    re = new RegExp(anchored ? '^(?:' + pattern + ')$' : pattern)
  } catch (e) {
    fail++
    console.error('✗ oracle 無法編譯', pattern, e.message)
    return
  }
  const samples = generateSamples(pattern, { count: n, maxRepeat: 4 })
  if (samples.length !== n) {
    fail++
    console.error('✗ 數量不符', pattern, samples.length)
    return
  }
  const bad = samples.find((s) => !re.test(s))
  if (bad === undefined) pass++
  else {
    fail++
    console.error(`✗ 樣本不符 /${pattern}/ →`, JSON.stringify(bad))
  }
}

// ── 各式樣式都應產生可被自身比對通過的字串 ──
check('abc')
check('a|b|c')
check('colou?r')
check('\\d{4}')
check('\\d{1,3}')
check('[a-z]{3}')
check('[A-Z][a-z]+')
check('09\\d{8}') // 台灣手機
check('\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}') // IPv4 形狀
check('(cat|dog)s?')
check('[^0-9]{2}') // 非數字
check('a*b+')
check('(ab)+')
check('\\w+@\\w+\\.\\w{2,3}') // email 形狀
check('\\$\\d+\\.\\d{2}') // $12.34
check('[\\d.]+') // 類別內含 shorthand
check('[a-fA-F0-9]{6}') // hex 色碼
check('AB[0-9]{2,4}XY')
check('(?:foo|bar){2}')
check('[\\w-]+') // 含跳脫連字號
check('x{0,3}y')
check('\\s\\d\\s') // 空白
check('[abc]+', 25, false)
check('a{3}') // 固定次數

// ── 錨點:應被忽略但仍產生合身字串(用非錨點 oracle 比對 contains)──
check('^\\d{3}$', 25, false)
{
  const s = generateSamples('^[a-z]{4}$', { count: 10 })
  ok(s.every((x) => /^[a-z]{4}$/.test(x)), '錨點被忽略後仍 4 碼小寫')
}

// ── 前瞻:解析不報錯,生成略過前瞻部分 ──
{
  const s = generateSamples('foo(?=bar)', { count: 5 })
  ok(s.every((x) => x === 'foo'), '前瞻略過,只剩 foo')
}
{
  const s = generateSamples('(?!x)\\d{2}', { count: 10 })
  ok(s.every((x) => /^\d{2}$/.test(x)), '負前瞻略過')
}

// ── 固定樣式應唯一 ──
ok(generateSamples('abc', { count: 5 }).every((x) => x === 'abc'), 'abc 恆為 abc')
ok(generateSamples('[a]', { count: 5 }).every((x) => x === 'a'), '[a] 恆為 a')
ok(generateSamples('\\.', { count: 3 }).every((x) => x === '.'), '跳脫點為字面 .')

// ── 量詞次數上限 ──
ok(generateSamples('a*', { count: 30, maxRepeat: 2 }).every((x) => x.length <= 2), 'a* 受 maxRepeat 上限')
ok(generateSamples('a{2,8}', { count: 30, maxRepeat: 1 }).every((x) => x.length >= 2 && x.length <= 3), '{2,8} 配 maxRepeat=1 → 2~3')
ok(generateSamples('a{5}', { count: 10 }).every((x) => x.length === 5), 'a{5} 固定五個')

// ── unique / count ──
ok(new Set(generateSamples('[ab]', { count: 2, unique: true })).size === 2, 'unique 去重')
ok(generateSamples('\\d', { count: 50 }).length === 50, 'count=50')
ok(generateSamples('\\d', { count: 1 }).length === 1, 'count=1')

// ── 錯誤處理 ──
function throws(fn) {
  try {
    fn()
    return false
  } catch {
    return true
  }
}
ok(throws(() => parseRegex('')), '空字串報錯')
ok(throws(() => parseRegex('[')), '未閉合類別報錯')
ok(throws(() => parseRegex('(abc')), '未閉合括號報錯')
ok(throws(() => parseRegex('a{3,1}')), '量詞範圍顛倒報錯')
ok(throws(() => parseRegex('[z-a]')), '字元範圍顛倒報錯')
ok(throws(() => parseRegex('[^\\x00-\\xff]')), '空集合(負集涵蓋全部可列印)報錯', true)

console.log(`regexgen: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
