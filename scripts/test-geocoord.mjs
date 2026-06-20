/*
  GPS 座標轉換引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-geocoord.mjs
  oracle:手算的 DD↔DMS 換算與已知地標座標(台北 101 ≈ 25.0337N, 121.5645E),
  以及 haversine 在赤道上 1 度經度 ≈ 111.195 km、對蹠點 = πR 等可手算的幾何事實。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `geocoord-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/geoCoord.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { parseComponent, toDMS, formatDMS, formatDM, validate, haversine, parsePair } =
  await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else { fail++; console.error(`✗ ${note}`) }
}
const near = (a, b, tol) => Math.abs(a - b) <= tol

// --- parseComponent ---
check('解析十進位', near(parseComponent('25.0337'), 25.0337, 1e-9))
check('解析負號', near(parseComponent('-25.0337'), -25.0337, 1e-9))
check('解析 S 半球為負', near(parseComponent('25.0337 S'), -25.0337, 1e-9))
check('解析 W 半球為負', near(parseComponent('121.5645W'), -121.5645, 1e-9))
check('解析 DMS', near(parseComponent('25°02\'01.32"N'), 25.0337, 1e-5))
check('解析 DMS 空白分隔', near(parseComponent('121 33 52.2 E'), 121.5645, 1e-5))
check('解析度分(DM)', near(parseComponent('25°2.022\'N'), 25.0337, 1e-5))

// --- toDMS / format ---
const lat = toDMS(25.0337, true)
check('toDMS 度', lat.deg === 25)
check('toDMS 分', lat.min === 2)
check('toDMS 秒', near(lat.sec, 1.32, 1e-6))
check('toDMS 半球 N', lat.hemi === 'N')
check('formatDMS 緯度', formatDMS(toDMS(25.0337, true)) === '25°02\'01.32"N')
check('formatDMS 經度', formatDMS(toDMS(121.5645, false)) === '121°33\'52.20"E')
check('toDMS 負值半球 S', toDMS(-25.0337, true).hemi === 'S')
check('toDMS 負值半球 W', toDMS(-121.5645, false).hemi === 'W')
check('formatDM', formatDM(25.0337, true, 3) === '25°2.022\'N')
// 浮點進位:秒進位到分
const carry = toDMS(10 + 59.9999999 / 60 / 1 / 1, true) // 約 10°59'59.99..."
check('toDMS 不產生 60 秒', carry.sec < 60 && carry.min < 60)

// --- validate ---
check('validate 合法回 null', validate(25, 121) === null)
check('validate 緯度超界', validate(91, 0) !== null)
check('validate 經度超界', validate(0, 181) !== null)

// --- haversine(可手算的幾何事實)---
check('haversine 同點為 0', haversine(0, 0, 0, 0) === 0)
check('赤道 1 度經度 ≈ 111195 m', near(haversine(0, 0, 0, 1), 111195, 50))
check('1 度緯度 ≈ 111195 m', near(haversine(0, 0, 1, 0), 111195, 50))
check('對蹠點 = πR ≈ 20015 km', near(haversine(0, 0, 0, 180), Math.PI * 6371008.8, 1))
// 真實城市:台北 → 東京 約 2100 km(寬鬆範圍)
const tpeToTokyo = haversine(25.0337, 121.5645, 35.6895, 139.6917)
check('台北→東京 約 2000~2200 km', tpeToTokyo > 2_000_000 && tpeToTokyo < 2_200_000)

// --- parsePair ---
const p1 = parsePair('25.0337, 121.5645')
check('parsePair 逗號', near(p1.lat, 25.0337, 1e-9) && near(p1.lon, 121.5645, 1e-9))
const p2 = parsePair('25.0337N 121.5645E')
check('parsePair 半球字母分界', near(p2.lat, 25.0337, 1e-9) && near(p2.lon, 121.5645, 1e-9))
const p3 = parsePair('25 121')
check('parsePair 空白對半', p3.lat === 25 && p3.lon === 121)
const p4 = parsePair('25°02\'01.32"N, 121°33\'52.2"E')
check('parsePair DMS 逗號', near(p4.lat, 25.0337, 1e-5) && near(p4.lon, 121.5645, 1e-5))

// --- 錯誤情況 ---
function throws(note, fn) {
  let t = false
  try { fn() } catch { t = true }
  check(note, t)
}
throws('空字串報錯', () => parseComponent(''))
throws('無數字報錯', () => parseComponent('abc'))
throws('數字過多報錯', () => parseComponent('1 2 3 4'))
throws('parsePair 單值報錯', () => parsePair('25'))

console.log(fail ? `\n${fail} 項失敗` : '\n全部通過')
process.exit(fail ? 1 : 0)
