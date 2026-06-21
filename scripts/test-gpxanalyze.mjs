/*
  GPX / KML 軌跡分析引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-gpxanalyze.mjs
  oracle:手構符合規範的 GPX / KML 片段 + 以 haversine 與已知座標手算的距離/爬升/時間,逐項比對。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `gpx-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/gpxAnalyze.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { parseGpx, parseKml, parseTrackFile, analyzeTrack, analyzeAll } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else { fail++; console.error(`✗ ${note}`) }
}
const approx = (a, b, tol) => Math.abs(a - b) <= tol

// ---- GPX 解析 ----
const gpx = `<?xml version="1.0"?>
<gpx version="1.1" creator="test">
  <trk><name>晨跑</name><trkseg>
    <trkpt lat="25.0330" lon="121.5654"><ele>10</ele><time>2026-06-21T08:00:00Z</time></trkpt>
    <trkpt lat="25.0340" lon="121.5654"><ele>15</ele><time>2026-06-21T08:01:00Z</time></trkpt>
    <trkpt lat="25.0350" lon="121.5654"><ele>12</ele><time>2026-06-21T08:02:00Z</time></trkpt>
  </trkseg></trk>
  <wpt lat="25.0330" lon="121.5654"><name>起點</name></wpt>
</gpx>`
const g = parseGpx(gpx)
check('GPX format', g.format === 'gpx')
check('GPX 1 條軌跡', g.tracks.length === 1 && g.tracks[0].name === '晨跑')
check('GPX 3 個點', g.tracks[0].points.length === 3)
check('GPX 點含 ele/time', g.tracks[0].points[0].ele === 10 && typeof g.tracks[0].points[0].time === 'number')
check('GPX waypoint', g.waypoints.length === 1 && g.waypoints[0].name === '起點')

// 0.001 度緯度 ≈ 111.2 公尺;兩段共 0.002 度 ≈ 222.4 公尺
const gs = analyzeTrack(g.tracks[0].points)
check('GPX 距離約 222m', approx(gs.distance, 222.4, 3))
check('GPX 爬升 5m(10→15)', approx(gs.elevationGain, 5, 0.001))
check('GPX 下降 3m(15→12)', approx(gs.elevationLoss, 3, 0.001))
check('GPX 海拔範圍 10~15', gs.minEle === 10 && gs.maxEle === 15)
check('GPX 有時間', gs.hasTime === true)
check('GPX 總時間 120 秒', gs.duration === 120000)
check('GPX 均速 = 距離/120', approx(gs.avgSpeed, gs.distance / 120, 0.01))
check('GPX 最高速度 > 0', gs.maxSpeed > 0)
check('GPX bounds', approx(gs.bounds.minLat, 25.033, 1e-6) && approx(gs.bounds.maxLat, 25.035, 1e-6))

// ---- 海拔雜訊閾值 ----
const noisy = [{ lat: 0, lon: 0, ele: 100 }, { lat: 0, lon: 0, ele: 100.5 }, { lat: 0, lon: 0, ele: 103 }]
check('閾值 0:爬升 3', approx(analyzeTrack(noisy, 0).elevationGain, 3, 0.001))
check('閾值 1:略過 0.5 雜訊 → 爬升 2.5', approx(analyzeTrack(noisy, 1).elevationGain, 2.5, 0.001))

// ---- 無時間 / 無海拔 ----
const plain = parseGpx(`<gpx><trk><trkseg>
  <trkpt lat="0" lon="0"/><trkpt lat="0" lon="0.001"/>
</trkseg></trk></gpx>`)
const ps = analyzeTrack(plain.tracks[0].points)
check('無時間 hasTime false', ps.hasTime === false && ps.duration === undefined)
check('無海拔 minEle undefined', ps.minEle === undefined && ps.elevationGain === 0)
check('經度距離約 111m(赤道 0.001 度)', approx(ps.distance, 111.3, 1))

// ---- 路徑(rte/rtept)當軌跡 ----
const rte = parseGpx(`<gpx><rte><name>路線</name>
  <rtept lat="1" lon="1"/><rtept lat="1.001" lon="1"/>
</rte></gpx>`)
check('rte 當軌跡', rte.tracks.length === 1 && rte.tracks[0].points.length === 2 && rte.tracks[0].name === '路線')

// ---- KML LineString(注意 經,緯,海拔)----
const kml = `<?xml version="1.0"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark><name>步道</name>
      <LineString><coordinates>
        121.5654,25.0330,10
        121.5654,25.0340,20
      </coordinates></LineString>
    </Placemark>
    <Placemark><name>涼亭</name><Point><coordinates>121.5700,25.0400,5</coordinates></Point></Placemark>
  </Document>
</kml>`
const k = parseKml(kml)
check('KML format', k.format === 'kml')
check('KML 1 條軌跡 2 點', k.tracks.length === 1 && k.tracks[0].points.length === 2)
check('KML 座標順序正確(lat=25.033)', approx(k.tracks[0].points[0].lat, 25.033, 1e-6) && approx(k.tracks[0].points[0].lon, 121.5654, 1e-6))
check('KML 海拔讀入', k.tracks[0].points[1].ele === 20)
check('KML Point → waypoint', k.waypoints.length === 1 && k.waypoints[0].name === '涼亭' && approx(k.waypoints[0].lat, 25.04, 1e-6))
check('KML 距離約 111m', approx(analyzeTrack(k.tracks[0].points).distance, 111.3, 1))

// ---- KML gx:Track ----
const gxkml = `<kml xmlns:gx="http://www.google.com/kml/ext/2.2"><Placemark><name>飛行</name>
  <gx:Track>
    <when>2026-06-21T08:00:00Z</when>
    <when>2026-06-21T08:00:10Z</when>
    <gx:coord>121.0 25.0 100</gx:coord>
    <gx:coord>121.0 25.001 110</gx:coord>
  </gx:Track>
</Placemark></kml>`
const gx = parseKml(gxkml)
check('gx:Track 解析 2 點', gx.tracks.length === 1 && gx.tracks[0].points.length === 2)
check('gx:coord 順序(經 緯 海拔)', approx(gx.tracks[0].points[0].lat, 25.0, 1e-6) && approx(gx.tracks[0].points[0].lon, 121.0, 1e-6))
check('gx:Track 時間配對', gx.tracks[0].points[1].time - gx.tracks[0].points[0].time === 10000)
check('gx:Track 海拔', gx.tracks[0].points[1].ele === 110)

// ---- 自動辨識 ----
check('parseTrackFile 辨識 GPX', parseTrackFile(gpx).format === 'gpx')
check('parseTrackFile 辨識 KML', parseTrackFile(kml).format === 'kml')
check('parseTrackFile 空字串 error', !!parseTrackFile('  ').error)
check('parseTrackFile 非軌跡 error', !!parseTrackFile('<html></html>').error)

// ---- analyzeAll(多軌跡不補跳接段)----
const multi = [
  { points: [{ lat: 0, lon: 0, ele: 0 }, { lat: 0, lon: 0.001, ele: 10 }] },
  { points: [{ lat: 5, lon: 5, ele: 100 }, { lat: 5, lon: 5.001, ele: 90 }] },
]
const allStats = analyzeAll(multi)
check('analyzeAll 距離 = 兩段相加(不含跳接)', approx(allStats.distance, 111.3 * 2, 3))
check('analyzeAll 爬升 10 下降 10', approx(allStats.elevationGain, 10, 0.001) && approx(allStats.elevationLoss, 10, 0.001))
check('analyzeAll 點數 4', allStats.pointCount === 4)
check('analyzeAll 全域海拔 0~100', allStats.minEle === 0 && allStats.maxEle === 100)
check('analyzeAll bounds 全域', approx(allStats.bounds.maxLat, 5, 1e-6))

console.log(fail === 0 ? '\n全部通過 ✅' : `\n${fail} 筆失敗 ❌`)
process.exit(fail === 0 ? 0 : 1)
