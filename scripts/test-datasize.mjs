/*
  資料大小與傳輸時間引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-datasize.mjs
  oracle 以 SI(1000 冪)/ IEC(1024 冪)定義與 1 byte = 8 bit 手算為準。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `datasize-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/dataSize.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { unitBytes, toBytes, breakdown, humanize, transferSeconds, humanDuration, round } =
  await import('file://' + out)

let fail = 0
function eq(note, got, want) {
  const g = JSON.stringify(got)
  const w = JSON.stringify(want)
  if (g !== w) {
    console.error(`✗ ${note}\n   got:  ${g}\n   want: ${w}`)
    fail++
  } else {
    console.log(`✓ ${note}`)
  }
}

// unitBytes
eq('kB = 1000', unitBytes('kB'), 1000)
eq('MB = 1e6', unitBytes('MB'), 1e6)
eq('KiB = 1024', unitBytes('KiB'), 1024)
eq('MiB = 1024^2', unitBytes('MiB'), 1048576)
eq('GiB = 1024^3', unitBytes('GiB'), 1073741824)
eq('bit = 1/8', unitBytes('bit'), 0.125)
eq('byte = 1', unitBytes('byte'), 1)
eq('未知單位 NaN', Number.isNaN(unitBytes('xx')), true)

// toBytes
eq('1 MB = 1e6 B', toBytes(1, 'MB'), 1e6)
eq('1 MiB = 1048576 B', toBytes(1, 'MiB'), 1048576)
eq('8 bit = 1 B', toBytes(8, 'bit'), 1)
eq('非法單位 NaN', Number.isNaN(toBytes(1, 'zz')), true)

// breakdown:1 TB(SI)→ 系統顯示約 0.909 TiB
const b = breakdown(1e12)
eq('1e12 bytes', b.bytes, 1e12)
eq('1e12 bits', b.bits, 8e12)
eq('1e12 → 1000 GB', b.si.find((u) => u.unit === 'GB').value, 1000)
eq('1e12 → 0.909 TiB(硬碟標 1TB 系統顯示)', round(b.iec.find((u) => u.unit === 'TiB').value, 3), 0.909)

// humanize
eq('1500 → 1.5 kB(SI)', humanize(1500, 'si'), '1.5 kB')
eq('1536 → 1.5 KiB(IEC)', humanize(1536, 'iec'), '1.5 KiB')
eq('0 → 0 B', humanize(0), '0 B')
eq('999 → 999 B', humanize(999, 'si'), '999 B')
eq('1024 → 1 KiB', humanize(1024, 'iec'), '1 KiB')
eq('1e9 → 1 GB', humanize(1e9, 'si'), '1 GB')
eq('負值', humanize(-2000, 'si'), '-2 kB')

// transferSeconds:1 GB(SI=1e9 bytes)在 100 Mbps → 80 秒
eq('1GB @100Mbps = 80s', transferSeconds(1e9, 100, 'Mbps'), 80)
eq('100Mbps 實際約 12.5 MB/s:100MB @100Mbps', round(transferSeconds(1e8, 100, 'Mbps'), 1), 8)
eq('MBps 單位:8MB @1MBps = 8s', transferSeconds(8e6, 1, 'MBps'), 8)
eq('速度 0 → NaN', Number.isNaN(transferSeconds(1e6, 0, 'Mbps')), true)
eq('size 負 → NaN', Number.isNaN(transferSeconds(-1, 100, 'Mbps')), true)

// humanDuration
eq('0.25s → 250 毫秒', humanDuration(0.25), '250 毫秒')
eq('5.5s → 5.5 秒', humanDuration(5.5), '5.5 秒')
eq('80s → 1 分 20 秒', humanDuration(80), '1 分 20 秒')
eq('3661s → 1 小時 1 分 1 秒', humanDuration(3661), '1 小時 1 分 1 秒')
eq('3600s → 1 小時', humanDuration(3600), '1 小時')
eq('NaN → —', humanDuration(NaN), '—')

if (fail) {
  console.error(`\n${fail} 個測試失敗`)
  process.exit(1)
}
console.log('\n全部通過 ✓')
