/*
  Cookie / Set-Cookie 解析引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-cookieparse.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `cookieparse-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/cookieParse.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { parseCookieHeader, parseSetCookie, humanDuration } = await import('file://' + out)

let fail = 0
function eq(note, got, want) {
  if (got === want) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}\n   got : ${JSON.stringify(got)}\n   want: ${JSON.stringify(want)}`)
  }
}
function ok(note, cond) {
  eq(note, !!cond, true)
}

// --- parseCookieHeader ---
eq('請求標頭兩組', JSON.stringify(parseCookieHeader('a=1; b=2')), JSON.stringify([{ name: 'a', value: '1' }, { name: 'b', value: '2' }]))
eq('去 Cookie: 前綴', JSON.stringify(parseCookieHeader('Cookie: sid=xyz')), JSON.stringify([{ name: 'sid', value: 'xyz' }]))
eq('值含等號', JSON.stringify(parseCookieHeader('token=ab=cd')), JSON.stringify([{ name: 'token', value: 'ab=cd' }]))
eq('無值', JSON.stringify(parseCookieHeader('flag')), JSON.stringify([{ name: 'flag', value: '' }]))
eq('空字串', JSON.stringify(parseCookieHeader('')), JSON.stringify([]))

// --- parseSetCookie 基本 ---
const r = parseSetCookie('sessionId=abc123; Domain=example.com; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=3600')
eq('name', r.name, 'sessionId')
eq('value', r.value, 'abc123')
eq('domain', r.attributes.domain, 'example.com')
eq('path', r.attributes.path, '/')
eq('secure flag', r.attributes.secure, true)
eq('httponly flag', r.attributes.httponly, true)
eq('samesite', r.attributes.samesite, 'Lax')
eq('max-age', r.attributes['max-age'], '3600')
ok('Max-Age 說明含小時', r.expiresInfo.includes('1 小時'))

// --- 去 Set-Cookie: 前綴 ---
eq('去前綴', parseSetCookie('Set-Cookie: a=b').name, 'a')

// --- 警告:SameSite=None 無 Secure ---
const w1 = parseSetCookie('a=b; SameSite=None')
ok('SameSite=None 缺 Secure 警告', w1.warnings.some((x) => x.includes('Secure')))

// --- 警告:缺 HttpOnly / Secure ---
const w2 = parseSetCookie('a=b')
ok('缺 HttpOnly 警告', w2.warnings.some((x) => x.includes('HttpOnly')))
ok('缺 Secure 警告', w2.warnings.some((x) => x.includes('Secure')))
ok('缺 SameSite 警告', w2.warnings.some((x) => x.includes('SameSite')))
eq('session cookie 說明', w2.expiresInfo.includes('session'), true)

// --- Max-Age 0 立即刪除 ---
ok('Max-Age 0 刪除', parseSetCookie('a=b; Max-Age=0').expiresInfo.includes('刪除'))
ok('Max-Age 負 刪除', parseSetCookie('a=b; Max-Age=-1').expiresInfo.includes('刪除'))

// --- Expires 解析 ---
const re = parseSetCookie('a=b; Expires=Wed, 21 Oct 2015 07:28:00 GMT')
ok('Expires 轉 ISO', re.expiresInfo.includes('2015-10-21T07:28:00.000Z'))

// --- 完整無 httponly/secure 但有 SameSite=Strict:無 SameSite 警告 ---
const r3 = parseSetCookie('a=b; Secure; HttpOnly; SameSite=Strict')
eq('齊全時無警告', r3.warnings.length, 0)

// --- 空 / 無效 ---
eq('空 Set-Cookie 回 null', parseSetCookie(''), null)
eq('只有屬性無名稱回 null', parseSetCookie('=value'), null)

// --- humanDuration ---
eq('humanDuration 1 小時', humanDuration(3600), '1 小時')
eq('humanDuration 1 天', humanDuration(86400), '1 天')
eq('humanDuration 天+小時', humanDuration(90000), '1 天 1 小時')
eq('humanDuration 分', humanDuration(120), '2 分')
eq('humanDuration 秒', humanDuration(30), '30 秒')

if (fail) {
  console.error(`\n${fail} 個測試未通過`)
  process.exit(1)
} else {
  console.log('\n全部 cookieParse 測試通過')
}
