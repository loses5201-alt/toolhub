/*
  UUID 檢視引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  解析 UUID,判斷版本(1–8)與變體,並對含時間的版本還原內嵌時間:
    v1 / v6:60 位元時間戳,單位 100 奈秒,自 1582-10-15(格里曆改制)起算。
    v7:前 48 位元為 Unix 毫秒(time-ordered,新標準 RFC 9562)。
  與 id-gen(產生 ID)互補:這支專做「反查」。全程在你的瀏覽器,不連網、不上傳。
*/

export interface UuidInfo {
  canonical: string // 8-4-4-4-12 小寫
  version: number // 0–15(0 通常為 Nil)
  versionLabel: string
  variant: string
  timestampMs: number | null
  iso: string | null
  special: string | null // 'nil' | 'max' | null
}

// 1582-10-15 到 1970-01-01 之間的 100 奈秒間隔數
const GREGORIAN_OFFSET_100NS = 0x01b21dd213814000n // 122192928000000000

/** 正規化成 32 個十六進位字元(去 urn:uuid:、大括號、連字號);非法回 null。 */
export function normalizeUuid(input: string): string | null {
  let s = (input || '').trim().toLowerCase()
  s = s.replace(/^urn:uuid:/, '').replace(/[{}]/g, '').replace(/-/g, '')
  if (!/^[0-9a-f]{32}$/.test(s)) return null
  return s
}

/** 32-hex → 標準 8-4-4-4-12。 */
export function formatCanonical(hex32: string): string {
  return `${hex32.slice(0, 8)}-${hex32.slice(8, 12)}-${hex32.slice(12, 16)}-${hex32.slice(16, 20)}-${hex32.slice(20)}`
}

const VERSION_LABELS: Record<number, string> = {
  1: 'v1(時間 + MAC)',
  2: 'v2(DCE Security)',
  3: 'v3(名稱雜湊 MD5)',
  4: 'v4(隨機)',
  5: 'v5(名稱雜湊 SHA-1)',
  6: 'v6(重排序時間)',
  7: 'v7(Unix 毫秒時間)',
  8: 'v8(自訂)',
}

function variantOf(hex32: string): string {
  const n = parseInt(hex32[16], 16)
  if ((n & 0x8) === 0) return 'NCS(向後相容,0xxx)'
  if ((n & 0xc) === 0x8) return 'RFC 4122 / 9562(10xx)'
  if ((n & 0xe) === 0xc) return 'Microsoft(110x)'
  return '保留(111x)'
}

/** v1/v6 的 60 位元時間戳(100ns)→ Unix 毫秒。 */
function gregorian100nsToMs(ts100ns: bigint): number {
  return Number((ts100ns - GREGORIAN_OFFSET_100NS) / 10000n)
}

/** 主入口:解析並回傳完整資訊;非法回 null。 */
export function inspectUuid(input: string): UuidInfo | null {
  const hex = normalizeUuid(input)
  if (hex === null) return null
  const canonical = formatCanonical(hex)
  const version = parseInt(hex[12], 16)

  let special: string | null = null
  if (hex === '0'.repeat(32)) special = 'nil'
  else if (hex === 'f'.repeat(32)) special = 'max'

  let timestampMs: number | null = null

  if (version === 1) {
    const timeLow = BigInt('0x' + hex.slice(0, 8))
    const timeMid = BigInt('0x' + hex.slice(8, 12))
    const timeHi = BigInt('0x' + hex.slice(12, 16)) & 0x0fffn
    const ts = (timeHi << 48n) | (timeMid << 32n) | timeLow
    timestampMs = gregorian100nsToMs(ts)
  } else if (version === 6) {
    // v6:時間高位在前。time_high(32) time_mid(16) version+time_low(12)
    const timeHigh = BigInt('0x' + hex.slice(0, 8))
    const timeMid = BigInt('0x' + hex.slice(8, 12))
    const timeLow = BigInt('0x' + hex.slice(12, 16)) & 0x0fffn
    const ts = (timeHigh << 28n) | (timeMid << 12n) | timeLow
    timestampMs = gregorian100nsToMs(ts)
  } else if (version === 7) {
    timestampMs = Number(BigInt('0x' + hex.slice(0, 12)))
  }

  let iso: string | null = null
  if (timestampMs !== null && Number.isFinite(timestampMs)) {
    const d = new Date(timestampMs)
    if (!Number.isNaN(d.getTime())) iso = d.toISOString()
  }

  return {
    canonical,
    version,
    versionLabel: special === 'nil' ? 'Nil UUID(全零)' : special === 'max' ? 'Max UUID(全 F)' : VERSION_LABELS[version] ?? `v${version}(未知)`,
    variant: special ? '—' : variantOf(hex),
    timestampMs,
    iso,
    special,
  }
}

/** 由 Unix 毫秒組出一個 v7 UUID 的前 48 位元(供測試/示範);其餘位元填 0。 */
export function v7TimePrefix(ms: number): string {
  const hex = BigInt(Math.floor(ms)).toString(16).padStart(12, '0')
  return hex.slice(-12)
}
