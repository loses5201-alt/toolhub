/*
  robots.txt 解析 / 測試引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  依 Google 的 robots.txt 規範:
   - 以 User-agent 行分組(連續的 User-agent 共用後續規則;遇規則後再出現 User-agent 即新組)。
   - Allow / Disallow 路徑支援 * 萬用字元與 $ 結尾錨點。
   - 比對網址時,在符合的群組內,以「最長(最具體)的規則」勝出;同長度時 Allow 勝 Disallow。
   - 沒有任何規則命中 → 預設允許。空的 Disallow: 代表允許全部。
  全程在你的瀏覽器判讀,不連網、不上傳。
*/

export type RuleType = 'allow' | 'disallow'

export interface RobotsRule {
  type: RuleType
  path: string
}

export interface RobotsGroup {
  agents: string[] // 皆小寫
  rules: RobotsRule[]
  crawlDelay?: number
}

export interface RobotsParsed {
  groups: RobotsGroup[]
  sitemaps: string[]
}

export interface RobotsVerdict {
  allowed: boolean
  matchedRule: RobotsRule | null
  matchedAgents: string[] // 命中的群組 user-agent(空陣列 = 無對應群組,預設允許)
  path: string
  reason: string
}

/** 解析 robots.txt 全文。 */
export function parseRobots(text: string): RobotsParsed {
  const groups: RobotsGroup[] = []
  const sitemaps: string[] = []
  let current: RobotsGroup | null = null
  let sawRuleInCurrent = false

  for (const rawLine of (text || '').split(/\r?\n/)) {
    // 去除註解(# 之後)與前後空白
    const line = rawLine.replace(/#.*$/, '').trim()
    if (!line) continue
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const field = line.slice(0, idx).trim().toLowerCase()
    const value = line.slice(idx + 1).trim()

    if (field === 'user-agent' || field === 'useragent') {
      // 規則出現後又見到 user-agent → 開新群組
      if (current && sawRuleInCurrent) {
        groups.push(current)
        current = null
        sawRuleInCurrent = false
      }
      if (!current) current = { agents: [], rules: [] }
      if (value) current.agents.push(value.toLowerCase())
    } else if (field === 'allow' || field === 'disallow') {
      if (!current) {
        // 規則出現在任何 user-agent 之前 → 視為 * 群組
        current = { agents: ['*'], rules: [] }
      }
      current.rules.push({ type: field, path: value })
      sawRuleInCurrent = true
    } else if (field === 'sitemap') {
      if (value) sitemaps.push(value)
    } else if (field === 'crawl-delay') {
      if (current) {
        const n = Number(value)
        if (!isNaN(n)) current.crawlDelay = n
      }
    }
    // 其他欄位忽略
  }
  if (current) groups.push(current)
  return { groups, sitemaps }
}

/** 由完整網址或路徑取出要比對的 path(含 query)。 */
export function extractPath(urlOrPath: string): string {
  const s = (urlOrPath || '').trim()
  if (!s) return '/'
  const m = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]+([^#]*)/i.exec(s)
  let path = m ? m[1] : s
  if (!path) path = '/'
  if (!path.startsWith('/')) path = '/' + path
  return path
}

/** 把 robots 路徑樣式編成 RegExp(* → 任意字元;$ → 結尾錨點)。 */
function patternToRegExp(pattern: string): RegExp {
  let p = pattern
  let anchorEnd = false
  if (p.endsWith('$')) {
    anchorEnd = true
    p = p.slice(0, -1)
  }
  let re = ''
  for (const ch of p) {
    if (ch === '*') re += '.*'
    else re += ch.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp('^' + re + (anchorEnd ? '$' : ''))
}

function ruleMatches(path: string, pattern: string): boolean {
  if (pattern === '') return false // 空路徑不命中任何網址(等同無此規則)
  return patternToRegExp(pattern).test(path)
}

/** 選出最符合此 user-agent 的群組(最長的 token 前綴匹配;否則 * 群組)。 */
function selectGroup(groups: RobotsGroup[], userAgent: string): RobotsGroup | null {
  const ua = (userAgent || '').toLowerCase()
  let best: RobotsGroup | null = null
  let bestLen = -1
  let star: RobotsGroup | null = null
  for (const g of groups) {
    for (const token of g.agents) {
      if (token === '*') {
        if (!star) star = g
        continue
      }
      if (ua.startsWith(token) && token.length > bestLen) {
        best = g
        bestLen = token.length
      }
    }
  }
  return best || star
}

/** 判斷某 user-agent 能否抓取某網址。 */
export function isAllowed(parsed: RobotsParsed, userAgent: string, urlOrPath: string): RobotsVerdict {
  const path = extractPath(urlOrPath)
  const group = selectGroup(parsed.groups, userAgent)
  if (!group) {
    return { allowed: true, matchedRule: null, matchedAgents: [], path, reason: '沒有對應的群組,預設允許抓取。' }
  }

  let bestRule: RobotsRule | null = null
  let bestLen = -1
  for (const rule of group.rules) {
    if (!ruleMatches(path, rule.path)) continue
    const len = rule.path.length
    if (len > bestLen) {
      bestLen = len
      bestRule = rule
    } else if (len === bestLen && rule.type === 'allow' && bestRule && bestRule.type === 'disallow') {
      // 同長度 Allow 勝 Disallow
      bestRule = rule
    }
  }

  if (!bestRule) {
    return {
      allowed: true,
      matchedRule: null,
      matchedAgents: group.agents,
      path,
      reason: '此群組沒有規則命中,預設允許抓取。',
    }
  }
  const allowed = bestRule.type === 'allow'
  return {
    allowed,
    matchedRule: bestRule,
    matchedAgents: group.agents,
    path,
    reason: `命中規則 ${bestRule.type === 'allow' ? 'Allow' : 'Disallow'}: ${bestRule.path}(最具體規則),因此${allowed ? '允許' : '禁止'}抓取。`,
  }
}
