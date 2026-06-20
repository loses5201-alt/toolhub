// curl 指令解析 / 轉換 —— 把一行 curl 拆成 method / url / headers / body / 認證,
// 再產生 JavaScript fetch 與 Python requests 程式碼。純函式、無 DOM,可在 Node 測試。

export interface CurlRequest {
  method: string
  url: string
  headers: [string, string][]
  body: string | null
  bodyType: 'raw' | 'urlencoded' | 'form' | null
  forms: [string, string][]
  auth: { user: string; pass: string } | null
  warnings: string[]
}

// 依 shell 規則切詞:單引號內原樣、雙引號內 \ 跳脫、引號可黏在 token 內、\ 換行為續行
export function tokenize(input: string): string[] {
  const s = input.replace(/\\\r?\n/g, ' ')
  const tokens: string[] = []
  let i = 0
  const n = s.length
  while (i < n) {
    while (i < n && /\s/.test(s[i])) i++
    if (i >= n) break
    let tok = ''
    let inToken = false
    while (i < n && (!/\s/.test(s[i]) || false)) {
      const c = s[i]
      if (/\s/.test(c)) break
      inToken = true
      if (c === "'") {
        i++
        while (i < n && s[i] !== "'") tok += s[i++]
        i++ // 收掉結尾 '
      } else if (c === '"') {
        i++
        while (i < n && s[i] !== '"') {
          if (s[i] === '\\' && i + 1 < n) {
            i++
            tok += s[i++]
          } else tok += s[i++]
        }
        i++ // 收掉結尾 "
      } else if (c === '\\' && i + 1 < n) {
        i++
        tok += s[i++]
      } else {
        tok += c
        i++
      }
    }
    if (inToken) tokens.push(tok)
  }
  return tokens
}

const DATA_FLAGS = ['--data', '--data-raw', '--data-binary', '--data-ascii', '--data-urlencode']

export function parseCurl(cmd: string): CurlRequest {
  const req: CurlRequest = {
    method: '',
    url: '',
    headers: [],
    body: null,
    bodyType: null,
    forms: [],
    auth: null,
    warnings: [],
  }
  let tokens = tokenize(cmd.trim())
  if (tokens.length && tokens[0] === 'curl') tokens = tokens.slice(1)
  else if (tokens.length && /(^|\/)curl$/.test(tokens[0])) tokens = tokens.slice(1)

  let explicitMethod = ''
  let asGet = false
  const dataParts: string[] = []

  // 把長旗標的 --flag=value 拆開
  const expand = (t: string): [string, string | null] => {
    if (t.startsWith('--') && t.includes('=')) {
      const idx = t.indexOf('=')
      return [t.slice(0, idx), t.slice(idx + 1)]
    }
    return [t, null]
  }

  for (let i = 0; i < tokens.length; i++) {
    let t = tokens[i]
    let inlineVal: string | null = null
    ;[t, inlineVal] = expand(t)
    const next = (): string => {
      if (inlineVal !== null) {
        const v = inlineVal
        inlineVal = null
        return v
      }
      return tokens[++i] ?? ''
    }

    // 黏在一起的短旗標,如 -XPOST、-H'K: V'、-d{...}
    if (/^-[XHduAeFb]./.test(t) && !t.startsWith('--')) {
      inlineVal = t.slice(2)
      t = t.slice(0, 2)
    }

    if (t === '-X' || t === '--request') {
      explicitMethod = next().toUpperCase()
    } else if (t === '-H' || t === '--header') {
      const h = next()
      const ci = h.indexOf(':')
      if (ci >= 0) req.headers.push([h.slice(0, ci).trim(), h.slice(ci + 1).trim()])
    } else if (t === '-d' || DATA_FLAGS.includes(t)) {
      dataParts.push(next())
      if (req.bodyType !== 'raw') req.bodyType = 'urlencoded'
    } else if (t === '-F' || t === '--form') {
      const f = next()
      const ei = f.indexOf('=')
      req.forms.push(ei >= 0 ? [f.slice(0, ei), f.slice(ei + 1)] : [f, ''])
      req.bodyType = 'form'
    } else if (t === '-u' || t === '--user') {
      const u = next()
      const ci = u.indexOf(':')
      req.auth = ci >= 0 ? { user: u.slice(0, ci), pass: u.slice(ci + 1) } : { user: u, pass: '' }
    } else if (t === '-A' || t === '--user-agent') {
      req.headers.push(['User-Agent', next()])
    } else if (t === '-e' || t === '--referer') {
      req.headers.push(['Referer', next()])
    } else if (t === '-b' || t === '--cookie') {
      req.headers.push(['Cookie', next()])
    } else if (t === '-G' || t === '--get') {
      asGet = true
    } else if (t === '--url') {
      req.url = next()
    } else if (t === '--compressed' || t === '-L' || t === '--location' || t === '-k' || t === '--insecure' || t === '-s' || t === '--silent' || t === '-i' || t === '--include' || t === '-v' || t === '--verbose') {
      // 與請求內容無關,忽略
    } else if (t.startsWith('-') && t !== '-') {
      req.warnings.push(`未支援的選項 ${t},已略過`)
      if (inlineVal === null && tokens[i + 1] && !tokens[i + 1].startsWith('-')) {
        // 保守起見不吞掉下一個 token(多數未知旗標是布林)
      }
    } else if (!t.startsWith('-')) {
      if (!req.url) req.url = t
    }
  }

  // content-type 若已指定 → body 視為 raw
  const hasContentType = req.headers.some(([k]) => k.toLowerCase() === 'content-type')
  if (dataParts.length && hasContentType) req.bodyType = 'raw'

  const data = dataParts.join('&')

  if (asGet && data) {
    req.url += (req.url.includes('?') ? '&' : '?') + data
  } else if (dataParts.length) {
    req.body = data
  }

  // 決定 method
  if (explicitMethod) req.method = explicitMethod
  else if (req.forms.length || (req.body !== null && !asGet)) req.method = 'POST'
  else req.method = 'GET'

  if (!req.url) req.warnings.push('找不到網址')
  return req
}

function jsStr(s: string): string {
  return "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'"
}

export function toFetch(req: CurlRequest): string {
  const opts: string[] = [`method: ${jsStr(req.method)}`]
  const headers = req.headers.slice()
  if (req.auth) headers.push(['Authorization', `__BASIC__`])
  if (headers.length) {
    const lines = headers.map(([k, v]) =>
      v === '__BASIC__'
        ? `    ${jsStr(k)}: 'Basic ' + btoa(${jsStr(req.auth!.user + ':' + req.auth!.pass)})`
        : `    ${jsStr(k)}: ${jsStr(v)}`,
    )
    opts.push('headers: {\n' + lines.join(',\n') + '\n  }')
  }
  if (req.forms.length) {
    const fd = req.forms.map(([k, v]) => `formData.append(${jsStr(k)}, ${jsStr(v)})`).join('\n')
    return (
      `const formData = new FormData()\n${fd}\n\n` +
      `fetch(${jsStr(req.url)}, {\n  ${opts.join(',\n  ')},\n  body: formData\n})`
    )
  }
  if (req.body !== null) opts.push(`body: ${jsStr(req.body)}`)
  return `fetch(${jsStr(req.url)}, {\n  ${opts.join(',\n  ')}\n})`
}

function pyStr(s: string): string {
  return "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'"
}

export function toPython(req: CurlRequest): string {
  const lines = ['import requests', '']
  const args: string[] = [pyStr(req.url)]
  if (req.headers.length) {
    const h = req.headers.map(([k, v]) => `    ${pyStr(k)}: ${pyStr(v)}`).join(',\n')
    lines.push('headers = {\n' + h + '\n}')
    args.push('headers=headers')
  }
  if (req.auth) args.push(`auth=(${pyStr(req.auth.user)}, ${pyStr(req.auth.pass)})`)
  if (req.forms.length) {
    const f = req.forms.map(([k, v]) => `    ${pyStr(k)}: ${pyStr(v)}`).join(',\n')
    lines.push('files = {\n' + f + '\n}')
    args.push('files=files')
  } else if (req.body !== null) {
    lines.push(`data = ${pyStr(req.body)}`)
    args.push('data=data')
  }
  lines.push('')
  lines.push(`response = requests.${req.method.toLowerCase()}(${args.join(', ')})`)
  return lines.join('\n')
}
