/*
  GraphQL 詞法分析(tokenizer)—— 純函式、無 DOM。
  忽略空白、逗號與註解(# ...);處理字串、區塊字串、數字、名稱與標點。
*/

export interface Tok {
  kind: 'name' | 'int' | 'float' | 'string' | 'punct' | 'eof'
  value: string
}

const PUNCT = ['...', '!', '$', '&', '(', ')', ':', '=', '@', '[', ']', '{', '|', '}']

function isNameStart(c: string) {
  return /[A-Za-z_]/.test(c)
}
function isNameCont(c: string) {
  return /[A-Za-z0-9_]/.test(c)
}

/** 依 GraphQL 規格還原區塊字串(去共同縮排、去頭尾空白行)。 */
export function blockStringValue(raw: string): string {
  const lines = raw.split('\n')
  let common = Infinity
  for (let i = 1; i < lines.length; i++) {
    const indent = lines[i].length - lines[i].replace(/^[ \t]+/, '').length
    if (lines[i].trim()) common = Math.min(common, indent)
  }
  if (common !== Infinity) for (let i = 1; i < lines.length; i++) lines[i] = lines[i].slice(common)
  while (lines.length && lines[0].trim() === '') lines.shift()
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop()
  return lines.join('\n')
}

export function lex(src: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    if (c === '﻿' || c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === ',') {
      i++
      continue
    }
    if (c === '#') {
      while (i < n && src[i] !== '\n') i++
      continue
    }
    if (c === '"') {
      if (src.startsWith('"""', i)) {
        const end = src.indexOf('"""', i + 3)
        if (end < 0) throw new Error('區塊字串未結束(缺少 """)')
        toks.push({ kind: 'string', value: blockStringValue(src.slice(i + 3, end)) })
        i = end + 3
        continue
      }
      let j = i + 1
      let out = ''
      while (j < n && src[j] !== '"') {
        if (src[j] === '\n') throw new Error('字串未結束')
        if (src[j] === '\\') {
          const e = src[j + 1]
          const map: Record<string, string> = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', '"': '"', '\\': '\\', '/': '/' }
          if (e === 'u') {
            out += String.fromCharCode(parseInt(src.slice(j + 2, j + 6), 16))
            j += 6
            continue
          }
          out += map[e] ?? e
          j += 2
          continue
        }
        out += src[j]
        j++
      }
      if (j >= n) throw new Error('字串未結束')
      toks.push({ kind: 'string', value: out })
      i = j + 1
      continue
    }
    if (c === '-' || /[0-9]/.test(c)) {
      let j = i
      if (src[j] === '-') j++
      while (j < n && /[0-9]/.test(src[j])) j++
      let isFloat = false
      if (src[j] === '.') {
        isFloat = true
        j++
        while (j < n && /[0-9]/.test(src[j])) j++
      }
      if (src[j] === 'e' || src[j] === 'E') {
        isFloat = true
        j++
        if (src[j] === '+' || src[j] === '-') j++
        while (j < n && /[0-9]/.test(src[j])) j++
      }
      toks.push({ kind: isFloat ? 'float' : 'int', value: src.slice(i, j) })
      i = j
      continue
    }
    if (isNameStart(c)) {
      let j = i + 1
      while (j < n && isNameCont(src[j])) j++
      toks.push({ kind: 'name', value: src.slice(i, j) })
      i = j
      continue
    }
    const p = PUNCT.find((x) => src.startsWith(x, i))
    if (p) {
      toks.push({ kind: 'punct', value: p })
      i += p.length
      continue
    }
    throw new Error(`無法解析的字元:「${c}」(位置 ${i})`)
  }
  toks.push({ kind: 'eof', value: '' })
  return toks
}
