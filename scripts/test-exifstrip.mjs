/*
  照片個資清除引擎回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-exifstrip.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `exifstrip-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/exifStrip.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { detectType, stripJpeg, stripPng, stripMetadata } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}
const eq = (a, b) => a.length === b.length && a.every((v, i) => v === b[i])

// JPEG 段建構:[FF, marker, lenHi, lenLo, ...payload],len = payload+2
function jpegSeg(marker, payload) {
  const len = payload.length + 2
  return [0xff, marker, (len >> 8) & 0xff, len & 0xff, ...payload]
}
function str(s) {
  return [...s].map((c) => c.charCodeAt(0))
}

// 組一張假 JPEG:SOI + APP0(JFIF,留) + APP1(Exif,刪) + APP2(ICC,留) + COM(刪) + SOS + 掃描 + EOI
const app0 = jpegSeg(0xe0, str('JFIF\0') ) // 留
const app1 = jpegSeg(0xe1, [...str('Exif\0\0'), 1, 2, 3, 4, 5, 6]) // 刪(含假 GPS)
const app2 = jpegSeg(0xe2, [...str('ICC_PROFILE\0'), 9, 9, 9]) // 留
const com = jpegSeg(0xfe, str('secret comment')) // 刪
const sos = [0xff, 0xda, 0x00, 0x03, 0x01] // SOS 段
const scan = [0x12, 0x34, 0x56, 0x78] // 壓縮影像資料
const eoi = [0xff, 0xd9]
const jpeg = Uint8Array.from([0xff, 0xd8, ...app0, ...app1, ...app2, ...com, ...sos, ...scan, ...eoi])

check('detectType jpeg', detectType(jpeg) === 'jpeg')

const sj = stripJpeg(jpeg)
check('jpeg 仍以 SOI 開頭', sj[0] === 0xff && sj[1] === 0xd8)
check('jpeg 以 EOI 結尾', sj[sj.length - 2] === 0xff && sj[sj.length - 1] === 0xd9)
check('jpeg 移除了 APP1+COM 的位元組', sj.length === jpeg.length - app1.length - com.length)
// 預期結果 = SOI + APP0 + APP2 + SOS + scan + EOI
const expected = Uint8Array.from([0xff, 0xd8, ...app0, ...app2, ...sos, ...scan, ...eoi])
check('jpeg 內容 = 保留段', eq(sj, expected))
check('jpeg 掃描資料完整保留', [...sj].join(',').includes('18,52,86,120'))
check('jpeg 不再含 Exif 標記', !Array.from(sj).some((_, k) => sj[k] === 0xff && sj[k + 1] === 0xe1))
// 等冪
check('jpeg strip 等冪', eq(stripJpeg(sj), sj))

// 沒有中繼資料的 JPEG:不變
{
  const clean = Uint8Array.from([0xff, 0xd8, ...app0, ...sos, ...scan, ...eoi])
  check('jpeg 無隱私段時不變', eq(stripJpeg(clean), clean))
}

// 損壞 / 非預期結構:原樣回傳、不丟例外
check('jpeg 截斷不破壞', eq(stripJpeg(Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0x00])), Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0x00])))
check('jpeg 段長過大不破壞', eq(stripJpeg(Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 1, 2])), Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 1, 2])))

// ── PNG ──
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
function pngChunk(type, data) {
  const len = data.length
  return [
    (len >>> 24) & 0xff,
    (len >>> 16) & 0xff,
    (len >>> 8) & 0xff,
    len & 0xff,
    ...str(type),
    ...data,
    0xde, 0xad, 0xbe, 0xef, // 假 CRC(本工具不驗 CRC)
  ]
}
const ihdr = pngChunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0])
const text = pngChunk('tEXt', str('Comment\0private note')) // 刪
const exif = pngChunk('eXIf', [1, 2, 3, 4]) // 刪
const iccp = pngChunk('iCCP', [...str('icc\0'), 0, 1, 2]) // 留(色彩)
const idat = pngChunk('IDAT', [10, 20, 30]) // 留
const iend = pngChunk('IEND', []) // 留
const png = Uint8Array.from([...PNG_SIG, ...ihdr, ...text, ...iccp, ...exif, ...idat, ...iend])

check('detectType png', detectType(png) === 'png')
const sp = stripPng(png)
check('png 簽章保留', PNG_SIG.every((b, k) => sp[k] === b))
check('png 移除 tEXt+eXIf', sp.length === png.length - text.length - exif.length)
const pngExpected = Uint8Array.from([...PNG_SIG, ...ihdr, ...iccp, ...idat, ...iend])
check('png 內容 = 保留 chunk', eq(sp, pngExpected))
check('png 以 IEND 收尾', String.fromCharCode(sp[sp.length - 8], sp[sp.length - 7], sp[sp.length - 6], sp[sp.length - 5]) === 'IEND')
check('png strip 等冪', eq(stripPng(sp), sp))
check('png IEND 後若有垃圾會被丟棄', eq(stripPng(Uint8Array.from([...png, 0x00, 0x00])), pngExpected))

// detectType 與 stripMetadata
check('detectType 非影像 null', detectType(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8])) === null)
{
  const r = stripMetadata(jpeg)
  check('stripMetadata jpeg 派發', r.type === 'jpeg' && r.removed === app1.length + com.length)
  const r2 = stripMetadata(Uint8Array.from([1, 2, 3, 4]))
  check('stripMetadata 非影像 type=null removed=0', r2.type === null && r2.removed === 0)
}

console.log(fail === 0 ? '\nAll exifstrip tests passed.' : `\n${fail} test(s) FAILED.`)
process.exit(fail === 0 ? 0 : 1)
