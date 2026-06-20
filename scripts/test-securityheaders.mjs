/*
  HTTP 安全標頭稽核引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-securityheaders.mjs
  oracle:依各檢查的權重(hsts20 csp25 nosniff15 clickjacking15 referrer10
  permissions10 disclosure5 = 100)手算分數與評等。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `secheaders-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/securityHeaders.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { parseHeaders, analyzeSecurityHeaders } = await import('file://' + out)

let fail = 0
function eq(note, got, want) {
  if (got === want) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}\n   got : ${JSON.stringify(got)}\n   want: ${JSON.stringify(want)}`)
  }
}
const f = (res, id) => res.findings.find((x) => x.id === id)
const st = (res, id) => (f(res, id) ? f(res, id).status : '(無)')

// --- parseHeaders ---
const ph = parseHeaders('HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nX-Frame-Options: DENY\r\n')
eq('跳過狀態行', ph['http/1.1 200 ok'], undefined)
eq('鍵轉小寫', ph['content-type'], 'text/html')
eq('值正確', ph['x-frame-options'], 'DENY')
const dup = parseHeaders('Set-Cookie: a=1\nSet-Cookie: b=2')
eq('重複標頭串接', dup['set-cookie'], 'a=1, b=2')
eq('空輸入', Object.keys(parseHeaders('')).length, 0)
eq('忽略無冒號行', parseHeaders('garbage line')['garbage line'], undefined)

// --- 全空 → 幾乎全缺 ---
const empty = analyzeSecurityHeaders('')
eq('空:hsts bad', st(empty, 'hsts'), 'bad')
eq('空:csp bad', st(empty, 'csp'), 'bad')
eq('空:referrer warn', st(empty, 'referrer'), 'warn')
eq('空:disclosure good', st(empty, 'disclosure'), 'good') // 沒揭露版本
eq('空:分數', empty.score, 5) // 只有 disclosure 的 5 分
eq('空:評等 F', empty.grade, 'F')

// --- 滿分組合 ---
const perfect = analyzeSecurityHeaders(
  [
    'HTTP/2 200',
    'strict-transport-security: max-age=31536000; includeSubDomains; preload',
    "content-security-policy: default-src 'self'",
    'x-content-type-options: nosniff',
    'x-frame-options: DENY',
    'referrer-policy: strict-origin-when-cross-origin',
    'permissions-policy: geolocation=()',
  ].join('\n'),
)
eq('滿分:hsts good', st(perfect, 'hsts'), 'good')
eq('滿分:csp good', st(perfect, 'csp'), 'good')
eq('滿分:clickjacking good', st(perfect, 'clickjacking'), 'good')
eq('滿分:permissions good', st(perfect, 'permissions'), 'good')
eq('滿分:分數 100', perfect.score, 100)
eq('滿分:評等 A+', perfect.grade, 'A+')

// --- HSTS max-age 太短 → warn ---
const shortHsts = analyzeSecurityHeaders('strict-transport-security: max-age=100')
eq('短 HSTS warn', st(shortHsts, 'hsts'), 'warn')

// --- HSTS 缺 max-age → warn ---
const noMaxAge = analyzeSecurityHeaders('strict-transport-security: includeSubDomains')
eq('HSTS 無 max-age warn', st(noMaxAge, 'hsts'), 'warn')

// --- CSP 含 unsafe-inline → warn ---
const unsafeCsp = analyzeSecurityHeaders("content-security-policy: default-src 'self'; script-src 'unsafe-inline'")
eq('CSP unsafe warn', st(unsafeCsp, 'csp'), 'warn')

// --- nosniff 錯值 → warn ---
const badSniff = analyzeSecurityHeaders('x-content-type-options: sniff')
eq('nosniff 錯值 warn', st(badSniff, 'nosniff'), 'warn')

// --- 點擊劫持:只靠 CSP frame-ancestors ---
const faOnly = analyzeSecurityHeaders("content-security-policy: frame-ancestors 'none'")
eq('frame-ancestors → clickjacking good', st(faOnly, 'clickjacking'), 'good')

// --- 資訊揭露:Server 含版本 → warn ---
const disc = analyzeSecurityHeaders('Server: nginx/1.18.0\nX-Powered-By: PHP/8.1')
eq('揭露版本 warn', st(disc, 'disclosure'), 'warn')
const noVer = analyzeSecurityHeaders('Server: cloudflare')
eq('Server 無版本 good', st(noVer, 'disclosure'), 'good')

// --- 舊版 Feature-Policy → warn(legacy) ---
const legacy = analyzeSecurityHeaders('feature-policy: geolocation none')
eq('feature-policy legacy warn', st(legacy, 'permissions'), 'warn')

// --- 額外資訊:X-XSS-Protection 棄用、COOP ---
const extra = analyzeSecurityHeaders('x-xss-protection: 1; mode=block\ncross-origin-opener-policy: same-origin')
eq('xss-legacy info', st(extra, 'xss-legacy'), 'info')
eq('cross-origin info', st(extra, 'cross-origin'), 'info')

// --- 邊界分數:只有 hsts + csp good = 20+25+5(disclosure)=50 → D ---
const partial = analyzeSecurityHeaders(
  ['strict-transport-security: max-age=31536000', "content-security-policy: default-src 'self'"].join('\n'),
)
eq('部分:分數 50', partial.score, 50)
eq('部分:評等 D', partial.grade, 'D')

if (fail) {
  console.error(`\n${fail} 筆失敗`)
  process.exit(1)
}
console.log('\n全部通過 ✅')
