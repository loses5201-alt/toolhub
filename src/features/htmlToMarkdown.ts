/*
  HTML 轉 Markdown 引擎 —— 純函式、無 DOM(自帶輕量 HTML 解析器),可在 Node 直接測試。
  把從網頁、Notion、Google 文件、HTML Email 複製來的內容,轉成乾淨的 Markdown
  (標題、粗體/斜體、連結、圖片、清單、引言、程式碼、表格、刪除線、分隔線)。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

const VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
])
const BLOCK = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'blockquote', 'pre', 'hr', 'div',
  'table', 'thead', 'tbody', 'tr', 'section', 'article', 'header', 'footer', 'figure',
])

interface Attrs {
  [k: string]: string
}
interface Node {
  tag: string // '' = 文字節點
  text?: string
  attrs?: Attrs
  children: Node[]
}

// ── HTML 實體解碼 ─────────────────────────────────────────
const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', reg: '®',
  trade: '™', hellip: '…', mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“',
  rdquo: '”', middot: '·', bull: '•', deg: '°', times: '×', divide: '÷',
}
export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      return Number.isFinite(code) ? safeFromCodePoint(code) : m
    }
    if (body === 'nbsp') return '\x20' // 一律轉成一般空白,Markdown 較乾淨
    return Object.prototype.hasOwnProperty.call(NAMED, body) ? NAMED[body] : m
  })
}
function safeFromCodePoint(cp: number): string {
  try {
    return String.fromCodePoint(cp)
  } catch {
    return ''
  }
}

// ── 解析屬性 ───────────────────────────────────────────────
function parseAttrs(s: string): Attrs {
  const attrs: Attrs = {}
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    const name = m[1].toLowerCase()
    const val = m[2] ?? m[3] ?? m[4] ?? ''
    attrs[name] = decodeEntities(val)
  }
  return attrs
}

// ── 解析成節點樹 ───────────────────────────────────────────
function parse(html: string): Node {
  const root: Node = { tag: '', children: [] }
  const stack: Node[] = [root]
  let i = 0
  const push = (n: Node) => stack[stack.length - 1].children.push(n)

  while (i < html.length) {
    if (html[i] === '<') {
      if (html.startsWith('<!--', i)) {
        const end = html.indexOf('-->', i)
        i = end < 0 ? html.length : end + 3
        continue
      }
      if (html[i + 1] === '!' || html[i + 1] === '?') {
        const end = html.indexOf('>', i)
        i = end < 0 ? html.length : end + 1
        continue
      }
      const end = html.indexOf('>', i)
      if (end < 0) {
        push({ tag: '', text: html.slice(i), children: [] })
        break
      }
      let raw = html.slice(i + 1, end)
      i = end + 1
      let close = false
      if (raw[0] === '/') {
        close = true
        raw = raw.slice(1)
      }
      let selfClose = false
      if (raw.endsWith('/')) {
        selfClose = true
        raw = raw.slice(0, -1)
      }
      const nameMatch = raw.match(/^([a-zA-Z][a-zA-Z0-9]*)/)
      if (!nameMatch) continue
      const tag = nameMatch[1].toLowerCase()

      // script / style:整段內容跳過
      if (!close && (tag === 'script' || tag === 'style')) {
        const closeRe = new RegExp(`</${tag}\\s*>`, 'i')
        const rest = html.slice(i)
        const cm = rest.match(closeRe)
        i += cm ? (cm.index ?? rest.length) + cm[0].length : rest.length
        continue
      }

      if (close) {
        // 往上彈到相符的開啟標籤(容忍未閉合)
        for (let s = stack.length - 1; s >= 1; s--) {
          if (stack[s].tag === tag) {
            stack.length = s
            break
          }
        }
      } else if (selfClose || VOID.has(tag)) {
        push({ tag, attrs: parseAttrs(raw.slice(nameMatch[1].length)), children: [] })
      } else {
        const node: Node = { tag, attrs: parseAttrs(raw.slice(nameMatch[1].length)), children: [] }
        push(node)
        stack.push(node)
      }
    } else {
      const next = html.indexOf('<', i)
      const text = html.slice(i, next < 0 ? html.length : next)
      push({ tag: '', text, children: [] })
      i = next < 0 ? html.length : next
    }
  }
  return root
}

// ── 序列化成 Markdown ──────────────────────────────────────
function collapseWs(s: string): string {
  return s.replace(/\s+/g, ' ')
}

// 取得節點底下的純文字(用於 pre / code / 表格儲存格的原始內容)
function rawText(node: Node): string {
  if (node.tag === '') return decodeEntities(node.text ?? '')
  if (node.tag === 'br') return '\n'
  return node.children.map(rawText).join('')
}

function renderInline(nodes: Node[]): string {
  let out = ''
  for (const n of nodes) {
    if (n.tag === '') {
      out += collapseWs(decodeEntities(n.text ?? ''))
      continue
    }
    switch (n.tag) {
      case 'strong':
      case 'b': {
        const inner = renderInline(n.children).trim()
        out += inner ? `**${inner}**` : ''
        break
      }
      case 'em':
      case 'i': {
        const inner = renderInline(n.children).trim()
        out += inner ? `*${inner}*` : ''
        break
      }
      case 'del':
      case 's':
      case 'strike': {
        const inner = renderInline(n.children).trim()
        out += inner ? `~~${inner}~~` : ''
        break
      }
      case 'code': {
        const inner = rawText(n).trim()
        out += inner ? `\`${inner}\`` : ''
        break
      }
      case 'a': {
        const inner = renderInline(n.children).trim() || n.attrs?.href || ''
        const href = n.attrs?.href ?? ''
        out += href ? `[${inner}](${href})` : inner
        break
      }
      case 'img': {
        const alt = n.attrs?.alt ?? ''
        const src = n.attrs?.src ?? ''
        if (src) out += `![${alt}](${src})`
        break
      }
      case 'br':
        out += '  \n'
        break
      default:
        out += renderInline(n.children) // span / mark / sub / sup / u / small / font 等直接穿透
    }
  }
  return out
}

function renderBlocks(nodes: Node[], listDepth = 0): string {
  const blocks: string[] = []
  let inlineBuf = ''
  const flush = () => {
    const t = inlineBuf.trim() // 不動內部的「  \n」硬換行
    if (t) blocks.push(t)
    inlineBuf = ''
  }
  for (const n of nodes) {
    if (n.tag !== '' && BLOCK.has(n.tag)) {
      flush()
      const b = renderBlock(n, listDepth)
      if (b) blocks.push(b)
    } else {
      inlineBuf += renderInline([n])
    }
  }
  flush()
  return blocks.join('\n\n')
}

function renderBlock(n: Node, listDepth: number): string {
  switch (n.tag) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return '#'.repeat(Number(n.tag[1])) + ' ' + renderInline(n.children).trim()
    case 'hr':
      return '---'
    case 'pre': {
      const code = rawText(n).replace(/\n$/, '')
      return '```\n' + code + '\n```'
    }
    case 'blockquote':
      return renderBlocks(n.children, listDepth)
        .split('\n')
        .map((l) => (l ? '> ' + l : '>'))
        .join('\n')
    case 'ul':
    case 'ol': {
      const items = n.children.filter((c) => c.tag === 'li')
      const lines: string[] = []
      items.forEach((li, idx) => {
        const marker = n.tag === 'ol' ? `${idx + 1}.` : '-'
        const content = renderBlocks(li.children, listDepth + 1)
        const sub = content.split('\n')
        const indent = '  '.repeat(listDepth)
        sub.forEach((line, li2) => {
          if (li2 === 0) lines.push(`${indent}${marker} ${line}`)
          else lines.push(line ? `${indent}  ${line}` : '')
        })
      })
      return lines.join('\n')
    }
    case 'table':
      return renderTable(n)
    case 'div':
    case 'section':
    case 'article':
    case 'header':
    case 'footer':
    case 'figure':
    case 'thead':
    case 'tbody':
      return renderBlocks(n.children, listDepth)
    case 'p':
    default:
      return renderInline(n.children).trim()
  }
}

function renderTable(table: Node): string {
  const rows: Node[] = []
  const collect = (node: Node) => {
    for (const c of node.children) {
      if (c.tag === 'tr') rows.push(c)
      else if (c.tag === 'thead' || c.tag === 'tbody') collect(c)
    }
  }
  collect(table)
  if (!rows.length) return ''
  const cellText = (cell: Node) => renderInline(cell.children).trim().replace(/\|/g, '\\|').replace(/\n/g, ' ')
  const matrix = rows.map((r) => r.children.filter((c) => c.tag === 'td' || c.tag === 'th').map(cellText))
  const cols = Math.max(...matrix.map((r) => r.length))
  const pad = (r: string[]) => {
    const c = r.slice()
    while (c.length < cols) c.push('')
    return c
  }
  const header = pad(matrix[0])
  const out = ['| ' + header.join(' | ') + ' |', '| ' + header.map(() => '---').join(' | ') + ' |']
  for (let i = 1; i < matrix.length; i++) out.push('| ' + pad(matrix[i]).join(' | ') + ' |')
  return out.join('\n')
}

/** 把 HTML 轉成 Markdown。 */
export function htmlToMarkdown(html: string): string {
  const tree = parse(html)
  const md = renderBlocks(tree.children)
  // 收斂超過兩個的空行
  return md.replace(/\n{3,}/g, '\n\n').trim()
}
