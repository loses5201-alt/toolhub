/*
  Open Graph / meta 標籤產生 + 解析引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-ogmeta.mjs
  oracle:依 Open Graph / Twitter Card 標準標籤與來回(generate→parse)一致性。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `ogmeta-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/ogMeta.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { generateMeta, parseMeta, escapeAttr, escapeText, metaWarnings, EMPTY_FIELDS } = await import(
  'file://' + out
)

let fail = 0
function eq(note, got, want) {
  if (got === want) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}\n   got : ${JSON.stringify(got)}\n   want: ${JSON.stringify(want)}`)
  }
}
function ok(note, cond) {
  eq(note, !!cond, true)
}

// --- escape ---
eq('escapeAttr 引號', escapeAttr('a"b&c<d>'), 'a&quot;b&amp;c&lt;d&gt;')
eq('escapeText 不跳脫引號', escapeText('a"b&c<'), 'a"b&amp;c&lt;')

// --- generate ---
const f = {
  title: '我的網站',
  description: '一段描述',
  url: 'https://example.com/page',
  image: 'https://example.com/og.png',
  siteName: 'ToolHub',
  type: 'article',
  twitterCard: 'summary_large_image',
}
const html = generateMeta(f)
ok('含 title 標籤', html.includes('<title>我的網站</title>'))
ok('含 og:title', html.includes('<meta property="og:title" content="我的網站" />'))
ok('含 og:type article', html.includes('<meta property="og:type" content="article" />'))
ok('含 og:image', html.includes('<meta property="og:image" content="https://example.com/og.png" />'))
ok('含 twitter:card', html.includes('<meta name="twitter:card" content="summary_large_image" />'))
ok('含 description', html.includes('<meta name="description" content="一段描述" />'))

// --- generate 跳脫 ---
const esc = generateMeta({ ...EMPTY_FIELDS, title: 'A & "B"', description: '' })
ok('產生時跳脫屬性', esc.includes('content="A &amp; &quot;B&quot;"'))
ok('title 文字跳脫', esc.includes('<title>A &amp; "B"</title>'))

// --- 只輸出有值欄位 ---
const partial = generateMeta({ ...EMPTY_FIELDS, title: 'X', description: '', image: '', url: '', siteName: '', type: '', twitterCard: '' })
ok('無 image 則不輸出 og:image', !partial.includes('og:image'))
ok('無 description 則不輸出', !partial.includes('og:description'))

// --- parse 來回一致 ---
const parsed = parseMeta(html)
eq('round-trip title', parsed.title, '我的網站')
eq('round-trip description', parsed.description, '一段描述')
eq('round-trip url', parsed.url, 'https://example.com/page')
eq('round-trip image', parsed.image, 'https://example.com/og.png')
eq('round-trip siteName', parsed.siteName, 'ToolHub')
eq('round-trip type', parsed.type, 'article')
eq('round-trip twitterCard', parsed.twitterCard, 'summary_large_image')

// --- parse 屬性順序顛倒(content 在前)---
const reversed = '<meta content="顛倒" property="og:title">'
eq('content 在前也可解析', parseMeta(reversed).title, '顛倒')

// --- parse 單引號 ---
eq("單引號屬性", parseMeta("<meta property='og:title' content='單引號'>").title, '單引號')

// --- parse 實體還原 ---
eq('解析還原 &amp;', parseMeta('<meta property="og:title" content="A &amp; B">').title, 'A & B')

// --- parse fallback:無 og 用 <title> 與 name=description ---
const plain = '<head><title>純標題</title><meta name="description" content="純描述"></head>'
const pp = parseMeta(plain)
eq('fallback title', pp.title, '純標題')
eq('fallback description', pp.description, '純描述')

// --- parse twitter fallback ---
const twOnly = '<meta name="twitter:title" content="推標"><meta name="twitter:image" content="t.png">'
eq('twitter title fallback', parseMeta(twOnly).title, '推標')
eq('twitter image fallback', parseMeta(twOnly).image, 't.png')

// --- parse 空 ---
eq('空 HTML title 空', parseMeta('').title, '')

// --- warnings ---
const w1 = metaWarnings({ ...EMPTY_FIELDS, title: '', description: '', image: '', url: '' })
ok('缺標題警告', w1.some((x) => x.includes('標題')))
ok('缺描述警告', w1.some((x) => x.includes('描述')))
ok('缺圖警告', w1.some((x) => x.includes('預覽圖')))

const longTitle = 'x'.repeat(61)
ok('標題過長警告', metaWarnings({ ...EMPTY_FIELDS, title: longTitle, description: 'd', image: 'https://a/i.png', url: 'https://a' }).some((x) => x.includes('偏長')))

ok('相對 image 警告', metaWarnings({ ...EMPTY_FIELDS, title: 't', description: 'd', image: '/img.png', url: 'https://a' }).some((x) => x.includes('絕對網址')))

const clean = metaWarnings({ title: 't', description: 'd', image: 'https://a/i.png', url: 'https://a', siteName: 's', type: 'website', twitterCard: 'summary' })
eq('齊全無警告', clean.length, 0)

if (fail) {
  console.error(`\n${fail} 筆失敗`)
  process.exit(1)
}
console.log('\n全部通過 ✅')
