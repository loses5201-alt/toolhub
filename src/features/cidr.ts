/*
  IPv4 CIDR / 子網計算核心 —— 純函式、無 DOM,可在 Node 測。
  給一個 CIDR(如 192.168.1.10/24)算出網路位址、廣播位址、可用主機範圍、
  子網路遮罩、萬用遮罩、主機數量等。以 32 位元無號整數運算。
  全程瀏覽器、不連網、不上傳。
*/

/** 解析 IPv4 字串成四個 0–255 八位元;格式錯誤回 null。 */
export function parseIPv4(input: string): number[] | null {
  const parts = input.trim().split('.')
  if (parts.length !== 4) return null
  const octets: number[] = []
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null
    const n = parseInt(p, 10)
    if (n < 0 || n > 255) return null
    // 不接受 "01" 這類前導零(避免八進位誤會),但允許單一 "0"
    if (p.length > 1 && p[0] === '0') return null
    octets.push(n)
  }
  return octets
}

/** 八位元陣列轉 32 位元無號整數。 */
export function octetsToInt(octets: number[]): number {
  return ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0
}

/** 32 位元無號整數轉 IPv4 字串。 */
export function intToIp(n: number): string {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff].join('.')
}

/** IPv4 字串 → 整數(失敗回 null)。 */
export function ipToInt(input: string): number | null {
  const o = parseIPv4(input)
  return o ? octetsToInt(o) : null
}

export interface CidrInput {
  ip: number // 使用者輸入的位址(整數)
  prefix: number // 0–32
}

export interface ParseCidrResult {
  ok: boolean
  value?: CidrInput
  error?: string
}

/**
 * 解析 "a.b.c.d/n" 或 "a.b.c.d 255.255.255.0"(遮罩寫法)。
 * 只給位址不給字首時,預設 /32。
 */
export function parseCidr(input: string): ParseCidrResult {
  const text = input.trim()
  if (!text) return { ok: false, error: '請輸入 IP / CIDR,例如 192.168.1.0/24。' }

  let ipPart = text
  let prefix = 32

  if (text.includes('/')) {
    const [a, b] = text.split('/')
    ipPart = a.trim()
    const n = Number(b.trim())
    if (!Number.isInteger(n) || n < 0 || n > 32) {
      return { ok: false, error: '網路字首(/n)必須是 0 到 32 的整數。' }
    }
    prefix = n
  } else if (/\s+/.test(text)) {
    // 遮罩寫法:192.168.1.0 255.255.255.0
    const [a, m] = text.split(/\s+/)
    ipPart = a.trim()
    const maskInt = ipToInt(m.trim())
    if (maskInt === null) return { ok: false, error: `子網路遮罩格式不正確:${m}` }
    const p = maskToPrefix(maskInt)
    if (p === null) return { ok: false, error: `不是有效的連續子網路遮罩:${m}` }
    prefix = p
  }

  const ip = ipToInt(ipPart)
  if (ip === null) return { ok: false, error: `IP 位址格式不正確:${ipPart}` }
  return { ok: true, value: { ip, prefix } }
}

/** 由字首長度算出遮罩整數(/0 → 0,/32 → 0xffffffff)。 */
export function prefixToMask(prefix: number): number {
  if (prefix <= 0) return 0
  if (prefix >= 32) return 0xffffffff
  return (0xffffffff << (32 - prefix)) >>> 0
}

/** 由遮罩整數反推字首長度;非連續遮罩(如 255.0.255.0)回 null。 */
export function maskToPrefix(mask: number): number | null {
  // 連續遮罩:取補數 +1 必為 2 的冪(或遮罩為 0 / 全 1)
  const inv = (~mask) >>> 0
  if (((inv + 1) & inv) !== 0) return null // 補數非「全 0 後接全 1」
  let count = 0
  let m = mask >>> 0
  while (m & 0x80000000) {
    count++
    m = (m << 1) >>> 0
  }
  return count
}

export interface SubnetInfo {
  ip: string // 輸入位址
  prefix: number
  mask: string // 子網路遮罩
  wildcard: string // 萬用遮罩(遮罩的補數)
  network: string // 網路位址
  broadcast: string // 廣播位址
  firstHost: string // 第一個可用主機
  lastHost: string // 最後一個可用主機
  totalHosts: number // 區塊總位址數(含網路/廣播)
  usableHosts: number // 可用主機數
  isPrivate: boolean // 是否為私有位址(RFC 1918)
  class: string // 傳統等級 A/B/C/D/E
}

const PRIVATE_RANGES: Array<[string, number]> = [
  ['10.0.0.0', 8],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
]

function inRange(ip: number, baseStr: string, prefix: number): boolean {
  const base = ipToInt(baseStr)!
  const mask = prefixToMask(prefix)
  return ((ip & mask) >>> 0) === ((base & mask) >>> 0)
}

function ipClass(firstOctet: number): string {
  if (firstOctet < 128) return 'A'
  if (firstOctet < 192) return 'B'
  if (firstOctet < 224) return 'C'
  if (firstOctet < 240) return 'D(多播)'
  return 'E(保留)'
}

/** 主計算:由 CIDR 產出完整子網資訊。 */
export function computeSubnet(ip: number, prefix: number): SubnetInfo {
  const mask = prefixToMask(prefix)
  const wildcard = (~mask) >>> 0
  const network = (ip & mask) >>> 0
  const broadcast = (network | wildcard) >>> 0
  const totalHosts = prefix >= 32 ? 1 : 2 ** (32 - prefix)

  let firstHost: number
  let lastHost: number
  let usableHosts: number
  if (prefix >= 31) {
    // /31 點對點(RFC 3021)、/32 單一位址:兩端皆可用,無網路/廣播保留
    firstHost = network
    lastHost = broadcast
    usableHosts = totalHosts
  } else {
    firstHost = (network + 1) >>> 0
    lastHost = (broadcast - 1) >>> 0
    usableHosts = totalHosts - 2
  }

  return {
    ip: intToIp(ip),
    prefix,
    mask: intToIp(mask),
    wildcard: intToIp(wildcard),
    network: intToIp(network),
    broadcast: intToIp(broadcast),
    firstHost: intToIp(firstHost),
    lastHost: intToIp(lastHost),
    totalHosts,
    usableHosts,
    isPrivate: PRIVATE_RANGES.some(([b, p]) => inRange(ip, b, p)),
    class: ipClass((ip >>> 24) & 0xff),
  }
}
