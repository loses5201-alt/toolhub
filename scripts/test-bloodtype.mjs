/*
  血型遺傳計算引擎回歸測試(node 直接跑)。
  執行:node scripts/test-bloodtype.mjs
  oracle(孟德爾遺傳法則手算,確定結果):
   1) 基因型→表現型:AA/AO→A、BB/BO→B、AB→AB、OO→O;Rh:含 D→+、dd→−。
   2) 龐尼特方格機率:AB×OO→A½ B½;AB×AB→A¼ AB½ B¼;AO×BO→A¼ B¼ AB¼ O¼;DD×dd→全+;Dd×Dd→+¾ −¼。
   3) 可能血型集合:A×B→{A,B,AB,O}(全部);O×AB→{A,B};O×O→{O};AB×O 不可能生 O 或 AB。
   4) Rh:−×−→只有−;+×+ 可能 + 或 −;summarize 的 impossible 集合。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `bloodtype-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/bloodType.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const {
  abacoPhenotypeOf,
  aboPhenotypeDist,
  rhPhenotypeDist,
  possibleABO,
  possibleRh,
  isABOPossible,
  summarizeABO,
  pct,
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
const setEq = (a, b) => a.length === b.length && a.every((v, i) => v === b[i])
const close = (a, b) => Math.abs(a - b) < 1e-9

// 1) 基因型 → 表現型
ok('AA→A', abacoPhenotypeOf('AA') === 'A')
ok('AO→A (未排序)', abacoPhenotypeOf('OA') === 'A')
ok('BO→B', abacoPhenotypeOf('BO') === 'B')
ok('AB→AB', abacoPhenotypeOf('BA') === 'AB')
ok('OO→O', abacoPhenotypeOf('OO') === 'O')

// 2) 龐尼特方格機率
ok('AB×OO → A½ B½ 無 AB 無 O', (() => {
  const d = aboPhenotypeDist('AB', 'OO')
  return close(d.A, 0.5) && close(d.B, 0.5) && !d.AB && !d.O
})())
ok('AB×AB → A¼ AB½ B¼', (() => {
  const d = aboPhenotypeDist('AB', 'AB')
  return close(d.A, 0.25) && close(d.AB, 0.5) && close(d.B, 0.25) && !d.O
})())
ok('AO×BO → A¼ B¼ AB¼ O¼', (() => {
  const d = aboPhenotypeDist('AO', 'BO')
  return close(d.A, 0.25) && close(d.B, 0.25) && close(d.AB, 0.25) && close(d.O, 0.25)
})())
ok('AA×AA → A 100%', (() => {
  const d = aboPhenotypeDist('AA', 'AA')
  return close(d.A, 1) && Object.keys(d).length === 1
})())
ok('OO×OO → O 100%', (() => {
  const d = aboPhenotypeDist('OO', 'OO')
  return close(d.O, 1) && Object.keys(d).length === 1
})())
ok('Rh DD×dd → 全 +', (() => {
  const d = rhPhenotypeDist('DD', 'dd')
  return close(d['+'], 1) && !d['-']
})())
ok('Rh Dd×Dd → +¾ −¼', (() => {
  const d = rhPhenotypeDist('Dd', 'Dd')
  return close(d['+'], 0.75) && close(d['-'], 0.25)
})())
ok('Rh dd×dd → 全 −', (() => {
  const d = rhPhenotypeDist('dd', 'dd')
  return close(d['-'], 1) && !d['+']
})())

// 3) 可能血型集合(只知表現型)
ok('A×B → 全部四型', setEq(possibleABO('A', 'B'), ['A', 'B', 'AB', 'O']))
ok('O×AB → {A,B}', setEq(possibleABO('O', 'AB'), ['A', 'B']))
ok('O×O → {O}', setEq(possibleABO('O', 'O'), ['O']))
ok('AB×O → {A,B}', setEq(possibleABO('AB', 'O'), ['A', 'B']))
ok('AB×AB → {A,B,AB}', setEq(possibleABO('AB', 'AB'), ['A', 'B', 'AB']))
ok('A×A → {A,O}', setEq(possibleABO('A', 'A'), ['A', 'O']))
ok('A×O → {A,O}', setEq(possibleABO('A', 'O'), ['A', 'O']))
ok('AB×O 不可能生 O', isABOPossible('AB', 'O', 'O') === false)
ok('AB×O 不可能生 AB', isABOPossible('AB', 'O', 'AB') === false)
ok('A×B 可能生 O', isABOPossible('A', 'B', 'O') === true)
ok('O×O 不可能生 A', isABOPossible('O', 'O', 'A') === false)

// 4) Rh 可能集合
ok('Rh −×− → 只有 −', setEq(possibleRh('-', '-'), ['-']))
ok('Rh +×+ → 可能 + 與 −', setEq(possibleRh('+', '+'), ['+', '-']))
ok('Rh +×− → 可能 + 與 −', setEq(possibleRh('+', '-'), ['+', '-']))

// 5) summarize impossible 集合
ok('summarize O×O impossible = {A,B,AB}', setEq(summarizeABO('O', 'O').impossible, ['A', 'B', 'AB']))
ok('summarize A×B impossible = []', summarizeABO('A', 'B').impossible.length === 0)
ok('summarize meanDist 機率和=1', (() => {
  const d = summarizeABO('A', 'B').meanDist
  const sum = Object.values(d).reduce((a, b) => a + b, 0)
  return close(sum, 1)
})())

// 6) pct
ok('pct(0.25)=25%', pct(0.25) === '25%')
ok('pct(0.5)=50%', pct(0.5) === '50%')
ok('pct(1/3)≈33.3%', pct(1 / 3) === '33.3%')

console.log(`\n血型遺傳:${pass} 通過,${fail} 失敗`)
if (fail) process.exit(1)
