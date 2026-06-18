/*
  「照片壓到指定大小」核心邏輯回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-imagefit.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `imagefit-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/imageFit.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { fmtSize, fitScale, searchQuality } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// fmtSize
check('fmtSize B', fmtSize(500) === '500 B')
check('fmtSize 小 KB 一位小數', fmtSize(2048) === '2.0 KB')
check('fmtSize 大 KB 無小數', fmtSize(50 * 1024) === '50 KB')
check('fmtSize MB', fmtSize(3 * 1024 * 1024) === '3.00 MB')

// fitScale
check('fitScale 不縮(null)', fitScale(4000, 3000, null) === 1)
check('fitScale 不縮(0)', fitScale(4000, 3000, 0) === 1)
check('fitScale 已在範圍內', fitScale(800, 600, 1000) === 1)
check('fitScale 橫向縮放', Math.abs(fitScale(2000, 1000, 1000) - 0.5) < 1e-9)
check('fitScale 直向縮放', Math.abs(fitScale(1000, 4000, 1000) - 0.25) < 1e-9)

// 合成編碼器:大小隨品質線性遞增(size = q * k),單調遞增
function linearMeasure(k) {
  return (q) => q * k
}

// 達標:target 介於 minQ 與 maxQ 之間 → 找到最高達標品質
{
  const calls = []
  const measure = (q) => {
    calls.push(q)
    return q * 1000 // size = q KB-ish
  }
  // target = 50_000 → 達標品質 = 50(50*1000=50000 ≤ 50000)
  const r = await searchQuality(measure, 50000, { minQ: 20, maxQ: 95, iters: 12 })
  check('達標 underTarget=true', r.underTarget === true)
  check('達標 size ≤ target', r.size <= 50000)
  check('達標 找到最高品質 50', r.quality === 50)
}

// maxQ 就已達標 → 直接回 maxQ,且只量一次(效率)
{
  let count = 0
  const measure = (q) => {
    count++
    return q * 10 // 95*10=950,target 大
  }
  const r = await searchQuality(measure, 100000, { minQ: 20, maxQ: 95 })
  check('maxQ 達標回 maxQ', r.quality === 95 && r.underTarget === true)
  check('maxQ 達標只量一次', count === 1)
}

// 連 minQ 都超過 → underTarget=false,回 minQ
{
  const measure = (q) => q * 1000 + 1_000_000 // 永遠很大
  const r = await searchQuality(measure, 50000, { minQ: 20, maxQ: 95 })
  check('壓不下 underTarget=false', r.underTarget === false)
  check('壓不下回 minQ', r.quality === 20)
}

// 邊界:target 剛好等於某品質大小(≤ 視為達標)
{
  const measure = (q) => q * 1000
  const r = await searchQuality(measure, 60000, { minQ: 20, maxQ: 95, iters: 12 })
  check('邊界相等視為達標(quality=60)', r.quality === 60 && r.size === 60000)
}

// 搜尋結果一定不超過 target(達標時)、且是「最高」達標品質
{
  const measure = (q) => q * q * 5 // 非線性但仍單調遞增
  const target = 18000 // q*q*5 ≤ 18000 → q ≤ 60
  const r = await searchQuality(measure, target, { minQ: 10, maxQ: 95, iters: 14 })
  check('非線性 達標', r.underTarget && r.size <= target)
  check('非線性 最高達標品質≈60', r.quality === 60)
  // 比它高一階就會超過
  check('非線性 +1 會超標', measure(r.quality + 1) > target)
}

// 支援 async measure(回 Promise)
{
  const measure = async (q) => q * 1000
  const r = await searchQuality(measure, 50000, { minQ: 20, maxQ: 95, iters: 12 })
  check('async measure 正常運作', r.quality === 50 && r.underTarget)
}

console.log(fail === 0 ? '\nAll imagefit tests passed.' : `\n${fail} test(s) FAILED.`)
process.exit(fail === 0 ? 0 : 1)
