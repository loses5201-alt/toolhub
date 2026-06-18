/*
  正規表達式解讀引擎 —— 純函式、無 DOM、可在 Node 測試。
  把一段 regex pattern 逐段拆解成「原始片段 + 白話中文說明」,
  讓使用者看懂手上那串符號到底在比對什麼。
  matchAll() 只是包一層原生 RegExp(供 UI 即時標示),邏輯本身可測。
*/

export interface RegexToken {
  text: string // pattern 中的原始片段
  desc: string // 白話中文說明
  kind: TokenKind // 供 UI 上色
}

export type TokenKind =
  | 'anchor'
  | 'class'
  | 'quant'
  | 'group'
  | 'set'
  | 'literal'
  | 'escape'
  | 'alt'
  | 'backref'

// \d \w 等簡寫字元類
const CLASS_DESC: Record<string, string> = {
  d: '任一數字(0-9)',
  D: '任一「非數字」字元',
  w: '任一文字字元(英數或底線)',
  W: '任一「非文字」字元',
  s: '任一空白字元(空格、Tab、換行等)',
  S: '任一「非空白」字元',
  b: '單字邊界(字與非字的交界)',
  B: '「非單字邊界」',
}

// 跳脫後代表特殊字元的字
const ESCAPED_CHAR: Record<string, string> = {
  n: '換行字元 (\\n)',
  r: '歸位字元 (\\r)',
  t: 'Tab 字元 (\\t)',
  f: '換頁字元 (\\f)',
  v: '垂直定位字元 (\\v)',
  '0': 'NULL 字元 (\\0)',
}

function quantDesc(raw: string): string {
  if (raw === '*') return '前一項出現 0 次以上(可有可無、可重複)'
  if (raw === '+') return '前一項出現 1 次以上'
  if (raw === '?') return '前一項出現 0 或 1 次(可有可無)'
  const m = raw.match(/^\{(\d+)(,)?(\d+)?\}$/)
  if (m) {
    const min = m[1]
    if (!m[2]) return `前一項剛好出現 ${min} 次`
    if (m[3] === undefined) return `前一項出現至少 ${min} 次`
    return `前一項出現 ${min} 到 ${m[3]} 次`
  }
  return '重複次數限定'
}

function describeSet(body: string, negated: boolean): string {
  const parts: string[] = []
  let i = 0
  while (i < body.length) {
    const c = body[i]
    if (c === '\\' && i + 1 < body.length) {
      const n = body[i + 1]
      parts.push(CLASS_DESC[n] ? CLASS_DESC[n] : `字元「${n}」`)
      i += 2
      continue
    }
    // 範圍 a-z
    if (body[i + 1] === '-' && i + 2 < body.length && body[i + 2] !== ']') {
      parts.push(`${c} 到 ${body[i + 2]} 之間`)
      i += 3
      continue
    }
    parts.push(`「${c}」`)
    i += 1
  }
  const list = parts.join('、')
  return negated ? `任一「不是」這些的字元:${list}` : `任一符合的字元:${list}`
}

function groupHead(pattern: string, i: number): { len: number; desc: string; kind: TokenKind } {
  // i 指向 '('
  const rest = pattern.slice(i)
  if (rest.startsWith('(?:')) return { len: 3, desc: '群組(不擷取,只分組)', kind: 'group' }
  if (rest.startsWith('(?=')) return { len: 3, desc: '正向先行斷言:後面要接著…', kind: 'group' }
  if (rest.startsWith('(?!')) return { len: 3, desc: '負向先行斷言:後面「不可」接著…', kind: 'group' }
  if (rest.startsWith('(?<=')) return { len: 4, desc: '正向後行斷言:前面要是…', kind: 'group' }
  if (rest.startsWith('(?<!')) return { len: 4, desc: '負向後行斷言:前面「不可」是…', kind: 'group' }
  const named = rest.match(/^\(\?<([A-Za-z_$][\w$]*)>/)
  if (named) return { len: named[0].length, desc: `具名擷取群組「${named[1]}」開始`, kind: 'group' }
  return { len: 1, desc: '擷取群組開始(可被回溯參照)', kind: 'group' }
}

/** 把 regex pattern 逐段拆解並加上白話說明。不合法時擲出 Error。 */
export function explainRegex(pattern: string, flags = ''): RegexToken[] {
  if (!pattern) return []
  // 先確認能編譯(也驗證 flags)
  new RegExp(pattern, flags)

  const tokens: RegexToken[] = []
  let i = 0
  let literalBuf = ''
  const flushLiteral = () => {
    if (literalBuf) {
      tokens.push({ text: literalBuf, desc: `字面文字「${literalBuf}」`, kind: 'literal' })
      literalBuf = ''
    }
  }
  const pushLazy = () => {
    if (pattern[i] === '?') {
      tokens.push({ text: '?', desc: '惰性比對(盡量比少一點)', kind: 'quant' })
      i += 1
    } else if (pattern[i] === '+') {
      tokens.push({ text: '+', desc: '佔有比對(不回溯)', kind: 'quant' })
      i += 1
    }
  }

  while (i < pattern.length) {
    const c = pattern[i]

    if (c === '\\' && i + 1 < pattern.length) {
      flushLiteral()
      const n = pattern[i + 1]
      if (CLASS_DESC[n]) {
        const kind: TokenKind = n === 'b' || n === 'B' ? 'anchor' : 'class'
        tokens.push({ text: '\\' + n, desc: CLASS_DESC[n], kind })
      } else if (/[1-9]/.test(n)) {
        tokens.push({ text: '\\' + n, desc: `回溯參照:比對第 ${n} 個群組擷取到的內容`, kind: 'backref' })
      } else if (n === 'k') {
        const m = pattern.slice(i).match(/^\\k<([A-Za-z_$][\w$]*)>/)
        if (m) {
          tokens.push({ text: m[0], desc: `回溯參照:比對具名群組「${m[1]}」`, kind: 'backref' })
          i += m[0].length
          continue
        }
        tokens.push({ text: '\\k', desc: '跳脫字元 k', kind: 'escape' })
      } else if (ESCAPED_CHAR[n]) {
        tokens.push({ text: '\\' + n, desc: ESCAPED_CHAR[n], kind: 'escape' })
      } else {
        tokens.push({ text: '\\' + n, desc: `字面字元「${n}」(已跳脫)`, kind: 'escape' })
      }
      i += 2
      continue
    }

    if (c === '[') {
      flushLiteral()
      // 找到對應的 ]
      let j = i + 1
      const negated = pattern[j] === '^'
      if (negated) j++
      if (pattern[j] === ']') j++ // 開頭的 ] 視為字面
      while (j < pattern.length && pattern[j] !== ']') {
        if (pattern[j] === '\\') j++
        j++
      }
      const inner = pattern.slice(negated ? i + 2 : i + 1, j)
      tokens.push({ text: pattern.slice(i, j + 1), desc: describeSet(inner, negated), kind: 'set' })
      i = j + 1
      continue
    }

    if (c === '(') {
      flushLiteral()
      const g = groupHead(pattern, i)
      tokens.push({ text: pattern.slice(i, i + g.len), desc: g.desc, kind: g.kind })
      i += g.len
      continue
    }

    if (c === ')') {
      flushLiteral()
      tokens.push({ text: ')', desc: '群組結束', kind: 'group' })
      i += 1
      continue
    }

    if (c === '|') {
      flushLiteral()
      tokens.push({ text: '|', desc: '或(左右兩種寫法擇一符合)', kind: 'alt' })
      i += 1
      continue
    }

    if (c === '^') {
      flushLiteral()
      tokens.push({ text: '^', desc: '比對開頭(字串或該行開頭)', kind: 'anchor' })
      i += 1
      continue
    }
    if (c === '$') {
      flushLiteral()
      tokens.push({ text: '$', desc: '比對結尾(字串或該行結尾)', kind: 'anchor' })
      i += 1
      continue
    }
    if (c === '.') {
      flushLiteral()
      tokens.push({ text: '.', desc: '任一字元(預設不含換行)', kind: 'class' })
      i += 1
      continue
    }

    if (c === '*' || c === '+' || c === '?') {
      flushLiteral()
      tokens.push({ text: c, desc: quantDesc(c), kind: 'quant' })
      i += 1
      pushLazy()
      continue
    }

    if (c === '{') {
      const m = pattern.slice(i).match(/^\{\d+(,\d*)?\}/)
      if (m) {
        flushLiteral()
        tokens.push({ text: m[0], desc: quantDesc(m[0]), kind: 'quant' })
        i += m[0].length
        pushLazy()
        continue
      }
    }

    // 一般字面字元,累積起來
    literalBuf += c
    i += 1
  }
  flushLiteral()
  return tokens
}

export interface RegexMatch {
  index: number
  text: string
  groups: string[]
  named: Record<string, string>
}

/** 用原生 RegExp 跑出所有比對(供 UI 標示)。不合法時擲出 Error。 */
export function matchAll(pattern: string, flags: string, input: string): RegexMatch[] {
  const g = flags.includes('g') ? flags : flags + 'g'
  const re = new RegExp(pattern, g)
  const out: RegexMatch[] = []
  let m: RegExpExecArray | null
  let guard = 0
  while ((m = re.exec(input)) !== null) {
    out.push({
      index: m.index,
      text: m[0],
      groups: m.slice(1).map((x) => x ?? ''),
      named: { ...(m.groups || {}) },
    })
    if (m.index === re.lastIndex) re.lastIndex++ // 避免零寬比對卡住
    if (++guard > 100000) break
  }
  return out
}
