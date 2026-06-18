/*
  Big5 ↔ UTF-8 轉換引擎回歸測試(無需測試框架,node 直接跑)。
  需 Node 內建 full-ICU(Node 22 預設支援 big5)。
  執行:node scripts/test-big5.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `big5-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/big5.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { decodeBig5, encodeBig5, decodeUtf8, encodeUtf8, looksLikeUtf8 } = await import(
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
const eq = (a, b) => a.length === b.length && a.every((v, i) => v === b[i])

// Big5:'中'=A4A4、'文'=A4E5、'臺'=BBD2(常用字)
const big5ZhBytes = Uint8Array.from([0xa4, 0xa4, 0xa4, 0xe5])

// 解碼
check('decodeBig5 中文', decodeBig5(big5ZhBytes) === '中文')
check('decodeBig5 ASCII', decodeBig5(Uint8Array.from([0x48, 0x69])) === 'Hi')

// 編碼
{
  const r = encodeBig5('中文')
  check('encodeBig5 中文 位元組正確', eq(r.bytes, big5ZhBytes))
  check('encodeBig5 中文 無 unmapped', r.unmapped.length === 0)
}
{
  const r = encodeBig5('AB1 ')
  check('encodeBig5 ASCII 直通', eq(r.bytes, Uint8Array.from([0x41, 0x42, 0x31, 0x20])))
}

// 來回一致:UTF-8 文字 → Big5 → 回 UTF-8
{
  const text = '台灣繁體中文,測試 ABC 123。'
  const r = encodeBig5(text)
  check('round-trip 無 unmapped', r.unmapped.length === 0)
  check('round-trip Big5→文字一致', decodeBig5(r.bytes) === text)
}

// 換行/標點保留
{
  const text = '第一行\n第二行\t結束'
  const r = encodeBig5(text)
  check('換行 tab 保留(round-trip)', decodeBig5(r.bytes) === text)
}

// 無法以 Big5 表示的字(emoji)→ '?' 並回報
{
  const r = encodeBig5('讚😀!')
  check('emoji 列入 unmapped', r.unmapped.includes('😀'))
  check('emoji 以 ? 代替', r.bytes.includes(0x3f))
  // '讚' 與 '!' 仍正確
  check('其餘字仍可解回', decodeBig5(r.bytes).startsWith('讚') && decodeBig5(r.bytes).endsWith('!'))
}

// 簡體專用字通常不在 Big5(繁體)→ unmapped(以「这」測,Big5 無)
{
  const r = encodeBig5('这')
  check('簡體字不在 Big5 → unmapped', r.unmapped.includes('这') && r.bytes.includes(0x3f))
}

// UTF-8 helpers 與往返
{
  const text = '中文 UTF-8 ✓'
  const bytes = encodeUtf8(text)
  check('encodeUtf8/decodeUtf8 往返', decodeUtf8(bytes) === text)
  check('UTF-8 中文為 3 bytes', encodeUtf8('中').length === 3)
}

// looksLikeUtf8:UTF-8 中文 true、Big5 中文(非法 UTF-8)false、純 ASCII true
check('looksLikeUtf8 UTF-8 中文 = true', looksLikeUtf8(encodeUtf8('中文')) === true)
check('looksLikeUtf8 Big5 中文 = false', looksLikeUtf8(big5ZhBytes) === false)
check('looksLikeUtf8 ASCII = true', looksLikeUtf8(Uint8Array.from([0x41, 0x42])) === true)

// 空輸入
check('encodeBig5 空字串', encodeBig5('').bytes.length === 0)
check('decodeBig5 空', decodeBig5(Uint8Array.from([])) === '')

console.log(fail === 0 ? '\nAll big5 tests passed.' : `\n${fail} test(s) FAILED.`)
process.exit(fail === 0 ? 0 : 1)
