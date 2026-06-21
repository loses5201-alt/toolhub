/*
  WKT ⇆ GeoJSON 轉換引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-wkt.mjs
  oracle:WKT 規範範例手構,雙向轉換 + round-trip 比對。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `wkt-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/wkt.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { wktToGeoJson, geoJsonToWkt, geoJsonTextToWkt } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else { fail++; console.error(`✗ ${note}`) }
}
function eq(note, a, b) {
  check(`${note} (得到 ${JSON.stringify(a)})`, JSON.stringify(a) === JSON.stringify(b))
}
function throws(note, fn) {
  try { fn(); check(note + '(應丟錯)', false) } catch { check(note, true) }
}

// ---- WKT → GeoJSON ----
eq('POINT', wktToGeoJson('POINT (30 10)'), { type: 'Point', coordinates: [30, 10] })
eq('POINT 小寫 + 多空白', wktToGeoJson('point  (  121.5   25.0 )'), { type: 'Point', coordinates: [121.5, 25] })
eq('POINT Z 三軸', wktToGeoJson('POINT Z (30 10 5)'), { type: 'Point', coordinates: [30, 10, 5] })
eq('POINT 負數與小數', wktToGeoJson('POINT (-122.4 37.8)'), { type: 'Point', coordinates: [-122.4, 37.8] })
eq('LINESTRING', wktToGeoJson('LINESTRING (30 10, 10 30, 40 40)'),
  { type: 'LineString', coordinates: [[30, 10], [10, 30], [40, 40]] })
eq('POLYGON 無洞', wktToGeoJson('POLYGON ((30 10, 40 40, 20 40, 10 20, 30 10))'),
  { type: 'Polygon', coordinates: [[[30, 10], [40, 40], [20, 40], [10, 20], [30, 10]]] })
eq('POLYGON 有洞', wktToGeoJson('POLYGON ((35 10, 45 45, 15 40, 10 20, 35 10), (20 30, 35 35, 30 20, 20 30))'),
  { type: 'Polygon', coordinates: [
    [[35, 10], [45, 45], [15, 40], [10, 20], [35, 10]],
    [[20, 30], [35, 35], [30, 20], [20, 30]],
  ] })
eq('MULTIPOINT 裸座標', wktToGeoJson('MULTIPOINT (10 40, 40 30, 20 20)'),
  { type: 'MultiPoint', coordinates: [[10, 40], [40, 30], [20, 20]] })
eq('MULTIPOINT 括號座標', wktToGeoJson('MULTIPOINT ((10 40), (40 30))'),
  { type: 'MultiPoint', coordinates: [[10, 40], [40, 30]] })
eq('MULTILINESTRING', wktToGeoJson('MULTILINESTRING ((10 10, 20 20), (40 40, 30 30))'),
  { type: 'MultiLineString', coordinates: [[[10, 10], [20, 20]], [[40, 40], [30, 30]]] })
eq('MULTIPOLYGON', wktToGeoJson('MULTIPOLYGON (((30 20, 45 40, 10 40, 30 20)), ((15 5, 40 10, 10 20, 15 5)))'),
  { type: 'MultiPolygon', coordinates: [
    [[[30, 20], [45, 40], [10, 40], [30, 20]]],
    [[[15, 5], [40, 10], [10, 20], [15, 5]]],
  ] })
const gc = wktToGeoJson('GEOMETRYCOLLECTION (POINT (40 10), LINESTRING (10 10, 20 20))')
eq('GEOMETRYCOLLECTION', gc, { type: 'GeometryCollection', geometries: [
  { type: 'Point', coordinates: [40, 10] },
  { type: 'LineString', coordinates: [[10, 10], [20, 20]] },
] })
eq('EWKT SRID 前綴容忍', wktToGeoJson('SRID=4326;POINT (1 2)'), { type: 'Point', coordinates: [1, 2] })

// EMPTY
eq('POINT EMPTY', wktToGeoJson('POINT EMPTY'), { type: 'Point', coordinates: [] })
eq('POLYGON EMPTY', wktToGeoJson('POLYGON EMPTY'), { type: 'Polygon', coordinates: [] })
eq('GEOMETRYCOLLECTION EMPTY', wktToGeoJson('GEOMETRYCOLLECTION EMPTY'), { type: 'GeometryCollection', geometries: [] })

// ---- GeoJSON → WKT ----
eq('→ POINT', geoJsonToWkt({ type: 'Point', coordinates: [30, 10] }), 'POINT (30 10)')
eq('→ LINESTRING', geoJsonToWkt({ type: 'LineString', coordinates: [[30, 10], [10, 30]] }), 'LINESTRING (30 10, 10 30)')
eq('→ POLYGON 有洞', geoJsonToWkt({ type: 'Polygon', coordinates: [
  [[35, 10], [45, 45], [15, 40], [10, 20], [35, 10]],
  [[20, 30], [35, 35], [30, 20], [20, 30]],
] }), 'POLYGON ((35 10, 45 45, 15 40, 10 20, 35 10), (20 30, 35 35, 30 20, 20 30))')
eq('→ MULTIPOINT', geoJsonToWkt({ type: 'MultiPoint', coordinates: [[10, 40], [40, 30]] }), 'MULTIPOINT (10 40, 40 30)')
eq('→ MULTIPOLYGON', geoJsonToWkt({ type: 'MultiPolygon', coordinates: [[[[30, 20], [45, 40], [10, 40], [30, 20]]]] }),
  'MULTIPOLYGON (((30 20, 45 40, 10 40, 30 20)))')
eq('→ POINT EMPTY', geoJsonToWkt({ type: 'Point', coordinates: [] }), 'POINT EMPTY')
eq('→ GEOMETRYCOLLECTION', geoJsonToWkt({ type: 'GeometryCollection', geometries: [
  { type: 'Point', coordinates: [40, 10] },
] }), 'GEOMETRYCOLLECTION (POINT (40 10))')

// ---- round-trip ----
const samples = [
  'POINT (30 10)',
  'LINESTRING (30 10, 10 30, 40 40)',
  'POLYGON ((35 10, 45 45, 15 40, 10 20, 35 10), (20 30, 35 35, 30 20, 20 30))',
  'MULTIPOINT (10 40, 40 30, 20 20)',
  'MULTILINESTRING ((10 10, 20 20), (40 40, 30 30))',
  'MULTIPOLYGON (((30 20, 45 40, 10 40, 30 20)), ((15 5, 40 10, 10 20, 15 5)))',
  'GEOMETRYCOLLECTION (POINT (40 10), LINESTRING (10 10, 20 20))',
]
for (const w of samples) {
  eq('round-trip ' + w.split(' ')[0], geoJsonToWkt(wktToGeoJson(w)), w)
}

// ---- GeoJSON 文字(Feature / FeatureCollection)→ WKT ----
eq('Feature → WKT', geoJsonTextToWkt(JSON.stringify({ type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] }, properties: {} })), 'POINT (1 2)')
eq('FeatureCollection → 多行 WKT', geoJsonTextToWkt(JSON.stringify({ type: 'FeatureCollection', features: [
  { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] }, properties: {} },
  { type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }, properties: {} },
] })), 'POINT (1 2)\nLINESTRING (0 0, 1 1)')
eq('裸幾何字串 → WKT', geoJsonTextToWkt('{"type":"Point","coordinates":[5,6]}'), 'POINT (5 6)')

// ---- 錯誤處理 ----
throws('空字串丟錯', () => wktToGeoJson('   '))
throws('未知型別丟錯', () => wktToGeoJson('CIRCLE (0 0 5)'))
throws('括號不匹配丟錯', () => wktToGeoJson('POINT (30 10'))
throws('座標不足丟錯', () => wktToGeoJson('POINT (30)'))
throws('結尾多餘內容丟錯', () => wktToGeoJson('POINT (1 2) EXTRA'))
throws('GeoJSON 無幾何丟錯', () => geoJsonTextToWkt('{"type":"FeatureCollection","features":[]}'))

if (fail) { console.error(`\n${fail} 項失敗`); process.exit(1) }
console.log('\n全部通過')
