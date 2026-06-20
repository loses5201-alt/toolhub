/*
  CSS 格式化 / 壓縮引擎(純函式、無 DOM,可在 Node 直接測)。
  目標:把擠成一行或排版凌亂的 CSS / SCSS-ish 規則整理成可讀格式(每條宣告獨立一行、
  選擇器逗號各自成行、巢狀 @media 縮排),或反向壓成單行。全程在使用者瀏覽器執行、不上傳。

  正確處理容易出錯的地方:
  - url(data:image/png;base64,...) 內的 ; 與 , 不會被當成宣告分隔(掃描器追蹤括號深度);
  - 選擇器的 : 偽類(a:hover)不會被誤當宣告的 prop:value 冒號;
  - 字串("..." / '...')內容原樣保留;區塊註解保留(獨立成行或附在該行)。
  限制:這是排版器、不驗證 CSS;會收斂多餘空白。壓縮模式移除註解。
*/

export interface CssFormatOptions {
  indent?: number
}
export interface CssFormatResult {
  ok: boolean
  output: string
}

// 收斂空白成單一空格,但保留引號字串內的內容
function collapseWs(s: string): string {
  let out = ''
  let quote = ''
  let prevSpace = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (quote) {
      out += c
      if (c === quote) quote = ''
      continue
    }
    if (c === '"' || c === "'") {
      quote = c
      out += c
      prevSpace = false
      continue
    }
    if (/\s/.test(c)) {
      if (!prevSpace && out !== '') out += ' '
      prevSpace = true
      continue
    }
    out += c
    prevSpace = false
  }
  return out.replace(/\s+$/, '')
}

// 在頂層(括號/中括號/引號外)依字元 ch 切割;回傳每段(未 trim)
function splitTopLevel(s: string, ch: string): string[] {
  const parts: string[] = []
  let depth = 0
  let quote = ''
  let buf = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (quote) {
      buf += c
      if (c === quote) quote = ''
      continue
    }
    if (c === '"' || c === "'") {
      quote = c
      buf += c
      continue
    }
    if (c === '(' || c === '[') depth++
    else if (c === ')' || c === ']') depth = Math.max(0, depth - 1)
    if (c === ch && depth === 0) {
      parts.push(buf)
      buf = ''
      continue
    }
    buf += c
  }
  parts.push(buf)
  return parts
}

// 把宣告字串整理成 "prop: value"(以第一個頂層冒號切分);無冒號則原樣收斂
function formatDeclaration(t: string): string {
  const parts = splitTopLevel(t, ':')
  if (parts.length >= 2 && parts[0].trim() !== '') {
    const prop = collapseWs(parts[0].trim())
    const value = collapseWs(parts.slice(1).join(':').trim())
    return `${prop}: ${value}`
  }
  return collapseWs(t.trim())
}

// 掃描 CSS,呼叫各事件處理器(追蹤括號深度與字串,讓 ; { } 在 url()/字串內不被誤判)
function scan(
  css: string,
  on: {
    comment: (raw: string) => void
    selector: (buf: string) => void
    decl: (buf: string) => void
    close: () => void
  },
): void {
  let buf = ''
  let i = 0
  let paren = 0
  const n = css.length
  while (i < n) {
    const c = css[i]
    if (c === '/' && css[i + 1] === '*') {
      let e = css.indexOf('*/', i + 2)
      if (e < 0) e = n - 2
      on.comment(css.slice(i, e + 2))
      // 註解處理器自行決定是否併入 buf;這裡用回傳值無法,改由 on.comment 透過閉包處理
      i = e + 2
      continue
    }
    if (c === '"' || c === "'") {
      const q = c
      let j = i + 1
      while (j < n && css[j] !== q) {
        if (css[j] === '\\') j++
        j++
      }
      buf += css.slice(i, Math.min(j + 1, n))
      i = j + 1
      continue
    }
    if (c === '(') {
      paren++
      buf += c
      i++
      continue
    }
    if (c === ')') {
      paren = Math.max(0, paren - 1)
      buf += c
      i++
      continue
    }
    if (paren === 0 && c === '{') {
      on.selector(buf)
      buf = ''
      i++
      continue
    }
    if (paren === 0 && c === '}') {
      on.decl(buf)
      buf = ''
      on.close()
      i++
      continue
    }
    if (paren === 0 && c === ';') {
      on.decl(buf)
      buf = ''
      i++
      continue
    }
    buf += c
    i++
  }
  on.decl(buf)
}

export function formatCss(css: string, opts: CssFormatOptions = {}): CssFormatResult {
  const unit = Math.max(1, Math.min(8, opts.indent ?? 2))
  const pad = (d: number) => ' '.repeat(unit * d)
  const lines: string[] = []
  let depth = 0
  let buf = '' // 累積中的文字(供註解判斷是否獨立成行)

  // 由於 scan 的 comment 需要存取「目前是否有待處理的 buf」,改用自訂掃描整合
  let i = 0
  let paren = 0
  const n = css.length
  function flushSelector(text: string) {
    const nonEmpty = splitTopLevel(text, ',')
      .map((s) => collapseWs(s.trim()))
      .filter((s) => s !== '')
    const list = nonEmpty.length ? nonEmpty : ['']
    for (let k = 0; k < list.length; k++) {
      const suffix = k === list.length - 1 ? ' {' : ','
      lines.push(pad(depth) + list[k] + suffix)
    }
    depth++
  }
  function flushDecl(text: string) {
    const t = text.trim()
    if (!t) return
    lines.push(pad(depth) + formatDeclaration(t) + ';')
  }
  while (i < n) {
    const c = css[i]
    if (c === '/' && css[i + 1] === '*') {
      let e = css.indexOf('*/', i + 2)
      if (e < 0) e = n - 2
      const cm = css.slice(i, e + 2)
      if (buf.trim() === '') lines.push(pad(depth) + cm)
      else buf += cm
      i = e + 2
      continue
    }
    if (c === '"' || c === "'") {
      const q = c
      let j = i + 1
      while (j < n && css[j] !== q) {
        if (css[j] === '\\') j++
        j++
      }
      buf += css.slice(i, Math.min(j + 1, n))
      i = j + 1
      continue
    }
    if (c === '(') {
      paren++
      buf += c
      i++
      continue
    }
    if (c === ')') {
      paren = Math.max(0, paren - 1)
      buf += c
      i++
      continue
    }
    if (paren === 0 && c === '{') {
      flushSelector(buf)
      buf = ''
      i++
      continue
    }
    if (paren === 0 && c === '}') {
      flushDecl(buf)
      buf = ''
      depth = Math.max(0, depth - 1)
      lines.push(pad(depth) + '}')
      i++
      continue
    }
    if (paren === 0 && c === ';') {
      flushDecl(buf)
      buf = ''
      i++
      continue
    }
    buf += c
    i++
  }
  flushDecl(buf)
  return { ok: true, output: lines.join('\n') }
}

export function minifyCss(css: string): CssFormatResult {
  let out = ''
  scan(css, {
    comment: () => {
      /* 壓縮時移除註解 */
    },
    selector: (b) => {
      const sels = splitTopLevel(b, ',')
        .map((s) => collapseWs(s.trim()))
        .filter((s) => s !== '')
      out += sels.join(',') + '{'
    },
    decl: (b) => {
      const t = b.trim()
      if (!t) return
      const parts = splitTopLevel(t, ':')
      let d: string
      if (parts.length >= 2 && parts[0].trim() !== '')
        d = collapseWs(parts[0].trim()) + ':' + collapseWs(parts.slice(1).join(':').trim())
      else d = collapseWs(t)
      out += d + ';'
    },
    close: () => {
      if (out.endsWith(';')) out = out.slice(0, -1)
      out += '}'
    },
  })
  return { ok: true, output: out }
}
