/*
  方位角 / 羅盤方位引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
   - initialBearing:從 A 點看 B 點的「起始方位角」(沿大圓出發時的羅盤角度,0–360°,正北為 0、順時針)。
   - finalBearing:抵達 B 點時的「到達方位角」(因大圓路線會轉向,與起始不同)。
   - backBearing:反方位角(180° 對面)。
   - compassPoint:方位角 → 羅盤方位名(4 / 8 / 16 方位,中英對照)。
   - distance:沿地表的大圓距離(複用 geoCoord 的 haversine)。
  與 geo-coord(座標換算 / 距離)互補。全程在你的瀏覽器計算,不連網、不上傳。
*/

import { haversine, parsePair, validate } from './geoCoord'

export { parsePair, validate }

const toRad = (x: number) => (x * Math.PI) / 180
const toDeg = (x: number) => (x * 180) / Math.PI

/** 把任意角度正規化到 [0, 360)。 */
export function normalizeBearing(deg: number): number {
  return ((deg % 360) + 360) % 360
}

/** 從 (lat1,lon1) 看 (lat2,lon2) 的起始方位角(0–360°,正北 0、順時針)。 */
export function initialBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = toRad(lat1)
  const φ2 = toRad(lat2)
  const Δλ = toRad(lon2 - lon1)
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return normalizeBearing(toDeg(Math.atan2(y, x)))
}

/** 抵達 (lat2,lon2) 時的到達方位角(= 反向起始方位角 + 180°)。 */
export function finalBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return normalizeBearing(initialBearing(lat2, lon2, lat1, lon1) + 180)
}

/** 反方位角(back azimuth):正對面方向。 */
export function backBearing(deg: number): number {
  return normalizeBearing(deg + 180)
}

/** 大圓距離(公尺),複用 haversine。 */
export function distance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return haversine(lat1, lon1, lat2, lon2)
}

const POINTS_16_EN = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
]
const POINTS_16_ZH = [
  '北', '北北東', '東北', '東北東', '東', '東南東', '東南', '南南東',
  '南', '南南西', '西南', '西南西', '西', '西北西', '西北', '北北西',
]

export interface CompassPoint {
  abbr: string // 英文縮寫,如 NNE
  zh: string // 中文,如 北北東
  index: number // 在所選精度方位環中的序號
}

/**
 * 方位角 → 羅盤方位名。
 * precision:1 = 4 方位(N/E/S/W)、2 = 8 方位(加 NE…)、3 = 16 方位(加 NNE…)。
 */
export function compassPoint(bearing: number, precision: 1 | 2 | 3 = 3): CompassPoint {
  const b = normalizeBearing(bearing)
  const divisions = precision === 1 ? 4 : precision === 2 ? 8 : 16
  const stepIn16 = 16 / divisions
  // 直接把方位角四捨五入到所選精度的方位環,再換算回 16 方位環的索引取名稱
  const idxSel = Math.round(b / (360 / divisions)) % divisions
  const idxIn16 = (idxSel * stepIn16) % 16
  return { abbr: POINTS_16_EN[idxIn16], zh: POINTS_16_ZH[idxIn16], index: idxSel }
}

export interface BearingResult {
  initial: number
  final: number
  back: number
  distanceM: number
  compass: CompassPoint
}

/** 一次算出 A→B 的起始/到達/反方位角、距離與羅盤方位。 */
export function computeBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): BearingResult {
  const initial = initialBearing(lat1, lon1, lat2, lon2)
  return {
    initial,
    final: finalBearing(lat1, lon1, lat2, lon2),
    back: backBearing(initial),
    distanceM: distance(lat1, lon1, lat2, lon2),
    compass: compassPoint(initial, 3),
  }
}
