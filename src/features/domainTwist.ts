// 相似網域產生(防仿冒)—— 給一個真實網域,列出詐騙集團常拿來假冒它的「形近 / 錯字」網域樣式
// (dnstwist 風格),幫使用者與長輩認得仿冒網域長什麼樣。純函式、無 DOM、不連網(只生成字串,
// 不解析、不查詢),可在 Node 測試。

export interface TwistGroup {
  category: string
  label: string
  domains: string[]
}

// 拆成「要變造的名稱部分」與「TLD」(用最後一個點切;名稱裡的點保持不動)
export function parseDomain(domain: string): { name: string; tld: string } | null {
  const d = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  if (!/^[a-z0-9.-]+$/.test(d)) return null
  const dot = d.lastIndexOf('.')
  if (dot <= 0 || dot === d.length - 1) return null
  return { name: d.slice(0, dot), tld: d.slice(dot + 1) }
}

const KEYBOARD: Record<string, string> = {
  a: 'qwsz', b: 'vghn', c: 'xdfv', d: 'serfcx', e: 'wsdr', f: 'drtgvc', g: 'ftyhbv',
  h: 'gyujnb', i: 'ujko', j: 'huikmn', k: 'jiolm', l: 'kop', m: 'njk', n: 'bhjm',
  o: 'iklp', p: 'ol', q: 'wa', r: 'edft', s: 'awedxz', t: 'rfgy', u: 'yhji',
  v: 'cfgb', w: 'qase', x: 'zsdc', y: 'tghu', z: 'asx',
  '0': '9', '1': '2', '2': '13', '3': '24', '4': '35', '5': '46', '6': '57', '7': '68', '8': '79', '9': '80',
}

const HOMOGLYPH: Record<string, string[]> = {
  l: ['1', 'i'], i: ['l', '1'], o: ['0'], '0': ['o'], '1': ['l', 'i'],
  s: ['5'], '5': ['s'], g: ['9'], b: ['6'], z: ['2'], '2': ['z'],
}
// 多字元形近(rn 看起來像 m 等)
const HOMOGLYPH_MULTI: [string, string][] = [
  ['m', 'rn'], ['rn', 'm'], ['w', 'vv'], ['vv', 'w'], ['d', 'cl'], ['cl', 'd'], ['nn', 'm'],
]

const VOWELS = 'aeiou'
const COMMON_TLDS = ['com', 'net', 'org', 'co', 'info', 'biz', 'cc', 'tw', 'com.tw', 'app', 'online', 'shop', 'xyz', 'top', 'site']
const CONFUSE_TLDS: Record<string, string[]> = {
  com: ['co', 'cm', 'om', 'con', 'comm', 'cpm', 'xom'],
  net: ['nett', 'ner', 'het'],
  org: ['ogr', 'orgg', 'or'],
}

function isNameChar(ch: string): boolean {
  return /[a-z0-9-]/.test(ch)
}

// 對名稱字串套用「逐位置」轉換,dot 等非名稱字元位置略過
function eachPos(name: string, fn: (i: number, ch: string) => string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < name.length; i++) {
    if (!isNameChar(name[i])) continue
    for (const variant of fn(i, name[i])) out.push(variant)
  }
  return out
}

export function omission(name: string): string[] {
  return eachPos(name, (i) => [name.slice(0, i) + name.slice(i + 1)]).filter((s) => s.length > 0)
}
export function repetition(name: string): string[] {
  return eachPos(name, (i, ch) => [name.slice(0, i) + ch + name.slice(i)])
}
export function transposition(name: string): string[] {
  const out: string[] = []
  for (let i = 0; i < name.length - 1; i++) {
    if (name[i] === name[i + 1]) continue
    out.push(name.slice(0, i) + name[i + 1] + name[i] + name.slice(i + 2))
  }
  return out
}
export function replacement(name: string): string[] {
  return eachPos(name, (i, ch) => (KEYBOARD[ch] ?? '').split('').map((k) => name.slice(0, i) + k + name.slice(i + 1)))
}
export function insertion(name: string): string[] {
  return eachPos(name, (i, ch) => (KEYBOARD[ch] ?? '').split('').map((k) => name.slice(0, i) + k + name.slice(i)))
}
export function homoglyph(name: string): string[] {
  const out: string[] = []
  // 單字元
  for (let i = 0; i < name.length; i++) {
    for (const g of HOMOGLYPH[name[i]] ?? []) out.push(name.slice(0, i) + g + name.slice(i + 1))
  }
  // 多字元
  for (const [from, to] of HOMOGLYPH_MULTI) {
    let idx = name.indexOf(from)
    while (idx >= 0) {
      out.push(name.slice(0, idx) + to + name.slice(idx + from.length))
      idx = name.indexOf(from, idx + 1)
    }
  }
  return out
}
export function hyphenation(name: string): string[] {
  const out: string[] = []
  for (let i = 1; i < name.length; i++) {
    if (isNameChar(name[i - 1]) && isNameChar(name[i]) && name[i] !== '-' && name[i - 1] !== '-') {
      out.push(name.slice(0, i) + '-' + name.slice(i))
    }
  }
  return out
}
export function vowelSwap(name: string): string[] {
  const out: string[] = []
  for (let i = 0; i < name.length; i++) {
    if (VOWELS.includes(name[i])) {
      for (const v of VOWELS) if (v !== name[i]) out.push(name.slice(0, i) + v + name.slice(i + 1))
    }
  }
  return out
}
export function bitsquatting(name: string): string[] {
  const out: string[] = []
  for (let i = 0; i < name.length; i++) {
    const code = name.charCodeAt(i)
    for (let bit = 0; bit < 7; bit++) {
      const ch = String.fromCharCode(code ^ (1 << bit))
      if (/[a-z0-9-]/.test(ch) && ch !== name[i]) out.push(name.slice(0, i) + ch + name.slice(i + 1))
    }
  }
  return out
}
export function addition(name: string): string[] {
  const out: string[] = []
  for (let c = 97; c <= 122; c++) out.push(name + String.fromCharCode(c))
  for (let c = 48; c <= 57; c++) out.push(name + String.fromCharCode(c))
  return out
}

export function generateTwists(domain: string): TwistGroup[] {
  const parsed = parseDomain(domain)
  if (!parsed) return []
  const { name, tld } = parsed
  const original = name + '.' + tld
  const seen = new Set<string>([original])

  const build = (category: string, label: string, names: string[], keepTld = true): TwistGroup => {
    const domains: string[] = []
    for (const n of names) {
      const full = keepTld ? n + '.' + tld : n
      if (!seen.has(full) && /^[a-z0-9.-]+$/.test(full)) {
        seen.add(full)
        domains.push(full)
      }
    }
    return { category, label, domains }
  }

  // TLD 變造:換常見 TLD + 形近 TLD
  const tldNames: string[] = []
  for (const t of COMMON_TLDS) if (t !== tld) tldNames.push(name + '.' + t)
  for (const t of CONFUSE_TLDS[tld] ?? []) tldNames.push(name + '.' + t)

  const groups: TwistGroup[] = [
    build('omission', '少打一個字', omission(name)),
    build('repetition', '多打一個字', repetition(name)),
    build('transposition', '相鄰字對調', transposition(name)),
    build('replacement', '鍵盤鄰鍵打錯', replacement(name)),
    build('insertion', '多插入鄰鍵', insertion(name)),
    build('homoglyph', '形近字假冒(看起來一樣)', homoglyph(name)),
    build('hyphenation', '插入連字號', hyphenation(name)),
    build('vowel-swap', '母音替換', vowelSwap(name)),
    build('bitsquatting', '位元翻轉(bitsquatting)', bitsquatting(name)),
    build('addition', '結尾多一字', addition(name)),
    build('tld-swap', '換頂級網域(TLD)', tldNames, false),
  ]
  return groups.filter((g) => g.domains.length > 0)
}

export function countTwists(groups: TwistGroup[]): number {
  return groups.reduce((s, g) => s + g.domains.length, 0)
}
