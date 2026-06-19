/*
  CSS 漸層產生引擎回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-gradientmaker.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `gradientmaker-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/gradientMaker.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { stopsToString, buildGradient, buildCSS, distributeStops, reverseStops } = await import(
  'file://' + out
)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

const two = [
  { color: '#fff', pos: 0 },
  { color: '#000', pos: 100 },
]

// --- stopsToString ---
check('色標組字串', stopsToString(two) === '#fff 0%, #000 100%')
check('依位置排序', stopsToString([
  { color: '#000', pos: 100 },
  { color: '#fff', pos: 0 },
]) === '#fff 0%, #000 100%')
check('位置夾在 0–100 且四捨五入', stopsToString([
  { color: '#a', pos: -20 },
  { color: '#b', pos: 130 },
]) === '#a 0%, #b 100%')
check('小數位置四捨五入', stopsToString([{ color: '#a', pos: 33.6 }]) === '#a 34%')

// --- buildGradient ---
check('linear 字串', buildGradient({ type: 'linear', angle: 90, stops: two }) === 'linear-gradient(90deg, #fff 0%, #000 100%)')
check('角度正規化(420→60)', buildGradient({ type: 'linear', angle: 420, stops: two }) === 'linear-gradient(60deg, #fff 0%, #000 100%)')
check('角度負值正規化(-90→270)', buildGradient({ type: 'linear', angle: -90, stops: two }) === 'linear-gradient(270deg, #fff 0%, #000 100%)')
check('radial 字串', buildGradient({ type: 'radial', shape: 'circle', position: 'center', stops: two }) === 'radial-gradient(circle at center, #fff 0%, #000 100%)')
check('radial ellipse / 位置', buildGradient({ type: 'radial', shape: 'ellipse', position: 'top left', stops: two }) === 'radial-gradient(ellipse at top left, #fff 0%, #000 100%)')
check('conic 字串', buildGradient({ type: 'conic', angle: 45, position: 'center', stops: two }) === 'conic-gradient(from 45deg at center, #fff 0%, #000 100%)')

// --- buildCSS ---
check('buildCSS 前綴', buildCSS({ type: 'linear', angle: 0, stops: two }) === 'background: linear-gradient(0deg, #fff 0%, #000 100%);')

// --- distributeStops ---
const dist = distributeStops([
  { color: '#a', pos: 10 },
  { color: '#b', pos: 12 },
  { color: '#c', pos: 90 },
])
check('平均分布 0/50/100', dist.map((s) => s.pos).join(',') === '0,50,100')
check('單一色標分布為 0', distributeStops([{ color: '#a', pos: 70 }])[0].pos === 0)

// --- reverseStops ---
const rev = reverseStops([
  { color: '#a', pos: 0 },
  { color: '#b', pos: 30 },
  { color: '#c', pos: 100 },
])
check('反轉位置鏡射', rev.map((s) => `${s.color}:${s.pos}`).join(',') === '#c:0,#b:70,#a:100')

if (fail) {
  console.error(`\n${fail} 項失敗`)
  process.exit(1)
}
console.log('\n全部通過')
