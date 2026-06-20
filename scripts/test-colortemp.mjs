/*
  色溫引擎回歸測試(node 直接跑)。
  執行:node scripts/test-colortemp.mjs
  oracle:
   1) Tanner Helland 近似式的已知輸出:1000K=(255,68,0)、6600K=(255,255,255)。
   2) 物理性質:低色溫偏紅(blue=0、red=255)、高色溫偏藍(blue=255、red<255);
      整段掃描 red 不遞增、blue 不遞減,且永遠落在 0–255。
   3) mired = 10⁶/K 互逆;rgbToKelvin(kelvinToRgb(K)) 在中段約等於 K(自洽)。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `colortemp-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/colorTemp.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const {
  kelvinToRgb,
  kelvinToMired,
  miredToKelvin,
  rgbToKelvin,
  rgbToHex,
  describeKelvin,
  LIGHT_SOURCES,
  MIN_KELVIN,
  MAX_KELVIN,
} = await import('file://' + out)

let pass = 0
let fail = 0
function ok(name, cond) {
  if (cond) pass++
  else {
    fail++
    console.error('✗', name)
  }
}

// 1) 已知輸出
const c1000 = kelvinToRgb(1000)
ok('1000K = (255,68,0)', c1000.r === 255 && c1000.g === 68 && c1000.b === 0)
const c6600 = kelvinToRgb(6600)
ok('6600K = (255,255,255)', c6600.r === 255 && c6600.g === 255 && c6600.b === 255)

// 2) 物理性質
const warm = kelvinToRgb(1900)
ok('暖色 1900K:red=255、blue=0', warm.r === 255 && warm.b === 0)
const cool = kelvinToRgb(10000)
ok('冷色 10000K:blue=255、red<255', cool.b === 255 && cool.r < 255)

let prevRed = 256
let prevBlue = -1
let rangeOk = true
let redMono = true
let blueMono = true
for (let k = MIN_KELVIN; k <= MAX_KELVIN; k += 100) {
  const c = kelvinToRgb(k)
  for (const v of [c.r, c.g, c.b]) if (v < 0 || v > 255 || !Number.isInteger(v)) rangeOk = false
  if (c.r > prevRed) redMono = false
  if (c.b < prevBlue) blueMono = false
  prevRed = c.r
  prevBlue = c.b
}
ok('所有通道落在 0–255 整數', rangeOk)
ok('red 隨色溫不遞增', redMono)
ok('blue 隨色溫不遞減', blueMono)

// 邊界夾鉗
ok('低於下限夾到 1000K', rgbToHex(kelvinToRgb(500)) === rgbToHex(kelvinToRgb(1000)))
ok('高於上限夾到 40000K', rgbToHex(kelvinToRgb(99999)) === rgbToHex(kelvinToRgb(40000)))

// 3) mired 互逆
ok('mired 6500K ≈ 153.85', Math.abs(kelvinToMired(6500) - 153.846) < 0.01)
ok('mired 互逆', Math.abs(miredToKelvin(kelvinToMired(3200)) - 3200) < 1e-6)

// rgbToKelvin 自洽(中段)
for (const k of [2700, 4000, 5500, 6500, 8000]) {
  const back = rgbToKelvin(kelvinToRgb(k))
  ok(`rgbToKelvin 自洽 ~${k}K(±400)`, Math.abs(back - k) <= 400)
}

// hex 格式
ok('rgbToHex 格式', rgbToHex({ r: 255, g: 68, b: 0 }) === '#FF4400')

// describe / 對照表
ok('describeKelvin 含 hex/tone', (() => {
  const d = describeKelvin(2700)
  return d.hex.startsWith('#') && typeof d.tone === 'string' && d.tone.length > 0
})())
ok('光源對照表非空且遞增', (() => {
  if (LIGHT_SOURCES.length < 8) return false
  for (let i = 1; i < LIGHT_SOURCES.length; i++)
    if (LIGHT_SOURCES[i].kelvin <= LIGHT_SOURCES[i - 1].kelvin) return false
  return true
})())

console.log(`\n色溫:${pass} 通過,${fail} 失敗`)
if (fail) process.exit(1)
