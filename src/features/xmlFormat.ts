/*
  XML 格式化 / 壓縮引擎(純函式、無 DOM,可在 Node 直接測)。
  目標:把擠成一行的 XML / SVG / RSS / pom.xml / 設定檔重新縮排成可讀格式,或反向壓成單行。
  不依賴瀏覽器 DOMParser,自行 tokenize + 建樹 + 重排,所以可在 Node 測,也代表
  全程在使用者瀏覽器執行、不上傳(XML 設定常含連線字串/密鑰)。

  保留:註解、CDATA、處理指令(<?xml?>)、DOCTYPE、屬性值內容、文字實體;
  標籤內多餘空白會收斂成單一空格。限制:這是排版器、不做 schema 驗證;
  「文字與子元素混雜」的內容(常見於 HTML 散文)重排時節點各自成行,空白會被正規化。
*/

export interface XmlFormatOptions {
  indent?: number
}
export interface XmlFormatResult {
  ok: boolean
  output: string
  error?: string
}

type Node =
  | { type: 'element'; name: string; open: string; selfClose: boolean; children: Node[] }
  | { type: 'text'; value: string }
  | { type: 'comment'; raw: string }
  | { type: 'cdata'; raw: string }
  | { type: 'pi'; raw: string }
  | { type: 'doctype'; raw: string }

// 收斂開始標籤內(引號外)的多餘空白成單一空格,並去掉收尾前的空白
function normalizeTag(raw: string): { norm: string; name: string; selfClose: boolean } {
  // raw 形如 <name ...> 或 <name .../>
  let inner = raw.slice(1, raw.endsWith('/>') ? -2 : -1) // 去掉 < 與 > 或 />
  const selfClose = raw.endsWith('/>')
  let out = ''
  let quote = ''
  let prevSpace = false
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i]
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
      if (!prevSpace) out += ' '
      prevSpace = true
      continue
    }
    out += c
    prevSpace = false
  }
  out = out.replace(/\s+$/, '')
  const m = /^([^\s/>]+)/.exec(out)
  const name = m ? m[1] : ''
  const norm = '<' + out + (selfClose ? '/>' : '>')
  return { norm, name, selfClose }
}

function tokenize(xml: string): Node[] {
  const toks: Node[] = []
  let i = 0
  const n = xml.length
  while (i < n) {
    if (xml[i] === '<') {
      if (xml.startsWith('<!--', i)) {
        const e = xml.indexOf('-->', i + 4)
        if (e < 0) throw new Error('註解 <!-- 沒有對應的 --> 結尾')
        toks.push({ type: 'comment', raw: xml.slice(i, e + 3) })
        i = e + 3
        continue
      }
      if (xml.startsWith('<![CDATA[', i)) {
        const e = xml.indexOf(']]>', i + 9)
        if (e < 0) throw new Error('CDATA 沒有對應的 ]]> 結尾')
        toks.push({ type: 'cdata', raw: xml.slice(i, e + 3) })
        i = e + 3
        continue
      }
      if (xml.startsWith('<?', i)) {
        const e = xml.indexOf('?>', i + 2)
        if (e < 0) throw new Error('處理指令 <? 沒有對應的 ?> 結尾')
        toks.push({ type: 'pi', raw: xml.slice(i, e + 2) })
        i = e + 2
        continue
      }
      if (xml.startsWith('<!', i)) {
        const e = xml.indexOf('>', i + 2)
        if (e < 0) throw new Error('<! 宣告沒有對應的 > 結尾')
        toks.push({ type: 'doctype', raw: xml.slice(i, e + 1) })
        i = e + 1
        continue
      }
      // 一般標籤(找對應的 >,略過引號內的 >)
      let j = i + 1
      let quote = ''
      while (j < n) {
        const c = xml[j]
        if (quote) {
          if (c === quote) quote = ''
        } else if (c === '"' || c === "'") quote = c
        else if (c === '>') break
        j++
      }
      if (j >= n) throw new Error('標籤 < 沒有對應的 > 結尾')
      const raw = xml.slice(i, j + 1)
      if (raw[1] === '/') {
        const name = raw.slice(2, -1).trim()
        toks.push({ type: 'element', name, open: '', selfClose: false, children: [] }) // 暫存:用 close 標記
        ;(toks[toks.length - 1] as { close?: boolean }).close = true
      } else {
        const { norm, name, selfClose } = normalizeTag(raw)
        toks.push({ type: 'element', name, open: norm, selfClose, children: [] })
      }
      i = j + 1
      continue
    }
    // 文字
    let j = i
    while (j < n && xml[j] !== '<') j++
    toks.push({ type: 'text', value: xml.slice(i, j) })
    i = j
  }
  return toks
}

function parse(xml: string): Node[] {
  const toks = tokenize(xml)
  const root: Node[] = []
  const stack: { node: Extract<Node, { type: 'element' }>; siblings: Node[] }[] = []
  let cur = root
  for (const tk of toks) {
    if (tk.type === 'element' && (tk as { close?: boolean }).close) {
      // 關閉標籤
      if (stack.length === 0) throw new Error(`多出來的結束標籤 </${tk.name}>`)
      const top = stack[stack.length - 1]
      if (top.node.name !== tk.name)
        throw new Error(`結束標籤 </${tk.name}> 與開始標籤 <${top.node.name}> 不相符`)
      stack.pop()
      cur = top.siblings
      continue
    }
    if (tk.type === 'element' && !tk.selfClose) {
      cur.push(tk)
      stack.push({ node: tk, siblings: cur })
      cur = tk.children
      continue
    }
    cur.push(tk)
  }
  if (stack.length > 0) throw new Error(`開始標籤 <${stack[stack.length - 1].node.name}> 沒有對應的結束標籤`)
  return root
}

function significant(children: Node[]): Node[] {
  return children.filter((c) => !(c.type === 'text' && c.value.trim() === ''))
}

export function formatXml(xml: string, opts: XmlFormatOptions = {}): XmlFormatResult {
  const unit = Math.max(1, Math.min(8, opts.indent ?? 2))
  let tree: Node[]
  try {
    tree = parse(xml)
  } catch (e) {
    return { ok: false, output: '', error: e instanceof Error ? e.message : String(e) }
  }
  const pad = (lvl: number) => ' '.repeat(unit * lvl)
  const lines: string[] = []
  function render(node: Node, level: number) {
    const p = pad(level)
    if (node.type === 'text') {
      const t = node.value.trim()
      if (t) lines.push(p + t)
      return
    }
    if (node.type === 'comment' || node.type === 'cdata' || node.type === 'pi' || node.type === 'doctype') {
      lines.push(p + node.raw.trim())
      return
    }
    // element
    if (node.selfClose) {
      lines.push(p + node.open)
      return
    }
    const sig = significant(node.children)
    const closeTag = `</${node.name}>`
    if (sig.length === 0) {
      lines.push(p + node.open + closeTag)
      return
    }
    if (sig.length === 1 && sig[0].type === 'text') {
      lines.push(p + node.open + sig[0].value.trim() + closeTag)
      return
    }
    lines.push(p + node.open)
    for (const c of sig) render(c, level + 1)
    lines.push(p + closeTag)
  }
  for (const node of significant(tree)) render(node, 0)
  return { ok: true, output: lines.join('\n') }
}

export function minifyXml(xml: string): XmlFormatResult {
  let tree: Node[]
  try {
    tree = parse(xml)
  } catch (e) {
    return { ok: false, output: '', error: e instanceof Error ? e.message : String(e) }
  }
  let out = ''
  function render(node: Node) {
    if (node.type === 'text') {
      if (node.value.trim()) out += node.value.trim()
      return
    }
    if (node.type === 'comment' || node.type === 'cdata' || node.type === 'pi' || node.type === 'doctype') {
      out += node.raw.trim()
      return
    }
    if (node.selfClose) {
      out += node.open
      return
    }
    out += node.open
    for (const c of significant(node.children)) render(c)
    out += `</${node.name}>`
  }
  for (const node of significant(tree)) render(node)
  return { ok: true, output: out }
}
