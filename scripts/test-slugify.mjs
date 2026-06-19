/*
  Slug 產生引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-slugify.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `slugify-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/slugify.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { slugify, DEFAULT_OPTIONS } = await import('file://' + out)

let fail = 0
function eq(note, got, want) {
  if (got === want) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}\n   got : ${JSON.stringify(got)}\n   want: ${JSON.stringify(want)}`)
  }
}

// --- 基本 ---
eq('空字串', slugify(''), '')
eq('null', slugify(null), '')
eq('簡單句子', slugify('Hello World'), 'hello-world')
eq('標點轉分隔', slugify('Hello, World!'), 'hello-world')
eq('多重空白收斂', slugify('a    b   c'), 'a-b-c')
eq('去頭尾分隔符', slugify('  --Hello--  '), 'hello')
eq('連續標點不產生多重分隔', slugify('foo --- bar'), 'foo-bar')
eq('數字保留', slugify('Top 10 Tips'), 'top-10-tips')

// --- 重音 / 變音符號 ---
eq('café → cafe', slugify('Café'), 'cafe')
eq('naïve → naive', slugify('naïve'), 'naive')
eq('Señor → senor', slugify('Señor'), 'senor')
eq('über → uber', slugify('Über Cool'), 'uber-cool')

// --- 大小寫 ---
eq('預設轉小寫', slugify('Hello World'), 'hello-world')
eq('保留大小寫', slugify('Hello World', { lowercase: false }), 'Hello-World')

// --- 分隔符 ---
eq('底線分隔符', slugify('Hello World', { separator: '_' }), 'hello_world')
eq('底線收斂', slugify('a   b', { separator: '_' }), 'a_b')
eq('底線去頭尾', slugify('__a b__', { separator: '_' }), 'a_b')

// --- Unicode / 中文 ---
eq('預設移除中文(僅 ASCII)', slugify('Hello 世界'), 'hello')
eq('保留中文', slugify('Hello 世界', { keepUnicode: true }), 'hello-世界')
eq('純中文標題保留', slugify('第一篇:我的旅程', { keepUnicode: true }), '第一篇-我的旅程')
eq('純中文在 ASCII 模式回空', slugify('你好'), '')
eq('中文 + 數字保留', slugify('2024 年度報告', { keepUnicode: true }), '2024-年度報告')
eq('日文假名保留', slugify('こんにちは 世界', { keepUnicode: true }), 'こんにちは-世界')

// --- 長度上限 ---
eq('長度上限切斷', slugify('hello-world-foo-bar', { maxLength: 11 }), 'hello-world')
eq('長度上限後去尾端分隔', slugify('hello world foo', { maxLength: 6 }), 'hello')
eq('長度上限 0 不限', slugify('hello world', { maxLength: 0 }), 'hello-world')
eq('長度上限大於字串長', slugify('abc', { maxLength: 100 }), 'abc')

// --- 綜合 ---
eq(
  '混合:重音+標點+大寫+中文(ASCII)',
  slugify('Café & 餐廳: Best in 2024!'),
  'cafe-best-in-2024',
)
eq(
  '混合保留 Unicode',
  slugify('Café & 餐廳 2024', { keepUnicode: true }),
  'cafe-餐廳-2024',
)
eq('預設選項小寫', DEFAULT_OPTIONS.lowercase, true)
eq('預設不保留 Unicode', DEFAULT_OPTIONS.keepUnicode, false)

if (fail) {
  console.error(`\n${fail} 筆測試失敗`)
  process.exit(1)
}
console.log('\n全部通過')
