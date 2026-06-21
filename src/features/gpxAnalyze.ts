/*
  GPX / KML 軌跡分析引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  解析 Garmin / Strava / 手機 App 匯出的 .gpx 或 Google Earth 的 .kml 軌跡,
  算出總距離、爬升 / 下降、最高 / 最低海拔、總時間、移動均速 / 最高速度,並給出邊界供畫路線預覽。

  全程在你瀏覽器計算,軌跡(含你的所在位置)不上傳、不連網。
*/
import { haversine } from './geoCoord'

export interface TrackPoint {
  lat: number
  lon: number
  ele?: number // 海拔(公尺)
  time?: number // epoch 毫秒
}
export interface Track {
  name?: string
  points: TrackPoint[]
}
export interface Waypoint {
  lat: number
  lon: number
  name?: string
  ele?: number
}
export interface ParsedTracks {
  format: 'gpx' | 'kml' | ''
  tracks: Track[]
  waypoints: Waypoint[]
  error?: string
}

export interface TrackStats {
  pointCount: number
  distance: number // 公尺
  elevationGain: number // 公尺
  elevationLoss: number
  minEle?: number
  maxEle?: number
  hasTime: boolean
  startTime?: number
  endTime?: number
  duration?: number // 毫秒(總經過時間)
  avgSpeed?: number // 公尺/秒(距離 ÷ 總時間)
  maxSpeed?: number // 公尺/秒(逐段)
  bounds?: { minLat: number; maxLat: number; minLon: number; maxLon: number }
}

// ---- 共用小工具 ----

function attrNum(tag: string, name: string): number {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'))
  return m ? parseFloat(m[1]) : NaN
}
function parseTimeMs(s: string | undefined): number | undefined {
  if (!s) return undefined
  const t = Date.parse(s.trim())
  return Number.isNaN(t) ? undefined : t
}
function tagInner(scope: string, tag: string): string | undefined {
  const m = scope.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}\\s*>`, 'i'))
  return m ? m[1].trim() : undefined
}
function blocks(xml: string, tag: string): string[] {
  const out: string[] = []
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}\\s*>`, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) out.push(m[1])
  return out
}

// ---- GPX ----

function parseGpxPoints(scope: string, tag: string): TrackPoint[] {
  const out: TrackPoint[] = []
  const re = new RegExp(`<${tag}\\b([^>]*?)(/?)>`, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(scope))) {
    const lat = attrNum(m[1], 'lat')
    const lon = attrNum(m[1], 'lon')
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    let ele: number | undefined
    let time: number | undefined
    if (m[2] !== '/') {
      const closeRe = new RegExp(`</${tag}\\s*>`, 'gi')
      closeRe.lastIndex = re.lastIndex
      const c = closeRe.exec(scope)
      const inner = c ? scope.slice(re.lastIndex, c.index) : ''
      const e = tagInner(inner, 'ele')
      if (e != null) { const v = parseFloat(e); if (Number.isFinite(v)) ele = v }
      time = parseTimeMs(tagInner(inner, 'time'))
      if (c) re.lastIndex = closeRe.lastIndex
    }
    out.push({ lat, lon, ele, time })
  }
  return out
}

export function parseGpx(xml: string): ParsedTracks {
  const tracks: Track[] = []
  for (const trk of blocks(xml, 'trk')) {
    const name = tagInner(trk, 'name')
    const segs = blocks(trk, 'trkseg')
    const segScopes = segs.length ? segs : [trk]
    const points: TrackPoint[] = []
    for (const seg of segScopes) points.push(...parseGpxPoints(seg, 'trkpt'))
    if (points.length) tracks.push({ name, points })
  }
  // 沒有 trk 時,把 route(rte/rtept)當作軌跡
  if (!tracks.length) {
    for (const rte of blocks(xml, 'rte')) {
      const points = parseGpxPoints(rte, 'rtept')
      if (points.length) tracks.push({ name: tagInner(rte, 'name'), points })
    }
  }
  // 路徑點 wpt
  const waypoints: Waypoint[] = []
  const re = /<wpt\b([^>]*?)(\/?)>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    const lat = attrNum(m[1], 'lat')
    const lon = attrNum(m[1], 'lon')
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    let name: string | undefined
    if (m[2] !== '/') {
      const closeRe = /<\/wpt\s*>/gi
      closeRe.lastIndex = re.lastIndex
      const c = closeRe.exec(xml)
      if (c) { name = tagInner(xml.slice(re.lastIndex, c.index), 'name'); re.lastIndex = closeRe.lastIndex }
    }
    waypoints.push({ lat, lon, name })
  }
  return { format: 'gpx', tracks, waypoints }
}

// ---- KML(注意:KML 座標順序為 經度,緯度,海拔)----

function parseKmlCoordString(text: string): TrackPoint[] {
  const out: TrackPoint[] = []
  for (const tok of text.trim().split(/\s+/)) {
    if (!tok) continue
    const parts = tok.split(',')
    const lon = parseFloat(parts[0])
    const lat = parseFloat(parts[1])
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const ele = parts.length > 2 ? parseFloat(parts[2]) : NaN
    out.push({ lat, lon, ele: Number.isFinite(ele) ? ele : undefined })
  }
  return out
}

export function parseKml(xml: string): ParsedTracks {
  const tracks: Track[] = []
  const waypoints: Waypoint[] = []

  for (const pm of blocks(xml, 'Placemark')) {
    const name = tagInner(pm, 'name')
    // gx:Track(逐點 when + gx:coord「經 緯 海拔」)
    const gxCoords = blocks(pm, 'gx:coord').map((c) => c)
    if (gxCoords.length || /<gx:Track/i.test(pm)) {
      const coordTexts = (pm.match(/<gx:coord>\s*([^<]+)<\/gx:coord>/gi) || []).map((s) =>
        s.replace(/<\/?gx:coord>/gi, '').trim(),
      )
      const whens = (pm.match(/<when>\s*([^<]+)<\/when>/gi) || []).map((s) => s.replace(/<\/?when>/gi, '').trim())
      const points: TrackPoint[] = []
      coordTexts.forEach((ct, i) => {
        const p = ct.split(/\s+/)
        const lon = parseFloat(p[0])
        const lat = parseFloat(p[1])
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return
        const ele = p.length > 2 ? parseFloat(p[2]) : NaN
        points.push({ lat, lon, ele: Number.isFinite(ele) ? ele : undefined, time: parseTimeMs(whens[i]) })
      })
      if (points.length) { tracks.push({ name, points }); continue }
    }
    // LineString / LinearRing
    let added = false
    for (const ls of [...blocks(pm, 'LineString'), ...blocks(pm, 'LinearRing')]) {
      const coords = tagInner(ls, 'coordinates')
      if (coords) {
        const points = parseKmlCoordString(coords)
        if (points.length) { tracks.push({ name, points }); added = true }
      }
    }
    if (added) continue
    // Point → 路徑點
    for (const pt of blocks(pm, 'Point')) {
      const coords = tagInner(pt, 'coordinates')
      const p = coords ? parseKmlCoordString(coords)[0] : undefined
      if (p) waypoints.push({ lat: p.lat, lon: p.lon, ele: p.ele, name })
    }
  }
  return { format: 'kml', tracks, waypoints }
}

/** 自動辨識 GPX / KML 並解析。 */
export function parseTrackFile(text: string): ParsedTracks {
  const t = (text || '').trim()
  if (!t) return { format: '', tracks: [], waypoints: [], error: '沒有內容' }
  if (/<gpx\b/i.test(t) || /<trkpt\b/i.test(t)) return parseGpx(t)
  if (/<kml\b/i.test(t) || /<coordinates\b/i.test(t) || /<gx:coord/i.test(t)) return parseKml(t)
  // 退而求其次:有 trkpt 當 gpx,有 coordinates 當 kml
  if (/<rtept\b|<wpt\b/i.test(t)) return parseGpx(t)
  return { format: '', tracks: [], waypoints: [], error: '無法辨識為 GPX 或 KML 軌跡' }
}

/**
 * 計算單一軌跡的統計。
 * eleThreshold:海拔變化小於此值(公尺)的雜訊不計入爬升 / 下降,預設 0(不過濾)。
 */
export function analyzeTrack(points: TrackPoint[], eleThreshold = 0): TrackStats {
  const s: TrackStats = { pointCount: points.length, distance: 0, elevationGain: 0, elevationLoss: 0, hasTime: false }
  if (!points.length) return s

  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity
  let minEle = Infinity, maxEle = -Infinity, hasEle = false
  let lastEle: number | undefined
  let maxSpeed = 0
  const times: number[] = []

  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat)
    minLon = Math.min(minLon, p.lon); maxLon = Math.max(maxLon, p.lon)
    if (p.ele != null) {
      hasEle = true
      minEle = Math.min(minEle, p.ele); maxEle = Math.max(maxEle, p.ele)
      if (lastEle != null) {
        const d = p.ele - lastEle
        if (Math.abs(d) >= eleThreshold) { if (d > 0) s.elevationGain += d; else s.elevationLoss += -d }
      }
      lastEle = p.ele
    }
    if (p.time != null) times.push(p.time)
    if (i > 0) {
      const prev = points[i - 1]
      const segDist = haversine(prev.lat, prev.lon, p.lat, p.lon)
      s.distance += segDist
      if (prev.time != null && p.time != null && p.time > prev.time) {
        const v = segDist / ((p.time - prev.time) / 1000)
        if (Number.isFinite(v)) maxSpeed = Math.max(maxSpeed, v)
      }
    }
  }

  s.bounds = { minLat, maxLat, minLon, maxLon }
  if (hasEle) { s.minEle = minEle; s.maxEle = maxEle }
  if (times.length >= 2) {
    s.hasTime = true
    s.startTime = Math.min(...times)
    s.endTime = Math.max(...times)
    s.duration = s.endTime - s.startTime
    if (s.duration > 0) s.avgSpeed = s.distance / (s.duration / 1000)
    if (maxSpeed > 0) s.maxSpeed = maxSpeed
  }
  return s
}

/**
 * 多條軌跡的整體摘要:距離 / 爬升 / 下降逐條相加(不在軌跡之間補上跳接段),
 * 邊界、海拔極值、時間範圍取全域。
 */
export function analyzeAll(tracks: Track[], eleThreshold = 0): TrackStats {
  const per = tracks.map((t) => analyzeTrack(t.points, eleThreshold))
  const all: TrackStats = {
    pointCount: per.reduce((a, s) => a + s.pointCount, 0),
    distance: per.reduce((a, s) => a + s.distance, 0),
    elevationGain: per.reduce((a, s) => a + s.elevationGain, 0),
    elevationLoss: per.reduce((a, s) => a + s.elevationLoss, 0),
    hasTime: per.some((s) => s.hasTime),
  }
  const bounded = per.filter((s) => s.bounds)
  if (bounded.length) {
    all.bounds = {
      minLat: Math.min(...bounded.map((s) => s.bounds!.minLat)),
      maxLat: Math.max(...bounded.map((s) => s.bounds!.maxLat)),
      minLon: Math.min(...bounded.map((s) => s.bounds!.minLon)),
      maxLon: Math.max(...bounded.map((s) => s.bounds!.maxLon)),
    }
  }
  const eles = per.filter((s) => s.minEle != null)
  if (eles.length) {
    all.minEle = Math.min(...eles.map((s) => s.minEle!))
    all.maxEle = Math.max(...eles.map((s) => s.maxEle!))
  }
  const timed = per.filter((s) => s.startTime != null)
  if (timed.length) {
    all.startTime = Math.min(...timed.map((s) => s.startTime!))
    all.endTime = Math.max(...timed.map((s) => s.endTime!))
    all.duration = all.endTime - all.startTime
    if (all.duration > 0) all.avgSpeed = all.distance / (all.duration / 1000)
    const ms = per.map((s) => s.maxSpeed ?? 0)
    if (Math.max(...ms) > 0) all.maxSpeed = Math.max(...ms)
  }
  return all
}
