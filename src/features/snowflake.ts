/*
  Snowflake ID 解析引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  Twitter/X、Discord 等服務的 64 位元 ID 內嵌了「建立時間」,可反推出這筆資料是何時產生的。
  位元配置(由高到低):42 位元時間戳 + 5 位元 + 5 位元 + 12 位元序號。
    時間戳 = (id >> 22) + 該平台 epoch(毫秒)
  不同平台對中間兩個 5 位元欄位命名不同(Discord:worker/process;Twitter:datacenter/worker)。
  全程在你的瀏覽器,不連網、不上傳。
*/

export interface Platform {
  id: string
  name: string
  epoch: number // 毫秒
  field1: string // bits 17–21 名稱
  field2: string // bits 12–16 名稱
  field3: string // bits 0–11 名稱
}

export const PLATFORMS: Platform[] = [
  {
    id: 'discord',
    name: 'Discord',
    epoch: 1420070400000, // 2015-01-01
    field1: 'Worker ID',
    field2: 'Process ID',
    field3: 'Increment',
  },
  {
    id: 'twitter',
    name: 'Twitter / X',
    epoch: 1288834974657, // 2010-11-04
    field1: 'Datacenter ID',
    field2: 'Worker ID',
    field3: 'Sequence',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    epoch: 1314220021721,
    field1: 'Shard ID(高位)',
    field2: 'Shard ID(低位)',
    field3: 'Sequence',
  },
]

export const platformMap: Record<string, Platform> = Object.fromEntries(
  PLATFORMS.map((p) => [p.id, p]),
)

export interface SnowflakeResult {
  id: string
  timestampMs: number
  iso: string // UTC ISO 字串
  field1: number // bits 17–21
  field2: number // bits 12–16
  sequence: number // bits 0–11
  binary: string // 64 位元二進位(補零)
}

const MASK_5 = 0x1fn
const MASK_12 = 0xfffn

/** 驗證並解析輸入字串成 BigInt;非純數字或超過 64 位元無號上限回 null。 */
export function parseId(input: string): bigint | null {
  const s = (input || '').trim()
  if (!/^\d+$/.test(s)) return null
  let v: bigint
  try {
    v = BigInt(s)
  } catch {
    return null
  }
  if (v < 0n || v > (1n << 64n) - 1n) return null
  return v
}

/** 解析 snowflake ID;以指定 epoch(毫秒)計算內嵌時間。失敗回 null。 */
export function parseSnowflake(input: string, epochMs: number): SnowflakeResult | null {
  const id = parseId(input)
  if (id === null) return null
  const ts = Number((id >> 22n) + BigInt(epochMs))
  const field1 = Number((id >> 17n) & MASK_5)
  const field2 = Number((id >> 12n) & MASK_5)
  const sequence = Number(id & MASK_12)
  const binary = id.toString(2).padStart(64, '0')
  return {
    id: id.toString(),
    timestampMs: ts,
    iso: new Date(ts).toISOString(),
    field1,
    field2,
    sequence,
    binary,
  }
}

/** 用平台預設值解析。 */
export function parseByPlatform(input: string, platformId: string): SnowflakeResult | null {
  const p = platformMap[platformId]
  if (!p) return null
  return parseSnowflake(input, p.epoch)
}

/** 由「時間 + epoch」反推一個該毫秒的最小 snowflake(序號等皆 0),供查詢區間用。 */
export function snowflakeForTime(timestampMs: number, epochMs: number): string {
  const t = BigInt(Math.floor(timestampMs) - epochMs)
  if (t < 0n) return '0'
  return (t << 22n).toString()
}
