/*
  GPS 座標轉換引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  十進位度(DD,Google 地圖用)↔ 度分秒(DMS,25°02'01.3"N)↔ 度分(DM)互轉,
  並用 haversine 公式算兩點間的地表距離。地理課、登山、無人機、地政、貼地圖座標時好用。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

export interface DMS {
  deg: number
  min: number
  sec: number
  hemi: string // N/S/E/W
  negative: boolean
}

// 把各種度/分/秒符號正規化成空白,方便抽數字
function normalizeSymbols(s: string): string {
  return s
    .replace(/[°º]/g, ' ')
    .replace(/['′’]/g, ' ')
    .replace(/["″”]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 解析單一座標分量(可為十進位、度分、度分秒),支援 N/S/E/W 半球字母或前置負號。
 * 回傳有號的十進位度。無法解析丟 Error。
 */
export function parseComponent(input: string): number {
  let s = input.trim().toUpperCase()
  if (!s) throw new Error('座標為空')
  let sign = 1
  const hemi = s.match(/[NSEW]/)
  if (hemi) {
    if (hemi[0] === 'S' || hemi[0] === 'W') sign = -1
    s = s.replace(/[NSEW]/g, ' ')
  }
  s = normalizeSymbols(s)
  if (s.startsWith('-')) {
    sign *= -1
    s = s.slice(1).trim()
  }
  const nums = s.match(/\d+(?:\.\d+)?/g)
  if (!nums || nums.length === 0) throw new Error(`無法解析座標「${input}」`)
  if (nums.length > 3) throw new Error(`座標「${input}」數字過多`)
  const [d, m = '0', sec = '0'] = nums
  const dd = parseFloat(d) + parseFloat(m) / 60 + parseFloat(sec) / 3600
  return sign * dd
}

/** 把十進位度拆成度分秒結構。isLat=true 時半球為 N/S,否則 E/W。 */
export function toDMS(deg: number, isLat: boolean): DMS {
  const negative = deg < 0
  const abs = Math.abs(deg)
  let d = Math.floor(abs)
  let rem = (abs - d) * 60
  let m = Math.floor(rem)
  let s = (rem - m) * 60
  // 處理浮點進位(例 59.9999... 秒)
  if (Math.round(s * 1e6) / 1e6 >= 60) { s = 0; m += 1 }
  if (m >= 60) { m = 0; d += 1 }
  const hemi = isLat ? (negative ? 'S' : 'N') : negative ? 'W' : 'E'
  return { deg: d, min: m, sec: s, hemi, negative }
}

/** 格式化 DMS 為字串,例 25°02'01.32"N。secDigits 控制秒的小數位。 */
export function formatDMS(dms: DMS, secDigits = 2): string {
  const mm = String(dms.min).padStart(2, '0')
  const ss = dms.sec.toFixed(secDigits).padStart(secDigits > 0 ? secDigits + 3 : 2, '0')
  return `${dms.deg}°${mm}'${ss}"${dms.hemi}`
}

/** 格式化度分(DM),例 25°02.022'N。minDigits 控制分的小數位。 */
export function formatDM(deg: number, isLat: boolean, minDigits = 3): string {
  const negative = deg < 0
  const abs = Math.abs(deg)
  const d = Math.floor(abs)
  const m = (abs - d) * 60
  const hemi = isLat ? (negative ? 'S' : 'N') : negative ? 'W' : 'E'
  return `${d}°${m.toFixed(minDigits)}'${hemi}`
}

/** 驗證緯度 -90~90、經度 -180~180。 */
export function validate(lat: number, lon: number): string | null {
  if (lat < -90 || lat > 90) return '緯度需在 -90 ~ 90 之間'
  if (lon < -180 || lon > 180) return '經度需在 -180 ~ 180 之間'
  return null
}

const R = 6371008.8 // 地球平均半徑(公尺,IUGG 平均半徑)

/** haversine 公式:回傳兩點間地表大圓距離(公尺)。 */
export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** 把一整串「緯度, 經度」拆成兩個分量(逗號優先;否則嘗試以半球字母或空白分隔)。 */
export function parsePair(input: string): { lat: number; lon: number } {
  let s = input.trim()
  let latStr: string
  let lonStr: string
  if (s.includes(',')) {
    const idx = s.indexOf(',')
    latStr = s.slice(0, idx)
    lonStr = s.slice(idx + 1)
  } else {
    // 先嘗試以 N/S 半球字母為界(其後即為經度部分)
    const m = s.toUpperCase().match(/[NS]/)
    if (m && m.index !== undefined) {
      latStr = s.slice(0, m.index + 1)
      lonStr = s.slice(m.index + 1)
    } else {
      // 退而以空白對半切(各取一半的數字群組)
      const parts = s.split(/\s+/)
      if (parts.length < 2) throw new Error('請輸入緯度與經度兩個值(以逗號分隔)')
      const half = Math.ceil(parts.length / 2)
      latStr = parts.slice(0, half).join(' ')
      lonStr = parts.slice(half).join(' ')
    }
  }
  return { lat: parseComponent(latStr), lon: parseComponent(lonStr) }
}
