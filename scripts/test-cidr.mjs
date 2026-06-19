/*
  IPv4 CIDR / 子網計算引擎回歸測試(node 直接跑)。
  執行:node scripts/test-cidr.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `cidr-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/cidr.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const {
  parseIPv4,
  ipToInt,
  intToIp,
  parseCidr,
  prefixToMask,
  maskToPrefix,
  computeSubnet,
} = await import('file://' + out)

let fail = 0
let pass = 0
function eq(a, b, msg) {
  if (a === b) pass++
  else {
    fail++
    console.error(`✗ FAIL: ${msg} — got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`)
  }
}
function ok(c, msg) {
  if (c) pass++
  else {
    fail++
    console.error('✗ FAIL:', msg)
  }
}

// parseIPv4
ok(parseIPv4('192.168.1.1') !== null, 'parse valid')
eq(parseIPv4('256.1.1.1'), null, 'parse 256 invalid')
eq(parseIPv4('1.2.3'), null, 'parse 3 parts')
eq(parseIPv4('1.2.3.4.5'), null, 'parse 5 parts')
eq(parseIPv4('01.2.3.4'), null, 'parse leading zero invalid')
ok(parseIPv4('0.0.0.0') !== null, 'parse 0.0.0.0 valid')
eq(parseIPv4('a.b.c.d'), null, 'parse non-numeric')
eq(parseIPv4('1.2.3.-1'), null, 'parse negative')

// ipToInt / intToIp roundtrip
eq(ipToInt('0.0.0.0'), 0, 'ipToInt 0')
eq(ipToInt('255.255.255.255'), 0xffffffff, 'ipToInt max')
eq(ipToInt('192.168.1.1'), 0xc0a80101, 'ipToInt 192.168.1.1')
eq(intToIp(0xc0a80101), '192.168.1.1', 'intToIp 192.168.1.1')
eq(intToIp(0), '0.0.0.0', 'intToIp 0')
eq(intToIp(0xffffffff), '255.255.255.255', 'intToIp max')
for (const s of ['10.20.30.40', '172.16.5.4', '8.8.8.8', '255.0.255.0']) {
  eq(intToIp(ipToInt(s)), s, `roundtrip ${s}`)
}

// prefixToMask
eq(intToIp(prefixToMask(0)), '0.0.0.0', 'mask /0')
eq(intToIp(prefixToMask(24)), '255.255.255.0', 'mask /24')
eq(intToIp(prefixToMask(32)), '255.255.255.255', 'mask /32')
eq(intToIp(prefixToMask(25)), '255.255.255.128', 'mask /25')
eq(intToIp(prefixToMask(16)), '255.255.0.0', 'mask /16')
eq(intToIp(prefixToMask(30)), '255.255.255.252', 'mask /30')

// maskToPrefix
eq(maskToPrefix(ipToInt('255.255.255.0')), 24, 'maskToPrefix /24')
eq(maskToPrefix(ipToInt('255.255.255.252')), 30, 'maskToPrefix /30')
eq(maskToPrefix(ipToInt('0.0.0.0')), 0, 'maskToPrefix /0')
eq(maskToPrefix(ipToInt('255.255.255.255')), 32, 'maskToPrefix /32')
eq(maskToPrefix(ipToInt('255.0.255.0')), null, 'maskToPrefix non-contiguous null')
eq(maskToPrefix(ipToInt('255.255.0.255')), null, 'maskToPrefix non-contiguous null 2')

// parseCidr
{
  const r = parseCidr('192.168.1.10/24')
  ok(r.ok, 'parseCidr ok')
  eq(r.value.prefix, 24, 'parseCidr prefix 24')
  eq(intToIp(r.value.ip), '192.168.1.10', 'parseCidr ip')
}
ok(!parseCidr('192.168.1.10/33').ok, 'parseCidr /33 invalid')
ok(!parseCidr('192.168.1.10/-1').ok, 'parseCidr /-1 invalid')
ok(!parseCidr('300.1.1.1/24').ok, 'parseCidr bad ip')
ok(!parseCidr('').ok, 'parseCidr empty invalid')
{
  const r = parseCidr('10.0.0.5') // no prefix -> /32
  ok(r.ok, 'parseCidr no prefix ok')
  eq(r.value.prefix, 32, 'parseCidr default /32')
}
{
  const r = parseCidr('192.168.1.0 255.255.255.0') // mask form
  ok(r.ok, 'parseCidr mask form ok')
  eq(r.value.prefix, 24, 'parseCidr mask form -> 24')
}
ok(!parseCidr('192.168.1.0 255.0.255.0').ok, 'parseCidr non-contiguous mask invalid')

// computeSubnet /24
{
  const { ip, prefix } = parseCidr('192.168.1.10/24').value
  const s = computeSubnet(ip, prefix)
  eq(s.network, '192.168.1.0', '/24 network')
  eq(s.broadcast, '192.168.1.255', '/24 broadcast')
  eq(s.firstHost, '192.168.1.1', '/24 firstHost')
  eq(s.lastHost, '192.168.1.254', '/24 lastHost')
  eq(s.mask, '255.255.255.0', '/24 mask')
  eq(s.wildcard, '0.0.0.255', '/24 wildcard')
  eq(s.totalHosts, 256, '/24 totalHosts')
  eq(s.usableHosts, 254, '/24 usableHosts')
  ok(s.isPrivate, '/24 192.168 isPrivate')
  eq(s.class, 'C', '/24 class C')
}

// computeSubnet /30 (4 addrs, 2 usable)
{
  const { ip, prefix } = parseCidr('10.0.0.5/30').value
  const s = computeSubnet(ip, prefix)
  eq(s.network, '10.0.0.4', '/30 network')
  eq(s.broadcast, '10.0.0.7', '/30 broadcast')
  eq(s.firstHost, '10.0.0.5', '/30 firstHost')
  eq(s.lastHost, '10.0.0.6', '/30 lastHost')
  eq(s.totalHosts, 4, '/30 total')
  eq(s.usableHosts, 2, '/30 usable')
  ok(s.isPrivate, '/30 10.x isPrivate')
}

// /31 point-to-point: both usable
{
  const { ip, prefix } = parseCidr('192.168.1.0/31').value
  const s = computeSubnet(ip, prefix)
  eq(s.totalHosts, 2, '/31 total 2')
  eq(s.usableHosts, 2, '/31 usable 2')
  eq(s.firstHost, '192.168.1.0', '/31 first = network')
  eq(s.lastHost, '192.168.1.1', '/31 last = broadcast')
}

// /32 single host
{
  const { ip, prefix } = parseCidr('8.8.8.8/32').value
  const s = computeSubnet(ip, prefix)
  eq(s.totalHosts, 1, '/32 total 1')
  eq(s.usableHosts, 1, '/32 usable 1')
  eq(s.network, '8.8.8.8', '/32 network self')
  eq(s.broadcast, '8.8.8.8', '/32 broadcast self')
  ok(!s.isPrivate, '/32 8.8.8.8 public')
  eq(s.class, 'A', '/32 8.8.8.8 class A')
}

// /0 whole internet
{
  const s = computeSubnet(ipToInt('1.2.3.4'), 0)
  eq(s.network, '0.0.0.0', '/0 network')
  eq(s.broadcast, '255.255.255.255', '/0 broadcast')
  eq(s.totalHosts, 4294967296, '/0 total 2^32')
  eq(s.usableHosts, 4294967294, '/0 usable')
}

// /16 private 172.16
{
  const s = computeSubnet(ipToInt('172.16.50.1'), 16)
  eq(s.network, '172.16.0.0', '/16 network')
  eq(s.broadcast, '172.16.255.255', '/16 broadcast')
  ok(s.isPrivate, '172.16 isPrivate')
  eq(s.class, 'B', '172.16 class B')
}
// 172.32 is NOT private (outside 172.16/12)
{
  const s = computeSubnet(ipToInt('172.32.0.1'), 16)
  ok(!s.isPrivate, '172.32 not private')
}

console.log(`\ncidr: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
