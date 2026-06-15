/*
  文字差異比對引擎的回歸測試(無需測試框架,node 直接跑)。
  用 esbuild 即時把 TS 轉成 ESM 再 import,斷言行/詞層級結果。
  執行:node scripts/test-textdiff.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `textdiff-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/textDiff.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { diffText } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) {
    console.log(`✓ ${note}`)
  } else {
    fail++
    console.log(`✗ ${note}`)
  }
}

// 1. 完全相同 → 沒有增刪
{
  const r = diffText('a\nb\nc', 'a\nb\nc')
  check('相同文字:無增刪', r.added === 0 && r.removed === 0 && r.unchanged === 3)
}

// 2. 中間新增一行
{
  const r = diffText('a\nc', 'a\nb\nc')
  check('新增一行:+1 −0', r.added === 1 && r.removed === 0 && r.unchanged === 2)
}

// 3. 刪除一行
{
  const r = diffText('a\nb\nc', 'a\nc')
  check('刪除一行:+0 −1', r.added === 0 && r.removed === 1 && r.unchanged === 2)
}

// 4. 一刪一增配對 → 行內詞差異:只標出改動的字
{
  const r = diffText('價格是 100 元', '價格是 200 元')
  const del = r.lines.find((l) => l.op === '-')
  const add = r.lines.find((l) => l.op === '+')
  const delChanged = del.tokens.filter((t) => t.op === '-').map((t) => t.text).join('')
  const addChanged = add.tokens.filter((t) => t.op === '+').map((t) => t.text).join('')
  check('行內詞差異:刪除標出 100', delChanged === '100')
  check('行內詞差異:新增標出 200', addChanged === '200')
  check('行內詞差異:共用字不被標', del.tokens.some((t) => t.op === '=' && t.text.includes('價')))
}

// 5. 忽略大小寫:Hello vs hello 視為相同
{
  const r1 = diffText('Hello', 'hello')
  check('預設區分大小寫:有增刪', r1.added === 1 && r1.removed === 1)
  const r2 = diffText('Hello', 'hello', { ignoreCase: true })
  check('忽略大小寫:視為相同', r2.added === 0 && r2.removed === 0 && r2.unchanged === 1)
}

// 6. 忽略空白:多餘空白不算差異
{
  const r1 = diffText('a  b', 'a b')
  check('預設計較空白:有增刪', r1.added === 1 && r1.removed === 1)
  const r2 = diffText('a  b', 'a b', { ignoreWhitespace: true })
  check('忽略空白:視為相同', r2.added === 0 && r2.removed === 0)
}

// 7. 行號正確(刪除行只有 oldNo,新增行只有 newNo)
{
  const r = diffText('x\ny', 'x\nz')
  const del = r.lines.find((l) => l.op === '-')
  const add = r.lines.find((l) => l.op === '+')
  check('刪除行 newNo 為 null', del.newNo === null && del.oldNo === 2)
  check('新增行 oldNo 為 null', add.oldNo === null && add.newNo === 2)
}

// 8. 空輸入不爆
{
  const r = diffText('', '')
  check('空對空不爆', r.added === 0 && r.removed === 0)
}

if (fail === 0) {
  console.log('\n全部通過 ✅')
} else {
  console.error(`\n${fail} 筆失敗 ❌`)
  process.exit(1)
}
