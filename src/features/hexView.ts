/*
  Hex 檢視器核心 —— 把任意位元組以「位移 + 十六進位 + ASCII」三欄排版,
  就像 xxd / hexdump。純函式、無 DOM,故可在 Node 測。
  全程瀏覽器、不連網、不上傳;用來看清檔案開頭的魔術位元組、編碼、夾帶內容。
*/

const HEX = '0123456789abcdef'

/** 單一位元組轉兩位小寫十六進位。 */
export function byteToHex(b: number): string {
  return HEX[(b >> 4) & 0xf] + HEX[b & 0xf]
}

/** 把位移量轉成固定寬度(預設 8)的十六進位位址,前面補零。 */
export function offsetToHex(offset: number, width = 8): string {
  let s = offset.toString(16)
  while (s.length < width) s = '0' + s
  return s
}

/** 可列印 ASCII(0x20–0x7E)原樣,其餘以 '.' 代替。 */
export function byteToAscii(b: number): string {
  return b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.'
}

export interface HexDumpOptions {
  bytesPerRow?: number // 每列幾個位元組(預設 16)
  groupSize?: number // 每幾個位元組之間多一個空格(預設 8;0 表不分組)
  offsetWidth?: number // 位址欄寬度(預設 8)
  uppercase?: boolean // 十六進位是否大寫(預設否)
  maxBytes?: number // 安全上限,超過只處理前 N 個(預設 1MB)
}

export interface HexRow {
  offset: string // 位址欄,如 "00000010"
  hex: string // 十六進位欄(已含分組空白,右側不足補空白對齊)
  ascii: string // ASCII 欄
}

export interface HexDump {
  rows: HexRow[]
  total: number // 實際輸入位元組數
  shown: number // 實際排版的位元組數(可能因 maxBytes 截斷)
  truncated: boolean
}

const DEFAULTS: Required<HexDumpOptions> = {
  bytesPerRow: 16,
  groupSize: 8,
  offsetWidth: 8,
  uppercase: false,
  maxBytes: 1024 * 1024,
}

/** 排版一列的十六進位欄;不足 bytesPerRow 時右側補空白讓 ASCII 欄對齊。 */
function rowHex(
  bytes: Uint8Array,
  start: number,
  count: number,
  perRow: number,
  groupSize: number,
  uppercase: boolean,
): string {
  let out = ''
  for (let i = 0; i < perRow; i++) {
    if (groupSize > 0 && i > 0 && i % groupSize === 0) out += ' '
    if (i < count) {
      const h = byteToHex(bytes[start + i])
      out += (uppercase ? h.toUpperCase() : h) + ' '
    } else {
      out += '   ' // 兩位數 + 一空白
    }
  }
  return out.replace(/ +$/, '')
}

/** 主函式:把位元組陣列轉成可排版的列陣列。 */
export function hexDump(bytes: Uint8Array, options: HexDumpOptions = {}): HexDump {
  const opt = { ...DEFAULTS, ...options }
  const perRow = Math.max(1, Math.floor(opt.bytesPerRow))
  const total = bytes.length
  const shown = Math.min(total, Math.max(0, Math.floor(opt.maxBytes)))
  const rows: HexRow[] = []
  for (let start = 0; start < shown; start += perRow) {
    const count = Math.min(perRow, shown - start)
    let ascii = ''
    for (let i = 0; i < count; i++) ascii += byteToAscii(bytes[start + i])
    rows.push({
      offset: offsetToHex(start, opt.offsetWidth),
      hex: rowHex(bytes, start, count, perRow, opt.groupSize, opt.uppercase),
      ascii,
    })
  }
  return { rows, total, shown, truncated: shown < total }
}

/** 把整份 dump 串成一段純文字(每列:位址  十六進位  |ASCII|),方便複製/下載。 */
export function dumpToText(dump: HexDump): string {
  return dump.rows.map((r) => `${r.offset}  ${r.hex}  |${r.ascii}|`).join('\n')
}

/** 把一段文字以 UTF-8 編碼成位元組(供「貼上文字」模式)。 */
export function textToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

/**
 * 解析使用者貼上的「十六進位字串」成位元組(供反向:hex → 還原)。
 * 容許空白、換行、底線、逗號、0x 前綴分隔;非十六進位字元或奇數位數回 null。
 */
export function parseHex(input: string): Uint8Array | null {
  const cleaned = input
    .replace(/0x/gi, ' ')
    .replace(/[\s_,;:]+/g, '')
  if (cleaned.length === 0) return new Uint8Array(0)
  if (cleaned.length % 2 !== 0) return null
  if (!/^[0-9a-fA-F]+$/.test(cleaned)) return null
  const out = new Uint8Array(cleaned.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}
