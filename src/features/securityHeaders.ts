/*
  HTTP 安全標頭稽核引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  貼上網站的 HTTP 回應標頭(curl -I 或 DevTools 看到的那一串),逐項檢查常見的
  安全防護標頭是否存在、設定是否良好,並給總評分與改善建議。
  概念類似 securityheaders.com,但全程在你的瀏覽器離線判讀,不連網、不上傳。
*/

export type FindingStatus = 'good' | 'warn' | 'bad' | 'info'

export interface Finding {
  id: string
  title: string
  status: FindingStatus
  header?: string
  value?: string
  message: string
}

export interface SecurityHeadersResult {
  headers: Record<string, string>
  findings: Finding[]
  score: number // 0–100
  grade: string // A+ / A / B / C / D / F
}

/** 解析原始 HTTP 標頭文字成小寫鍵的 map(忽略狀態行;重複標頭以 ", " 串接)。 */
export function parseHeaders(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  const lines = (raw || '').split(/\r?\n/)
  for (const line of lines) {
    const s = line.trim()
    if (!s) continue
    // 跳過狀態行,例:HTTP/1.1 200 OK 或 HTTP/2 301
    if (/^HTTP\/\d/i.test(s)) continue
    const idx = s.indexOf(':')
    if (idx <= 0) continue
    const key = s.slice(0, idx).trim().toLowerCase()
    const value = s.slice(idx + 1).trim()
    if (!key) continue
    out[key] = key in out ? out[key] + ', ' + value : value
  }
  return out
}

function parseMaxAge(hsts: string): number {
  const m = /max-age\s*=\s*"?(\d+)"?/i.exec(hsts)
  return m ? parseInt(m[1], 10) : -1
}

const SIX_MONTHS = 15768000 // 秒

interface Check {
  id: string
  title: string
  weight: number
  run: (h: Record<string, string>) => { status: FindingStatus; ratio: number; message: string; value?: string; header?: string }
}

const CHECKS: Check[] = [
  {
    id: 'hsts',
    title: 'Strict-Transport-Security(強制 HTTPS)',
    weight: 20,
    run: (h) => {
      const v = h['strict-transport-security']
      if (!v)
        return { status: 'bad', ratio: 0, message: '缺少 HSTS。建議加上 Strict-Transport-Security 強制瀏覽器只走 HTTPS,防止被降級攻擊。' }
      const maxAge = parseMaxAge(v)
      const sub = /includesubdomains/i.test(v)
      const preload = /preload/i.test(v)
      if (maxAge < 0)
        return { status: 'warn', ratio: 0.4, header: 'strict-transport-security', value: v, message: '有 HSTS 但缺 max-age,等同未生效。' }
      if (maxAge < SIX_MONTHS)
        return {
          status: 'warn',
          ratio: 0.6,
          header: 'strict-transport-security',
          value: v,
          message: `max-age 僅 ${maxAge} 秒,建議至少半年(15768000)。${sub ? '' : ' 另可加 includeSubDomains。'}`,
        }
      return {
        status: 'good',
        ratio: 1,
        header: 'strict-transport-security',
        value: v,
        message: `良好(max-age=${maxAge}${sub ? '、includeSubDomains' : ''}${preload ? '、preload' : ''})。`,
      }
    },
  },
  {
    id: 'csp',
    title: 'Content-Security-Policy(防 XSS / 注入)',
    weight: 25,
    run: (h) => {
      const v = h['content-security-policy']
      if (!v)
        return { status: 'bad', ratio: 0, message: '缺少 CSP。這是抵禦 XSS 與資源注入最有效的標頭,建議至少設定 default-src。' }
      const unsafe = /'unsafe-inline'|'unsafe-eval'/i.test(v)
      if (unsafe)
        return {
          status: 'warn',
          ratio: 0.5,
          header: 'content-security-policy',
          value: v,
          message: 'CSP 含 unsafe-inline 或 unsafe-eval,大幅削弱防護;建議改用 nonce / hash。',
        }
      return { status: 'good', ratio: 1, header: 'content-security-policy', value: v, message: '良好,已設定 CSP。' }
    },
  },
  {
    id: 'nosniff',
    title: 'X-Content-Type-Options(防 MIME 嗅探)',
    weight: 15,
    run: (h) => {
      const v = h['x-content-type-options']
      if (!v) return { status: 'bad', ratio: 0, message: '缺少。建議設為 nosniff,避免瀏覽器把回應當成別的型別執行。' }
      if (v.trim().toLowerCase() !== 'nosniff')
        return { status: 'warn', ratio: 0.5, header: 'x-content-type-options', value: v, message: '值應為 nosniff。' }
      return { status: 'good', ratio: 1, header: 'x-content-type-options', value: v, message: '良好(nosniff)。' }
    },
  },
  {
    id: 'clickjacking',
    title: '防點擊劫持(X-Frame-Options 或 CSP frame-ancestors)',
    weight: 15,
    run: (h) => {
      const xfo = h['x-frame-options']
      const csp = h['content-security-policy'] || ''
      const hasFA = /frame-ancestors/i.test(csp)
      if (xfo) return { status: 'good', ratio: 1, header: 'x-frame-options', value: xfo, message: '良好,已防止被嵌入 iframe。' }
      if (hasFA) return { status: 'good', ratio: 1, header: 'content-security-policy', value: 'frame-ancestors …', message: '良好,CSP frame-ancestors 已限制嵌入。' }
      return { status: 'bad', ratio: 0, message: '缺少防點擊劫持設定。建議 X-Frame-Options: SAMEORIGIN 或 CSP frame-ancestors。' }
    },
  },
  {
    id: 'referrer',
    title: 'Referrer-Policy(控制來源資訊外洩)',
    weight: 10,
    run: (h) => {
      const v = h['referrer-policy']
      if (!v) return { status: 'warn', ratio: 0, message: '缺少。建議設 strict-origin-when-cross-origin,避免把完整網址洩漏給第三方。' }
      return { status: 'good', ratio: 1, header: 'referrer-policy', value: v, message: '良好。' }
    },
  },
  {
    id: 'permissions',
    title: 'Permissions-Policy(限制相機/麥克風/定位等)',
    weight: 10,
    run: (h) => {
      const v = h['permissions-policy'] || h['feature-policy']
      if (!v) return { status: 'warn', ratio: 0, message: '缺少。建議用 Permissions-Policy 關閉用不到的瀏覽器功能(相機、麥克風、地理位置等)。' }
      const legacy = !h['permissions-policy'] && !!h['feature-policy']
      return { status: legacy ? 'warn' : 'good', ratio: legacy ? 0.6 : 1, header: legacy ? 'feature-policy' : 'permissions-policy', value: v, message: legacy ? '使用的是舊版 Feature-Policy,建議改用 Permissions-Policy。' : '良好。' }
    },
  },
  {
    id: 'disclosure',
    title: '資訊揭露(Server / X-Powered-By 版本)',
    weight: 5,
    run: (h) => {
      const offenders: string[] = []
      const server = h['server']
      const powered = h['x-powered-by']
      // 含版本號(數字.數字)才算揭露
      if (server && /\d+\.\d+/.test(server)) offenders.push(`Server: ${server}`)
      if (powered) offenders.push(`X-Powered-By: ${powered}`)
      if (offenders.length)
        return { status: 'warn', ratio: 0, message: `揭露了軟體版本(${offenders.join('、')}),方便攻擊者鎖定已知漏洞;建議移除或隱藏版本。` }
      return { status: 'good', ratio: 1, message: '良好,未揭露明顯的軟體版本資訊。' }
    },
  },
]

function gradeOf(score: number): string {
  if (score >= 95) return 'A+'
  if (score >= 85) return 'A'
  if (score >= 70) return 'B'
  if (score >= 55) return 'C'
  if (score >= 40) return 'D'
  return 'F'
}

/** 稽核安全標頭,回傳逐項結果與總評分。 */
export function analyzeSecurityHeaders(raw: string): SecurityHeadersResult {
  const headers = parseHeaders(raw)
  const findings: Finding[] = []
  let earned = 0
  let total = 0
  for (const c of CHECKS) {
    const r = c.run(headers)
    total += c.weight
    earned += c.weight * r.ratio
    findings.push({ id: c.id, title: c.title, status: r.status, header: r.header, value: r.value, message: r.message })
  }

  // 額外資訊(不計分):X-XSS-Protection 已棄用、跨來源隔離
  if (headers['x-xss-protection'] != null) {
    findings.push({
      id: 'xss-legacy',
      title: 'X-XSS-Protection(已棄用)',
      status: 'info',
      header: 'x-xss-protection',
      value: headers['x-xss-protection'],
      message: '此標頭已被現代瀏覽器棄用,建議移除(或設為 0),改用 CSP。',
    })
  }
  const coop = headers['cross-origin-opener-policy']
  const coep = headers['cross-origin-embedder-policy']
  if (coop || coep) {
    findings.push({
      id: 'cross-origin',
      title: '跨來源隔離(COOP / COEP)',
      status: 'info',
      message: `已設定跨來源隔離標頭(${[coop && 'COOP', coep && 'COEP'].filter(Boolean).join(' / ')}),有助於進階安全與高精度計時 API。`,
    })
  }

  const score = total > 0 ? Math.round((earned / total) * 100) : 0
  return { headers, findings, score, grade: gradeOf(score) }
}
