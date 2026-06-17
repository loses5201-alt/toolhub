/*
  亂碼修復核心 —— 純函式、無 DOM,可在 Node 測。
  針對最常見且「可還原」的一類亂碼:原文是 UTF-8,卻被當成西歐編碼
  (Latin-1 / Windows-1252)解讀,於是中文變成「ä¸­æ–‡」、é 變成「Ã©」、
  ' 變成「â€™」這種。做法:把畫面上的亂碼字元逆向還原成原始位元組,
  再用 UTF-8 正確解碼。全程在瀏覽器,文字不上傳。

  限制(誠實揭露):
  - 只能修「UTF-8 被誤當成西歐編碼」這一向(最常見、可逆)。
  - 若亂碼裡已出現替換字元 �(U+FFFD),代表位元組在轉換時已遺失,無法還原。
  - 整段文字需一致地被同一種錯誤編碼;中英文與亂碼混雜時可能無法處理。
*/

// Windows-1252 在 0x80–0x9F 的特殊字元 → 位元組(其餘 0x00–0x7F、0xA0–0xFF 與 Unicode 同碼位)
const CP1252_SPECIALS: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
}

/** 把(被誤解讀的)文字逆向還原成原始位元組;遇到無法對應的字元回 null。 */
export function reencodeToBytes(text: string): Uint8Array | null {
  const out = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) {
    const cp = text.charCodeAt(i)
    let byte: number
    if (cp <= 0xff) {
      byte = cp // ASCII + Latin-1(含 0x80–0x9F C1 控制碼):碼位 = 位元組
    } else if (cp in CP1252_SPECIALS) {
      byte = CP1252_SPECIALS[cp] // Windows-1252 在 0x80–0x9F 的可見特殊字
    } else {
      return null // 出現非西歐可表示的字元(例如正常中文),代表這段不是此類亂碼
    }
    out[i] = byte
  }
  return out
}

const utf8Fatal = new TextDecoder('utf-8', { fatal: true })

/** 嘗試修復一輪:逆向成位元組再以 UTF-8 解碼;失敗(非此類亂碼)回 null。 */
export function fixOnce(text: string): string | null {
  if (!text) return null
  const bytes = reencodeToBytes(text)
  if (!bytes) return null
  try {
    return utf8Fatal.decode(bytes)
  } catch {
    return null // 還原出的位元組不是合法 UTF-8 → 並非此類亂碼
  }
}

/**
 * 「亂碼嫌疑分數」:落在 Latin-1 補充 / 拉丁擴充 / 一般標點區的字元數。
 * 正確的中文(CJK,碼位 > 0xFF 且不在此區)修好後分數會明顯下降。
 */
export function suspicionScore(text: string): number {
  let n = 0
  for (let i = 0; i < text.length; i++) {
    const cp = text.charCodeAt(i)
    if ((cp >= 0x80 && cp <= 0x24f) || (cp >= 0x2010 && cp <= 0x203a) || cp === 0xfffd) n++
  }
  return n
}

export interface FixResult {
  fixed: string
  changed: boolean
  rounds: number // 套用了幾輪(雙重亂碼需 2 輪以上)
  hasLoss: boolean // 含 U+FFFD 替換字元 → 部分內容已不可還原
}

/**
 * 修復亂碼:反覆套用 fixOnce,只在「嫌疑分數下降」時接受,最多 5 輪
 * (處理被重複錯誤編碼多次的雙重/三重亂碼)。
 */
export function fixMojibake(text: string): FixResult {
  let cur = text
  let rounds = 0
  for (let i = 0; i < 5; i++) {
    const next = fixOnce(cur)
    if (next === null || next === cur) break
    if (suspicionScore(next) < suspicionScore(cur)) {
      cur = next
      rounds++
    } else break
  }
  return {
    fixed: cur,
    changed: cur !== text,
    rounds,
    hasLoss: cur.includes('�'),
  }
}
