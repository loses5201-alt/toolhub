/*
  批次 QR Code 引擎回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-qrbatch.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `qrbatch-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/qrBatch.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { parseEntries, safeName, planSheet } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// --- parseEntries 無標籤 ---
const a = parseEntries('https://a.com\n https://b.com \n\n\nc', false)
check('parse 略過空行', a.length === 3)
check('parse 去頭尾空白', a[1].content === 'https://b.com')
check('parse 無標籤時 label 空', a.every((e) => e.label === ''))

// --- parseEntries 有標籤 ---
const b = parseEntries('桌1,https://a.com\n桌2\thttps://b.com\n整行內容無分隔', true)
check('parse 逗號分隔取標籤', b[0].label === '桌1' && b[0].content === 'https://a.com')
check('parse Tab 分隔取標籤', b[1].label === '桌2' && b[1].content === 'https://b.com')
check('parse 無分隔整行當內容', b[2].label === '' && b[2].content === '整行內容無分隔')
// 只有標籤、分隔後內容空 → 標籤轉為內容
const c = parseEntries('只有這個,', true)
check('parse 分隔後內容空則標籤當內容', c[0].content === '只有這個' && c[0].label === '')
// 只取第一個分隔符,內容裡的逗號保留
const d = parseEntries('標籤,a,b,c', true)
check('parse 只切第一個分隔符', d[0].label === '標籤' && d[0].content === 'a,b,c')

// --- safeName ---
check('safeName 去路徑字元', safeName('a/b:c*d?') === 'a_b_c_d')
check('safeName 空白轉底線', safeName('hello world') === 'hello_world')
check('safeName 去前後點', safeName('..名稱..') === '名稱')
check('safeName 空字串回 fallback', safeName('') === 'qr')
check('safeName 自訂 fallback', safeName('   ', 'X') === 'X')
check('safeName 保留中文', safeName('桌號1') === '桌號1')
check('safeName 夾長度 60', safeName('字'.repeat(200)).length === 60)

// --- planSheet ---
const A4 = { cols: 2, rows: 3, pageW: 595, pageH: 842, margin: 40, gap: 10 }
const cells = planSheet(7, A4)
check('planSheet 數量 = total', cells.length === 7)
check('planSheet 每頁 6 格,第 7 筆換頁', cells[5].page === 0 && cells[6].page === 1)
check('planSheet 第 7 筆回到左上格', cells[6].x === cells[0].x && cells[6].y === cells[0].y)
check('planSheet 格子寬高為正', cells[0].w > 0 && cells[0].h > 0)
// 第 0 格在左上、第 1 格在右上(同列不同欄)
check('planSheet 第二格在右側同列', cells[1].x > cells[0].x && cells[1].y === cells[0].y)
check('planSheet 第三格換到下一列', cells[2].y > cells[0].y && cells[2].x === cells[0].x)
// 不超出頁面右/下邊界
const maxRight = Math.max(...cells.map((c) => c.x + c.w))
const maxBottom = Math.max(...cells.map((c) => c.y + c.h))
check('planSheet 不超出右邊界', maxRight <= A4.pageW - A4.margin + 0.001)
check('planSheet 不超出下邊界', maxBottom <= A4.pageH - A4.margin + 0.001)
// 寬度計算正確:2 欄,usableW=(595-80-10)=505,每格 252.5
check('planSheet 格寬計算正確', Math.abs(cells[0].w - (595 - 80 - 10) / 2) < 0.001)

check('planSheet total 0 回空', planSheet(0, A4).length === 0)

let threw = false
try {
  planSheet(4, { ...A4, cols: 0 })
} catch {
  threw = true
}
check('planSheet 欄數 0 報錯', threw)

threw = false
try {
  planSheet(4, { ...A4, margin: 400 })
} catch {
  threw = true
}
check('planSheet 邊界過大報錯', threw)

if (fail) {
  console.error(`\n${fail} 項失敗`)
  process.exit(1)
}
console.log('\n全部通過')
