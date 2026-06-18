/*
  JWT 解碼/驗證引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-jwt.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `jwt-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/jwt.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const {
  base64UrlToString,
  decodeJwt,
  tokenStatus,
  humanizeDuration,
  formatUnix,
  verifyHmac,
} = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// 工具:把物件編成 base64url 段
const b64url = (s) =>
  Buffer.from(s, 'utf-8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const seg = (obj) => b64url(JSON.stringify(obj))
const mkToken = (header, payload, sig = 'sig') => `${seg(header)}.${seg(payload)}.${sig}`

// 一個常見的 HS256 範例 token(jwt.io 經典範例,secret 為 "your-256-bit-secret")
const CLASSIC =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.' +
  'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'

// --- base64url 解碼 ---
check('base64url 解中文', base64UrlToString(b64url('中文 test')) === '中文 test')

// --- 基本解碼 ---
const d = decodeJwt(CLASSIC)
check('經典 token 解碼成功', d.ok)
check('alg = HS256', d.alg === 'HS256')
check('typ = JWT', d.typ === 'JWT')
check('payload.sub', d.payload.sub === '1234567890')
check('payload.name', d.payload.name === 'John Doe')
check('payload.iat 數字', d.payload.iat === 1516239022)
check('headerJson 美化含換行', d.headerJson.includes('\n'))
check('signature 帶入第三段', d.signature === 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c')

// 前綴 Bearer 也能解
check('去掉 Bearer 前綴', decodeJwt('Bearer ' + CLASSIC).ok)

// --- 錯誤處理 ---
check('空字串報錯', decodeJwt('').ok === false)
check('兩段(無簽章)視為段數不足', decodeJwt('a.b').ok === false)
check('一段報錯', decodeJwt('justonestring').ok === false)
check('JWE 五段標記', decodeJwt('a.b.c.d.e').isJwe === true)
check('標頭非 base64url 報錯', decodeJwt('!!!.' + seg({ a: 1 }) + '.x').ok === false)
check('payload 非 JSON 報錯', decodeJwt(seg({ alg: 'HS256' }) + '.' + b64url('not json') + '.x').ok === false)
check('內含空白報錯', decodeJwt(CLASSIC.slice(0, 10) + ' ' + CLASSIC.slice(10)).ok === false)

// --- 有效期判斷 ---
const now = 1_700_000_000
check('已過期', tokenStatus({ exp: now - 100 }, now).state === 'expired')
check('有效中', tokenStatus({ exp: now + 3600 }, now).state === 'valid')
check('尚未生效', tokenStatus({ nbf: now + 60 }, now).state === 'not-yet')
check('無 exp 為 unknown', tokenStatus({ sub: 'a' }, now).state === 'unknown')
check('過期訊息含已過期', tokenStatus({ exp: now - 86400 }, now).message.includes('已過期'))
check('nbf 優先於 exp 判尚未生效', tokenStatus({ nbf: now + 60, exp: now + 3600 }, now).state === 'not-yet')

// --- humanize ---
check('1 天 1 小時', humanizeDuration(86400 + 3600) === '1 天 1 小時')
check('不到一秒', humanizeDuration(0).includes('不到') || humanizeDuration(0.4) === '不到 1 秒')
check('純分鐘', humanizeDuration(120) === '2 分')

// --- formatUnix ---
check('formatUnix 有 utc', formatUnix(1516239022).utc.startsWith('2018-01-18'))
check('formatUnix NaN 回 null', formatUnix(Number.NaN) === null)

// --- HMAC 驗證 ---
const v1 = await verifyHmac(CLASSIC, 'your-256-bit-secret')
check('HS256 正確密鑰驗證通過', v1.supported && v1.valid === true)
const v2 = await verifyHmac(CLASSIC, 'wrong-secret')
check('HS256 錯誤密鑰驗證失敗', v2.supported && v2.valid === false)
const v3 = await verifyHmac(mkToken({ alg: 'RS256', typ: 'JWT' }, { sub: '1' }), 'x')
check('RS256 不支援(需公鑰)', v3.supported === false && v3.alg === 'RS256')
const v4 = await verifyHmac(CLASSIC, '')
check('未填密鑰提示', v4.supported === true && !!v4.error)

// 自製 HS384 token 來回驗證
async function makeHs(alg, hash, payload, secret) {
  const h = seg({ alg, typ: 'JWT' })
  const p = seg(payload)
  const { createHmac } = await import('node:crypto')
  const map = { 'SHA-256': 'sha256', 'SHA-384': 'sha384', 'SHA-512': 'sha512' }
  const sig = createHmac(map[hash], secret)
    .update(`${h}.${p}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `${h}.${p}.${sig}`
}
const t384 = await makeHs('HS384', 'SHA-384', { sub: 'x' }, 's3cret')
check('HS384 來回驗證通過', (await verifyHmac(t384, 's3cret')).valid === true)
const t512 = await makeHs('HS512', 'SHA-512', { sub: 'y' }, 'pw')
check('HS512 來回驗證通過', (await verifyHmac(t512, 'pw')).valid === true)
check('HS512 錯密鑰失敗', (await verifyHmac(t512, 'pw2')).valid === false)

if (fail) {
  console.error(`\n${fail} 項測試未通過`)
  process.exit(1)
}
console.log('\nJWT 引擎全部測試通過')
