/*
  JSON ↔ 查詢字串引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-qsconvert.mjs
  oracle 以本工具定義的方括號表示法語意手算為準。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `qsconvert-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/qsConvert.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { queryToJson, jsonToQuery } = await import('file://' + out)

let fail = 0
function eq(note, got, want) {
  const g = JSON.stringify(got)
  const w = JSON.stringify(want)
  if (g !== w) {
    console.error(`✗ ${note}\n   got:  ${g}\n   want: ${w}`)
    fail++
  } else {
    console.log(`✓ ${note}`)
  }
}

// ── queryToJson ──
eq('扁平', queryToJson('a=1&b=2'), { a: '1', b: '2' })
eq('開頭問號', queryToJson('?a=1'), { a: '1' })
eq('空字串', queryToJson(''), {})
eq('無值', queryToJson('a&b='), { a: '', b: '' })
eq('巢狀物件', queryToJson('a[b]=1&a[c]=2'), { a: { b: '1', c: '2' } })
eq('陣列 push', queryToJson('a[]=1&a[]=2'), { a: ['1', '2'] })
eq('陣列索引', queryToJson('a[0]=x&a[1]=y'), { a: ['x', 'y'] })
eq('深巢狀陣列', queryToJson('a[b][]=1&a[b][]=2'), { a: { b: ['1', '2'] } })
eq('重複裸鍵→陣列', queryToJson('a=1&a=2&a=3'), { a: ['1', '2', '3'] })
eq('URL 解碼 + 與 %20', queryToJson('q=hello+world&n=%E4%B8%AD'), { q: 'hello world', n: '中' })
eq('值含等號', queryToJson('token=ab=cd'), { token: 'ab=cd' })
eq('編碼方括號鍵', queryToJson('a%5Bb%5D=1'), { a: { b: '1' } })
eq('混合', queryToJson('user[name]=Amy&user[tags][]=a&user[tags][]=b&page=2'), {
  user: { name: 'Amy', tags: ['a', 'b'] },
  page: '2',
})

// ── jsonToQuery ──
eq('扁平序列化', jsonToQuery({ a: '1', b: '2' }), 'a=1&b=2')
eq('巢狀物件序列化', jsonToQuery({ a: { b: '1', c: '2' } }), 'a[b]=1&a[c]=2')
eq('陣列 brackets(預設)', jsonToQuery({ a: ['1', '2'] }), 'a[]=1&a[]=2')
eq('陣列 indices', jsonToQuery({ a: ['x', 'y'] }, 'indices'), 'a[0]=x&a[1]=y')
eq('陣列 repeat', jsonToQuery({ a: ['1', '2'] }, 'repeat'), 'a=1&a=2')
eq('陣列 comma', jsonToQuery({ a: ['1', '2', '3'] }, 'comma'), 'a=1%2C2%2C3')
eq('數字與布林', jsonToQuery({ n: 5, ok: true }), 'n=5&ok=true')
eq('null → 空值', jsonToQuery({ a: null }), 'a=')
eq('值需編碼', jsonToQuery({ q: 'hello world', x: 'a&b' }), 'q=hello%20world&x=a%26b')
eq('深巢狀', jsonToQuery({ a: { b: ['1'] } }), 'a[b][]=1')
eq('非物件回空字串', jsonToQuery([1, 2]), '')
eq('字串回空字串', jsonToQuery('abc'), '')

// ── 往返(round-trip)──
const obj = { user: { name: 'Amy', tags: ['a', 'b'] }, page: '2' }
eq('round-trip 物件→字串→物件', queryToJson(jsonToQuery(obj)), obj)
const flat = { a: '1', b: 'x y', c: '中文' }
eq('round-trip 含編碼', queryToJson(jsonToQuery(flat)), flat)

if (fail) {
  console.error(`\n${fail} 個測試失敗`)
  process.exit(1)
}
console.log('\n全部通過 ✓')
