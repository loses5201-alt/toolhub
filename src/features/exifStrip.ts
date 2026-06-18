/*
  照片個資清除引擎 —— 不重新編碼、直接移除 JPEG / PNG 裡夾帶的中繼資料
  (EXIF、GPS 定位、XMP、IPTC、拍攝時間、相機型號、註解),畫質完全不變。

  純位元組運算、與環境無關,方便 Node 跑回歸測試;讀檔/下載留在 .vue 元件。

  與 image-studio(重新編碼會順便去 EXIF,但會壓損畫質、可能改格式)不同:這支保留原始影像位元、原格式。
*/

export type ImageType = 'jpeg' | 'png' | null

export function detectType(bytes: Uint8Array): ImageType {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg'
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return 'png'
  return null
}

// JPEG:要移除的標記。APP1(0xE1)=Exif/XMP、APP13(0xED)=IPTC/Photoshop、COM(0xFE)=註解。
// 保留 APP0(JFIF)、APP2(ICC 色彩)、APP14(Adobe)等以免影響顯示。
const JPEG_REMOVE = new Set([0xe1, 0xed, 0xfe])

/**
 * 移除 JPEG 的隱私中繼資料段,保留影像資料與色彩設定檔。
 * 解析失敗(非預期結構)時回傳原位元組,絕不破壞檔案。
 */
export function stripJpeg(bytes: Uint8Array): Uint8Array {
  const n = bytes.length
  if (n < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes
  const out: number[] = [0xff, 0xd8] // SOI
  let i = 2
  while (i + 1 < n) {
    if (bytes[i] !== 0xff) return bytes // 結構異常,原樣回傳保安全
    let marker = bytes[i + 1]
    // 跳過填充用的連續 0xFF
    while (marker === 0xff && i + 2 < n) {
      i++
      marker = bytes[i + 1]
    }
    // SOS(0xDA):進入壓縮影像資料,後面直接整段複製到結尾
    if (marker === 0xda) {
      for (let k = i; k < n; k++) out.push(bytes[k])
      return Uint8Array.from(out)
    }
    // EOI
    if (marker === 0xd9) {
      out.push(0xff, 0xd9)
      return Uint8Array.from(out)
    }
    // 無酬載的標記(RSTn 0xD0–0xD7、TEM 0x01):理論上不會出現在此,保險複製
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      out.push(0xff, marker)
      i += 2
      continue
    }
    // 含 2-byte 長度的段
    if (i + 3 >= n) return bytes
    const len = (bytes[i + 2] << 8) | bytes[i + 3]
    if (len < 2 || i + 2 + len > n) return bytes // 長度不合理
    const segEnd = i + 2 + len
    if (!JPEG_REMOVE.has(marker)) {
      for (let k = i; k < segEnd; k++) out.push(bytes[k])
    }
    i = segEnd
  }
  return bytes
}

// PNG:要移除的中繼資料 chunk 類型(輔助塊,移除不影響影像)。
const PNG_REMOVE = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME', 'dSIG'])

function chunkType(bytes: Uint8Array, at: number): string {
  return String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3])
}

/**
 * 移除 PNG 的文字 / EXIF / 時間等中繼資料 chunk,保留影像與色彩相關 chunk。
 * 解析失敗時回傳原位元組。
 */
export function stripPng(bytes: Uint8Array): Uint8Array {
  const n = bytes.length
  if (n < 8) return bytes
  const out: number[] = []
  for (let k = 0; k < 8; k++) out.push(bytes[k]) // 簽章
  let i = 8
  while (i + 8 <= n) {
    const len = (bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]
    if (len < 0 || i + 12 + len > n) return bytes // 長度不合理
    const type = chunkType(bytes, i + 4)
    const chunkEnd = i + 12 + len // length(4)+type(4)+data(len)+crc(4)
    if (!PNG_REMOVE.has(type)) {
      for (let k = i; k < chunkEnd; k++) out.push(bytes[k])
    }
    i = chunkEnd
    if (type === 'IEND') break
  }
  return Uint8Array.from(out)
}

export interface StripResult {
  type: ImageType
  output: Uint8Array
  removed: number // 移除的位元組數(原長 - 新長)
}

/** 依檔案類型移除中繼資料。非 JPEG/PNG 回傳原位元組、type=null。 */
export function stripMetadata(bytes: Uint8Array): StripResult {
  const type = detectType(bytes)
  let output = bytes
  if (type === 'jpeg') output = stripJpeg(bytes)
  else if (type === 'png') output = stripPng(bytes)
  return { type, output, removed: bytes.length - output.length }
}
