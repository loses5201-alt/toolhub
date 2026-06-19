/*
  INI / 設定檔 ↔ JSON 轉換引擎 —— 純函式、無 DOM,可在 Node 測。
  支援:; 與 # 註解、[區段]、key=value(亦接受 key: value)、值前後引號去除、區段前的根層鍵、
  同名後者覆蓋。限一層區段(INI 標準),巢狀過深於 JSON→INI 時報錯。
*/
export type IniValue = string | Record<string, string>
export type IniObject = Record<string, IniValue>

function stripQuotes(s: string): string {
  if (s.length >= 2 && ((s[0] === '"' && s.endsWith('"')) || (s[0] === "'" && s.endsWith("'")))) {
    return s.slice(1, -1)
  }
  return s
}

export interface IniParseResult {
  data: IniObject
  errors: { line: number; message: string }[]
}

export function parseIni(text: string): IniParseResult {
  const data: IniObject = {}
  const errors: { line: number; message: string }[] = []
  let section: string | null = null
  text.split(/\r?\n/).forEach((raw, idx) => {
    const lineNo = idx + 1
    const line = raw.trim()
    if (!line || line.startsWith(';') || line.startsWith('#')) return
    if (line.startsWith('[')) {
      const end = line.indexOf(']')
      if (end < 0) {
        errors.push({ line: lineNo, message: `第 ${lineNo} 行的區段沒有結束的 "]",已略過` })
        return
      }
      section = line.slice(1, end).trim()
      if (!section) {
        errors.push({ line: lineNo, message: `第 ${lineNo} 行的區段名稱是空的,已略過` })
        section = null
        return
      }
      if (!(section in data)) data[section] = {}
      return
    }
    const sep = line.search(/[=:]/)
    if (sep < 0) {
      errors.push({ line: lineNo, message: `第 ${lineNo} 行沒有 "=",已略過:${line.slice(0, 40)}` })
      return
    }
    const key = line.slice(0, sep).trim()
    if (!key) {
      errors.push({ line: lineNo, message: `第 ${lineNo} 行缺少鍵名,已略過` })
      return
    }
    const value = stripQuotes(line.slice(sep + 1).trim())
    if (section === null) {
      data[key] = value
    } else {
      ;(data[section] as Record<string, string>)[key] = value
    }
  })
  return { data, errors }
}

// 值含特殊字元才加引號(分號/井號/前後空白/等號)
function quoteIfNeeded(v: string): string {
  if (v === '' || /^\s|\s$|[;#=]/.test(v)) return `"${v.replace(/"/g, '\\"')}"`
  return v
}

export function stringifyIni(obj: IniObject): { ini: string; error: string } {
  const rootLines: string[] = []
  const sectionBlocks: string[] = []
  for (const [key, val] of Object.entries(obj)) {
    if (val !== null && typeof val === 'object') {
      if (Array.isArray(val)) return { ini: '', error: `「${key}」是陣列,INI 不支援陣列。` }
      const lines = [`[${key}]`]
      for (const [k, v] of Object.entries(val)) {
        if (v !== null && typeof v === 'object') return { ini: '', error: `「${key}.${k}」巢狀過深,INI 只支援一層區段。` }
        lines.push(`${k}=${quoteIfNeeded(v === null ? '' : String(v))}`)
      }
      sectionBlocks.push(lines.join('\n'))
    } else {
      rootLines.push(`${key}=${quoteIfNeeded(val === null ? '' : String(val))}`)
    }
  }
  const parts: string[] = []
  if (rootLines.length) parts.push(rootLines.join('\n'))
  if (sectionBlocks.length) parts.push(sectionBlocks.join('\n\n'))
  return { ini: parts.join('\n\n'), error: '' }
}

export function iniToJson(text: string): { json: string; errors: string[] } {
  const { data, errors } = parseIni(text)
  return { json: JSON.stringify(data, null, 2), errors: errors.map((e) => e.message) }
}

export function jsonToIni(text: string): { ini: string; error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ini: '', error: 'JSON 格式錯誤,請檢查語法。' }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ini: '', error: '需要一個 JSON 物件(鍵值對 / 區段)。' }
  }
  return stringifyIni(parsed as IniObject)
}
