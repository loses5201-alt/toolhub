/*
  字型檔(SFNT)解析引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-font.mjs
  oracle:測試內自帶一支獨立的「SFNT 組裝器」(buildSfnt),依 OpenType / TrueType 規範手寫
  head / maxp / OS/2 / post / cmap / name / glyf 等資料表,組成合法字型位元組後用引擎解回來比對。
  另測 .ttc 字型集外殼、WOFF 偵測與錯誤路徑。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `font-test-${Date.now()}.mjs`)
await build({ entryPoints: ['src/features/font.ts'], bundle: true, format: 'esm', outfile: out, logLevel: 'silent' })
const { parseFont } = await import('file://' + out)

let fail = 0
function check(note, cond) { if (cond) console.log(`✓ ${note}`); else { fail++; console.error(`✗ ${note}`) } }

/* ---------- 獨立 SFNT 組裝器(oracle)---------- */
function u16(v) { return [(v >> 8) & 0xff, v & 0xff] }
function u32(v) { return [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff] }
function i16(v) { return u16(v & 0xffff) }
function utf16be(s) { const o = []; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); o.push((c >> 8) & 0xff, c & 0xff) } return o }
function latin1(s) { return [...s].map((c) => c.charCodeAt(0) & 0xff) }
function pad4(arr) { while (arr.length % 4) arr.push(0); return arr }

function buildHead({ unitsPerEm, created, modified, bbox, macStyle }) {
  const b = new Array(54).fill(0)
  set16(b, 18, unitsPerEm)
  set32(b, 20, 0); set32(b, 24, created) // longdatetime 高位 0 + 低位
  set32(b, 28, 0); set32(b, 32, modified)
  set16(b, 36, bbox.xMin & 0xffff); set16(b, 38, bbox.yMin & 0xffff)
  set16(b, 40, bbox.xMax & 0xffff); set16(b, 42, bbox.yMax & 0xffff)
  set16(b, 44, macStyle)
  return b
}
function buildMaxp(numGlyphs) { const b = new Array(6).fill(0); set32(b, 0, 0x00010000); set16(b, 4, numGlyphs); return b }
function buildOs2({ weight, width, fsType, fsSelection }) { const b = new Array(96).fill(0); set16(b, 4, weight); set16(b, 6, width); set16(b, 8, fsType); set16(b, 62, fsSelection); return b }
function buildPost(isFixed) { const b = new Array(32).fill(0); set32(b, 0, 0x00020000); set32(b, 12, isFixed ? 1 : 0); return b }
function buildCmap(numSub) { const b = new Array(4).fill(0); set16(b, 0, 0); set16(b, 2, numSub); return b }
function set16(b, off, v) { b[off] = (v >> 8) & 0xff; b[off + 1] = v & 0xff }
function set32(b, off, v) { b[off] = (v >>> 24) & 0xff; b[off + 1] = (v >>> 16) & 0xff; b[off + 2] = (v >>> 8) & 0xff; b[off + 3] = v & 0xff }

// records:{ platformID, encodingID, langID, nameID, text, enc }
function buildName(records) {
  const count = records.length
  const header = [...u16(0), ...u16(count), ...u16(6 + count * 12)]
  const recBytes = []
  const strBytes = []
  for (const r of records) {
    const data = r.enc === 'mac' ? latin1(r.text) : utf16be(r.text)
    const off = strBytes.length
    recBytes.push(...u16(r.platformID), ...u16(r.encodingID), ...u16(r.langID), ...u16(r.nameID), ...u16(data.length), ...u16(off))
    strBytes.push(...data)
  }
  return [...header, ...recBytes, ...strBytes]
}

function buildSfnt(tableMap, sfntVersion = 0x00010000) {
  const tags = Object.keys(tableMap)
  const numTables = tags.length
  let offset = 12 + numTables * 16
  const entries = []
  for (const tag of tags) {
    const data = tableMap[tag]
    entries.push({ tag, offset, length: data.length, data })
    offset += data.length
    while (offset % 4) offset++
  }
  const buf = new Array(offset).fill(0)
  set32(buf, 0, sfntVersion)
  set16(buf, 4, numTables)
  let p = 12
  for (const e of entries) {
    for (let i = 0; i < 4; i++) buf[p + i] = e.tag.charCodeAt(i)
    set32(buf, p + 8, e.offset)
    set32(buf, p + 12, e.length)
    p += 16
  }
  for (const e of entries) for (let i = 0; i < e.data.length; i++) buf[e.offset + i] = e.data[i]
  return new Uint8Array(buf)
}

/* ---------- 組一個完整字型並驗證 ---------- */
const NAME_RECORDS = [
  { platformID: 1, encodingID: 0, langID: 0, nameID: 1, text: 'WRONG MAC', enc: 'mac' }, // Mac 記錄分數較低,應被忽略
  { platformID: 3, encodingID: 1, langID: 0x409, nameID: 1, text: 'Test Sans' },
  { platformID: 3, encodingID: 1, langID: 0x409, nameID: 2, text: 'Bold Italic' },
  { platformID: 3, encodingID: 1, langID: 0x409, nameID: 4, text: 'Test Sans Bold Italic' },
  { platformID: 3, encodingID: 1, langID: 0x409, nameID: 5, text: 'Version 1.234' },
  { platformID: 3, encodingID: 1, langID: 0x409, nameID: 8, text: 'ACME Foundry' },
  { platformID: 3, encodingID: 1, langID: 0x409, nameID: 13, text: 'SIL Open Font License' },
]
const CREATED = 1000000000 // 對映 2001-09-09T01:46:40Z(秒數會被加上 1904 基準)
const tables = {
  head: buildHead({ unitsPerEm: 1000, created: 2082844800 + CREATED, modified: 2082844800 + CREATED, bbox: { xMin: -50, yMin: -200, xMax: 900, yMax: 800 }, macStyle: 0x02 }),
  maxp: buildMaxp(256),
  'OS/2': buildOs2({ weight: 700, width: 3, fsType: 0x0008, fsSelection: 0x20 }),
  post: buildPost(true),
  cmap: buildCmap(3),
  glyf: [0, 0, 0, 0],
  name: buildName(NAME_RECORDS),
}
const font = buildSfnt(tables)
const info = parseFont(font)

check('無錯誤', !info.error)
check('format = TrueType(含 glyf)', info.format.includes('TrueType'))
check('unitsPerEm = 1000', info.unitsPerEm === 1000)
check('numGlyphs = 256', info.numGlyphs === 256)
check('family = Test Sans(Windows 優先於 Mac)', info.names.family === 'Test Sans')
check('subfamily = Bold Italic', info.names.subfamily === 'Bold Italic')
check('fullName', info.names.fullName === 'Test Sans Bold Italic')
check('version', info.names.version === 'Version 1.234')
check('manufacturer', info.names.manufacturer === 'ACME Foundry')
check('license', info.names.license === 'SIL Open Font License')
check('weightClass = 700', info.weightClass === 700)
check('weightName = Bold', info.weightName === 'Bold')
check('widthClass = 3', info.widthClass === 3 && info.widthName === 'Condensed')
check('italic(來自 head macStyle)', info.italic === true)
check('bold(來自 OS/2 fsSelection)', info.bold === true)
check('monospaced(來自 post)', info.monospaced === true)
check('embedding(fsType 0x08 = 可編輯內嵌)', info.embedding.includes('可編輯'))
check('cmap 子表數 = 3', info.cmapSubtables === 3)
check('bbox', info.bbox.xMin === -50 && info.bbox.yMax === 800)
check('created 日期', info.created === new Date(CREATED * 1000).toISOString())
check('table 清單含 head/maxp/name/glyf', ['head', 'maxp', 'name', 'glyf'].every((t) => info.tables.some((x) => x.tag === t)))
check('table 長度正確(maxp = 6)', info.tables.find((t) => t.tag === 'maxp').length === 6)

/* ---------- fsType 各種值 ---------- */
const mk = (fsType) => parseFont(buildSfnt({ ...tables, 'OS/2': buildOs2({ weight: 400, width: 5, fsType, fsSelection: 0 }) })).embedding
check('fsType 0 = 可自由嵌入', mk(0).includes('可自由嵌入'))
check('fsType 0x02 = 不允許嵌入', mk(0x0002).includes('不允許'))
check('fsType 0x04 = 僅供預覽/列印', mk(0x0004).includes('預覽'))

/* ---------- OpenType CFF ---------- */
const otf = parseFont(buildSfnt({ 'CFF ': [0, 0, 0, 0], head: tables.head, maxp: tables.maxp, name: tables.name }, 0x4f54544f /* 'OTTO' */))
check('OTTO + CFF → OpenType(CFF)', otf.format.includes('OpenType') && !otf.error)

/* ---------- .ttc 字型集外殼 ---------- */
{
  const numFonts = 2
  const headerLen = 12 + 4 * numFonts
  // 真實 .ttc 內字型的資料表 offset 是相對整個檔案的絕對位置,故需把內層字型目錄的 offset 全部 + headerLen
  const inner = [...font]
  const innerNumTables = (inner[4] << 8) | inner[5]
  for (let i = 0; i < innerNumTables; i++) {
    const op = 12 + i * 16 + 8
    const cur = (inner[op] << 24) | (inner[op + 1] << 16) | (inner[op + 2] << 8) | inner[op + 3]
    set32(inner, op, cur + headerLen)
  }
  const ttc = new Array(headerLen).fill(0)
  ttc[0] = 't'.charCodeAt(0); ttc[1] = 't'.charCodeAt(0); ttc[2] = 'c'.charCodeAt(0); ttc[3] = 'f'.charCodeAt(0)
  set32(ttc, 4, 0x00010000)
  set32(ttc, 8, numFonts)
  set32(ttc, 12, headerLen) // 兩個字型都指向同一份
  set32(ttc, 16, headerLen)
  const full = new Uint8Array([...ttc, ...inner])
  const r = parseFont(full)
  check('.ttc:無錯誤', !r.error)
  check('.ttc:fontCount = 2', r.fontCount === 2)
  check('.ttc:解析到第一個字型的 family', r.names.family === 'Test Sans')
}

/* ---------- 錯誤 / 特殊格式偵測 ---------- */
check('WOFF 偵測', parseFont(Uint8Array.from([...latin1('wOFF'), ...new Array(20).fill(0)])).error?.includes('WOFF'))
check('WOFF2 偵測', parseFont(Uint8Array.from([...latin1('wOF2'), ...new Array(20).fill(0)])).error?.includes('WOFF2'))
check('亂碼 magic → 錯誤', !!parseFont(Uint8Array.from([...latin1('JUNK'), ...new Array(20).fill(0)])).error)
check('資料太短 → 錯誤', !!parseFont(Uint8Array.from([0, 1])).error)

console.log(fail === 0 ? '\n全部通過 🎉' : `\n${fail} 項失敗`)
process.exit(fail ? 1 : 0)
