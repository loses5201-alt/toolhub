/*
  HTML 轉 Markdown 核心 —— 純函式、無 DOM(自寫 tokenizer + 樹狀解析,Node 可測)。
  把從網頁、HTML 電子報、Notion/Google Docs 複製來的內容,轉成保留「結構」的
  Markdown(標題、清單、連結、粗體、表格、引言、程式碼),貼進 README / Issue /
  筆記。與 html-to-text(只留純文字)、markdown-preview(反向 MD→HTML)互補。
  盡力而為:極複雜的版面不保證完美,但一般內文夠用。全程瀏覽器、不連網、不上傳。
*/
import { decodeEntities } from './htmlToText'

const VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
])
const RAW = new Set(['script', 'style', 'noscript', 'template'])
const INLINE = new Set([
  'a', 'b', 'strong', 'i', 'em', 'code', 'span', 'del', 's', 'strike', 'mark', 'u',
  'sub', 'sup', 'small', 'br', 'img', 'q', 'abbr', 'cite', 'time', 'kbd', 'var', 'samp', 'font',
])

type TextNode = { type: 'text'; value: string }
type ElNode = { type: 'element'; tag: string; attrs: Record<string, string>; children: Node[] }
type Node = TextNode | ElNode

type Token =
  | { t: 'text'; v: string }
  | { t: 'open'; tag: string; attrs: string; selfClose: boolean }
  | { t: 'close'; tag: string }

/** 把 HTML 切成 token 串(移除註解、doctype,並丟棄 script/style 等原始內容)。 */
export function tokenize(html: string): Token[] {
  let s = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<!doctype[^>]*>/gi, '')
  const tokens: Token[] = []
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^<>"']|"[^"]*"|'[^']*')*?)(\/?)>/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    if (m.index > last) tokens.push({ t: 'text', v: s.slice(last, m.index) })
    const closing = m[1] === '/'
    const tag = m[2].toLowerCase()
    last = re.lastIndex
    if (closing) {
      tokens.push({ t: 'close', tag })
    } else {
      const selfClose = m[4] === '/' || VOID.has(tag)
      if (RAW.has(tag) && !selfClose) {
        // 整塊跳過原始內容(直到對應結束標籤)
        const close = new RegExp(`</${tag}\\s*>`, 'i')
        const cm = close.exec(s.slice(last))
        last = cm ? last + cm.index + cm[0].length : s.length
        re.lastIndex = last
      } else {
        tokens.push({ t: 'open', tag, attrs: m[3], selfClose })
      }
    }
  }
  if (last < s.length) tokens.push({ t: 'text', v: s.slice(last) })
  return tokens
}

function parseAttrs(s: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    attrs[m[1].toLowerCase()] = decodeEntities(m[3] ?? m[4] ?? m[5] ?? '')
  }
  return attrs
}

/** 由 token 串建出寬容的節點樹(遇到未閉合的內嵌標籤也能自動收斂)。 */
export function buildTree(tokens: Token[]): ElNode {
  const root: ElNode = { type: 'element', tag: '#root', attrs: {}, children: [] }
  const stack: ElNode[] = [root]
  for (const tk of tokens) {
    const top = stack[stack.length - 1]
    if (tk.t === 'text') {
      top.children.push({ type: 'text', value: tk.v })
    } else if (tk.t === 'open') {
      const node: ElNode = { type: 'element', tag: tk.tag, attrs: parseAttrs(tk.attrs), children: [] }
      top.children.push(node)
      if (!tk.selfClose) stack.push(node)
    } else {
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tk.tag) {
          stack.length = i
          break
        }
      }
    }
  }
  return root
}

const collapse = (s: string) => s.replace(/\s+/g, ' ')
const escapeInline = (s: string) => s.replace(/([\\`*[\]])/g, '\\$1')

/** 取節點底下的純文字(用於行內 code 與 pre 程式碼區塊)。 */
function textContent(nodes: Node[]): string {
  let out = ''
  for (const n of nodes) {
    if (n.type === 'text') out += decodeEntities(n.value)
    else if (n.tag === 'br') out += '\n'
    else out += textContent(n.children)
  }
  return out
}

function wrap(inner: string, marker: string): string {
  if (!inner.trim()) return inner
  const lead = inner.match(/^\s*/)![0]
  const trail = inner.match(/\s*$/)![0]
  return lead + marker + inner.trim() + marker + trail
}

function renderInline(nodes: Node[]): string {
  let out = ''
  for (const n of nodes) {
    if (n.type === 'text') {
      out += escapeInline(collapse(decodeEntities(n.value)))
      continue
    }
    const inner = () => renderInline(n.children)
    switch (n.tag) {
      case 'b':
      case 'strong':
        out += wrap(inner(), '**')
        break
      case 'i':
      case 'em':
      case 'cite':
      case 'var':
        out += wrap(inner(), '*')
        break
      case 'del':
      case 's':
      case 'strike':
        out += wrap(inner(), '~~')
        break
      case 'code':
      case 'kbd':
      case 'samp': {
        const t = textContent(n.children).replace(/\s+/g, ' ').trim()
        out += t ? '`' + t + '`' : ''
        break
      }
      case 'a': {
        const txt = inner().trim() || n.attrs.href || ''
        const href = n.attrs.href
        out += href ? `[${txt}](${href})` : txt
        break
      }
      case 'img': {
        const alt = n.attrs.alt ?? ''
        const src = n.attrs.src
        out += src ? `![${alt}](${src})` : alt
        break
      }
      case 'br':
        out += '  \n'
        break
      default:
        out += inner()
    }
  }
  return out
}

function renderContainer(children: Node[]): string {
  const blocks: string[] = []
  let buf: Node[] = []
  const flush = () => {
    if (buf.length) {
      const s = renderInline(buf).replace(/[ \t]+$/gm, (x) => (x === '  ' ? x : '')).trim()
      if (s) blocks.push(s)
      buf = []
    }
  }
  for (const n of children) {
    if (n.type === 'text') {
      if (n.value.trim() === '') {
        if (buf.length) buf.push(n)
      } else buf.push(n)
    } else if (INLINE.has(n.tag)) {
      buf.push(n)
    } else {
      flush()
      const b = renderBlock(n)
      if (b) blocks.push(b)
    }
  }
  flush()
  return blocks.join('\n\n')
}

function renderList(node: ElNode, ordered: boolean): string {
  const items = node.children.filter(
    (c): c is ElNode => c.type === 'element' && c.tag === 'li',
  )
  let idx = parseInt(node.attrs.start ?? '1', 10)
  if (!Number.isFinite(idx)) idx = 1
  const lines: string[] = []
  for (const li of items) {
    const marker = ordered ? `${idx++}. ` : '- '
    const pad = ' '.repeat(marker.length)
    const inner = renderContainer(li.children) || ''
    const arr = inner.split('\n')
    lines.push(marker + (arr[0] ?? ''))
    // 續行縮排對齊;略過空行讓清單保持緊湊(tight list)
    for (const l of arr.slice(1)) if (l) lines.push(pad + l)
  }
  return lines.join('\n')
}

function renderTable(node: ElNode): string {
  const rows: ElNode[] = []
  const walk = (nodes: Node[]) => {
    for (const n of nodes) {
      if (n.type !== 'element') continue
      if (n.tag === 'tr') rows.push(n)
      else walk(n.children)
    }
  }
  walk(node.children)
  if (!rows.length) return ''
  const cellsOf = (tr: ElNode) =>
    tr.children
      .filter((c): c is ElNode => c.type === 'element' && (c.tag === 'td' || c.tag === 'th'))
      .map((c) => renderInline(c.children).replace(/\n/g, ' ').replace(/\|/g, '\\|').trim())
  const grid = rows.map(cellsOf)
  const cols = Math.max(...grid.map((r) => r.length))
  const pad = (r: string[]) => {
    const a = r.slice()
    while (a.length < cols) a.push('')
    return a
  }
  const header = pad(grid[0])
  const body = grid.slice(1).map(pad)
  const out = [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`]
  for (const r of body) out.push(`| ${r.join(' | ')} |`)
  return out.join('\n')
}

function renderBlock(node: ElNode): string {
  const tag = node.tag
  const h = /^h([1-6])$/.exec(tag)
  if (h) return '#'.repeat(Number(h[1])) + ' ' + renderInline(node.children).trim()
  switch (tag) {
    case 'hr':
      return '---'
    case 'table':
      return renderTable(node)
    case 'ul':
      return renderList(node, false)
    case 'ol':
      return renderList(node, true)
    case 'blockquote': {
      const inner = renderContainer(node.children)
      return inner
        .split('\n')
        .map((l) => (l ? '> ' + l : '>'))
        .join('\n')
    }
    case 'pre': {
      const codeChild = node.children.find(
        (c): c is ElNode => c.type === 'element' && c.tag === 'code',
      )
      const lang = codeChild
        ? (/(?:language|lang)-([\w+-]+)/.exec(codeChild.attrs.class ?? '')?.[1] ?? '')
        : ''
      const code = textContent(node.children).replace(/^\n/, '').replace(/\s+$/, '')
      return '```' + lang + '\n' + code + '\n```'
    }
    default:
      return renderContainer(node.children)
  }
}

/** 把 HTML 轉成保留結構的 Markdown。 */
export function htmlToMarkdown(html: string): string {
  const root = buildTree(tokenize(html))
  const md = renderContainer(root.children)
  return md.replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '')
}
