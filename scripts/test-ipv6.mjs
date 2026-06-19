/*
  IPv6 展開 / 壓縮引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-ipv6.mjs
  多數向量取自 RFC 5952。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `ipv6-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/ipv6.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { parseIPv6, expand, compress, classify, analyzeIPv6 } = await import('file://' + out)

let fail = 0
function eq(note, got, want) {
  if (got === want) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}\n   got : ${JSON.stringify(got)}\n   want: ${JSON.stringify(want)}`)
  }
}
const comp = (s) => compress(parseIPv6(s))
const exp = (s) => expand(parseIPv6(s))
const cls = (s) => classify(parseIPv6(s))

// --- 展開 ---
eq('展開 2001:db8::1', exp('2001:db8::1'), '2001:0db8:0000:0000:0000:0000:0000:0001')
eq('展開 :: ', exp('::'), '0000:0000:0000:0000:0000:0000:0000:0000')
eq('展開 ::1', exp('::1'), '0000:0000:0000:0000:0000:0000:0000:0001')
eq('展開已完整不變', exp('2001:0db8:0000:0000:0000:0000:1428:57ab'), '2001:0db8:0000:0000:0000:0000:1428:57ab')

// --- 壓縮(RFC 5952)---
eq('壓縮 RFC 範例', comp('2001:0db8:0000:0000:0000:0000:1428:57ab'), '2001:db8::1428:57ab')
eq('壓縮全零為 ::', comp('0:0:0:0:0:0:0:0'), '::')
eq('壓縮 ::1', comp('0:0:0:0:0:0:0:1'), '::1')
eq('壓縮去前導零', comp('2001:0db8:0:0:0:0:0:1'), '2001:db8::1')
eq('壓縮最左零段優先', comp('2001:db8:0:0:1:0:0:1'), '2001:db8::1:0:0:1')
eq('單一零組不壓縮', comp('1:0:1:0:1:0:1:0'), '1:0:1:0:1:0:1:0')
eq('最長段優先', comp('1:0:0:0:1:0:1:1'), '1::1:0:1:1')
eq('結尾零段', comp('fe80:0:0:0:0:0:0:0'), 'fe80::')

// --- 內嵌 IPv4 ---
eq('IPv4-mapped 解析展開', exp('::ffff:192.168.1.1'), '0000:0000:0000:0000:0000:ffff:c0a8:0101')
eq('IPv4-mapped 壓縮', comp('::ffff:192.168.1.1'), '::ffff:c0a8:101')
eq('IPv4-mapped 分類', cls('::ffff:192.168.1.1'), 'IPv4-mapped(192.168.1.1)')

// --- 分類 ---
eq('未指定', cls('::'), '未指定位址(::)')
eq('loopback', cls('::1'), '回送位址(loopback ::1)')
eq('link-local', cls('fe80::1'), '連結本地位址(link-local fe80::/10)')
eq('ULA', cls('fc00::1'), '唯一本地位址(ULA fc00::/7)')
eq('ULA fd', cls('fd12:3456::1'), '唯一本地位址(ULA fc00::/7)')
eq('multicast', cls('ff02::1'), '多播位址(multicast ff00::/8)')
eq('global', cls('2001:db8::1'), '全域單播位址(global unicast 2000::/3)')

// --- 大小寫與 zone ---
eq('大寫正規化', comp('2001:DB8::1'), '2001:db8::1')
eq('zone id 去除', comp('fe80::1%eth0'), 'fe80::1')

// --- 非法 ---
eq('兩個 :: 非法', parseIPv6('1::2::3'), null)
eq('組數不足且無 ::', parseIPv6('1:2:3:4:5:6:7'), null)
eq('組數過多', parseIPv6('1:2:3:4:5:6:7:8:9'), null)
eq('五位 hex 非法', parseIPv6('12345::'), null)
eq('非 hex 字元', parseIPv6('gggg::'), null)
eq('空字串', parseIPv6(''), null)
eq('IPv4 段超界', parseIPv6('::ffff:999.1.1.1'), null)
eq(':: 佔滿 8 組非法', parseIPv6('1:2:3:4:5:6:7:8::'), null)

// --- analyzeIPv6 ---
const a = analyzeIPv6('2001:db8::1')
eq('analyze expanded', a.expanded, '2001:0db8:0000:0000:0000:0000:0000:0001')
eq('analyze compressed', a.compressed, '2001:db8::1')
eq('analyze type', a.type, '全域單播位址(global unicast 2000::/3)')
eq('analyze groups[0]', a.groups[0], 0x2001)
eq('analyze 非法回 null', analyzeIPv6('zzz'), null)

if (fail) {
  console.error(`\n${fail} 個測試未通過`)
  process.exit(1)
} else {
  console.log('\n全部 IPv6 測試通過')
}
