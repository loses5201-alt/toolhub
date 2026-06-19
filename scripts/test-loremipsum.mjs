/*
  假文 / Lorem Ipsum 產生引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-loremipsum.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `lorem-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/loremIpsum.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { generate, DEFAULT_OPTIONS } = await import('file://' + out)

let fail = 0
function ok(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// --- 拉丁:單字 ---
const w = generate({ lang: 'latin', unit: 'words', count: 10, seed: 1 })
ok('拉丁 10 字 → 10 個空白分隔詞', w.split(' ').length === 10)
ok('拉丁經典開頭 Lorem ipsum', w.toLowerCase().startsWith('lorem ipsum dolor sit amet'))
ok('首字大寫', /^[A-Z]/.test(w))
const wNoClassic = generate({ lang: 'latin', unit: 'words', count: 5, startWithClassic: false, seed: 1 })
ok('關閉經典開頭不一定以 lorem 起頭(仍 5 字)', wNoClassic.split(' ').length === 5)

// --- 拉丁:句子 ---
const s = generate({ lang: 'latin', unit: 'sentences', count: 4, seed: 7 })
ok('拉丁 4 句以句號結尾', s.trim().endsWith('.'))
ok('拉丁句子皆以句號分隔(4 個 .)', (s.match(/\./g) || []).length >= 4)

// --- 拉丁:段落 ---
const p = generate({ lang: 'latin', unit: 'paragraphs', count: 3, seed: 42 })
ok('拉丁 3 段以空行分隔', p.split('\n\n').length === 3)
ok('拉丁段落首段含經典開頭', p.toLowerCase().startsWith('lorem ipsum dolor sit amet'))
ok('拉丁只含 ASCII', /^[\x00-\x7F]+$/.test(p))

// --- 可重現性 ---
ok('同 seed 結果相同', generate({ count: 2, seed: 99 }) === generate({ count: 2, seed: 99 }))
ok('不同 seed 結果不同', generate({ count: 3, seed: 1 }) !== generate({ count: 3, seed: 2 }))

// --- 中文:字 ---
const cw = generate({ lang: 'cjk', unit: 'words', count: 12, seed: 3 })
ok('中文 12 字長度為 12', [...cw].length === 12)
ok('中文字皆為漢字', /^[一-鿿]+$/.test(cw))

// --- 中文:句 ---
const cs = generate({ lang: 'cjk', unit: 'sentences', count: 3, seed: 5 })
ok('中文句以中文句末標點結尾', /[。!?]$/.test(cs))
ok('中文句含中文逗號或頓號', /[,、]/.test(cs))
ok('中文不含拉丁字母', !/[A-Za-z]/.test(cs))

// --- 中文:段 ---
const cp = generate({ lang: 'cjk', unit: 'paragraphs', count: 2, seed: 8 })
ok('中文 2 段以空行分隔', cp.split('\n\n').length === 2)
ok('中文每段以句末標點結尾', cp.split('\n\n').every((para) => /[。!?]$/.test(para)))

// --- 邊界 ---
ok('count 0 視為至少 1', generate({ unit: 'paragraphs', count: 0, seed: 1 }).split('\n\n').length === 1)
ok('count 超過 200 夾住', generate({ unit: 'words', count: 9999, lang: 'cjk', seed: 1 }).length === 200)
ok('預設 lang 為 latin', DEFAULT_OPTIONS.lang === 'latin')
ok('預設 unit 為 paragraphs', DEFAULT_OPTIONS.unit === 'paragraphs')
ok('預設不丟例外', typeof generate() === 'string' && generate().length > 0)

if (fail) {
  console.error(`\n${fail} 筆測試失敗`)
  process.exit(1)
}
console.log('\n全部通過')
