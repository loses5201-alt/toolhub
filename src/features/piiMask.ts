/*
  文字個資遮蔽引擎 —— 在貼上的文字中自動找出個資並打碼,分享對話/截圖文字前先遮起來。
  全程在本機以正規表示式比對,內容不離開這台電腦。

  為降低誤判(把不是個資的數字也遮掉),身分證以內政部檢查碼驗證、信用卡以 Luhn 驗證,
  通過才視為個資。手機、Email 以明確格式比對。
*/

export type PiiKind = 'id' | 'mobile' | 'creditcard' | 'email'

export interface MaskOpts {
  kinds: Record<PiiKind, boolean>
  keepTail: boolean // 是否保留末 4 碼(false = 整段遮蔽)
}

export interface MaskResult {
  text: string
  counts: Record<PiiKind, number>
}

const ID_LETTER: Record<string, number> = {
  A: 10, B: 11, C: 12, D: 13, E: 14, F: 15, G: 16, H: 17, I: 34, J: 18,
  K: 19, L: 20, M: 21, N: 22, O: 35, P: 23, Q: 24, R: 25, S: 26, T: 27,
  U: 28, V: 29, W: 32, X: 30, Y: 31, Z: 33,
}

/** 驗證台灣身分證字號檢查碼(內政部規則) */
export function isValidTwId(raw: string): boolean {
  const s = raw.toUpperCase()
  if (!/^[A-Z][12]\d{8}$/.test(s)) return false
  const code = ID_LETTER[s[0]]
  if (code === undefined) return false
  const digits = s.slice(1).split('').map(Number)
  let sum = Math.floor(code / 10) + (code % 10) * 9
  const weights = [8, 7, 6, 5, 4, 3, 2, 1, 1]
  for (let i = 0; i < 9; i++) sum += digits[i] * weights[i]
  return sum % 10 === 0
}

/** Luhn 演算法驗證信用卡卡號 */
export function isValidLuhn(digits: string): boolean {
  let sum = 0
  let alt = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48
    if (d < 0 || d > 9) return false
    if (alt) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    alt = !alt
  }
  return sum % 10 === 0
}

// 依設定把一段命中的字串打碼:keepTail 則保留末 4 碼,其餘可見字元換成 ●(分隔符保留)
function maskToken(token: string, keepTail: boolean): string {
  const chars = token.split('')
  const isVisible = (c: string) => /[0-9A-Za-z@.]/.test(c)
  const visibleIdx = chars.map((c, i) => (isVisible(c) ? i : -1)).filter((i) => i >= 0)
  const keep = keepTail ? new Set(visibleIdx.slice(-4)) : new Set<number>()
  return chars
    .map((c, i) => {
      if (!isVisible(c)) return c // 保留 - 空格 等分隔符,維持原本長相
      if (keep.has(i)) return c
      return '●'
    })
    .join('')
}

interface Detector {
  kind: PiiKind
  re: RegExp
  accept?: (m: string) => boolean
}

// 注意:用 \d 分隔符比對時要避免吃到更長數字串的一部分,故前後加非數字/邊界檢查由呼叫端處理。
const detectors: Detector[] = [
  // Email
  { kind: 'email', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  // 身分證字號(檢查碼需通過)
  { kind: 'id', re: /[A-Za-z][12]\d{8}/g, accept: (m) => isValidTwId(m) },
  // 手機 09xx-xxx-xxx / 09xxxxxxxx(允許 - 或空白分隔)
  {
    kind: 'mobile',
    re: /09\d{2}[-\s]?\d{3}[-\s]?\d{3}/g,
    accept: (m) => m.replace(/\D/g, '').length === 10,
  },
  // 信用卡 13~16 碼(可用 - 或空白分組),需通過 Luhn
  {
    kind: 'creditcard',
    re: /\b\d{4}[-\s]?\d{4}[-\s]?\d{2,4}[-\s]?\d{0,4}\b/g,
    accept: (m) => {
      const d = m.replace(/\D/g, '')
      return d.length >= 13 && d.length <= 16 && isValidLuhn(d)
    },
  },
]

interface Hit {
  start: number
  end: number
  kind: PiiKind
  text: string
}

/** 偵測並遮蔽文字中的個資,回傳遮蔽後文字與各類命中數。 */
export function maskPii(text: string, opts: MaskOpts): MaskResult {
  const counts: Record<PiiKind, number> = { id: 0, mobile: 0, creditcard: 0, email: 0 }
  if (!text) return { text, counts }

  const hits: Hit[] = []
  for (const det of detectors) {
    if (!opts.kinds[det.kind]) continue
    det.re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = det.re.exec(text)) !== null) {
      const token = m[0]
      if (m.index === det.re.lastIndex) det.re.lastIndex++ // 防零寬無限迴圈
      if (det.accept && !det.accept(token)) continue
      hits.push({ start: m.index, end: m.index + token.length, kind: det.kind, text: token })
    }
  }

  // 依出現位置排序,重疊時保留先偵測到的(detectors 順序即優先序),避免同一段被重複處理
  hits.sort((a, b) => a.start - b.start || b.end - a.end)
  const chosen: Hit[] = []
  let lastEnd = -1
  for (const h of hits) {
    if (h.start < lastEnd) continue // 與已選範圍重疊,略過
    chosen.push(h)
    lastEnd = h.end
  }

  let out = ''
  let cursor = 0
  for (const h of chosen) {
    out += text.slice(cursor, h.start)
    out += maskToken(h.text, opts.keepTail)
    counts[h.kind]++
    cursor = h.end
  }
  out += text.slice(cursor)
  return { text: out, counts }
}
