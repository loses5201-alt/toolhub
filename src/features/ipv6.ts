/*
  IPv6 位址展開 / 壓縮引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  解析各種寫法的 IPv6(含 :: 省略、內嵌 IPv4、%zone),正規化成:
    展開式:8 組各 4 位數(0000:0000:...)
    壓縮式:RFC 5952 標準(小寫、去前導零、最長一段零用 :: 取代、最左優先)
  並判斷位址類型(loopback / link-local / ULA / 多播 / IPv4-mapped / global)。
  cidr-calc 處理 IPv4,本工具補上 IPv6。全程在你的瀏覽器,不連網、不上傳。
*/

export interface IPv6Info {
  groups: number[] // 8 組 16 位元
  expanded: string
  compressed: string
  type: string
}

/** 解析 IPv6 字串成 8 組 16 位元數字;失敗回 null。 */
export function parseIPv6(input: string): number[] | null {
  let s = (input || '').trim().toLowerCase()
  if (!s) return null
  // 去除 zone id(%eth0)
  const pct = s.indexOf('%')
  if (pct >= 0) s = s.slice(0, pct)
  // 不可有多於一個 ::
  if ((s.match(/::/g) || []).length > 1) return null

  // 內嵌 IPv4(結尾如 ::ffff:192.168.1.1)
  const v4m = s.match(/(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (v4m) {
    // 內嵌 IPv4 前必須是 ':'(或位於開頭,但 IPv6 不會純 IPv4)
    const before = s[s.length - v4m[1].length - 1]
    if (before !== ':') return null
    const parts = v4m[1].split('.').map(Number)
    if (parts.some((p) => p > 255 || Number.isNaN(p))) return null
    const g1 = ((parts[0] << 8) | parts[1]).toString(16)
    const g2 = ((parts[2] << 8) | parts[3]).toString(16)
    s = s.slice(0, s.length - v4m[1].length) + g1 + ':' + g2
  }

  let groups: string[]
  if (s.includes('::')) {
    const [h, t] = s.split('::')
    const hg = h ? h.split(':') : []
    const tg = t ? t.split(':') : []
    const missing = 8 - hg.length - tg.length
    if (missing < 1) return null // :: 至少代表一組
    groups = [...hg, ...Array(missing).fill('0'), ...tg]
  } else {
    groups = s.split(':')
  }
  if (groups.length !== 8) return null

  const nums: number[] = []
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null
    nums.push(parseInt(g, 16))
  }
  return nums
}

/** 8 組 → 展開式(各補滿 4 位數)。 */
export function expand(groups: number[]): string {
  return groups.map((n) => n.toString(16).padStart(4, '0')).join(':')
}

/** 8 組 → RFC 5952 壓縮式。 */
export function compress(groups: number[]): string {
  const hex = groups.map((n) => n.toString(16))
  // 找最長的連續零段(最左優先)
  let best = { start: -1, len: 0 }
  let cur = { start: -1, len: 0 }
  for (let i = 0; i < groups.length; i++) {
    if (groups[i] === 0) {
      if (cur.len === 0) cur.start = i
      cur.len++
      if (cur.len > best.len) best = { ...cur }
    } else {
      cur = { start: -1, len: 0 }
    }
  }
  if (best.len < 2) return hex.join(':')
  const head = hex.slice(0, best.start).join(':')
  const tail = hex.slice(best.start + best.len).join(':')
  return head + '::' + tail
}

/** 判斷位址類型。 */
export function classify(groups: number[]): string {
  const allZero = groups.every((g) => g === 0)
  if (allZero) return '未指定位址(::)'
  if (groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1) return '回送位址(loopback ::1)'
  // IPv4-mapped ::ffff:0:0/96
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    const a = groups[6] >> 8
    const b = groups[6] & 0xff
    const c = groups[7] >> 8
    const d = groups[7] & 0xff
    return `IPv4-mapped(${a}.${b}.${c}.${d})`
  }
  const h = groups[0]
  if (h >> 8 === 0xff) return '多播位址(multicast ff00::/8)'
  if ((h & 0xffc0) === 0xfe80) return '連結本地位址(link-local fe80::/10)'
  if ((h & 0xfe00) === 0xfc00) return '唯一本地位址(ULA fc00::/7)'
  if ((h & 0xe000) === 0x2000) return '全域單播位址(global unicast 2000::/3)'
  return '其他 / 保留位址'
}

/** 一次解析並回傳完整資訊;失敗回 null。 */
export function analyzeIPv6(input: string): IPv6Info | null {
  const groups = parseIPv6(input)
  if (!groups) return null
  return {
    groups,
    expanded: expand(groups),
    compressed: compress(groups),
    type: classify(groups),
  }
}
