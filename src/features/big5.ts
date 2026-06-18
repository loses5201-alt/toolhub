/*
  Big5 ↔ UTF-8 文字檔轉換引擎(純函式、零相依)。

  痛點:早年 Windows 記事本存的 .txt(ANSI/Big5 編碼)在 Mac、手機、網頁、新版程式上開啟會變整片亂碼;
  反之 UTF-8 檔在很老的 Big5 程式裡也會亂。這支做兩種編碼互轉,全程在瀏覽器、檔案不上傳。

  解碼用瀏覽器/Node 內建 TextDecoder('big5');編碼(UTF-8→Big5)用「以 fatal 解碼器反建反查表」
  的方式即時產生 Big5 編碼器,零相依、確定性。無法以 Big5 表示的字(emoji、簡體專用字等)會回報並以 '?' 代替。

  與「亂碼修復(mojibake-fix)」不同:那支救的是「UTF-8 被當西歐編碼」那類已成亂碼的文字;
  這支處理的是「整個檔案就是 Big5(或要轉成 Big5)」的編碼轉換。
*/

let encoderMap: Map<string, number> | null = null

/** 即時建立 Big5 反查表:字元 → (lead<<8 | trail),含 ASCII。只建一次並快取。 */
function buildEncoderMap(): Map<string, number> {
  const map = new Map<string, number>()
  for (let b = 0; b < 0x80; b++) map.set(String.fromCharCode(b), b) // ASCII 直通
  const dec = new TextDecoder('big5', { fatal: true })
  const buf = new Uint8Array(2)
  for (let lead = 0x81; lead <= 0xfe; lead++) {
    for (let trail = 0x40; trail <= 0xfe; trail++) {
      if (trail > 0x7e && trail < 0xa1) continue // Big5 trail 的空隙
      buf[0] = lead
      buf[1] = trail
      let ch: string
      try {
        ch = dec.decode(buf)
      } catch {
        continue // 未指派的組合
      }
      // 只收單一字元、且保留最先出現(最小碼位)的編碼,避免重複指派覆蓋
      if (ch.length === 1 && ch !== '�' && !map.has(ch)) map.set(ch, (lead << 8) | trail)
    }
  }
  return map
}

/** Big5 位元組 → 文字(非 fatal,無法解的位元組以 � 顯示,不丟例外)。 */
export function decodeBig5(bytes: Uint8Array): string {
  return new TextDecoder('big5').decode(bytes)
}

/** UTF-8 位元組 → 文字。 */
export function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes)
}

/** 文字 → UTF-8 位元組。 */
export function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

export interface Big5EncodeResult {
  bytes: Uint8Array
  /** 無法以 Big5 表示、已用 '?' 代替的字元(去重)。 */
  unmapped: string[]
}

/** 文字 → Big5 位元組。無法表示的字以 '?'(0x3F)代替並回報。 */
export function encodeBig5(text: string): Big5EncodeResult {
  const map = (encoderMap ??= buildEncoderMap())
  const out: number[] = []
  const unmapped = new Set<string>()
  for (const ch of text) {
    const code = map.get(ch)
    if (code === undefined) {
      unmapped.add(ch)
      out.push(0x3f) // '?'
    } else if (code < 0x80) {
      out.push(code)
    } else {
      out.push((code >> 8) & 0xff, code & 0xff)
    }
  }
  return { bytes: Uint8Array.from(out), unmapped: [...unmapped] }
}

/** 粗略判斷一段位元組是否為合法 UTF-8(用來自動猜來源編碼)。純 ASCII 也算 true。 */
export function looksLikeUtf8(bytes: Uint8Array): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return true
  } catch {
    return false
  }
}
