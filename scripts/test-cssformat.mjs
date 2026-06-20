/*
  CSS 格式化引擎回歸測試(node 直接跑)。
  執行:node scripts/test-cssformat.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `cssformat-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/cssFormat.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { formatCss, minifyCss } = await import('file://' + out)

let fail = 0
let pass = 0
function ok(c, msg) {
  if (c) pass++
  else {
    fail++
    console.error('✗ FAIL:', msg)
  }
}
function eq(input, expected, msg, opts) {
  const r = formatCss(input, opts)
  if (r.output === expected) pass++
  else {
    fail++
    console.error(`✗ FAIL: ${msg}\n--- got ---\n${r.output}\n--- want ---\n${expected}\n-----------`)
  }
}
function eqMin(input, expected, msg) {
  const r = minifyCss(input)
  if (r.output === expected) pass++
  else {
    fail++
    console.error(`✗ FAIL(min): ${msg}\n got: ${r.output}\n want: ${expected}`)
  }
}

// ---- format 精確輸出 ----
eq('a{color:red}', 'a {\n  color: red;\n}', 'simple rule')
eq('a,b{color:red;font-size:12px}', 'a,\nb {\n  color: red;\n  font-size: 12px;\n}', 'selector list + two decls')
eq('@media screen{a{color:red}}', '@media screen {\n  a {\n    color: red;\n  }\n}', 'nested @media')
eq('/* c */a{color:red}', '/* c */\na {\n  color: red;\n}', 'leading comment standalone')
eq('a:hover{color:red}', 'a:hover {\n  color: red;\n}', 'pseudo colon not split')
eq('a:not(.x,.y){color:red}', 'a:not(.x,.y) {\n  color: red;\n}', 'comma inside paren not split')
eq('a{background:url(http://x/y.png)}', 'a {\n  background: url(http://x/y.png);\n}', 'url with colon')
eq(
  'a{background:url(data:image/png;base64,AAAB,)}',
  'a {\n  background: url(data:image/png;base64,AAAB,);\n}',
  'data uri ; and , inside url not split',
)
eq('@import "a.css";a{color:red}', '@import "a.css";\na {\n  color: red;\n}', 'import then rule')
eq('a{color:red}', 'a {\n    color: red;\n}', 'indent=4', { indent: 4 })
eq('a{margin:1px    2px}', 'a {\n  margin: 1px 2px;\n}', 'value whitespace collapsed')
eq('a{content:"a; b: c"}', 'a {\n  content: "a; b: c";\n}', 'string content untouched')
eq('a{color:red;}', 'a {\n  color: red;\n}', 'trailing semicolon')
eq('.empty{}', '.empty {\n}', 'empty rule')

// ---- minify ----
eqMin('a {\n  color: red;\n}', 'a{color:red}', 'minify simple')
eqMin('a, b { color: red; font-size: 12px }', 'a,b{color:red;font-size:12px}', 'minify list')
eqMin('/* c */ a { color: red }', 'a{color:red}', 'minify drops comment')
eqMin('a { background: url(http://x) }', 'a{background:url(http://x)}', 'minify url')
eqMin('a{margin:1px   2px}', 'a{margin:1px 2px}', 'minify keeps needed space')
eqMin('@media screen { a { color: red } }', '@media screen{a{color:red}}', 'minify nested')
eqMin('a{content:"x ; y"}', 'a{content:"x ; y"}', 'minify keeps string')

// ---- 冪等性 + 結構保留 ----
const samples = [
  'body{margin:0;padding:0}h1,h2{font-weight:bold;color:#333}',
  '@media (max-width:600px){.col{width:100%}.hide{display:none}}',
  '.btn{background:url(data:image/svg+xml;utf8,<svg/>);border:1px solid #ccc}',
  'a:hover,a:focus{text-decoration:underline}ul>li{list-style:none}',
]
for (const s of samples) {
  const once = formatCss(s).output
  const twice = formatCss(once).output
  ok(once === twice, `idempotent: ${s.slice(0, 36)}…`)
  ok(minifyCss(s).output === minifyCss(once).output, `structure preserved: ${s.slice(0, 36)}…`)
}

// ---- 邊界 ----
ok(formatCss('').output === '', '空字串')
ok(formatCss('   ').output === '', '純空白')
ok(minifyCss('').output === '', 'minify 空字串')

console.log(`\nCSS 格式化:${pass} 通過${fail ? `,${fail} 失敗` : ''}`)
if (fail) process.exit(1)
