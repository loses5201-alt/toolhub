/*
  語意化版本(Semantic Versioning)引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  解析 major.minor.patch[-prerelease][+build]、依 semver.org 規範比較先後(含 prerelease 優先序),
  並支援 npm/node-semver 常見的範圍語法:^ 插入符、~ 波浪號、x-range(1.2.x / 1 / *)、
  連字號範圍(1.2.3 - 2.3.4)、|| 聯集、空白 AND、>= <= > < = 比較子。
  prerelease 過濾採 node-semver 預設(includePrerelease=false):帶 prerelease 的版本只有在
  同一組比較子中存在 [major,minor,patch] 相同且也帶 prerelease 的比較子時才可能符合。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

export interface Semver {
  major: number
  minor: number
  patch: number
  prerelease: (string | number)[]
  build: string[]
  version: string // 正規化後的 major.minor.patch[-pre]
}

const SEMVER_RE =
  /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-.]+))?(?:\+([0-9A-Za-z-.]+))?$/

function toIdentifiers(s: string | undefined): (string | number)[] {
  if (!s) return []
  return s.split('.').map((id) => (/^\d+$/.test(id) ? parseInt(id, 10) : id))
}

/** 解析嚴格 semver 字串;失敗回 null。 */
export function parseSemver(input: string): Semver | null {
  if (typeof input !== 'string') return null
  const m = input.trim().match(SEMVER_RE)
  if (!m) return null
  const major = parseInt(m[1], 10)
  const minor = parseInt(m[2], 10)
  const patch = parseInt(m[3], 10)
  const prerelease = toIdentifiers(m[4])
  const build = m[5] ? m[5].split('.') : []
  const version = `${major}.${minor}.${patch}${m[4] ? '-' + m[4] : ''}`
  return { major, minor, patch, prerelease, build, version }
}

function comparePre(a: (string | number)[], b: (string | number)[]): number {
  // 無 prerelease 的版本優先序「高於」有 prerelease 的
  if (a.length === 0 && b.length === 0) return 0
  if (a.length === 0) return 1
  if (b.length === 0) return -1
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const x = a[i]
    const y = b[i]
    if (x === y) continue
    const xn = typeof x === 'number'
    const yn = typeof y === 'number'
    if (xn && yn) return (x as number) < (y as number) ? -1 : 1
    if (xn) return -1 // 數字識別碼優先序低於文字
    if (yn) return 1
    return (x as string) < (y as string) ? -1 : 1
  }
  // 前綴相同,較短者優先序較低
  return a.length === b.length ? 0 : a.length < b.length ? -1 : 1
}

/** 依 semver 規範比較:回 -1 / 0 / 1。build 中繼資料不參與比較。 */
export function compareSemver(a: Semver, b: Semver): number {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1
  return comparePre(a.prerelease, b.prerelease)
}

/** 比較兩個版本字串;任一無效回 null。 */
export function compareVersions(a: string, b: string): number | null {
  const pa = parseSemver(a)
  const pb = parseSemver(b)
  if (!pa || !pb) return null
  return compareSemver(pa, pb)
}

/** 由小到大排序版本字串(無效者剔除)。 */
export function sortVersions(list: string[]): string[] {
  return list
    .map((v) => ({ v, p: parseSemver(v) }))
    .filter((x) => x.p)
    .sort((a, b) => compareSemver(a.p as Semver, b.p as Semver))
    .map((x) => x.v)
}

/** 指出兩版本的差異層級(null 表相同)。 */
export function diffLevel(a: string, b: string): string | null {
  const pa = parseSemver(a)
  const pb = parseSemver(b)
  if (!pa || !pb) return null
  if (pa.major !== pb.major) return pa.major === 0 || pb.major === 0 ? 'major' : 'major'
  if (pa.minor !== pb.minor) return 'minor'
  if (pa.patch !== pb.patch) return 'patch'
  if (comparePre(pa.prerelease, pb.prerelease) !== 0) return 'prerelease'
  return null
}

// ───────────────────────── 範圍(range)解析 ─────────────────────────

const isX = (id: string | undefined): boolean =>
  id === undefined || id === '' || id === 'x' || id === 'X' || id === '*'

const XRANGE =
  /^(\d+|x|X|\*)(?:\.(\d+|x|X|\*))?(?:\.(\d+|x|X|\*))?(?:-([0-9A-Za-z-.]+))?(?:\+[0-9A-Za-z-.]+)?$/

interface Partial {
  M: string
  m?: string
  p?: string
  pr?: string
}

function parsePartial(s: string): Partial | null {
  const m = s.trim().match(XRANGE)
  if (!m) return null
  return { M: m[1], m: m[2], p: m[3], pr: m[4] }
}

const num = (s: string) => parseInt(s, 10)

/** 把 x-range(1.2.x / 1 / *)展開為基本比較子字串。op 為 '' 或 '=' 或 < <= > >= 之一。 */
function expandXRange(op: string, part: Partial): string[] {
  const { M, m, p, pr } = part
  const xM = isX(M)
  const xm = xM || isX(m)
  const xp = xm || isX(p)
  let gtlt = op === '=' ? '' : op
  if (xM) {
    if (gtlt === '>' || gtlt === '<') return ['<0.0.0-0']
    return ['>=0.0.0']
  }
  if (gtlt && xp) {
    let mm = xm ? 0 : num(m as string)
    let pp = 0
    let MM = num(M)
    if (gtlt === '>') {
      gtlt = '>='
      if (xm) { MM = MM + 1; mm = 0 } else { mm = mm + 1 }
      pp = 0
    } else if (gtlt === '<=') {
      gtlt = '<'
      if (xm) { MM = MM + 1; mm = 0 } else { mm = mm + 1 }
    }
    return [`${gtlt}${MM}.${mm}.${pp}`]
  }
  if (xm) return [`>=${num(M)}.0.0`, `<${num(M) + 1}.0.0`]
  if (xp) return [`>=${num(M)}.${num(m as string)}.0`, `<${num(M)}.${num(m as string) + 1}.0`]
  // 完整版本
  const ver = `${num(M)}.${num(m as string)}.${num(p as string)}${pr ? '-' + pr : ''}`
  return [op === '' || op === '=' ? `=${ver}` : `${op}${ver}`]
}

function expandTilde(part: Partial): string[] {
  const { M, m, p, pr } = part
  if (isX(m)) return [`>=${num(M)}.0.0`, `<${num(M) + 1}.0.0`]
  if (isX(p)) return [`>=${num(M)}.${num(m as string)}.0`, `<${num(M)}.${num(m as string) + 1}.0`]
  const lo = `${num(M)}.${num(m as string)}.${num(p as string)}${pr ? '-' + pr : ''}`
  return [`>=${lo}`, `<${num(M)}.${num(m as string) + 1}.0`]
}

function expandCaret(part: Partial): string[] {
  const { M, m, p, pr } = part
  const MM = num(M)
  if (isX(m)) return [`>=${MM}.0.0`, `<${MM + 1}.0.0`]
  const mm = num(m as string)
  if (isX(p)) {
    if (MM === 0) return [`>=${MM}.${mm}.0`, `<${MM}.${mm + 1}.0`]
    return [`>=${MM}.${mm}.0`, `<${MM + 1}.0.0`]
  }
  const pp = num(p as string)
  const lo = `${MM}.${mm}.${pp}${pr ? '-' + pr : ''}`
  if (MM === 0) {
    if (mm === 0) return [`>=${lo}`, `<${MM}.${mm}.${pp + 1}`]
    return [`>=${lo}`, `<${MM}.${mm + 1}.0`]
  }
  return [`>=${lo}`, `<${MM + 1}.0.0`]
}

function expandHyphen(loStr: string, hiStr: string): string[] {
  const from = parsePartial(loStr)
  const to = parsePartial(hiStr)
  if (!from || !to) throw new Error('invalid hyphen range')
  const out: string[] = []
  if (isX(from.M)) {
    // 下界 = 任意
  } else if (isX(from.m)) out.push(`>=${num(from.M)}.0.0`)
  else if (isX(from.p)) out.push(`>=${num(from.M)}.${num(from.m as string)}.0`)
  else out.push(`>=${num(from.M)}.${num(from.m as string)}.${num(from.p as string)}${from.pr ? '-' + from.pr : ''}`)
  if (isX(to.M)) {
    // 上界 = 任意
  } else if (isX(to.m)) out.push(`<${num(to.M) + 1}.0.0`)
  else if (isX(to.p)) out.push(`<${num(to.M)}.${num(to.m as string) + 1}.0`)
  else out.push(`<=${num(to.M)}.${num(to.m as string)}.${num(to.p as string)}${to.pr ? '-' + to.pr : ''}`)
  return out.length ? out : ['>=0.0.0']
}

const OP_RE = /^(<=|>=|<|>|=|~|\^)?\s*(.*)$/

function expandComparator(token: string): string[] {
  const m = token.match(OP_RE)
  if (!m) throw new Error('invalid comparator: ' + token)
  const op = m[1] || ''
  const rest = m[2].trim()
  const part = parsePartial(rest)
  if (!part) throw new Error('invalid version in comparator: ' + token)
  if (op === '~') return expandTilde(part)
  if (op === '^') return expandCaret(part)
  return expandXRange(op, part)
}

/** 把一組 AND 比較子字串展開成基本比較子字串清單。 */
export function expandComparatorSet(setStr: string): string[] {
  const s = setStr.trim()
  if (s === '' || s === '*') return ['>=0.0.0']
  const hyphen = s.match(/^(\S+)\s+-\s+(\S+)$/)
  if (hyphen) return expandHyphen(hyphen[1], hyphen[2])
  // 容忍 ">= 1.2.3" 這種運算子後有空白的寫法
  const normalized = s.replace(/(<=|>=|<|>|=|~|\^)\s+/g, '$1')
  const tokens = normalized.split(/\s+/).filter(Boolean)
  const out: string[] = []
  for (const t of tokens) out.push(...expandComparator(t))
  return out
}

interface Primitive {
  op: '<' | '<=' | '>' | '>=' | '='
  version: Semver
  raw: string
}

const PRIM_RE = /^(<=|>=|<|>|=)?(.+)$/

function toPrimitive(str: string): Primitive {
  const m = str.match(PRIM_RE)
  if (!m) throw new Error('invalid primitive: ' + str)
  const op = (m[1] || '=') as Primitive['op']
  const version = parseSemver(m[2])
  if (!version) throw new Error('invalid primitive version: ' + str)
  return { op, version, raw: str }
}

function testPrimitive(v: Semver, prim: Primitive): boolean {
  const c = compareSemver(v, prim.version)
  switch (prim.op) {
    case '=': return c === 0
    case '>': return c > 0
    case '>=': return c >= 0
    case '<': return c < 0
    case '<=': return c <= 0
  }
}

function testSet(v: Semver, set: Primitive[]): boolean {
  for (const p of set) if (!testPrimitive(v, p)) return false
  if (v.prerelease.length) {
    const ok = set.some(
      (p) =>
        p.version.prerelease.length &&
        p.version.major === v.major &&
        p.version.minor === v.minor &&
        p.version.patch === v.patch,
    )
    if (!ok) return false
  }
  return true
}

export interface RangeResult {
  valid: boolean
  satisfies: boolean
  /** 每個 OR 子句展開後的基本比較子(供說明「為什麼」)。 */
  expanded: string[][]
  error?: string
}

/** 測試版本是否落在範圍內,並回傳展開後的比較子供說明。 */
export function satisfies(version: string, range: string): RangeResult {
  const v = parseSemver(version)
  if (!v) return { valid: false, satisfies: false, expanded: [], error: '版本格式無效' }
  let orSets: Primitive[][]
  let expanded: string[][]
  try {
    const sets = range.split('||').map((s) => expandComparatorSet(s))
    expanded = sets
    orSets = sets.map((strs) => strs.map(toPrimitive))
  } catch (e) {
    return { valid: false, satisfies: false, expanded: [], error: '範圍語法無效' }
  }
  const ok = orSets.some((set) => testSet(v, set))
  return { valid: true, satisfies: ok, expanded }
}
