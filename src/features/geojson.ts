/*
  GeoJSON 檢視 / 分析引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。

  GeoJSON(RFC 7946)是地圖界通用的向量資料格式:QGIS / Leaflet / Mapbox / OpenStreetMap 匯出、
  政府開放資料的圖層,大多是 GeoJSON。一份檔常有上千個 feature,用文字編輯器打開只是一坨座標。

  本引擎統計:幾何型別分布、feature 數、座標點總數、整體邊界框(bbox)、線段總長、面積,
  並逐 feature 列出型別 / 點數 / 長度 / 面積 / 屬性。座標可能含敏感地點;全程在你瀏覽器解析,不上傳、不連網。

  座標順序依規範為 [經度, 緯度];長度 / 面積採球面近似(WGS84 平均半徑),供概覽參考非測量精度。
*/
import { haversine } from './geoCoord'

const R = 6371008.8 // WGS84 平均半徑(公尺),與 geoCoord 一致量級

export interface FeatureSummary {
  index: number
  geometryType: string | null
  positions: number
  lengthM: number
  areaM2: number
  propertyKeys: string[]
  id?: string | number
}
export interface GeoJsonSummary {
  rootType: string
  featureCount: number
  geometryCounts: Record<string, number>
  totalPositions: number
  bbox?: [number, number, number, number] // minLon, minLat, maxLon, maxLat
  totalLengthM: number
  totalAreaM2: number
  propertyKeys: string[]
  features: FeatureSummary[]
  errors: string[]
}

type Pos = number[]
type Geom = { type?: string; coordinates?: unknown; geometries?: unknown[] }

function isPos(v: unknown): v is Pos {
  return Array.isArray(v) && v.length >= 2 && typeof v[0] === 'number' && typeof v[1] === 'number'
}

/** 遞迴呼叫每個座標位置(用於計點數與 bbox)。 */
function eachPosition(coords: unknown, cb: (p: Pos) => void): void {
  if (isPos(coords)) { cb(coords); return }
  if (Array.isArray(coords)) for (const c of coords) eachPosition(c, cb)
}

/** 一條線(座標陣列)的長度(公尺)。 */
function lineLength(line: unknown): number {
  if (!Array.isArray(line)) return 0
  let sum = 0
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i]
    if (isPos(a) && isPos(b)) sum += haversine(a[1], a[0], b[1], b[0])
  }
  return sum
}

/** 單一環的球面面積(平方公尺,取絕對值)。座標為 [lon, lat]。 */
function ringArea(ring: unknown): number {
  if (!Array.isArray(ring) || ring.length < 3) return 0
  const toRad = (x: number) => (x * Math.PI) / 180
  let total = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length]
    if (!isPos(a) || !isPos(b)) continue
    total += (toRad(b[0]) - toRad(a[0])) * (2 + Math.sin(toRad(a[1])) + Math.sin(toRad(b[1])))
  }
  return Math.abs((total * R * R) / 2)
}

/** Polygon 面積:外環減內環(洞)。 */
function polygonArea(rings: unknown): number {
  if (!Array.isArray(rings) || !rings.length) return 0
  let area = ringArea(rings[0])
  for (let i = 1; i < rings.length; i++) area -= ringArea(rings[i])
  return Math.max(0, area)
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function geometryLength(g: Geom): number {
  switch (g.type) {
    case 'LineString': return lineLength(g.coordinates)
    case 'MultiLineString':
      return asArray(g.coordinates).reduce((s: number, l) => s + lineLength(l), 0)
    case 'Polygon':
      // 周長:各環長度
      return asArray(g.coordinates).reduce((s: number, r) => s + lineLength(r), 0)
    case 'MultiPolygon':
      return asArray(g.coordinates).reduce((s: number, poly) => s + asArray(poly).reduce((t: number, r) => t + lineLength(r), 0), 0)
    case 'GeometryCollection':
      return asArray(g.geometries).reduce((s: number, sub) => s + geometryLength(sub as Geom), 0)
    default: return 0
  }
}

function geometryArea(g: Geom): number {
  switch (g.type) {
    case 'Polygon': return polygonArea(g.coordinates)
    case 'MultiPolygon':
      return asArray(g.coordinates).reduce((s: number, p) => s + polygonArea(p), 0)
    case 'GeometryCollection':
      return asArray(g.geometries).reduce((s: number, sub) => s + geometryArea(sub as Geom), 0)
    default: return 0
  }
}

function countPositions(g: Geom): number {
  let n = 0
  if (g.type === 'GeometryCollection') {
    if (Array.isArray(g.geometries)) for (const sub of g.geometries) n += countPositions(sub as Geom)
    return n
  }
  eachPosition(g.coordinates, () => n++)
  return n
}

/** 解析並分析 GeoJSON 文字。語法錯誤或非 GeoJSON 會在 errors 反映,不丟例外。 */
export function analyzeGeoJson(text: string): GeoJsonSummary {
  const summary: GeoJsonSummary = {
    rootType: '', featureCount: 0, geometryCounts: {}, totalPositions: 0,
    totalLengthM: 0, totalAreaM2: 0, propertyKeys: [], features: [], errors: [],
  }
  let root: unknown
  try { root = JSON.parse(text) }
  catch (e) { summary.errors.push('JSON 語法錯誤:' + (e as Error).message); return summary }
  if (!root || typeof root !== 'object') { summary.errors.push('不是有效的 GeoJSON 物件'); return summary }

  const rootObj = root as { type?: string; features?: unknown[]; geometry?: unknown; properties?: unknown }
  summary.rootType = rootObj.type || '(未指定 type)'

  // 統一取出待分析的 feature 清單:FeatureCollection / 單一 Feature / 裸幾何
  type Pair = { geometry: Geom | null; properties: Record<string, unknown> | null; id?: string | number }
  const pairs: Pair[] = []
  if (rootObj.type === 'FeatureCollection') {
    if (!Array.isArray(rootObj.features)) summary.errors.push('FeatureCollection 缺少 features 陣列')
    else for (const f of rootObj.features) {
      const fo = f as { geometry?: unknown; properties?: unknown; id?: string | number }
      pairs.push({ geometry: (fo?.geometry ?? null) as Geom | null, properties: (fo?.properties ?? null) as Record<string, unknown> | null, id: fo?.id })
    }
  } else if (rootObj.type === 'Feature') {
    pairs.push({ geometry: (rootObj.geometry ?? null) as Geom | null, properties: (rootObj.properties ?? null) as Record<string, unknown> | null, id: (rootObj as { id?: string | number }).id })
  } else if (rootObj.type) {
    // 裸幾何(Point / LineString / … / GeometryCollection)
    pairs.push({ geometry: rootObj as Geom, properties: null })
  } else {
    summary.errors.push('缺少 type 欄位,無法判斷為哪種 GeoJSON')
  }

  const propKeySet = new Set<string>()
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity, hasBox = false

  pairs.forEach((p, index) => {
    const g = p.geometry
    const gType = g?.type ?? null
    if (gType) summary.geometryCounts[gType] = (summary.geometryCounts[gType] || 0) + 1
    else summary.geometryCounts['(null geometry)'] = (summary.geometryCounts['(null geometry)'] || 0) + 1

    let positions = 0, lengthM = 0, areaM2 = 0
    if (g) {
      positions = countPositions(g)
      lengthM = geometryLength(g)
      areaM2 = geometryArea(g)
      const collect = (geom: Geom) => {
        if (geom.type === 'GeometryCollection') {
          if (Array.isArray(geom.geometries)) geom.geometries.forEach((s) => collect(s as Geom))
          return
        }
        eachPosition(geom.coordinates, (pos) => {
          hasBox = true
          if (pos[0] < minLon) minLon = pos[0]
          if (pos[0] > maxLon) maxLon = pos[0]
          if (pos[1] < minLat) minLat = pos[1]
          if (pos[1] > maxLat) maxLat = pos[1]
        })
      }
      collect(g)
    }
    const keys = p.properties && typeof p.properties === 'object' ? Object.keys(p.properties) : []
    keys.forEach((k) => propKeySet.add(k))

    summary.totalPositions += positions
    summary.totalLengthM += lengthM
    summary.totalAreaM2 += areaM2
    summary.features.push({ index, geometryType: gType, positions, lengthM, areaM2, propertyKeys: keys, id: p.id })
  })

  summary.featureCount = pairs.length
  summary.propertyKeys = [...propKeySet].sort()
  if (hasBox) summary.bbox = [minLon, minLat, maxLon, maxLat]
  return summary
}

/** 公尺友善顯示。 */
export function formatLength(m: number): string {
  if (!m) return '0 m'
  return m >= 1000 ? (m / 1000).toFixed(m >= 100000 ? 0 : 2) + ' km' : m.toFixed(m >= 100 ? 0 : 1) + ' m'
}
/** 平方公尺友善顯示。 */
export function formatArea(m2: number): string {
  if (!m2) return '0 m²'
  if (m2 >= 1e6) return (m2 / 1e6).toFixed(m2 >= 1e8 ? 0 : 2) + ' km²'
  if (m2 >= 1e4) return (m2 / 1e4).toFixed(2) + ' 公頃'
  return m2.toFixed(m2 >= 100 ? 0 : 1) + ' m²'
}
