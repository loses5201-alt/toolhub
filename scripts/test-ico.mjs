/*
  ICO 容器組裝的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-ico.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `ico-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/ico.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { buildIco } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// 假 PNG 位元組(長度不同,值可辨識)
const a = new Uint8Array(10).fill(0xaa)
const b = new Uint8Array(20).fill(0xbb)
const ico = buildIco([
  { size: 16, png: a },
  { size: 32, png: b },
])
const dv = new DataView(ico.buffer, ico.byteOffset, ico.byteLength)

check('reserved = 0', dv.getUint16(0, true) === 0)
check('type = 1(icon)', dv.getUint16(2, true) === 1)
check('count = 2', dv.getUint16(4, true) === 2)

const headerSize = 6 + 2 * 16
check('總長 = 標頭 + 兩張影像', ico.length === headerSize + 10 + 20)

// 第一筆 entry
check('entry0 寬 = 16', ico[6] === 16)
check('entry0 高 = 16', ico[7] === 16)
check('entry0 bitcount = 32', dv.getUint16(6 + 6, true) === 32)
check('entry0 bytesInRes = 10', dv.getUint32(6 + 8, true) === 10)
check('entry0 offset = headerSize', dv.getUint32(6 + 12, true) === headerSize)

// 第二筆 entry
check('entry1 寬 = 32', ico[6 + 16] === 32)
check('entry1 bytesInRes = 20', dv.getUint32(6 + 16 + 8, true) === 20)
check('entry1 offset = headerSize + 10', dv.getUint32(6 + 16 + 12, true) === headerSize + 10)

// 影像資料正確放置
check('影像 a 放在 offset', ico[headerSize] === 0xaa && ico[headerSize + 9] === 0xaa)
check('影像 b 接在 a 之後', ico[headerSize + 10] === 0xbb && ico[headerSize + 29] === 0xbb)

// 256 尺寸以 0 表示
const big = buildIco([{ size: 256, png: a }])
check('256 尺寸寬度欄位寫 0', big[6] === 0 && big[7] === 0)

if (fail) {
  console.error(`\n${fail} 筆測試失敗`)
  process.exit(1)
} else {
  console.log('\n全部通過')
}
