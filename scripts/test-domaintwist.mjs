// 相似網域產生回歸測試
import { execSync } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'domaintwist-'))
const entry = join(dir, 'entry.mjs')
const src = join(process.cwd(), 'src/features/domainTwist.ts').replace(/\\/g, '\\\\')
writeFileSync(
  entry,
  `export { parseDomain, omission, repetition, transposition, replacement, insertion, homoglyph, hyphenation, vowelSwap, bitsquatting, addition, generateTwists, countTwists } from '${src}'`,
)
const outFile = join(dir, 'bundle.mjs')
execSync(`npx esbuild ${entry} --bundle --format=esm --platform=node --outfile=${outFile}`, {
  stdio: ['ignore', 'ignore', 'inherit'],
})
const m = await import('file://' + outFile)

let pass = 0
let fail = 0
function ok(cond, msg) {
  if (cond) pass++
  else {
    fail++
    console.error('✗', msg)
  }
}
const setEq = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join()
const has = (arr, x) => arr.includes(x)

// ── parseDomain ──
ok(JSON.stringify(m.parseDomain('example.com')) === JSON.stringify({ name: 'example', tld: 'com' }), '基本拆解')
ok(m.parseDomain('www.example.com').name === 'www.example', '多層只切最後一個點')
ok(JSON.stringify(m.parseDomain('Example.COM')) === JSON.stringify({ name: 'example', tld: 'com' }), '轉小寫')
ok(m.parseDomain('https://shop.pchome.com.tw/abc').name === 'shop.pchome.com', '去協定與路徑')
ok(m.parseDomain('localhost') === null, '無 TLD 回 null')
ok(m.parseDomain('a..') === null, '結尾點 null')
ok(m.parseDomain('中文.com') === null, '非 ASCII 回 null')
ok(m.parseDomain('') === null, '空字串 null')

// ── 各轉換規則 ──
ok(setEq(m.omission('abc'), ['bc', 'ac', 'ab']), 'omission 少一字')
ok(setEq(m.repetition('ab'), ['aab', 'abb']), 'repetition 多一字')
ok(setEq(m.transposition('abc'), ['bac', 'acb']), 'transposition 對調')
ok(m.transposition('aab').includes('aab') === false, 'transposition 相同字不對調(無變化跳過)')
ok(has(m.hyphenation('abc'), 'a-bc') && has(m.hyphenation('abc'), 'ab-c'), 'hyphenation 插連字號')
ok(m.hyphenation('abc').length === 2, 'hyphenation 數量')
ok(setEq(m.vowelSwap('bat'), ['bet', 'bit', 'bot', 'but']), 'vowelSwap 母音替換')

// homoglyph:l→1/i、o→0
ok(has(m.homoglyph('lo'), '1o'), 'homoglyph l→1')
ok(has(m.homoglyph('lo'), 'io'), 'homoglyph l→i')
ok(has(m.homoglyph('lo'), 'l0'), 'homoglyph o→0')
ok(has(m.homoglyph('com'), 'corn'), 'homoglyph m→rn(com→corn)')
ok(has(m.homoglyph('www'), 'vvww') || m.homoglyph('www').some((x) => x.includes('vv')), 'homoglyph w→vv')

// replacement / insertion 用鍵盤鄰鍵
ok(m.replacement('a').every((x) => x.length === 1) && m.replacement('a').includes('q'), 'replacement 同長度鄰鍵')
ok(m.insertion('a').every((x) => x.length === 2), 'insertion 加一字')
ok(m.replacement('a').length === 4, 'a 的鄰鍵數(qwsz)')

// bitsquatting:皆同長度、與原字不同、合法網域字元
const bs = m.bitsquatting('go')
ok(bs.length > 0 && bs.every((x) => x.length === 2), 'bitsquatting 同長度')
ok(bs.every((x) => /^[a-z0-9-]+$/.test(x) && x !== 'go'), 'bitsquatting 合法且不等於原字')

// addition:結尾加 a-z0-9 共 36 個
ok(m.addition('x').length === 36 && has(m.addition('x'), 'xa') && has(m.addition('x'), 'x9'), 'addition 結尾加字')

// ── generateTwists 整合 ──
const groups = m.generateTwists('example.com')
ok(groups.length > 0, '有分組')
const all = groups.flatMap((g) => g.domains)
ok(!all.includes('example.com'), '排除原網域本身')
ok(new Set(all).size === all.length, '全域去重(無重複)')
ok(all.every((d) => /^[a-z0-9.-]+$/.test(d)), '皆為合法網域字元')

// TLD-swap 應換掉 TLD 且含常見替代
const tldGroup = groups.find((g) => g.category === 'tld-swap')
ok(tldGroup && has(tldGroup.domains, 'example.net'), 'tld-swap → .net')
ok(tldGroup && has(tldGroup.domains, 'example.org'), 'tld-swap → .org')
ok(tldGroup && has(tldGroup.domains, 'example.co'), 'tld-swap → .co(形近)')
ok(tldGroup && tldGroup.domains.every((d) => d.startsWith('example.')), 'tld-swap 名稱不變')

// 非 tld-swap 分組都保留原 TLD
for (const g of groups) {
  if (g.category === 'tld-swap') continue
  ok(g.domains.every((d) => d.endsWith('.com')), `${g.category} 保留 .com`)
}

// 知名案例:google → 形近含 g00gle / googie 之類
const gg = m.generateTwists('google.com')
const ggAll = gg.flatMap((x) => x.domains)
ok(ggAll.includes('go0gle.com') || ggAll.includes('g00gle.com') || ggAll.some((d) => d.includes('0')), 'google 形近含 0')
ok(m.countTwists(gg) === ggAll.length, 'countTwists 與總數一致')
ok(m.countTwists(gg) > 50, 'google 產生數量充足')

// 空輸入 / 無效
ok(m.generateTwists('bad').length === 0, '無 TLD 不產生')
ok(m.generateTwists('').length === 0, '空字串不產生')

console.log(`domaintwist: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
