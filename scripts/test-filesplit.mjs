/*
  檔案分割 / 合併引擎的回歸測試(無需測試框架,node 直接跑)。
  引擎無三方相依,用 esbuild 把 TS 轉成 ESM 再 import。
  執行:node scripts/test-filesplit.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `filesplit-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/fileSplit.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
  logLevel: 'silent',
})
const {
  planChunks,
  partName,
  padWidth,
  partIndexOf,
  baseNameOf,
  orderParts,
  joinBytes,
  fmtSize,
  MAX_PARTS,
} = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}
function bytesEqual(a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

// ── 切點規劃 ──
const p1 = planChunks(1000, 300)
check('1000/300 切成 4 份', p1.length === 4)
check('最後一份大小為餘數 100', p1[3].size === 100)
check('各份相加等於總大小', p1.reduce((n, c) => n + c.size, 0) === 1000)
check('切點連續無縫(start === 前一份 end)', p1[1].start === p1[0].end && p1[2].start === p1[1].end)
check('第一份 start 為 0、index 為 1', p1[0].start === 0 && p1[0].index === 1)
check('末份 end 等於總大小', p1[p1.length - 1].end === 1000)

const p2 = planChunks(900, 300)
check('整除時 900/300 = 3 份且每份等大', p2.length === 3 && p2.every((c) => c.size === 300))

const p3 = planChunks(100, 999999)
check('每份比檔案大 → 單一份', p3.length === 1 && p3[0].size === 100)

let threw = false
try {
  planChunks(0, 100)
} catch {
  threw = true
}
check('總大小 0 丟錯', threw)

threw = false
try {
  planChunks(100, 0)
} catch {
  threw = true
}
check('每份大小 0 丟錯', threw)

threw = false
try {
  planChunks(MAX_PARTS * 10 + 10, 10) // 1000 份,超過上限
} catch (e) {
  threw = /上限/.test(e.message)
}
check('超過份數上限丟出可讀錯誤', threw)

// ── 命名與補零 ──
check('padWidth 預設 3 碼', padWidth(4) === 3 && padWidth(999) === 3)
check('padWidth 超過 999 自動加寬', padWidth(1000) === 4)
check('partName 零補齊三碼', partName('report.pdf', 1, 4) === 'report.pdf.001')
check('partName 第 12 份', partName('a.zip', 12, 50) === 'a.zip.012')
check('partName 份數破千用四碼', partName('big.iso', 7, 1200) === 'big.iso.0007')

// ── 序號解析 / 還原原名 ──
check('partIndexOf 取出序號', partIndexOf('report.pdf.003') === 3)
check('partIndexOf 非分割檔回 null', partIndexOf('report.pdf') === null)
check('partIndexOf 單碼不算(避免誤判副檔名)', partIndexOf('photo.1') === null)
check('baseNameOf 還原原始檔名', baseNameOf('report.pdf.003') === 'report.pdf')
check('baseNameOf 無序號維持原樣', baseNameOf('report.pdf') === 'report.pdf')

// ── 排序與序列檢查 ──
const shuffled = [{ n: 'f.001' }, { n: 'f.003' }, { n: 'f.002' }]
const r1 = orderParts(shuffled, (x) => x.n)
check('orderParts 依序號排好', r1.ordered.map((x) => x.n).join(',') === 'f.001,f.002,f.003')
check('完整序列無缺漏', r1.hasIndex && r1.missing.length === 0 && r1.duplicates.length === 0)

const gap = [{ n: 'f.001' }, { n: 'f.004' }, { n: 'f.002' }]
const r2 = orderParts(gap, (x) => x.n)
check('偵測缺少的序號 3', r2.missing.length === 1 && r2.missing[0] === 3)

const dup = [{ n: 'f.001' }, { n: 'f.002' }, { n: 'f.002' }]
const r3 = orderParts(dup, (x) => x.n)
check('偵測重複序號 2', r3.duplicates.includes(2))

const noidx = [{ n: 'a.bin' }, { n: 'b.bin' }]
const r4 = orderParts(noidx, (x) => x.n)
check('全無序號時維持原順序', !r4.hasIndex && r4.ordered[0].n === 'a.bin')

// ── 分割 → 合併 來回位元組一致(關鍵正確性)──
const data = new Uint8Array(1000)
for (let i = 0; i < data.length; i++) data[i] = (i * 7 + 3) & 0xff // 含 0 與 255 的可重現資料
const plan = planChunks(data.length, 256)
const slices = plan.map((c) => data.slice(c.start, c.end))
check('來回:slice 份數正確', slices.length === 4)
const rejoined = joinBytes(slices)
check('來回:合併後位元組與原檔完全一致', bytesEqual(rejoined, data))

// 含中文/二進位的混合資料來回
const mixed = new TextEncoder().encode('你好 hello\n')
const plan2 = planChunks(mixed.length, 3)
const slices2 = plan2.map((c) => mixed.slice(c.start, c.end))
check('來回:小切片(3B)中文資料一致', bytesEqual(joinBytes(slices2), mixed))

// ── 大小格式化 ──
check('fmtSize 位元組', fmtSize(512) === '512 B')
check('fmtSize MB', fmtSize(20 * 1024 * 1024) === '20.0 MB')
check('fmtSize 小數', fmtSize(1536) === '1.50 KB')

console.log(fail === 0 ? '\n全部通過 ✅' : `\n${fail} 項失敗 ❌`)
process.exit(fail === 0 ? 0 : 1)
