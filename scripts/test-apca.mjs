/*
  APCA 對比引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-apca.mjs
  oracle:APCA-W3 0.1.9 公認參考值(手算驗證過):
    #888 字 / #fff 底 = Lc 63.06、#fff 字 / #888 底 = Lc -68.54、
    #000 字 / #fff 底 = Lc 106.04、#fff 字 / #000 底 ≈ Lc -107.88。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `apca-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/apca.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { sRGBtoY, apcaContrastY, apcaContrast, describeLc, parseColor } = await import(out)

let pass = 0
let fail = 0
function near(name, got, want, tol = 0.2) {
  if (typeof got === 'number' && Math.abs(got - want) <= tol) {
    pass++
  } else {
    fail++
    console.error(`✗ ${name}\n    got:  ${got}\n    want: ${want} (±${tol})`)
  }
}
function ok(name, cond) {
  if (cond) pass++
  else {
    fail++
    console.error(`✗ ${name}`)
  }
}

const C = (hex) => parseColor(hex)

// ---- sRGBtoY ----
near('Y(#fff)≈1', sRGBtoY(C('#ffffff')), 1.0, 1e-5) // 官方係數和=1.0000001
near('Y(#000)=0', sRGBtoY(C('#000000')), 0.0, 1e-9)
near('Y(#888)≈0.2210', sRGBtoY(C('#888888')), 0.22120, 0.0005)

// ---- 公認參考 Lc 值 ----
near('#888 on #fff = 63.06', apcaContrast(C('#888888'), C('#ffffff')), 63.06)
near('#fff on #888 = -68.54', apcaContrast(C('#ffffff'), C('#888888')), -68.54)
near('#000 on #fff = 106.04', apcaContrast(C('#000000'), C('#ffffff')), 106.04)
near('#fff on #000 ≈ -107.88', apcaContrast(C('#ffffff'), C('#000000')), -107.88, 0.3)

// ---- 極性與符號 ----
ok('深字淺底為正', apcaContrast(C('#222222'), C('#eeeeee')) > 0)
ok('淺字深底為負', apcaContrast(C('#eeeeee'), C('#222222')) < 0)
ok('同色 Lc=0', apcaContrastY(0.4, 0.4) === 0)
ok('差異極小 Lc=0', apcaContrastY(0.4, 0.4002) === 0)

// ---- 低對比鉗位:微小差異被裁為 0 ----
ok('近似色裁為 0', apcaContrast(C('#808080'), C('#838383')) === 0)

// ---- 範圍護欄 ----
ok('黑白絕對值最大附近', Math.abs(apcaContrast(C('#000000'), C('#ffffff'))) > 100)
ok('Lc 不超過理論上限', apcaContrast(C('#000000'), C('#ffffff')) < 110)

// ---- 單調性:背景固定為白,文字越深 Lc 越大 ----
{
  const a = apcaContrast(C('#aaaaaa'), C('#ffffff'))
  const b = apcaContrast(C('#666666'), C('#ffffff'))
  const c = apcaContrast(C('#000000'), C('#ffffff'))
  ok('文字越深對白底 Lc 越大', a < b && b < c)
}

// ---- 反白單調性:背景黑,文字越亮 |Lc| 越大 ----
{
  const a = Math.abs(apcaContrast(C('#555555'), C('#000000')))
  const b = Math.abs(apcaContrast(C('#bbbbbb'), C('#000000')))
  const c = Math.abs(apcaContrast(C('#ffffff'), C('#000000')))
  ok('反白文字越亮 |Lc| 越大', a < b && b < c)
}

// ---- describeLc ----
{
  const d = describeLc(106.04)
  ok('106 → 極佳', d.label === '極佳')
  ok('106 → normal 極性', d.polarity === 'normal')
  ok('106 → 通過內文', d.passBodyText === true)
  ok('106 → abs 正確', d.abs === 106)
}
{
  const d = describeLc(-68.54)
  ok('-68 → reverse 極性', d.polarity === 'reverse')
  ok('-68 → 通過內文', d.passBodyText === true)
  ok('-68 → abs=68.5', d.abs === 68.5)
}
{
  const d = describeLc(40)
  ok('40 → 不通過內文', d.passBodyText === false)
  ok('40 → 低對比標籤', d.label === '低對比')
}
{
  const d = describeLc(0)
  ok('0 → none 極性', d.polarity === 'none')
  ok('0 → 幾乎看不見', d.label === '幾乎看不見')
}
{
  const d = describeLc(60)
  ok('60 → 內文下限', d.passBodyText === true && d.label === '良好(內文下限)')
}

// ---- parseColor 再匯出可用 ----
ok('parseColor 解析 #fff', parseColor('#fff') !== null)
ok('parseColor 無效回 null', parseColor('not a color') === null)

console.log(`\nAPCA 對比:${pass} 通過、${fail} 失敗`)
if (fail > 0) process.exit(1)
