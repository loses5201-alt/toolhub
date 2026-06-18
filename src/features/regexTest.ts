/*
  正規表達式(regex)測試引擎 —— 純函式、無 DOM,可在 Node 測。
  - runRegex:對文字套用 regex,回傳所有符合處(含位置與捕獲群組);語法錯誤回傳訊息。
  - explainPattern:把 pattern 拆成一段段,用白話中文解釋(regex101 不講中文)。
  - applyReplace:用替換字串做取代(支援 $1、$<name> 等)。
  - LIBRARY:常用樣式庫,含台灣在地(手機/身分證/統編/車牌/郵遞區號)。
  全程在瀏覽器內以 JS 內建 RegExp 運算,不連網、不上傳。
*/

export interface GroupHit {
  name: string // '1'、'2' 或具名群組名稱
  value: string | undefined
}
export interface MatchHit {
  match: string
  index: number
  length: number
  groups: GroupHit[]
}
export interface RunResult {
  ok: boolean
  error?: string
  matches: MatchHit[]
}

// 把使用者給的 flags 正規化:去重、保證含 'g'(才能列出全部),只留合法字元
export function normalizeFlags(flags: string): string {
  const allowed = 'gimsuy'
  const set = new Set<string>()
  for (const ch of flags) if (allowed.includes(ch)) set.add(ch)
  set.add('g')
  // 維持固定順序,避免 'gg' 之類重複
  return [...allowed].filter((c) => set.has(c)).join('')
}

export function runRegex(pattern: string, flags: string, text: string): RunResult {
  if (!pattern) return { ok: true, matches: [] }
  let re: RegExp
  try {
    re = new RegExp(pattern, normalizeFlags(flags))
  } catch (e) {
    return { ok: false, error: (e as Error).message, matches: [] }
  }
  const matches: MatchHit[] = []
  // 用 matchAll;空字串 match 由 JS 內建機制自動推進 lastIndex,不會無限迴圈
  let guard = 0
  for (const m of text.matchAll(re)) {
    const groups: GroupHit[] = []
    for (let i = 1; i < m.length; i++) groups.push({ name: String(i), value: m[i] })
    if (m.groups) for (const k of Object.keys(m.groups)) groups.push({ name: k, value: m.groups[k] })
    matches.push({ match: m[0], index: m.index ?? 0, length: m[0].length, groups })
    if (++guard > 100000) break // 安全上限
  }
  return { ok: true, matches }
}

// 取代:回傳結果或錯誤(沿用 String.replace 的 $1 / $<name> 規則)
export function applyReplace(
  pattern: string,
  flags: string,
  text: string,
  replacement: string,
): { ok: boolean; error?: string; result: string } {
  try {
    const re = new RegExp(pattern, normalizeFlags(flags))
    return { ok: true, result: text.replace(re, replacement) }
  } catch (e) {
    return { ok: false, error: (e as Error).message, result: '' }
  }
}

// ---- 解釋器 ----

export interface RegexToken {
  text: string
  explain: string
  depth: number
}

const ESCAPE_MAP: Record<string, string> = {
  d: '一個數字(0–9)',
  D: '一個「非」數字',
  w: '一個英數字或底線(a–z A–Z 0–9 _)',
  W: '一個「非」英數字元',
  s: '一個空白字元(空格、Tab、換行等)',
  S: '一個「非」空白字元',
  b: '單字邊界(字與非字的交界)',
  B: '非單字邊界',
  n: '換行字元(LF)',
  r: '回車字元(CR)',
  t: 'Tab 定位字元',
  f: '換頁字元',
  v: '垂直定位字元',
  0: 'NULL 字元',
}

// 讀取緊接在某個原子後面的量詞,回傳描述與長度
function readQuantifier(p: string, i: number): { text: string; desc: string; len: number } | null {
  const c = p[i]
  let base = ''
  let desc = ''
  let len = 0
  if (c === '*') {
    base = '*'
    desc = '出現 0 次以上'
    len = 1
  } else if (c === '+') {
    base = '+'
    desc = '出現 1 次以上'
    len = 1
  } else if (c === '?') {
    base = '?'
    desc = '出現 0 或 1 次(可有可無)'
    len = 1
  } else if (c === '{') {
    const close = p.indexOf('}', i)
    if (close > i) {
      const body = p.slice(i + 1, close)
      const mm = /^(\d+)(,(\d*)?)?$/.exec(body)
      if (mm) {
        base = p.slice(i, close + 1)
        len = base.length
        if (mm[2] === undefined) desc = `剛好出現 ${mm[1]} 次`
        else if (mm[3] === '' || mm[3] === undefined) desc = `出現 ${mm[1]} 次以上`
        else desc = `出現 ${mm[1]} 到 ${mm[3]} 次`
      }
    }
  }
  if (!base) return null
  // 惰性 / 佔有量詞後綴
  let suffix = ''
  if (p[i + len] === '?') {
    suffix = '?'
    desc += `(惰性:盡量少配)`
  } else if (p[i + len] === '+') {
    suffix = '+'
    desc += `(佔有:配到不回溯)`
  }
  return { text: base + suffix, desc, len: len + suffix.length }
}

// 描述字元集合 [...] 的內容
function describeClass(body: string, negated: boolean): string {
  const parts: string[] = []
  let i = 0
  while (i < body.length) {
    // 範圍 a-z
    if (body[i + 1] === '-' && i + 2 < body.length) {
      parts.push(`${body[i]} 到 ${body[i + 2]}`)
      i += 3
      continue
    }
    if (body[i] === '\\') {
      const nx = body[i + 1] ?? ''
      parts.push(ESCAPE_MAP[nx] ? ESCAPE_MAP[nx] : `「${nx}」`)
      i += 2
      continue
    }
    parts.push(`「${body[i]}」`)
    i += 1
  }
  const joined = parts.join('、')
  return negated ? `不是以下任一字元的單一字元:${joined}` : `以下任一個字元:${joined}`
}

export function explainPattern(pattern: string): RegexToken[] {
  const tokens: RegexToken[] = []
  let depth = 0
  let i = 0
  const n = pattern.length

  const push = (text: string, explain: string, d = depth) => {
    tokens.push({ text, explain, depth: d })
    // 量詞緊跟在後則合併進剛 push 的 token
    const q = readQuantifier(pattern, i)
    if (q) {
      const last = tokens[tokens.length - 1]
      last.text += q.text
      last.explain += `,${q.desc}`
      i += q.len
    }
  }

  while (i < n) {
    const c = pattern[i]

    if (c === '\\') {
      const next = pattern[i + 1] ?? ''
      const combo = '\\' + next
      i += 2
      if (/[1-9]/.test(next)) push(combo, `反向參照:要與第 ${next} 組捕獲到的內容相同`)
      else if (ESCAPE_MAP[next]) push(combo, ESCAPE_MAP[next])
      else push(combo, `比對字面上的「${next}」字元`)
      continue
    }

    if (c === '[') {
      // 讀到未跳脫的 ]
      let j = i + 1
      const negated = pattern[j] === '^'
      if (negated) j++
      if (pattern[j] === ']') j++ // 開頭的 ] 視為字面
      while (j < n && pattern[j] !== ']') {
        if (pattern[j] === '\\') j++
        j++
      }
      const body = pattern.slice(negated ? i + 2 : i + 1, j)
      const text = pattern.slice(i, j + 1)
      i = j + 1
      push(text, describeClass(body, negated))
      continue
    }

    if (c === '(') {
      let label = '開始一個捕獲群組(會記住配到的內容)'
      let text = '('
      if (pattern.startsWith('(?:', i)) {
        label = '開始一個非捕獲群組(只分組、不記住)'
        text = '(?:'
        i += 3
      } else if (pattern.startsWith('(?=', i)) {
        label = '正向先行(後面必須接著符合，但不消耗字元)'
        text = '(?='
        i += 3
      } else if (pattern.startsWith('(?!', i)) {
        label = '負向先行(後面不可接著符合)'
        text = '(?!'
        i += 3
      } else if (pattern.startsWith('(?<=', i)) {
        label = '正向後行(前面必須是)'
        text = '(?<='
        i += 4
      } else if (pattern.startsWith('(?<!', i)) {
        label = '負向後行(前面不可是)'
        text = '(?<!'
        i += 4
      } else {
        const named = /^\(\?<([A-Za-z_$][\w$]*)>/.exec(pattern.slice(i))
        if (named) {
          label = `開始一個具名捕獲群組「${named[1]}」`
          text = named[0]
          i += named[0].length
        } else {
          i += 1
        }
      }
      tokens.push({ text, explain: label, depth })
      depth++
      continue
    }

    if (c === ')') {
      depth = Math.max(0, depth - 1)
      i += 1
      tokens.push({ text: ')', explain: '群組結束', depth })
      // 群組後可接量詞
      const q = readQuantifier(pattern, i)
      if (q) {
        const last = tokens[tokens.length - 1]
        last.text += q.text
        last.explain += `,整組${q.desc}`
        i += q.len
      }
      continue
    }

    if (c === '^') {
      i += 1
      push('^', '比對開頭(行首,若加 m 旗標則為每行行首)')
      continue
    }
    if (c === '$') {
      i += 1
      push('$', '比對結尾(行尾,若加 m 旗標則為每行行尾)')
      continue
    }
    if (c === '.') {
      i += 1
      push('.', '任意一個字元(預設不含換行;加 s 旗標才含)')
      continue
    }
    if (c === '|') {
      i += 1
      tokens.push({ text: '|', explain: '或(左右兩邊任一符合即可)', depth })
      continue
    }

    // 一般字面字元
    i += 1
    push(c, `比對字面上的「${c}」`)
  }
  return tokens
}

// ---- 常用樣式庫 ----
export interface LibraryItem {
  name: string
  pattern: string
  flags: string
  sample: string
  desc: string
}

export const LIBRARY: LibraryItem[] = [
  {
    name: 'Email 信箱',
    pattern: '[\\w.+-]+@[\\w-]+\\.[\\w.-]+',
    flags: 'g',
    sample: '聯絡 hello@example.com 或 service@台灣.tw,客服 a.b+tag@mail.co.uk',
    desc: '抓出文字中的電子郵件地址。',
  },
  {
    name: '網址 URL',
    pattern: 'https?://[^\\s)）]+',
    flags: 'gi',
    sample: '官網 https://example.com/path?q=1 與 http://test.org 都可。',
    desc: '抓出 http/https 開頭的網址(遇到空白或括號即止)。',
  },
  {
    name: '台灣手機號碼',
    pattern: '09\\d{2}[-\\s]?\\d{3}[-\\s]?\\d{3}',
    flags: 'g',
    sample: '我的手機 0912-345-678,公司 0987654321,客服 0900 000 000。',
    desc: '09 開頭共 10 碼,可含 - 或空白分隔。',
  },
  {
    name: '台灣市話',
    pattern: '0\\d{1,2}-?\\d{6,8}',
    flags: 'g',
    sample: '台北 02-12345678、台中 04-22223333、宜蘭 03-9123456。',
    desc: '區碼 0 開頭 + 號碼,可含 -。',
  },
  {
    name: '身分證字號',
    pattern: '[A-Z][12]\\d{8}',
    flags: 'g',
    sample: '範例 A123456789、B287654321(僅檢查格式,非檢查碼)。',
    desc: '1 個大寫英文 + 性別碼(1/2) + 8 碼數字。',
  },
  {
    name: '統一編號',
    pattern: '(?<!\\d)\\d{8}(?!\\d)',
    flags: 'g',
    sample: '公司統編 12345678,發票 04595257,訂單號 1234567890 不算。',
    desc: '獨立的 8 碼數字(前後不接其他數字)。',
  },
  {
    name: '車牌(新式)',
    pattern: '[A-Z]{3}-?\\d{4}',
    flags: 'g',
    sample: '汽車 ABC-1234、機車 EFG5678。',
    desc: '3 碼英文 + 4 碼數字,可含 -。',
  },
  {
    name: '郵遞區號',
    pattern: '\\b\\d{3}(\\d{2})?\\b',
    flags: 'g',
    sample: '台北 100、信義區 11049、新竹 300。',
    desc: '3 碼或 3+2 碼(郵遞區號)。',
  },
  {
    name: '日期 YYYY-MM-DD',
    pattern: '\\d{4}[-/]\\d{1,2}[-/]\\d{1,2}',
    flags: 'g',
    sample: '報名 2026-06-18,截止 2026/7/1。',
    desc: '西元日期,分隔符可用 - 或 /。',
  },
  {
    name: '時間 HH:MM',
    pattern: '([01]\\d|2[0-3]):[0-5]\\d',
    flags: 'g',
    sample: '會議 09:30 到 17:05,午休 12:00。',
    desc: '24 小時制時間(00:00–23:59)。',
  },
  {
    name: 'IPv4 位址',
    pattern: '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b',
    flags: 'g',
    sample: '主機 192.168.0.1,DNS 8.8.8.8。',
    desc: '四組數字以點分隔(未驗證每組 ≤255)。',
  },
  {
    name: 'HEX 色碼',
    pattern: '#[0-9a-fA-F]{6}\\b',
    flags: 'g',
    sample: '主色 #1A2B3C,背景 #ffffff。',
    desc: '6 位 16 進位色碼。',
  },
  {
    name: '中文字',
    pattern: '[\\u4e00-\\u9fff]+',
    flags: 'g',
    sample: 'Hello 世界,this is 測試 123。',
    desc: '連續的中日韓統一表意文字(常見中文字)。',
  },
  {
    name: 'HTML 標籤',
    pattern: '</?[a-zA-Z][^>]*>',
    flags: 'g',
    sample: '<p class="x">嗨</p><br/>',
    desc: '抓出 HTML 標籤(粗略,非完整解析器)。',
  },
]
