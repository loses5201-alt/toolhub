/*
  CSS 選擇器優先級(specificity)引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  把 CSS 選擇器拆解成 (a, b, c) 三欄優先級:
    a = ID 選擇器數(#id)
    b = class、屬性 [attr]、虛擬類別(:hover)數
    c = 型別(div)與虛擬元素(::before)數
  通用選擇器 *、組合子(> + ~ 空白)不計分;:where() 永遠 0;
  :is()/:not()/:has() 取其引數中最高優先級的那一個。
  用於「為什麼我的 CSS 沒套用」的除錯。全程在你的瀏覽器,不連網、不上傳。
*/

export interface Spec {
  a: number
  b: number
  c: number
}

const zero = (): Spec => ({ a: 0, b: 0, c: 0 })

// 識別字字元:英數、底線、連字號,以及非 ASCII(CSS 允許 U+00A0 以上作識別字)
function isIdentChar(ch: string): boolean {
  return /[-_A-Za-z0-9]/.test(ch) || ch.charCodeAt(0) >= 0x00a0
}

function readIdent(s: string, start: number): string {
  let i = start
  while (i < s.length) {
    if (s[i] === '\\') {
      i += 2 // 跳過跳脫字元
      continue
    }
    if (isIdentChar(s[i])) i++
    else break
  }
  return s.slice(start, i)
}

function findChar(s: string, from: number, target: string): number {
  for (let i = from; i < s.length; i++) {
    if (s[i] === '\\') {
      i++
      continue
    }
    if (s[i] === target) return i
  }
  return -1
}

/** 從 '(' 位置找對應的 ')',支援巢狀。回傳 ')' 的索引;找不到回字串長度。 */
function matchParen(s: string, open: number): number {
  let depth = 0
  for (let i = open; i < s.length; i++) {
    if (s[i] === '\\') {
      i++
      continue
    }
    if (s[i] === '(') depth++
    else if (s[i] === ')') {
      depth--
      if (depth === 0) return i
    }
  }
  return s.length
}

/** 以頂層逗號切分(不切在括號 / 中括號內)。 */
export function splitTop(s: string): string[] {
  const out: string[] = []
  let depth = 0
  let last = 0
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '\\') {
      i++
      continue
    }
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    else if (ch === ',' && depth === 0) {
      out.push(s.slice(last, i))
      last = i + 1
    }
  }
  out.push(s.slice(last))
  return out.map((x) => x.trim()).filter((x) => x.length > 0)
}

/** 比較兩個優先級:正數表示 x 高於 y。 */
export function compareSpec(x: Spec, y: Spec): number {
  if (x.a !== y.a) return x.a - y.a
  if (x.b !== y.b) return x.b - y.b
  return x.c - y.c
}

function maxSpec(list: Spec[]): Spec {
  let best = zero()
  for (const s of list) if (compareSpec(s, best) > 0) best = s
  return best
}

const LEGACY_ELEMENTS = new Set(['before', 'after', 'first-line', 'first-letter'])

/** 計算單一複合 / 後代選擇器(可含組合子與空白)的優先級。 */
export function specificityOne(selector: string): Spec {
  const counts = zero()
  const sel = selector.trim()
  let i = 0
  while (i < sel.length) {
    const ch = sel[i]
    // 組合子與空白:不計分
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '>' || ch === '+' || ch === '~') {
      i++
      continue
    }
    if (ch === '*') {
      i++
      continue
    }
    if (ch === '|') {
      // 命名空間分隔,本身不計分
      i++
      continue
    }
    if (ch === '#') {
      i++
      const id = readIdent(sel, i)
      if (id) {
        counts.a++
        i += id.length
      } else i++
      continue
    }
    if (ch === '.') {
      i++
      const id = readIdent(sel, i)
      if (id) {
        counts.b++
        i += id.length
      } else i++
      continue
    }
    if (ch === '[') {
      const end = findChar(sel, i + 1, ']')
      counts.b++
      i = end >= 0 ? end + 1 : sel.length
      continue
    }
    if (ch === ':') {
      i++
      let doubleColon = false
      if (sel[i] === ':') {
        doubleColon = true
        i++
      }
      const name = readIdent(sel, i).toLowerCase()
      i += name.length
      if (sel[i] === '(') {
        const close = matchParen(sel, i)
        const inner = sel.slice(i + 1, close)
        i = close + 1
        if (
          !doubleColon &&
          (name === 'is' || name === 'matches' || name === 'not' || name === 'has')
        ) {
          const m = maxSpec(splitTop(inner).map((p) => specificityOne(p)))
          counts.a += m.a
          counts.b += m.b
          counts.c += m.c
        } else if (!doubleColon && name === 'where') {
          // 永遠 0,忽略引數
        } else {
          // 其他函式型:虛擬元素(::part/::slotted)算 c,虛擬類別(:nth-child)算 b
          if (doubleColon) counts.c++
          else counts.b++
        }
      } else {
        if (doubleColon) counts.c++
        else if (LEGACY_ELEMENTS.has(name)) counts.c++
        else counts.b++
      }
      continue
    }
    // 型別 / 元素名
    const id = readIdent(sel, i)
    if (id) {
      counts.c++
      i += id.length
      continue
    }
    i++ // 無法辨識的字元,跳過
  }
  return counts
}

export interface RankedSelector {
  selector: string
  spec: Spec
  label: string // "a,b,c"
  rank: number // 1 = 最高;同分同名次
}

/** 格式化成 "a,b,c"。 */
export function specLabel(s: Spec): string {
  return `${s.a},${s.b},${s.c}`
}

/**
 * 輸入多行 / 逗號分隔的選擇器,逐一計算並依優先級排名。
 * 同優先級給相同名次(且依 CSS 規則,實際以原始碼後出現者勝出 —— 由 UI 提示)。
 */
export function rankSelectors(input: string): RankedSelector[] {
  const lines = input
    .split(/\r?\n/)
    .flatMap((line) => splitTop(line))
    .filter((x) => x.length > 0)
  const items = lines.map((selector) => {
    const spec = specificityOne(selector)
    return { selector, spec, label: specLabel(spec), rank: 0 }
  })
  const sorted = [...items].sort((x, y) => compareSpec(y.spec, x.spec))
  // 指派名次(同分同名次)
  let rank = 0
  let prev: Spec | null = null
  for (let i = 0; i < sorted.length; i++) {
    if (prev === null || compareSpec(sorted[i].spec, prev) !== 0) rank = i + 1
    sorted[i].rank = rank
    prev = sorted[i].spec
  }
  return sorted
}
