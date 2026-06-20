/*
  robots.txt 解析 / 測試引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-robots.mjs
  oracle:依 Google robots.txt 規範(最長匹配勝、同長 Allow 勝、星號與錢號萬用字元、群組選擇)。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `robots-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/robots.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { parseRobots, extractPath, isAllowed } = await import('file://' + out)

let fail = 0
function eq(note, got, want) {
  if (got === want) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}\n   got : ${JSON.stringify(got)}\n   want: ${JSON.stringify(want)}`)
  }
}
const allow = (txt, ua, url) => isAllowed(parseRobots(txt), ua, url).allowed

// --- extractPath ---
eq('完整網址取 path', extractPath('https://a.com/foo/bar?x=1'), '/foo/bar?x=1')
eq('路徑原樣', extractPath('/foo'), '/foo')
eq('補開頭斜線', extractPath('foo'), '/foo')
eq('空 → 根', extractPath(''), '/')
eq('根網址 → /', extractPath('https://a.com'), '/')

// --- 空 robots → 全允許 ---
eq('空 robots 全允許', allow('', 'Googlebot', '/anything'), true)

// --- Disallow: / 全禁 ---
const blockAll = 'User-agent: *\nDisallow: /'
eq('Disallow / 全禁', allow(blockAll, 'Googlebot', '/page'), false)
eq('Disallow / 根也禁', allow(blockAll, 'Googlebot', '/'), false)

// --- 空 Disallow = 全允許 ---
const emptyDis = 'User-agent: *\nDisallow:'
eq('空 Disallow 全允許', allow(emptyDis, 'Googlebot', '/page'), true)

// --- Disallow 特定資料夾 ---
const folder = 'User-agent: *\nDisallow: /private/'
eq('禁 /private/', allow(folder, 'Googlebot', '/private/secret'), false)
eq('允 /public', allow(folder, 'Googlebot', '/public/x'), true)

// --- Allow 覆蓋 Disallow(更長更具體)---
const override = 'User-agent: *\nDisallow: /folder\nAllow: /folder/public'
eq('Allow 更長 → 允許', allow(override, 'Googlebot', '/folder/public/a'), true)
eq('Disallow 仍擋其他', allow(override, 'Googlebot', '/folder/private'), false)

// --- 同長度 Allow 勝 Disallow ---
const tie = 'User-agent: *\nDisallow: /page\nAllow: /page'
eq('同長度 Allow 勝', allow(tie, 'Googlebot', '/page'), true)

// --- $ 結尾錨點 ---
const dollar = 'User-agent: *\nDisallow: /*.php$'
eq('$ 命中 .php', allow(dollar, 'Googlebot', '/index.php'), false)
eq('$ 不命中帶 query', allow(dollar, 'Googlebot', '/index.php?id=1'), true)
eq('$ 不命中其他', allow(dollar, 'Googlebot', '/index.html'), true)

// --- * 萬用字元在路徑中 ---
const star = 'User-agent: *\nDisallow: /*/private'
eq('* 中段命中', allow(star, 'Googlebot', '/any/private'), false)
eq('* 中段不命中', allow(star, 'Googlebot', '/any/public'), true)

// --- 群組選擇:特定 UA 優先於 * ---
const groups = [
  'User-agent: *',
  'Disallow: /',
  '',
  'User-agent: Googlebot',
  'Disallow: /no-google',
  'Allow: /',
].join('\n')
eq('Googlebot 用自己的組(允許一般頁)', allow(groups, 'Googlebot', '/page'), true)
eq('Googlebot 自己的禁區', allow(groups, 'Googlebot', '/no-google'), false)
eq('其他 bot 用 * 組(全禁)', allow(groups, 'Bingbot', '/page'), false)

// --- 連續 User-agent 共用規則 ---
const shared = ['User-agent: A', 'User-agent: B', 'Disallow: /x'].join('\n')
const sharedParsed = parseRobots(shared)
eq('連續 UA 同組 agents 數', sharedParsed.groups[0].agents.length, 2)
eq('A 禁 /x', isAllowed(sharedParsed, 'A', '/x').allowed, false)
eq('B 禁 /x', isAllowed(sharedParsed, 'B', '/x').allowed, false)

// --- 規則後再見 UA → 新組 ---
const newgrp = ['User-agent: A', 'Disallow: /a', 'User-agent: B', 'Disallow: /b'].join('\n')
const ng = parseRobots(newgrp)
eq('規則後 UA 開新組', ng.groups.length, 2)
eq('A 禁 /a 但允 /b', isAllowed(ng, 'A', '/b').allowed, true)
eq('B 禁 /b 但允 /a', isAllowed(ng, 'B', '/a').allowed, true)

// --- 註解與 Sitemap ---
const withMeta = ['# 這是註解', 'Sitemap: https://a.com/sitemap.xml', 'User-agent: *', 'Disallow: /tmp # 暫存'].join('\n')
const meta = parseRobots(withMeta)
eq('解析 Sitemap', meta.sitemaps[0], 'https://a.com/sitemap.xml')
eq('規則去尾註解', meta.groups[0].rules[0].path, '/tmp')
eq('Sitemap 不影響規則', isAllowed(meta, 'X', '/tmp/a').allowed, false)

// --- UA 大小寫不敏感、前綴匹配 ---
const ci = 'User-agent: googlebot\nDisallow: /x'
eq('UA 大小寫不敏感', allow(ci, 'Googlebot/2.1', '/x'), false)

// --- crawl-delay 解析 ---
const cd = parseRobots('User-agent: *\nCrawl-delay: 10\nDisallow: /x')
eq('crawl-delay', cd.groups[0].crawlDelay, 10)

if (fail) {
  console.error(`\n${fail} 筆失敗`)
  process.exit(1)
}
console.log('\n全部通過 ✅')
