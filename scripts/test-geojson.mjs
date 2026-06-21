/*
  GeoJSON 檢視 / 分析引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-geojson.mjs
  oracle:手構符合 RFC 7946 的 GeoJSON,以已知座標手算長度 / 面積 / bbox / 點數比對。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `geojson-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/geojson.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { analyzeGeoJson, formatLength, formatArea } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else { fail++; console.error(`✗ ${note}`) }
}
function eq(note, a, b) {
  check(`${note} (得到 ${JSON.stringify(a)})`, JSON.stringify(a) === JSON.stringify(b))
}
function approx(note, a, b, tol) {
  check(`${note} (得到 ${a}, 期望 ~${b})`, Math.abs(a - b) <= tol)
}

// 一度緯度 ≈ 111195 m
const DEG_LAT = 6371008.8 * Math.PI / 180

const FC = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', id: 'p1', properties: { name: 'A', pop: 100 }, geometry: { type: 'Point', coordinates: [121, 25] } },
    { type: 'Feature', properties: { name: 'B' }, geometry: { type: 'LineString', coordinates: [[0, 0], [0, 1], [0, 2]] } },
    { type: 'Feature', properties: { city: 'X' }, geometry: { type: 'Polygon', coordinates: [
      [[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]],            // 外環
      [[0.4, 0.4], [0.4, 0.6], [0.6, 0.6], [0.6, 0.4], [0.4, 0.4]], // 洞
    ] } },
    { type: 'Feature', properties: null, geometry: null }, // null geometry
  ],
}
const s = analyzeGeoJson(JSON.stringify(FC))
eq('無錯誤', s.errors, [])
eq('rootType', s.rootType, 'FeatureCollection')
eq('feature 數', s.featureCount, 4)
eq('幾何型別統計', s.geometryCounts, { Point: 1, LineString: 1, Polygon: 1, '(null geometry)': 1 })
// 點數:Point 1 + LineString 3 + Polygon(5+5) 10 + null 0 = 14
eq('座標點總數', s.totalPositions, 14)
eq('屬性鍵彙整(排序去重)', s.propertyKeys, ['city', 'name', 'pop'])
// bbox 涵蓋所有點:lon 0..121, lat 0..25
eq('bbox', s.bbox, [0, 0, 121, 25])
// LineString 長度 = 2 度緯度
approx('線總長 ≈ 2 度緯度', s.totalLengthM, 2 * DEG_LAT + /*polygon 周長之後另計*/ 0, 5 * DEG_LAT) // 寬鬆,僅確認量級
// 改用單獨 feature 驗線長精確
const lineOnly = analyzeGeoJson(JSON.stringify({ type: 'LineString', coordinates: [[0, 0], [0, 1], [0, 2]] }))
approx('純 LineString 長 = 2 度緯度', lineOnly.totalLengthM, 2 * DEG_LAT, 50)
eq('裸幾何 rootType', lineOnly.rootType, 'LineString')
eq('裸幾何也算一個 feature', lineOnly.featureCount, 1)

// 面積:外環約 1°×1°,洞 0.2°×0.2°。1° 邊長 ≈ DEG_LAT;面積概略 (DEG_LAT^2)*(1 - 0.04)
const cellArea = DEG_LAT * DEG_LAT
approx('Polygon 面積扣洞 ≈ 0.96 平方度', s.totalAreaM2, cellArea * (1 - 0.2 * 0.2), cellArea * 0.05)
check('Polygon 面積 < 外環(有扣洞)', s.features[2].areaM2 < cellArea)
check('Polygon 面積 > 0', s.features[2].areaM2 > 0)

// 逐 feature
eq('feature0 是 Point', s.features[0].geometryType, 'Point')
eq('feature0 id', s.features[0].id, 'p1')
eq('feature0 屬性鍵', s.features[0].propertyKeys, ['name', 'pop'])
eq('feature3 null geometry', s.features[3].geometryType, null)
eq('feature3 點數 0', s.features[3].positions, 0)

// 單一 Feature
const single = analyzeGeoJson(JSON.stringify({ type: 'Feature', properties: { a: 1 }, geometry: { type: 'Point', coordinates: [10, 20] } }))
eq('單一 Feature 數', single.featureCount, 1)
eq('單一 Feature bbox', single.bbox, [10, 20, 10, 20])

// MultiPolygon + GeometryCollection
const mp = analyzeGeoJson(JSON.stringify({ type: 'GeometryCollection', geometries: [
  { type: 'Point', coordinates: [1, 1] },
  { type: 'MultiPolygon', coordinates: [[[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]] },
] }))
eq('GeometryCollection 一個 feature', mp.featureCount, 1)
eq('GC 型別統計', mp.geometryCounts, { GeometryCollection: 1 })
eq('GC 點數 = 1 + 5', mp.totalPositions, 6)
check('GC 面積 > 0', mp.totalAreaM2 > 0)

// 錯誤處理
eq('壞 JSON 一個錯誤', analyzeGeoJson('{bad').errors.length, 1)
check('壞 JSON 錯誤含語法', analyzeGeoJson('{bad').errors[0].includes('JSON 語法錯誤'))
eq('非物件報錯', analyzeGeoJson('123').errors.length, 1)
eq('缺 features 報錯', analyzeGeoJson('{"type":"FeatureCollection"}').errors.length, 1)
eq('缺 type 報錯', analyzeGeoJson('{"foo":1}').errors.length, 1)

// 顯示格式
eq('formatLength 公里', formatLength(1500), '1.50 km')
eq('formatLength 公尺', formatLength(50), '50.0 m')
eq('formatLength 0', formatLength(0), '0 m')
check('formatArea 公頃', formatArea(50000).includes('公頃'))
check('formatArea 平方公里', formatArea(5e6).includes('km²'))

if (fail) { console.error(`\n${fail} 項失敗`); process.exit(1) }
console.log('\n全部通過')
