/*
  檔案真實類型偵測引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  讀檔案開頭的「魔術位元組」(magic number)判斷它「實際上」是什麼格式,
  再和檔名副檔名比對。詐騙常把惡意程式(.exe / .scr)改名成 .jpg、.pdf 來騙人點開,
  或把假發票/釣魚附件偽裝成文件;副檔名可以亂改,但檔頭騙不了人。
  全程在你的瀏覽器讀取前幾十個位元組判斷,不上傳檔案。
*/

export interface FileType {
  type: string // 顯示名稱,如 PNG 圖片
  exts: string[] // 此類型常見副檔名(小寫,不含點)
  category: 'image' | 'document' | 'archive' | 'audio' | 'video' | 'executable' | 'other'
  executable: boolean // 是否為可執行檔(高風險)
}

interface Sig {
  offset: number
  bytes: number[] // -1 代表萬用(略過比對該位元組)
  result: FileType
}

const T = (
  type: string,
  exts: string[],
  category: FileType['category'],
  executable = false,
): FileType => ({ type, exts, category, executable })

// 依序比對(較具體者放前面)
const SIGNATURES: Sig[] = [
  { offset: 0, bytes: [0x25, 0x50, 0x44, 0x46], result: T('PDF 文件', ['pdf'], 'document') },
  { offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], result: T('PNG 圖片', ['png'], 'image') },
  { offset: 0, bytes: [0xff, 0xd8, 0xff], result: T('JPEG 圖片', ['jpg', 'jpeg'], 'image') },
  { offset: 0, bytes: [0x47, 0x49, 0x46, 0x38], result: T('GIF 圖片', ['gif'], 'image') },
  { offset: 0, bytes: [0x42, 0x4d], result: T('BMP 圖片', ['bmp'], 'image') },
  { offset: 0, bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07], result: T('RAR 壓縮檔', ['rar'], 'archive') },
  { offset: 0, bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c], result: T('7-Zip 壓縮檔', ['7z'], 'archive') },
  { offset: 0, bytes: [0x1f, 0x8b], result: T('GZIP 壓縮檔', ['gz', 'gzip', 'tgz'], 'archive') },
  { offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04], result: T('ZIP 壓縮檔(或 Office/APK 等以 ZIP 封裝的格式)', ['zip', 'docx', 'xlsx', 'pptx', 'apk', 'jar', 'epub', 'odt', 'ods'], 'archive') },
  { offset: 0, bytes: [0x50, 0x4b, 0x05, 0x06], result: T('ZIP 壓縮檔(空封存)', ['zip', 'docx', 'xlsx', 'pptx'], 'archive') },
  { offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], result: T('舊版 Office 文件(Word/Excel/PPT 97-2003)', ['doc', 'xls', 'ppt', 'msg'], 'document') },
  { offset: 0, bytes: [0x49, 0x44, 0x33], result: T('MP3 音訊', ['mp3'], 'audio') },
  { offset: 0, bytes: [0xff, 0xfb], result: T('MP3 音訊', ['mp3'], 'audio') },
  { offset: 0, bytes: [0x4d, 0x5a], result: T('Windows 執行檔 / 程式(PE:exe、dll、scr…)', ['exe', 'dll', 'scr', 'com', 'msi'], 'executable', true) },
  { offset: 0, bytes: [0x7f, 0x45, 0x4c, 0x46], result: T('Linux 執行檔(ELF)', ['elf', 'so', 'bin'], 'executable', true) },
  { offset: 0, bytes: [0xfe, 0xed, 0xfa, 0xce], result: T('macOS 執行檔(Mach-O)', ['', 'dylib'], 'executable', true) },
  { offset: 0, bytes: [0xfe, 0xed, 0xfa, 0xcf], result: T('macOS 執行檔(Mach-O 64)', ['', 'dylib'], 'executable', true) },
  { offset: 0, bytes: [0xcf, 0xfa, 0xed, 0xfe], result: T('macOS 執行檔(Mach-O)', ['', 'dylib'], 'executable', true) },
  // 容器類:需比對 offset 4 的標記
  { offset: 4, bytes: [0x66, 0x74, 0x79, 0x70], result: T('MP4 / MOV 影片', ['mp4', 'mov', 'm4a', 'm4v'], 'video') },
  // RIFF 系列(WEBP / WAV / AVI)offset 0=RIFF,offset 8 區分,於程式中特判
]

function matchAt(bytes: Uint8Array, offset: number, sig: number[]): boolean {
  if (offset + sig.length > bytes.length) return false
  for (let i = 0; i < sig.length; i++) {
    if (sig[i] === -1) continue
    if (bytes[offset + i] !== sig[i]) return false
  }
  return true
}

function isAscii(bytes: Uint8Array, offset: number, text: string): boolean {
  return matchAt(bytes, offset, [...text].map((c) => c.charCodeAt(0)))
}

/** 從位元組偵測檔案類型;無法判斷回 null。 */
export function detectType(bytes: Uint8Array): FileType | null {
  // RIFF 系列特判(WEBP/WAV/AVI)
  if (isAscii(bytes, 0, 'RIFF')) {
    if (isAscii(bytes, 8, 'WEBP')) return T('WebP 圖片', ['webp'], 'image')
    if (isAscii(bytes, 8, 'WAVE')) return T('WAV 音訊', ['wav'], 'audio')
    if (isAscii(bytes, 8, 'AVI ')) return T('AVI 影片', ['avi'], 'video')
  }
  for (const s of SIGNATURES) {
    if (matchAt(bytes, s.offset, s.bytes)) return s.result
  }
  return null
}

/** 取出副檔名(小寫,不含點);無副檔名回空字串。 */
export function getExtension(filename: string): string {
  const m = filename.toLowerCase().match(/\.([a-z0-9]+)$/)
  return m ? m[1] : ''
}

export type Verdict = 'ok' | 'unknown' | 'mismatch' | 'danger'

export interface CheckResult {
  detected: FileType | null
  ext: string
  verdict: Verdict
  message: string
}

/**
 * 比對「實際類型」與「副檔名」。
 * - danger:副檔名看似無害(圖片/文件/影音),實際卻是可執行檔 → 高度可疑。
 * - mismatch:實際類型與副檔名不符。
 * - unknown:無法辨識檔頭。
 * - ok:相符。
 */
export function checkFile(bytes: Uint8Array, filename: string): CheckResult {
  const detected = detectType(bytes)
  const ext = getExtension(filename)

  if (!detected) {
    return {
      detected: null,
      ext,
      verdict: 'unknown',
      message: '無法從檔頭辨識類型(可能是純文字、未知格式或空檔)。',
    }
  }

  const matches = ext !== '' && detected.exts.includes(ext)
  if (matches) {
    return { detected, ext, verdict: 'ok', message: `副檔名與實際類型相符:${detected.type}。` }
  }

  // 副檔名暗示為無害類型,實際卻是可執行檔 → 最危險
  const harmlessLooking = ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'mp4', 'mp3', 'zip']
  if (detected.executable && harmlessLooking.includes(ext)) {
    return {
      detected,
      ext,
      verdict: 'danger',
      message: `⚠️ 高度可疑:檔名是「.${ext}」看似無害,實際卻是「${detected.type}」。詐騙常用這招把惡意程式偽裝成圖片或文件,請勿開啟!`,
    }
  }

  return {
    detected,
    ext: ext || '(無副檔名)',
    verdict: 'mismatch',
    message: `副檔名「${ext ? '.' + ext : '無'}」與實際類型不符 —— 實際是「${detected.type}」(常見副檔名:${detected.exts.filter(Boolean).map((e) => '.' + e).join('、')})。`,
  }
}
