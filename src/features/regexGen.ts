// 反向正規表示式 —— 解析正則的常用子集成 AST,再生出「符合該樣式」的範例字串。
// 用途:造測試資料、確認自己寫的 regex 真的會吃到哪些字串。純函式、無 DOM,可在 Node 測試。
// 驗證方式:產生後可用原生 RegExp.test 反向核對(測試即如此)。

type Node =
  | { t: 'char'; cp: number }
  | { t: 'any' }
  | { t: 'class'; pool: number[] }
  | { t: 'seq'; items: Node[] }
  | { t: 'alt'; options: Node[] }
  | { t: 'repeat'; node: Node; min: number; max: number }

const PRINTABLE: number[] = []
for (let c = 0x20; c <= 0x7e; c++) PRINTABLE.push(c)
const DIGITS: number[] = []
for (let c = 0x30; c <= 0x39; c++) DIGITS.push(c)
const WORD: number[] = []
for (let c = 0x30; c <= 0x39; c++) WORD.push(c)
for (let c = 0x41; c <= 0x5a; c++) WORD.push(c)
for (let c = 0x61; c <= 0x7a; c++) WORD.push(c)
WORD.push(0x5f) // _
const SPACE = [0x20, 0x09]

function shorthandPool(letter: string): number[] {
  switch (letter) {
    case 'd':
      return DIGITS
    case 'w':
      return WORD
    case 's':
      return SPACE
    case 'D':
      return PRINTABLE.filter((c) => !DIGITS.includes(c))
    case 'W':
      return PRINTABLE.filter((c) => !WORD.includes(c))
    case 'S':
      return PRINTABLE.filter((c) => !SPACE.includes(c))
    default:
      return []
  }
}

const ESCAPE_MAP: Record<string, number> = {
  n: 0x0a,
  r: 0x0d,
  t: 0x09,
  f: 0x0c,
  v: 0x0b,
  '0': 0x00,
}

class Parser {
  i = 0
  constructor(public src: string) {}

  parse(): Node {
    const node = this.parseAlt()
    if (this.i < this.src.length) throw new Error(`第 ${this.i + 1} 個字元無法解析:${this.src[this.i]}`)
    return node
  }

  parseAlt(): Node {
    const options = [this.parseSeq()]
    while (this.peek() === '|') {
      this.i++
      options.push(this.parseSeq())
    }
    return options.length === 1 ? options[0] : { t: 'alt', options }
  }

  parseSeq(): Node {
    const items: Node[] = []
    while (this.i < this.src.length && this.peek() !== '|' && this.peek() !== ')') {
      const atom = this.parseAtom()
      if (atom) items.push(this.parseQuantifier(atom))
    }
    return items.length === 1 ? items[0] : { t: 'seq', items }
  }

  parseQuantifier(node: Node): Node {
    const c = this.peek()
    let min: number, max: number
    if (c === '*') {
      this.i++
      min = 0
      max = Infinity
    } else if (c === '+') {
      this.i++
      min = 1
      max = Infinity
    } else if (c === '?') {
      this.i++
      min = 0
      max = 1
    } else if (c === '{') {
      const m = this.src.slice(this.i).match(/^\{(\d+)(,(\d*))?\}/)
      if (!m) return node // 不是合法量詞,當字面 {
      this.i += m[0].length
      min = parseInt(m[1], 10)
      if (m[2] === undefined) max = min
      else if (m[3] === '') max = Infinity
      else max = parseInt(m[3], 10)
      if (max < min) throw new Error(`量詞範圍錯誤:{${min},${max}}`)
    } else {
      return node
    }
    if (this.peek() === '?' || this.peek() === '+') this.i++ // 懶惰/獨佔,生成時忽略
    return { t: 'repeat', node, min, max }
  }

  parseAtom(): Node | null {
    const c = this.src[this.i]
    if (c === '(') {
      this.i++
      // 非捕獲群組 (?: 與其他 (? 修飾一律略過旗標
      if (this.src.startsWith('?:', this.i)) this.i += 2
      else if (this.peek() === '?') {
        // (?=...) (?!...) 等前瞻:跳過整段,生成時忽略
        const depth = this.skipGroup()
        return depth
      }
      const inner = this.parseAlt()
      if (this.peek() !== ')') throw new Error('括號未閉合 (')
      this.i++
      return inner
    }
    if (c === '[') return this.parseClass()
    if (c === '^' || c === '$') {
      this.i++
      return null // 錨點:零寬,生成時忽略
    }
    if (c === '.') {
      this.i++
      return { t: 'any' }
    }
    if (c === '\\') return this.parseEscape(false)
    if (c === ')' || c === undefined) return null
    this.i++
    return { t: 'char', cp: c.codePointAt(0)! }
  }

  // 跳過一個 (?...) 前瞻/後顧群組(連同內層巢狀括號),回傳空序列(零寬)
  skipGroup(): Node {
    let depth = 1
    while (this.i < this.src.length && depth > 0) {
      const ch = this.src[this.i]
      if (ch === '\\') this.i += 2
      else {
        if (ch === '(') depth++
        else if (ch === ')') depth--
        this.i++
      }
    }
    return { t: 'seq', items: [] }
  }

  parseEscape(inClass: boolean): Node {
    this.i++ // 吃掉 \
    const c = this.src[this.i]
    if (c === undefined) throw new Error('反斜線後缺少字元')
    this.i++
    if ('dwsDWS'.includes(c)) {
      if (inClass) return { t: 'class', pool: shorthandPool(c) } // 由呼叫端合併
      return { t: 'class', pool: shorthandPool(c) }
    }
    if (c === 'b' || c === 'B') return { t: 'seq', items: [] } // 字界:零寬
    if (c === 'x') {
      const m = this.src.slice(this.i).match(/^[0-9a-fA-F]{2}/)
      if (m) {
        this.i += 2
        return { t: 'char', cp: parseInt(m[0], 16) }
      }
    }
    if (c === 'u') {
      const m = this.src.slice(this.i).match(/^[0-9a-fA-F]{4}/)
      if (m) {
        this.i += 4
        return { t: 'char', cp: parseInt(m[0], 16) }
      }
    }
    if (c in ESCAPE_MAP) return { t: 'char', cp: ESCAPE_MAP[c] }
    return { t: 'char', cp: c.codePointAt(0)! } // 跳脫的字面(\. \* \\ 等)
  }

  parseClass(): Node {
    this.i++ // [
    let negated = false
    if (this.peek() === '^') {
      negated = true
      this.i++
    }
    const included = new Set<number>()
    // 開頭的 ] 視為字面
    if (this.peek() === ']') {
      included.add(0x5d)
      this.i++
    }
    while (this.i < this.src.length && this.peek() !== ']') {
      let lo: number
      if (this.peek() === '\\') {
        const node = this.parseEscape(true)
        if (node.t === 'class') {
          node.pool.forEach((p) => included.add(p))
          continue
        }
        lo = (node as { cp: number }).cp
      } else {
        lo = this.src.codePointAt(this.i)!
        this.i += String.fromCodePoint(lo).length
      }
      // 範圍 a-z
      if (this.peek() === '-' && this.src[this.i + 1] !== ']' && this.i + 1 < this.src.length) {
        this.i++ // -
        let hi: number
        if (this.peek() === '\\') {
          const node = this.parseEscape(true)
          hi = (node as { cp: number }).cp
        } else {
          hi = this.src.codePointAt(this.i)!
          this.i += String.fromCodePoint(hi).length
        }
        if (hi < lo) throw new Error('字元範圍顛倒')
        for (let c = lo; c <= hi; c++) included.add(c)
      } else {
        included.add(lo)
      }
    }
    if (this.peek() !== ']') throw new Error('字元類別未閉合 [')
    this.i++
    let pool = negated ? PRINTABLE.filter((c) => !included.has(c)) : [...included]
    if (pool.length === 0) throw new Error('字元類別為空,無法產生')
    return { t: 'class', pool }
  }

  peek(): string {
    return this.src[this.i]
  }
}

export function parseRegex(pattern: string): Node {
  if (pattern === '') throw new Error('請輸入正規表示式')
  return new Parser(pattern).parse()
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function gen(node: Node, cap: number): string {
  switch (node.t) {
    case 'char':
      return String.fromCodePoint(node.cp)
    case 'any':
      return String.fromCodePoint(pick(PRINTABLE))
    case 'class':
      return String.fromCodePoint(pick(node.pool))
    case 'seq':
      return node.items.map((n) => gen(n, cap)).join('')
    case 'alt':
      return gen(pick(node.options), cap)
    case 'repeat': {
      const hi = node.max === Infinity ? node.min + cap : Math.min(node.max, node.min + cap)
      const n = node.min + Math.floor(Math.random() * (hi - node.min + 1))
      let out = ''
      for (let k = 0; k < n; k++) out += gen(node.node, cap)
      return out
    }
  }
}

export interface GenOptions {
  count?: number
  maxRepeat?: number
  unique?: boolean
}

export function generateSamples(pattern: string, opts: GenOptions = {}): string[] {
  const ast = parseRegex(pattern)
  const count = Math.max(1, Math.min(opts.count ?? 10, 1000))
  const cap = Math.max(0, Math.min(opts.maxRepeat ?? 4, 50))
  const out: string[] = []
  const seen = new Set<string>()
  let tries = 0
  while (out.length < count && tries < count * 30) {
    tries++
    const s = gen(ast, cap)
    if (opts.unique) {
      if (seen.has(s)) continue
      seen.add(s)
    }
    out.push(s)
  }
  return out
}
