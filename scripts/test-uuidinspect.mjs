/*
  UUID 檢視引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-uuidinspect.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `uuidinspect-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/uuidInspect.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { normalizeUuid, formatCanonical, inspectUuid, v7TimePrefix } = await import('file://' + out)

let fail = 0
function eq(note, got, want) {
  if (got === want) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}\n   got : ${JSON.stringify(got)}\n   want: ${JSON.stringify(want)}`)
  }
}

// --- normalizeUuid ---
eq('標準格式', normalizeUuid('f47ac10b-58cc-4372-a567-0e02b2c3d479'), 'f47ac10b58cc4372a5670e02b2c3d479')
eq('大寫轉小寫', normalizeUuid('F47AC10B-58CC-4372-A567-0E02B2C3D479'), 'f47ac10b58cc4372a5670e02b2c3d479')
eq('urn:uuid 前綴', normalizeUuid('urn:uuid:f47ac10b-58cc-4372-a567-0e02b2c3d479'), 'f47ac10b58cc4372a5670e02b2c3d479')
eq('大括號', normalizeUuid('{f47ac10b-58cc-4372-a567-0e02b2c3d479}'), 'f47ac10b58cc4372a5670e02b2c3d479')
eq('無連字號', normalizeUuid('f47ac10b58cc4372a5670e02b2c3d479'), 'f47ac10b58cc4372a5670e02b2c3d479')
eq('長度錯誤回 null', normalizeUuid('f47ac10b-58cc-4372-a567'), null)
eq('非 hex 回 null', normalizeUuid('z47ac10b-58cc-4372-a567-0e02b2c3d479'), null)
eq('空回 null', normalizeUuid(''), null)

// --- formatCanonical ---
eq('格式化', formatCanonical('f47ac10b58cc4372a5670e02b2c3d479'), 'f47ac10b-58cc-4372-a567-0e02b2c3d479')

// --- v4 ---
const v4 = inspectUuid('f47ac10b-58cc-4372-a567-0e02b2c3d479')
eq('v4 version', v4.version, 4)
eq('v4 variant', v4.variant, 'RFC 4122 / 9562(10xx)')
eq('v4 無時間戳', v4.timestampMs, null)
eq('v4 canonical', v4.canonical, 'f47ac10b-58cc-4372-a567-0e02b2c3d479')

// --- v1:由 ms=0 組出的 UUID 應解回 1970-01-01 ---
const v1 = inspectUuid('13814000-1dd2-11b2-a567-0e02b2c3d479')
eq('v1 version', v1.version, 1)
eq('v1 timestampMs', v1.timestampMs, 0)
eq('v1 iso', v1.iso, '1970-01-01T00:00:00.000Z')

// --- v7:前 48 位元為 Unix 毫秒 ---
const pre = v7TimePrefix(1700000000000)
const v7str = pre.slice(0, 8) + '-' + pre.slice(8, 12) + '-7cc3-98c4-dc0c0c07398f'
const v7 = inspectUuid(v7str)
eq('v7 version', v7.version, 7)
eq('v7 timestampMs', v7.timestampMs, 1700000000000)
eq('v7 iso', v7.iso, '2023-11-14T22:13:20.000Z')

// v7 已知字串(由上面建構,固定值)
eq('v7 固定字串 iso', inspectUuid('018bcfe5-6800-7cc3-98c4-dc0c0c07398f').iso, '2023-11-14T22:13:20.000Z')

// --- v6:由相同 ms=0 的 100ns 時間戳重排序組出 ---
// ts100ns = offset;  v6: timeHigh(32)|timeMid(16)|0x6_low(12)
;(() => {
  const ts = 0x01b21dd213814000n
  const timeHigh = (ts >> 28n) & 0xffffffffn
  const timeMid = (ts >> 12n) & 0xffffn
  const timeLow = ts & 0x0fffn
  const hex =
    timeHigh.toString(16).padStart(8, '0') +
    timeMid.toString(16).padStart(4, '0') +
    (0x6000n | timeLow).toString(16).padStart(4, '0')
  const s = formatCanonical(hex + 'a5670e02b2c3d479')
  const v6 = inspectUuid(s)
  eq('v6 version', v6.version, 6)
  eq('v6 timestampMs', v6.timestampMs, 0)
  eq('v6 iso', v6.iso, '1970-01-01T00:00:00.000Z')
})()

// --- Nil / Max ---
const nil = inspectUuid('00000000-0000-0000-0000-000000000000')
eq('Nil special', nil.special, 'nil')
eq('Nil label', nil.versionLabel, 'Nil UUID(全零)')
const max = inspectUuid('ffffffff-ffff-ffff-ffff-ffffffffffff')
eq('Max special', max.special, 'max')
eq('Max label', max.versionLabel, 'Max UUID(全 F)')

// --- 變體判定 ---
eq('變體 NCS', inspectUuid('00000000-0000-4000-0000-000000000001').variant, 'NCS(向後相容,0xxx)')
eq('變體 Microsoft', inspectUuid('00000000-0000-4000-c000-000000000001').variant, 'Microsoft(110x)')

// --- 非法輸入 ---
eq('非法回 null', inspectUuid('not-a-uuid'), null)

if (fail) {
  console.error(`\n${fail} 個測試未通過`)
  process.exit(1)
} else {
  console.log('\n全部 uuidInspect 測試通過')
}
