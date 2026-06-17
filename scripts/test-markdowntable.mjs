/*
  Markdown 表格引擎回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-markdowntable.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `mdtable-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/markdownTable.ts', 'src/features/tableClean.ts'],
  bundle: true,
  format: 'esm',
  outdir: out,
  logLevel: 'silent',
})
const { tableToMarkdown, markdownToTable } = await import('file://' + join(out, 'markdownTable.js'))
const { parseTable } = await import('file://' + join(out, 'tableClean.js'))

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// --- 表格 → Markdown ---
const t = parseTable('a,b\n1,2\n3,4', {})
const md = tableToMarkdown(t)
const ml = md.split('\n')
check('MD 行數 = 表頭+分隔+2 列', ml.length === 4)
check('MD 表頭含欄名', ml[0].includes('a') && ml[0].includes('b'))
check('MD 第二行是分隔列', /^\|[\s:-]+\|[\s:-]+\|$/.test(ml[1]))
check('MD 外框 |', ml[0].startsWith('|') && ml[0].endsWith('|'))
check('MD 內容列', ml[2].includes('1') && ml[2].includes('2'))

// --- 逸出 | 與換行 ---
const esc = tableToMarkdown(parseTable('h\n"a|b"', {}))
check('儲存格內 | 逸出成 \\|', esc.includes('a\\|b'))
const nl = tableToMarkdown(parseTable('h\n"a\nb"', {}))
check('儲存格內換行 → 空白', nl.includes('a b') && !nl.includes('a\nb\n'))

// --- 對齊 ---
const al = tableToMarkdown(parseTable('x,y,z\n1,2,3', {}), ['left', 'center', 'right'])
const sep = al.split('\n')[1]
check('置中對齊 :---:', /:-+:/.test(sep))
check('靠右對齊 --:', /[^:]-+:/.test(sep))

// --- Markdown → 表格 ---
const r1 = markdownToTable('| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |')
check('解析 ok', r1.ok)
check('解析表頭', r1.table.headers.join(',') === 'a,b')
check('解析列數', r1.table.rows.length === 2)
check('解析內容', r1.table.rows[1].join(',') === '3,4')

// --- 無外框 | 也能解析 ---
const r2 = markdownToTable('a | b\n--- | ---\n1 | 2')
check('無外框管線可解析', r2.ok && r2.table.rows[0].join(',') === '1,2')

// --- 對齊偵測 ---
const r3 = markdownToTable('| x | y | z |\n|:--|:-:|--:|\n|1|2|3|')
check('偵測對齊 left/center/right', r3.aligns.join(',') === 'left,center,right')

// --- 逸出還原 ---
const r4 = markdownToTable('| h |\n|---|\n| a\\|b |')
check('解析還原 \\| → |', r4.table.rows[0][0] === 'a|b')

// --- 補齊/裁切欄數 ---
const r5 = markdownToTable('| a | b | c |\n|---|---|---|\n| 1 | 2 |\n| 1 | 2 | 3 | 4 |')
check('短列補空', r5.table.rows[0].length === 3 && r5.table.rows[0][2] === '')
check('長列裁切', r5.table.rows[1].length === 3)

// --- 找不到分隔列報錯 ---
check('無分隔列報錯', markdownToTable('a | b\n1 | 2').ok === false)
check('只有一行報錯', markdownToTable('| a |').ok === false)

// --- 往返一致(CSV → MD → 解析回) ---
const round = markdownToTable(tableToMarkdown(parseTable('名稱,數量\n蘋果,3\n香蕉,5', {})))
check('往返:表頭', round.table.headers.join(',') === '名稱,數量')
check('往返:內容(含中文對齊)', round.table.rows[0].join(',') === '蘋果,3' && round.table.rows[1].join(',') === '香蕉,5')

console.log(fail === 0 ? '\n全部通過 ✅' : `\n${fail} 筆失敗 ❌`)
process.exit(fail === 0 ? 0 : 1)
