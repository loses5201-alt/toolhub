/*
  Markdown 目錄(TOC)引擎回歸測試(node 直接跑)。
  執行:node scripts/test-markdowntoc.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `markdowntoc-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/markdownToc.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { stripInline, githubSlug, dedupeSlug, parseHeadings, buildToc } =
  await import('file://' + out)

let fail = 0
let pass = 0
function eq(a, b, msg) {
  if (a === b) pass++
  else {
    fail++
    console.error(`✗ FAIL: ${msg} — got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`)
  }
}
function ok(c, msg) {
  if (c) pass++
  else {
    fail++
    console.error('✗ FAIL:', msg)
  }
}

// stripInline
eq(stripInline('**bold** text'), 'bold text', 'strip bold')
eq(stripInline('*italic*'), 'italic', 'strip italic')
eq(stripInline('`code` here'), 'code here', 'strip inline code')
eq(stripInline('[link](http://x)'), 'link', 'strip link keep text')
eq(stripInline('![img](x.png)title'), 'title', 'strip image')
eq(stripInline('~~strike~~'), 'strike', 'strip strikethrough')
eq(stripInline('plain'), 'plain', 'plain unchanged')

// githubSlug
eq(githubSlug('Hello World'), 'hello-world', 'slug hello world')
eq(githubSlug('Hello World!'), 'hello-world', 'slug strip punctuation')
eq(githubSlug('API 參考'), 'api-參考', 'slug keep CJK')
eq(githubSlug('Test (1)'), 'test-1', 'slug parentheses')
eq(githubSlug(' spaced out '), 'spaced-out', 'slug trim + single space')
eq(githubSlug('C++ & C#'), 'c--c', 'slug symbols removed then spaces->hyphen 1:1 (GitHub)')
eq(githubSlug('snake_case_heading'), 'snake_case_heading', 'slug keep underscore')
eq(githubSlug('already-hyphen'), 'already-hyphen', 'slug keep hyphen')
eq(githubSlug('純中文標題'), '純中文標題', 'slug pure CJK')

// dedupeSlug
{
  const seen = new Map()
  eq(dedupeSlug('test', seen), 'test', 'dedupe first')
  eq(dedupeSlug('test', seen), 'test-1', 'dedupe second')
  eq(dedupeSlug('test', seen), 'test-2', 'dedupe third')
  eq(dedupeSlug('other', seen), 'other', 'dedupe other first')
}

// parseHeadings 基本
{
  const md = '# Title\n\nsome text\n\n## Section A\n\n### Sub\n\n## Section B'
  const hs = parseHeadings(md)
  eq(hs.length, 4, 'parse 4 headings')
  eq(hs[0].level, 1, 'h0 level 1')
  eq(hs[0].text, 'Title', 'h0 text')
  eq(hs[0].slug, 'title', 'h0 slug')
  eq(hs[1].text, 'Section A', 'h1 text')
  eq(hs[2].level, 3, 'h2 level 3')
}

// 重複標題 → slug 加序號
{
  const md = '# Setup\n## Setup\n## Setup'
  const hs = parseHeadings(md)
  eq(hs[0].slug, 'setup', 'dup slug 0')
  eq(hs[1].slug, 'setup-1', 'dup slug 1')
  eq(hs[2].slug, 'setup-2', 'dup slug 2')
}

// 略過圍欄程式碼區塊內的 #
{
  const md = '# Real\n\n```\n# not a heading\n## also not\n```\n\n## After'
  const hs = parseHeadings(md)
  eq(hs.length, 2, 'fence skipped -> 2 headings')
  eq(hs[1].text, 'After', 'after fence heading')
}
// ~~~ 圍欄
{
  const md = '# Real\n~~~\n# nope\n~~~\n## B'
  const hs = parseHeadings(md)
  eq(hs.length, 2, 'tilde fence skipped')
}

// 行內 markdown 標題 + 尾端 #
{
  const md = '## **Bold** `code` heading ##'
  const hs = parseHeadings(md)
  eq(hs[0].text, 'Bold code heading', 'inline stripped in heading')
  eq(hs[0].slug, 'bold-code-heading', 'inline heading slug')
}

// 不是標題的 #(無空白)
{
  const md = '#nospace\n# yes space'
  const hs = parseHeadings(md)
  eq(hs.length, 1, 'require space after #')
  eq(hs[0].text, 'yes space', 'only valid heading')
}

// buildToc 縮排與相對層級
{
  const md = '## Top\n### Mid\n#### Deep\n## Top2'
  const hs = parseHeadings(md)
  const toc = buildToc(hs)
  const expected = [
    '- [Top](#top)',
    '  - [Mid](#mid)',
    '    - [Deep](#deep)',
    '- [Top2](#top2)',
  ].join('\n')
  eq(toc, expected, 'buildToc relative indent (base=2)')
}

// buildToc ordered
{
  const md = '# A\n## B'
  const toc = buildToc(parseHeadings(md), { ordered: true })
  eq(toc, '1. [A](#a)\n  1. [B](#b)', 'buildToc ordered')
}

// buildToc min/max level 過濾
{
  const md = '# H1\n## H2\n### H3\n#### H4'
  const toc = buildToc(parseHeadings(md), { minLevel: 2, maxLevel: 3 })
  eq(toc, '- [H2](#h2)\n  - [H3](#h3)', 'buildToc level filter')
}

// buildToc 空
eq(buildToc([]), '', 'buildToc empty')
eq(buildToc(parseHeadings('no headings here')), '', 'buildToc no headings')

console.log(`\nmarkdownToc: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
