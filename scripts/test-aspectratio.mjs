/*
  長寬比與尺寸縮放引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-aspectratio.mjs
  oracle 以數學定義手算為準:gcd 約分、維持比例求邊、contain/cover 縮放。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `aspectratio-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/aspectRatio.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { gcd, simplifyRatio, commonName, orientation, solveDimension, fit, megapixels, round } =
  await import('file://' + out)

let fail = 0
function eq(note, got, want) {
  const g = JSON.stringify(got)
  const w = JSON.stringify(want)
  if (g !== w) {
    console.error(`✗ ${note}\n   got:  ${g}\n   want: ${w}`)
    fail++
  } else {
    console.log(`✓ ${note}`)
  }
}

// gcd
eq('gcd(1920,1080)=120', gcd(1920, 1080), 120)
eq('gcd(0,5)=5', gcd(0, 5), 5)
eq('gcd 取絕對值', gcd(-12, 8), 4)

// simplifyRatio
eq('1920×1080 → 16:9', simplifyRatio(1920, 1080).text, '16:9')
eq('1280×1024 → 5:4', simplifyRatio(1280, 1024).text, '5:4')
eq('1280×720 → 16:9', simplifyRatio(1280, 720).text, '16:9')
eq('100×100 → 1:1', simplifyRatio(100, 100).text, '1:1')
eq('小數 16.0×9.0 → 16:9', simplifyRatio(16, 9).text, '16:9')
eq('小數 1.5×1 放大約分 → 3:2', simplifyRatio(1.5, 1).text, '3:2')
const r = simplifyRatio(1920, 1080)
eq('decimal 寬/高', round(r.decimal, 4), 1.7778)
eq('valid 旗標', r.valid, true)
eq('寬為 0 報錯', simplifyRatio(0, 9).error, '寬與高需大於 0')
eq('非數字報錯', simplifyRatio(NaN, 9).error, '寬與高需為數字')

// commonName
eq('16:9 名稱', commonName(1920, 1080).includes('寬螢幕'), true)
eq('1:1 名稱', commonName(500, 500).includes('正方形'), true)
eq('9:16 直式', commonName(1080, 1920).includes('短影音'), true)
eq('容差內 1916×1080 仍判 16:9', commonName(1916, 1080).includes('寬螢幕'), true)
eq('怪比例無名稱', commonName(1000, 813), '')

// orientation
eq('橫式', orientation(1920, 1080), 'landscape')
eq('直式', orientation(1080, 1920), 'portrait')
eq('正方', orientation(500, 500), 'square')

// solveDimension:16:9 給寬 1920 → 高 1080
eq('給寬求高', solveDimension(16, 9, { width: 1920 }), { width: 1920, height: 1080 })
eq('給高求寬', solveDimension(16, 9, { height: 720 }), { width: 1280, height: 720 })
eq('3:2 給寬 600 → 高 400', solveDimension(3, 2, { width: 600 }), { width: 600, height: 400 })
eq('無輸入回 null', solveDimension(16, 9, {}), null)
eq('比例 0 回 null', solveDimension(0, 9, { width: 100 }), null)

// fit:把 1600×1200(4:3)塞進 800×800
eq('contain:塞進方框取較小縮放', fit(1600, 1200, 800, 800, 'contain'), {
  width: 800,
  height: 600,
  scale: 0.5,
})
const cover = fit(1600, 1200, 800, 800, 'cover')
eq('cover 寬填滿(較大縮放)', round(cover.width, 2), 1066.67)
eq('cover 高=800', cover.height, 800)
eq('cover scale 取較大', round(cover.scale, 4), 0.6667)
eq('contain 預設', fit(1000, 500, 100, 100).height, 50)
eq('來源為 0 回 null', fit(0, 500, 100, 100), null)

// megapixels
eq('1920×1080 ≈ 2.07 MP', round(megapixels(1920, 1080), 2), 2.07)
eq('4000×3000 = 12 MP', megapixels(4000, 3000), 12)

// round
eq('round 去零', round(1.77777, 4), 1.7778)
eq('round 整數', round(50.0, 2), 50)

if (fail) {
  console.error(`\n${fail} 個測試失敗`)
  process.exit(1)
}
console.log('\n全部通過 ✓')
