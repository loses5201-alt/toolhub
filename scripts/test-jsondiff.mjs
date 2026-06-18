/*
  JSON 結構比對引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-jsondiff.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `jsondiff-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/jsonDiff.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { diffValues, compareJSON, preview } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}
// 找路徑對應變更的輔助
function find(changes, path) {
  return changes.find((c) => c.path === path)
}

// --- 相同 → 無差異 ---
check('完全相同→無差異', diffValues({ a: 1 }, { a: 1 }).length === 0)
check('鍵順序不同仍相同', diffValues({ a: 1, b: 2 }, { b: 2, a: 1 }).length === 0)
check('巢狀相同', diffValues({ a: { b: [1, 2] } }, { a: { b: [1, 2] } }).length === 0)

// --- 基本值變更 ---
const d1 = diffValues({ a: 1, b: 2 }, { a: 1, b: 3 })
check('一個值變更', d1.length === 1 && d1[0].kind === 'changed' && d1[0].path === 'b')
check('變更含前後值', d1[0].before === 2 && d1[0].after === 3)

// --- 新增 / 刪除鍵 ---
const d2 = diffValues({ a: 1 }, { a: 1, c: 9 })
check('新增鍵', find(d2, 'c')?.kind === 'added' && find(d2, 'c')?.after === 9)
const d3 = diffValues({ a: 1, c: 9 }, { a: 1 })
check('刪除鍵', find(d3, 'c')?.kind === 'removed' && find(d3, 'c')?.before === 9)

// --- 巢狀路徑 ---
const d4 = diffValues({ user: { name: 'A', age: 10 } }, { user: { name: 'B', age: 10 } })
check('巢狀路徑點記法', find(d4, 'user.name')?.kind === 'changed')
check('巢狀其他鍵不報', d4.length === 1)

// --- 陣列依索引 ---
const d5 = diffValues([1, 2, 3], [1, 9, 3])
check('陣列索引變更', find(d5, '[1]')?.kind === 'changed' && find(d5, '[1]').after === 9)
const d6 = diffValues([1, 2], [1, 2, 3])
check('陣列變長→新增', find(d6, '[2]')?.kind === 'added' && find(d6, '[2]').after === 3)
const d7 = diffValues([1, 2, 3], [1, 2])
check('陣列變短→刪除', find(d7, '[2]')?.kind === 'removed' && find(d7, '[2]').before === 3)
const d8 = diffValues({ tags: ['x', 'y'] }, { tags: ['x', 'z'] })
check('物件內陣列路徑', find(d8, 'tags[1]')?.kind === 'changed')

// --- 型別變更 ---
const d9 = diffValues({ a: 1 }, { a: '1' })
check('數字變字串→changed', find(d9, 'a')?.kind === 'changed' && find(d9, 'a').after === '1')
const d10 = diffValues({ a: { x: 1 } }, { a: [1] })
check('物件變陣列→changed', find(d10, 'a')?.kind === 'changed')
const d11 = diffValues({ a: null }, { a: 0 })
check('null 變 0→changed', find(d11, 'a')?.kind === 'changed')
check('null 與 null 相同', diffValues({ a: null }, { a: null }).length === 0)

// --- 含特殊字元的鍵 ---
const d12 = diffValues({ 'a-b': 1 }, { 'a-b': 2 })
check('特殊字元鍵用方括號', d12[0].path === '["a-b"]')
const d13 = diffValues({ 中文: 1 }, { 中文: 2 })
check('中文鍵用點記法', d13[0].path === '中文')

// --- 根層級型別變更 ---
const d14 = diffValues(1, 2)
check('根層級變更路徑為(根)', d14[0].path === '(根)' && d14[0].kind === 'changed')

// --- compareJSON 整合 ---
const c1 = compareJSON('{"a":1,"b":2}', '{"a":1,"b":3,"c":4}')
check('compareJSON 成功', c1.ok === true)
check('摘要計數', c1.summary.changed === 1 && c1.summary.added === 1 && c1.summary.removed === 0)
const c2 = compareJSON('{bad', '{}')
check('左側解析失敗', c2.ok === false && c2.errorSide === 'left')
const c3 = compareJSON('{}', 'oops')
check('右側解析失敗', c3.ok === false && c3.errorSide === 'right')
const c4 = compareJSON('{"a":1}', '{"a":1}')
check('相同→空變更清單', c4.ok && c4.changes.length === 0)

// --- preview ---
check('preview 字串加引號', preview('hi') === '"hi"')
check('preview 數字', preview(42) === '42')
check('preview null', preview(null) === 'null')
check('preview 截斷', preview('x'.repeat(200)).endsWith('…'))
check('preview 物件', preview({ a: 1 }) === '{"a":1}')

console.log(fail === 0 ? `\n全部通過` : `\n${fail} 筆失敗`)
process.exit(fail === 0 ? 0 : 1)
