/*
  Unified diff 產生引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-unifieddiff.mjs
  oracle:依 unified diff 格式與 Python difflib 規則手算 @@ 區塊與 range。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `udiff-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/unifiedDiff.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { unifiedDiff } = await import('file://' + out)

let fail = 0
function eq(note, got, want) {
  if (got === want) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}\n   got : ${JSON.stringify(got)}\n   want: ${JSON.stringify(want)}`)
  }
}

// --- 完全相同 ---
const same = unifiedDiff('a\nb\nc', 'a\nb\nc')
eq('identical flag', same.identical, true)
eq('identical patch empty', same.patch, '')
eq('identical added', same.added, 0)
eq('identical removed', same.removed, 0)
eq('identical hunks', same.hunks, 0)

// --- 單行替換 ---
const r1 = unifiedDiff('line1\nline2\nline3', 'line1\nCHANGED\nline3')
eq(
  '替換 patch',
  r1.patch,
  ['--- original', '+++ modified', '@@ -1,3 +1,3 @@', ' line1', '-line2', '+CHANGED', ' line3', ''].join('\n'),
)
eq('替換 added', r1.added, 1)
eq('替換 removed', r1.removed, 1)
eq('替換 hunks', r1.hunks, 1)

// --- 結尾新增 ---
const ins = unifiedDiff('a\nb', 'a\nb\nc')
eq(
  '新增 patch',
  ins.patch,
  ['--- original', '+++ modified', '@@ -1,2 +1,3 @@', ' a', ' b', '+c', ''].join('\n'),
)
eq('新增 added', ins.added, 1)
eq('新增 removed', ins.removed, 0)

// --- 刪除 ---
const del = unifiedDiff('a\nb\nc', 'a\nc')
eq(
  '刪除 patch',
  del.patch,
  ['--- original', '+++ modified', '@@ -1,3 +1,2 @@', ' a', '-b', ' c', ''].join('\n'),
)
eq('刪除 removed', del.removed, 1)
eq('刪除 added', del.added, 0)

// --- 兩處變更 → 兩個區塊(中間 equal 行數 > context*2) ---
const old2 = 'X\n2\n3\n4\n5\n6\n7\n8\n9\nY'
const new2 = 'A\n2\n3\n4\n5\n6\n7\n8\n9\nB'
const r2 = unifiedDiff(old2, new2)
eq('兩區塊 hunks', r2.hunks, 2)
eq('兩區塊 added', r2.added, 2)
eq('兩區塊 removed', r2.removed, 2)
eq(
  '兩區塊 patch',
  r2.patch,
  [
    '--- original',
    '+++ modified',
    '@@ -1,4 +1,4 @@',
    '-X',
    '+A',
    ' 2',
    ' 3',
    ' 4',
    '@@ -7,4 +7,4 @@',
    ' 7',
    ' 8',
    ' 9',
    '-Y',
    '+B',
    '',
  ].join('\n'),
)

// --- context = 1 收窄上下文 ---
const rc = unifiedDiff('1\n2\n3\n4\n5', '1\n2\nX\n4\n5', { context: 1 })
eq(
  'context=1 patch',
  rc.patch,
  ['--- original', '+++ modified', '@@ -2,3 +2,3 @@', ' 2', '-3', '+X', ' 4', ''].join('\n'),
)

// --- 自訂檔名 ---
const named = unifiedDiff('a', 'b', { oldName: 'a/foo.txt', newName: 'b/foo.txt' })
eq('自訂檔名首行', named.patch.split('\n')[0], '--- a/foo.txt')
eq('自訂檔名次行', named.patch.split('\n')[1], '+++ b/foo.txt')

// --- ignoreCase ---
const ic = unifiedDiff('Hello\nWorld', 'hello\nWORLD', { ignoreCase: true })
eq('忽略大小寫 → 相同', ic.identical, true)
const icOff = unifiedDiff('Hello', 'hello')
eq('不忽略大小寫 → 有差異', icOff.identical, false)

// --- ignoreTrailingSpace ---
const ts = unifiedDiff('foo  \nbar', 'foo\nbar', { ignoreTrailingSpace: true })
eq('忽略行尾空白 → 相同', ts.identical, true)

// --- 從空到有內容 ---
const fromEmpty = unifiedDiff('', 'new line')
eq('空→有內容 added', fromEmpty.added, 1)
eq('空→有內容 removed', fromEmpty.removed, 1) // '' 視為一行空字串被替換

// --- 全部新增(原本空白多行) ---
const grow = unifiedDiff('', 'a\nb\nc')
eq('grow identical false', grow.identical, false)
eq('grow has @@', grow.patch.includes('@@'), true)

if (fail) {
  console.error(`\n${fail} 筆失敗`)
  process.exit(1)
}
console.log('\n全部通過 ✅')
