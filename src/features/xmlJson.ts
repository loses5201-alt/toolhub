/*
  XML ↔ JSON 轉換引擎(純函式、無 DOM,可在 Node 直接測)。
  目標:把 SOAP 回應 / RSS / pom.xml / Android layout / 各種 XML 設定檔轉成方便程式處理的
  JSON,或把 JSON 還原成 XML。自行 tokenize + 建樹,不依賴瀏覽器 DOMParser,因此可在 Node 測,
  也代表全程在使用者瀏覽器執行、不上傳(XML 設定常含連線字串/密鑰)。

  慣例(業界常見的 "@屬性 / #text" 表示法):
  - 屬性 → 以 attrPrefix(預設 "@")為前綴的鍵
  - 純文字元素 → 直接是字串值;若同時有屬性/子元素,文字放在 textKey(預設 "#text")
  - 同名重複的子元素 → 收斂成陣列
  - CDATA 視為文字;註解 / 處理指令 / DOCTYPE 在轉 JSON 時略過
  限制:這是資料轉換器,不做 schema 驗證;命名空間前綴(ns:tag)原樣保留為鍵名。
*/

export interface XmlJsonOptions {
  attrPrefix?: string
  textKey?: string
  indent?: number
  parseValues?: boolean // 轉 JSON 時把 "123" / "true" 等字面值轉成數字 / 布林
  rootName?: string // 轉 XML 時,JSON 有多個頂層鍵才用得到
}
export interface ConvertResult {
  ok: boolean
  output: string
  error?: string
}

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[]
interface JsonObject {
  [k: string]: JsonValue
}

interface Element {
  name: string
  attrs: Record<string, string>
  children: Element[]
  text: string // 累積的文字內容(已去除元素間純空白)
}

// ---- XML → JSON ----

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&') // 最後處理,避免 &amp;lt; 被二次解碼
}

function parseAttrs(inner: string): { name: string; attrs: Record<string, string> } {
  const m = /^([^\s/>]+)/.exec(inner)
  const name = m ? m[1] : ''
  const attrs: Record<string, string> = {}
  const re = /([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')/g
  let mm: RegExpExecArray | null
  while ((mm = re.exec(inner))) {
    attrs[mm[1]] = decodeEntities(mm[3] !== undefined ? mm[3] : mm[4])
  }
  return { name, attrs }
}

function parseXmlTree(xml: string): Element {
  const root: Element = { name: '#root', attrs: {}, children: [], text: '' }
  const stack: Element[] = [root]
  let i = 0
  const n = xml.length
  while (i < n) {
    if (xml[i] === '<') {
      if (xml.startsWith('<!--', i)) {
        const e = xml.indexOf('-->', i + 4)
        if (e < 0) throw new Error('註解 <!-- 沒有對應的 --> 結尾')
        i = e + 3
        continue
      }
      if (xml.startsWith('<![CDATA[', i)) {
        const e = xml.indexOf(']]>', i + 9)
        if (e < 0) throw new Error('CDATA 沒有對應的 ]]> 結尾')
        stack[stack.length - 1].text += xml.slice(i + 9, e)
        i = e + 3
        continue
      }
      if (xml.startsWith('<?', i)) {
        const e = xml.indexOf('?>', i + 2)
        if (e < 0) throw new Error('處理指令 <? 沒有對應的 ?> 結尾')
        i = e + 2
        continue
      }
      if (xml.startsWith('<!', i)) {
        const e = xml.indexOf('>', i + 2)
        if (e < 0) throw new Error('<! 宣告沒有對應的 > 結尾')
        i = e + 1
        continue
      }
      // 一般標籤:找對應 >,略過引號內的 >
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
      i = j + 1
      if (raw[1] === '/') {
        const cname = raw.slice(2, -1).trim()
        const top = stack[stack.length - 1]
        if (stack.length === 1) throw new Error(`多出來的結束標籤 </${cname}>`)
        if (top.name !== cname)
          throw new Error(`結束標籤 </${cname}> 與開始標籤 <${top.name}> 不相符`)
        stack.pop()
        continue
      }
      const selfClose = raw.endsWith('/>')
      const inner = raw.slice(1, selfClose ? -2 : -1)
      const { name, attrs } = parseAttrs(inner)
      const el: Element = { name, attrs, children: [], text: '' }
      stack[stack.length - 1].children.push(el)
      if (!selfClose) stack.push(el)
      continue
    }
    // 文字(CDATA 已在上面原樣處理,這裡解碼實體)
    let j = i
    while (j < n && xml[j] !== '<') j++
    stack[stack.length - 1].text += decodeEntities(xml.slice(i, j))
    i = j
  }
  if (stack.length > 1)
    throw new Error(`開始標籤 <${stack[stack.length - 1].name}> 沒有對應的結束標籤`)
  return root
}

function coerce(s: string, on: boolean): JsonValue {
  if (!on) return s
  const t = s.trim()
  if (t === '') return s
  if (t === 'true') return true
  if (t === 'false') return false
  if (t === 'null') return null
  // 嚴格數字:避免電話 / 前導零 / 超長 ID 被破壞
  if (/^-?(0|[1-9]\d*)(\.\d+)?$/.test(t)) {
    const num = Number(t)
    if (Number.isFinite(num) && String(num) === t) return num
  }
  return s
}

function elementToValue(el: Element, opt: Required<Pick<XmlJsonOptions, 'attrPrefix' | 'textKey' | 'parseValues'>>): JsonValue {
  const text = el.text.replace(/\s+/g, ' ').trim()
  const attrKeys = Object.keys(el.attrs)
  if (attrKeys.length === 0 && el.children.length === 0) {
    return coerce(text, opt.parseValues)
  }
  const obj: JsonObject = {}
  for (const k of attrKeys) obj[opt.attrPrefix + k] = coerce(el.attrs[k], opt.parseValues)
  // 子元素依出現順序分組;同名 → 陣列
  for (const child of el.children) {
    const v = elementToValue(child, opt)
    if (child.name in obj) {
      const cur = obj[child.name]
      if (Array.isArray(cur)) cur.push(v)
      else obj[child.name] = [cur, v]
    } else {
      obj[child.name] = v
    }
  }
  if (text) obj[opt.textKey] = coerce(text, opt.parseValues)
  return obj
}

export function xmlToJson(xml: string, options: XmlJsonOptions = {}): ConvertResult {
  const opt = {
    attrPrefix: options.attrPrefix ?? '@',
    textKey: options.textKey ?? '#text',
    parseValues: options.parseValues ?? false,
    indent: options.indent ?? 2,
  }
  let root: Element
  try {
    root = parseXmlTree(xml)
  } catch (e) {
    return { ok: false, output: '', error: e instanceof Error ? e.message : String(e) }
  }
  if (root.children.length === 0) return { ok: false, output: '', error: '找不到任何 XML 元素' }
  const out: JsonObject = {}
  for (const child of root.children) {
    const v = elementToValue(child, opt)
    if (child.name in out) {
      const cur = out[child.name]
      if (Array.isArray(cur)) cur.push(v)
      else out[child.name] = [cur, v]
    } else out[child.name] = v
  }
  return { ok: true, output: JSON.stringify(out, null, opt.indent) }
}

// ---- JSON → XML ----

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, '&quot;')
}
function primitive(v: JsonValue): string {
  if (v === null) return ''
  return String(v)
}
function isPlainObject(v: JsonValue): v is JsonObject {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function jsonToXml(json: string, options: XmlJsonOptions = {}): ConvertResult {
  const opt = {
    attrPrefix: options.attrPrefix ?? '@',
    textKey: options.textKey ?? '#text',
    indent: options.indent ?? 2,
    rootName: options.rootName ?? 'root',
  }
  let data: JsonValue
  try {
    data = JSON.parse(json)
  } catch (e) {
    return { ok: false, output: '', error: 'JSON 格式錯誤:' + (e instanceof Error ? e.message : String(e)) }
  }
  if (!isPlainObject(data))
    return { ok: false, output: '', error: '最外層必須是 JSON 物件(例如 { "note": { ... } })' }
  const pad = (lvl: number) => ' '.repeat(opt.indent * lvl)
  const lines: string[] = []

  function renderElement(name: string, value: JsonValue, level: number) {
    if (Array.isArray(value)) {
      for (const item of value) renderElement(name, item, level)
      return
    }
    const p = pad(level)
    if (!isPlainObject(value)) {
      const text = primitive(value)
      if (text === '') lines.push(`${p}<${name}/>`)
      else lines.push(`${p}<${name}>${escapeText(text)}</${name}>`)
      return
    }
    // 物件:拆出屬性、文字、子元素
    const attrs: string[] = []
    let text: string | null = null
    const childKeys: string[] = []
    for (const k of Object.keys(value)) {
      if (k.startsWith(opt.attrPrefix)) attrs.push(`${k.slice(opt.attrPrefix.length)}="${escapeAttr(primitive(value[k]))}"`)
      else if (k === opt.textKey) text = primitive(value[k])
      else childKeys.push(k)
    }
    const attrStr = attrs.length ? ' ' + attrs.join(' ') : ''
    if (childKeys.length === 0) {
      if (text === null || text === '') lines.push(`${p}<${name}${attrStr}/>`)
      else lines.push(`${p}<${name}${attrStr}>${escapeText(text)}</${name}>`)
      return
    }
    lines.push(`${p}<${name}${attrStr}>`)
    if (text) lines.push(pad(level + 1) + escapeText(text))
    for (const ck of childKeys) renderElement(ck, value[ck], level + 1)
    lines.push(`${p}</${name}>`)
  }

  const keys = Object.keys(data)
  if (keys.length === 1) {
    renderElement(keys[0], data[keys[0]], 0)
  } else {
    // 多個頂層鍵 → 包進單一根元素(XML 只能有一個根)
    lines.push(`<${opt.rootName}>`)
    for (const k of keys) renderElement(k, data[k], 1)
    lines.push(`</${opt.rootName}>`)
  }
  return { ok: true, output: lines.join('\n') }
}
