/*
  等寬純文字表格(textTable)引擎回歸測試。執行:node scripts/test-texttable.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `texttable-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/textTable.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { displayWidth, parseDelimited, toTextTable } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (!cond) {
    fail++
    console.error('❌', note)
  } else {
    console.log('✓', note)
  }
}

// --- displayWidth ---
check('ASCII 寬度 = 長度', displayWidth('abc') === 3)
check('CJK 全形 = 2', displayWidth('中') === 2 && displayWidth('中文') === 4)
check('混合寬度', displayWidth('a中b') === 4)

// --- parseDelimited ---
check('CSV 基本', (() => {
  const r = parseDelimited('a,b\n1,2')
  return r.length === 2 && r[0].join() === 'a,b' && r[1].join() === '1,2'
})())
check('CSV 引號含逗號', (() => {
  const r = parseDelimited('"a,b",c')
  return r[0][0] === 'a,b' && r[0][1] === 'c'
})())
check('CSV 引號內換行', (() => {
  const r = parseDelimited('"line1\nline2",x')
  return r.length === 1 && r[0][0] === 'line1\nline2'
})())
check('CSV 跳脫雙引號', parseDelimited('"a""b"')[0][0] === 'a"b')
check('TSV 自動偵測', (() => {
  const r = parseDelimited('a\tb\n1\t2')
  return r[0].join() === 'a,b' && r[1].join() === '1,2'
})())
check('結尾換行不產生空列', parseDelimited('a,b\n1,2\n').length === 2)

// --- toTextTable: grid ---
const grid = toTextTable([['a', 'bb'], ['1', '2']], { style: 'grid' })
check('grid 含邊框字元', grid.includes('┌') && grid.includes('┼') && grid.includes('└'))
check('grid 表頭分隔線', grid.split('\n')[2].startsWith('├'))
check('grid 每行等長(等寬對齊)', (() => {
  const lines = grid.split('\n')
  const w = displayWidth(lines[0])
  return lines.every((l) => displayWidth(l) === w)
})())

// --- ascii ---
const ascii = toTextTable([['a', 'b'], ['1', '2']], { style: 'ascii' })
check('ascii 用 +-|', ascii.includes('+') && ascii.includes('|') && ascii.includes('-') && !ascii.includes('┌'))

// --- simple ---
const simple = toTextTable([['name', 'age'], ['Bob', '25']], { style: 'simple' })
check('simple 有表頭虛線', simple.split('\n')[1].includes('----'))
check('simple 無邊框直線', !simple.includes('|') && !simple.includes('│'))

// --- 數字欄右對齊 ---
const num = toTextTable([['item', 'qty'], ['a', '5'], ['bb', '100']], { style: 'simple', rightNumeric: true })
check('數字欄右對齊(個位對齊)', (() => {
  const lines = num.split('\n')
  // qty 欄寬 3:'5' 應右對齊成 '  5'
  return lines[2].endsWith('  5') && lines[3].endsWith('100')
})())
check('關閉右對齊則左對齊', (() => {
  const left = toTextTable([['item', 'qty'], ['a', '5']], { style: 'simple', rightNumeric: false }).split('\n')[2]
  const right = toTextTable([['item', 'qty'], ['a', '5']], { style: 'simple', rightNumeric: true }).split('\n')[2]
  // 左對齊:'5' 緊接欄首;右對齊:'5' 被推到欄尾,兩者應不同
  return left !== right && left === 'a     5'
})())

// --- CJK 對齊 ---
const cjk = toTextTable([['品名', '數量'], ['蘋果', '3']], { style: 'grid' })
check('CJK grid 每行等寬', (() => {
  const lines = cjk.split('\n')
  const w = displayWidth(lines[0])
  return lines.every((l) => displayWidth(l) === w)
})())

// --- 短列補齊 ---
const ragged = toTextTable([['a', 'b', 'c'], ['1']], { style: 'ascii', header: false })
check('短列自動補空欄', (() => {
  const lines = ragged.split('\n')
  const w = displayWidth(lines[0])
  return lines.every((l) => displayWidth(l) === w)
})())

// --- 無表頭 ---
const nohdr = toTextTable([['a', 'b'], ['1', '2']], { style: 'grid', header: false })
check('無表頭不含中間分隔線', !nohdr.includes('├'))

// --- 空輸入 ---
check('空輸入回空字串', toTextTable([]) === '')

console.log(fail === 0 ? '\n全部通過 ✅' : `\n${fail} 筆失敗 ❌`)
process.exit(fail === 0 ? 0 : 1)
