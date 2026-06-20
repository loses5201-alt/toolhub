/*
  OKLCH / OKLab 引擎回歸測試(node 直接跑)。
  執行:node scripts/test-oklch.mjs
  oracle:
   1) 已知 sRGB → OKLab/OKLCH 參考值(Ottosson 公布 + CSS Color 4 範例):
      白=(1,0,0)、黑=(0,0,0)、紅/綠/藍三原色。
   2) 往返一致性:對大量 sRGB 顏色做 rgb→oklch→rgb,需回到原值(±1 量化誤差)。
   3) 灰階色相無關:純灰的 OKLab a,b ≈ 0。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `oklch-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/oklch.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { rgbToOklab, rgbToOklch, oklchToRgb } = await import('file://' + out)

let pass = 0
let fail = 0
function ok(name, cond) {
  if (cond) pass++
  else {
    fail++
    console.error('✗', name)
  }
}
function approx(name, got, want, tol) {
  const good = Math.abs(got - want) <= tol
  if (!good) console.error(`✗ ${name}: got ${got}, want ${want} (tol ${tol})`)
  ok(name, good)
}

// ── 1) 已知 OKLab 參考值 ──
function labApprox(name, rgb, L, a, b, tol = 0.001) {
  const lab = rgbToOklab(rgb)
  approx(`${name} L`, lab.L, L, tol)
  approx(`${name} a`, lab.a, a, tol)
  approx(`${name} b`, lab.b, b, tol)
}
labApprox('白 #fff', { r: 255, g: 255, b: 255 }, 1.0, 0.0, 0.0, 1e-5)
labApprox('黑 #000', { r: 0, g: 0, b: 0 }, 0.0, 0.0, 0.0, 1e-7)
labApprox('紅 #f00', { r: 255, g: 0, b: 0 }, 0.62796, 0.22486, 0.12585)
labApprox('綠 #0f0', { r: 0, g: 255, b: 0 }, 0.86644, -0.23389, 0.1795)
labApprox('藍 #00f', { r: 0, g: 0, b: 255 }, 0.45201, -0.03246, -0.31153)

// 已知 OKLCH(由 OKLab 換算的極座標)
function lchApprox(name, rgb, L, C, H) {
  const lch = rgbToOklch(rgb)
  approx(`${name} L`, lch.L, L, 0.001)
  approx(`${name} C`, lch.C, C, 0.001)
  approx(`${name} H`, lch.H, H, 0.1)
}
lchApprox('紅 oklch', { r: 255, g: 0, b: 0 }, 0.62796, 0.25768, 29.234)
lchApprox('綠 oklch', { r: 0, g: 255, b: 0 }, 0.86644, 0.29483, 142.495)
lchApprox('藍 oklch', { r: 0, g: 0, b: 255 }, 0.45201, 0.31321, 264.052)

// ── 2) 往返一致性 ──
let rtFail = 0
for (let r = 0; r <= 255; r += 17) {
  for (let g = 0; g <= 255; g += 51) {
    for (let b = 0; b <= 255; b += 85) {
      const back = oklchToRgb(rgbToOklch({ r, g, b }))
      if (
        Math.abs(back.rgb.r - r) > 1 ||
        Math.abs(back.rgb.g - g) > 1 ||
        Math.abs(back.rgb.b - b) > 1 ||
        !back.inGamut
      ) {
        rtFail++
        if (rtFail <= 3) console.error(`✗ 往返 (${r},${g},${b}) → (${back.rgb.r},${back.rgb.g},${back.rgb.b}) inGamut=${back.inGamut}`)
      }
    }
  }
}
ok('sRGB 往返一致(rgb→oklch→rgb)', rtFail === 0)

// ── 3) 灰階色相無關 ──
let grayFail = 0
for (let v = 0; v <= 255; v += 15) {
  const lab = rgbToOklab({ r: v, g: v, b: v })
  if (Math.abs(lab.a) > 1e-4 || Math.abs(lab.b) > 1e-4) grayFail++
}
ok('純灰 a,b ≈ 0', grayFail === 0)

// 超出 sRGB 色域偵測:高彩度藍綠在 oklch 高 C 時應落在色域外
ok('色域外偵測', oklchToRgb({ L: 0.9, C: 0.4, H: 200 }).inGamut === false)

console.log(`\nOKLCH / OKLab:${pass} 通過${fail ? `,${fail} 失敗` : ''}`)
if (fail) process.exit(1)
