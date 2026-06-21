/*
  字型檔(SFNT:TrueType .ttf / OpenType .otf / 字型集 .ttc)解析引擎 —— 純函式、無 DOM 依賴
  (只用標準 TextDecoder / DataView),可在 Node 直接測試。

  打開一個字型檔不必裝任何軟體,就能看到:這是什麼字型(家族 / 樣式 / 完整名稱)、版本、
  製造商 / 設計師、著作權與授權條款、是否允許嵌入(fsType,做 PDF / 網頁前要先確認授權)、
  字重 / 寬度 / 斜體、每 em 單位、字符(glyph)數量、建立 / 修改日期、包含哪些資料表。
  字型檔可能來路不明,全程在你瀏覽器解析,不連網、不上傳。
*/

export interface FontTable { tag: string; length: number }
export interface FontInfo {
  format: string // TrueType (glyf) / OpenType (CFF) / …
  sfntVersion: string
  fontCount: number // .ttc 時 > 1
  names: Record<string, string> // family / subfamily / fullName / version / copyright / license …
  unitsPerEm: number | null
  numGlyphs: number | null
  created: string | null
  modified: string | null
  bbox: { xMin: number; yMin: number; xMax: number; yMax: number } | null
  weightClass: number | null
  weightName: string
  widthClass: number | null
  widthName: string
  italic: boolean
  bold: boolean
  monospaced: boolean
  embedding: string // fsType 白話說明
  cmapSubtables: number | null
  tables: FontTable[]
  error?: string
}

const NAME_IDS: Record<number, string> = {
  0: 'copyright', 1: 'family', 2: 'subfamily', 3: 'uniqueId', 4: 'fullName', 5: 'version',
  6: 'postScriptName', 7: 'trademark', 8: 'manufacturer', 9: 'designer', 10: 'description',
  11: 'vendorUrl', 12: 'designerUrl', 13: 'license', 14: 'licenseUrl',
  16: 'typoFamily', 17: 'typoSubfamily',
}
const WEIGHT_NAMES: Record<number, string> = {
  100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium',
  600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black',
}
const WIDTH_NAMES = ['', 'UltraCondensed', 'ExtraCondensed', 'Condensed', 'SemiCondensed', 'Normal', 'SemiExpanded', 'Expanded', 'ExtraExpanded', 'UltraExpanded']

const MAC_EPOCH = 2082844800 // 1904-01-01 與 1970-01-01 相差秒數

function tag4(b: Uint8Array, p: number): string {
  return String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3])
}
function describeFsType(fsType: number): string {
  if (fsType & 0x0002) return '不允許嵌入(Restricted)'
  const parts: string[] = []
  if (fsType === 0) return '可自由嵌入安裝(Installable)'
  if (fsType & 0x0004) parts.push('僅供預覽 / 列印')
  if (fsType & 0x0008) parts.push('可編輯內嵌')
  if (fsType & 0x0100) parts.push('不可子集化')
  if (fsType & 0x0200) parts.push('僅點陣嵌入')
  return parts.length ? parts.join('、') : `其他限制(fsType=0x${fsType.toString(16)})`
}

/** 解析字型檔位元組。 */
export function parseFont(bytes: Uint8Array): FontInfo {
  const empty: FontInfo = {
    format: '', sfntVersion: '', fontCount: 0, names: {}, unitsPerEm: null, numGlyphs: null,
    created: null, modified: null, bbox: null, weightClass: null, weightName: '', widthClass: null,
    widthName: '', italic: false, bold: false, monospaced: false, embedding: '', cmapSubtables: null, tables: [],
  }
  if (!bytes || bytes.length < 12) return { ...empty, error: '資料太短,不像字型檔' }
  const magic = tag4(bytes, 0)
  if (magic === 'wOFF') return { ...empty, error: '這是 WOFF 網頁字型,請先用工具轉成 .ttf / .otf 再檢視' }
  if (magic === 'wOF2') return { ...empty, error: '這是 WOFF2 網頁字型,請先轉成 .ttf / .otf 再檢視' }

  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let base = 0
  let fontCount = 1
  if (magic === 'ttcf') { // 字型集:解析第一個字型
    fontCount = dv.getUint32(8)
    base = dv.getUint32(12) // 第一個字型的 offset table 位置
  }
  const sfntVersion = tag4(bytes, base)
  const validSfnt = ['\x00\x01\x00\x00', 'OTTO', 'true', 'typ1'].includes(sfntVersion)
  if (magic !== 'ttcf' && !validSfnt) return { ...empty, error: `無法辨識的字型格式(magic=${JSON.stringify(magic)})` }

  const numTables = dv.getUint16(base + 4)
  const tables = new Map<string, { offset: number; length: number }>()
  const tableList: FontTable[] = []
  let p = base + 12
  for (let i = 0; i < numTables; i++) {
    if (p + 16 > bytes.length) break
    const tag = tag4(bytes, p)
    const offset = dv.getUint32(p + 8)
    const length = dv.getUint32(p + 12)
    tables.set(tag, { offset, length })
    tableList.push({ tag, length })
    p += 16
  }

  const info: FontInfo = { ...empty, sfntVersion, fontCount, tables: tableList }
  info.format = tables.has('CFF ') || sfntVersion === 'OTTO' ? 'OpenType(CFF 輪廓)' : tables.has('glyf') ? 'TrueType(glyf 輪廓)' : 'SFNT 字型'

  // head:unitsPerEm、日期、bbox、macStyle
  const head = tables.get('head')
  if (head && head.offset + 54 <= bytes.length) {
    const h = head.offset
    info.unitsPerEm = dv.getUint16(h + 18)
    const ld = (off: number) => { const hi = dv.getUint32(off); const lo = dv.getUint32(off + 4); return hi * 4294967296 + lo }
    const toIso = (secs: number) => secs > MAC_EPOCH ? new Date((secs - MAC_EPOCH) * 1000).toISOString() : null
    info.created = toIso(ld(h + 20))
    info.modified = toIso(ld(h + 28))
    info.bbox = { xMin: dv.getInt16(h + 36), yMin: dv.getInt16(h + 38), xMax: dv.getInt16(h + 40), yMax: dv.getInt16(h + 42) }
    const macStyle = dv.getUint16(h + 44)
    info.bold = !!(macStyle & 0x01)
    info.italic = !!(macStyle & 0x02)
  }

  // maxp:numGlyphs
  const maxp = tables.get('maxp')
  if (maxp && maxp.offset + 6 <= bytes.length) info.numGlyphs = dv.getUint16(maxp.offset + 4)

  // OS/2:字重 / 寬度 / 嵌入權限 / fsSelection
  const os2 = tables.get('OS/2')
  if (os2 && os2.offset + 10 <= bytes.length) {
    info.weightClass = dv.getUint16(os2.offset + 4)
    info.widthClass = dv.getUint16(os2.offset + 6)
    info.weightName = WEIGHT_NAMES[info.weightClass] || ''
    info.widthName = WIDTH_NAMES[info.widthClass] || ''
    info.embedding = describeFsType(dv.getUint16(os2.offset + 8))
    if (os2.offset + 64 <= bytes.length) {
      const fsSel = dv.getUint16(os2.offset + 62)
      if (fsSel & 0x01) info.italic = true
      if (fsSel & 0x20) info.bold = true
    }
  }

  // post:isFixedPitch(等寬)
  const post = tables.get('post')
  if (post && post.offset + 16 <= bytes.length) info.monospaced = dv.getUint32(post.offset + 12) !== 0

  // cmap:編碼子表數量
  const cmap = tables.get('cmap')
  if (cmap && cmap.offset + 4 <= bytes.length) info.cmapSubtables = dv.getUint16(cmap.offset + 2)

  // name:命名記錄
  const name = tables.get('name')
  if (name && name.offset + 6 <= bytes.length) {
    const n = name.offset
    const count = dv.getUint16(n + 2)
    const stringOffset = n + dv.getUint16(n + 4)
    // 每個 nameID 取「最佳」記錄:Windows 英文(平台 3 語言 0x409)> 其他 Windows > Mac
    const best: Record<number, { score: number; text: string }> = {}
    for (let i = 0; i < count; i++) {
      const rp = n + 6 + i * 12
      if (rp + 12 > bytes.length) break
      const platformID = dv.getUint16(rp)
      const langID = dv.getUint16(rp + 4)
      const nameID = dv.getUint16(rp + 6)
      const len = dv.getUint16(rp + 8)
      const off = stringOffset + dv.getUint16(rp + 10)
      if (off + len > bytes.length) continue
      const slice = bytes.subarray(off, off + len)
      const text = platformID === 1
        ? new TextDecoder('latin1').decode(slice)
        : new TextDecoder('utf-16be').decode(slice)
      const score = platformID === 3 && langID === 0x409 ? 3 : platformID === 3 ? 2 : platformID === 0 ? 1 : 0
      if (!best[nameID] || score > best[nameID].score) best[nameID] = { score, text }
    }
    for (const [id, v] of Object.entries(best)) {
      const key = NAME_IDS[Number(id)]
      if (key && !(key in info.names)) info.names[key] = v.text.trim()
    }
    // typographic family/subfamily 優先覆蓋顯示用名稱
    if (info.names.typoFamily) info.names.family = info.names.typoFamily
    if (info.names.typoSubfamily) info.names.subfamily = info.names.typoSubfamily
  }

  return info
}
