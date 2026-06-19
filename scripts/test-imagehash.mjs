/*
  感知雜湊(imageHash)引擎回歸測試。執行:node scripts/test-imagehash.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `imagehash-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/imageHash.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { toGray, dHash, hamming, bitsToHex, clusterByHash, HASH_W, HASH_H } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (!cond) {
    fail++
    console.error('❌', note)
  } else {
    console.log('✓', note)
  }
}

// --- toGray ---
check('toGray 白色 ≈255', Math.round(toGray([255, 255, 255, 255])[0]) === 255)
check('toGray 黑色 = 0', toGray([0, 0, 0, 255])[0] === 0)
check('toGray 多像素長度', toGray([0, 0, 0, 255, 255, 255, 255, 255]).length === 2)

// --- dHash 基本 ---
const W = HASH_W,
  H = HASH_H
// 水平遞增漸層:每列左<右 → 全部位元為 1
const ramp = []
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) ramp.push(x * 10)
const hRamp = dHash(ramp)
check('dHash 長度 = (W-1)*H = 64', hRamp.length === (W - 1) * H && hRamp.length === 64)
check('遞增漸層 → 全 1', hRamp.every((b) => b === 1))

// 遞減漸層 → 全 0
const desc = []
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) desc.push((W - x) * 10)
check('遞減漸層 → 全 0', dHash(desc).every((b) => b === 0))

// 全平 → 相鄰相等,因 < 為嚴格,故全 0
const flat = new Array(W * H).fill(128)
check('全平 → 全 0', dHash(flat).every((b) => b === 0))

// --- hamming ---
check('hamming 相同 = 0', hamming(hRamp, hRamp.slice()) === 0)
check('hamming 全反 = 64', hamming(new Array(64).fill(0), new Array(64).fill(1)) === 64)
check('hamming 一位差 = 1', (() => {
  const a = new Array(64).fill(0)
  const b = a.slice()
  b[5] = 1
  return hamming(a, b) === 1
})())

// --- bitsToHex ---
check('bitsToHex 全 0 = 0000…', bitsToHex(new Array(64).fill(0)) === '0'.repeat(16))
check('bitsToHex 全 1 = ffff…', bitsToHex(new Array(64).fill(1)) === 'f'.repeat(16))
check('bitsToHex 長度 16', bitsToHex(new Array(64).fill(0)).length === 16)

// --- clusterByHash ---
const A = new Array(64).fill(0)
const Anear = A.slice()
Anear[0] = 1
Anear[1] = 1 // 距 A = 2
const B = new Array(64).fill(1) // 距 A = 64
const items = [
  { id: 1, hash: A },
  { id: 2, hash: Anear },
  { id: 3, hash: B },
]
const g0 = clusterByHash(items, 0)
check('threshold 0:A 與 Anear 不同群', g0.length === 3)
const g5 = clusterByHash(items, 5)
check('threshold 5:A 與 Anear 同群、B 自成一群', (() => {
  const sizes = g5.map((g) => g.length).sort()
  return g5.length === 2 && sizes[0] === 1 && sizes[1] === 2
})())
check('clusterByHash 保留 id', clusterByHash(items, 5).flat().sort().join() === '1,2,3')

// --- 縮放穩定性模擬:同圖縮放後灰階接近 → 雜湊距離小 ---
// 用兩個僅些微差異的漸層代表「同張圖不同尺寸」
const ramp2 = ramp.map((v, i) => v + (i % 3 === 0 ? 1 : 0))
check('近似圖雜湊距離小', hamming(dHash(ramp), dHash(ramp2)) <= 2)

console.log(fail === 0 ? '\n全部通過 ✅' : `\n${fail} 筆失敗 ❌`)
process.exit(fail === 0 ? 0 : 1)
