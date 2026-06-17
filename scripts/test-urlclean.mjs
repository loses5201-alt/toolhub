/*
  網址清理 / 看穿轉址引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-urlclean.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `urlclean-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/urlClean.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { cleanUrl, unwrapRedirect, processUrl } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// --- cleanUrl ---
const c1 = cleanUrl('https://shop.com/p/123?utm_source=fb&utm_medium=cpc&id=9&fbclid=abc')
check('清理:移除 utm_* 與 fbclid', c1.removed.sort().join(',') === 'fbclid,utm_medium,utm_source')
check('清理:保留正常參數 id', c1.cleaned.includes('id=9'))
check('清理:結果不含 utm', !c1.cleaned.includes('utm_'))
check('清理:結果不含 fbclid', !c1.cleaned.includes('fbclid'))

const c2 = cleanUrl('https://example.com/page')
check('清理:無追蹤參數時 removed 空', c2.removed.length === 0)
check('清理:無參數網址原樣返回', c2.cleaned === 'https://example.com/page')

const c3 = cleanUrl('https://a.com/?gclid=x&UTM_Campaign=y&q=hello')
check('清理:大小寫不敏感(UTM_Campaign)', c3.removed.map((r) => r.toLowerCase()).sort().join(',') === 'gclid,utm_campaign')
check('清理:保留搜尋字 q=hello', c3.cleaned.includes('q=hello'))

check('清理:非 http 視為無效', cleanUrl('ftp://x.com').ok === false)
check('清理:亂字串視為無效', cleanUrl('不是網址').ok === false)
check('清理:javascript: 視為無效', cleanUrl('javascript:alert(1)').ok === false)

// --- unwrapRedirect ---
const u1 = unwrapRedirect('https://www.google.com/url?q=https%3A%2F%2Freal.example.com%2Fpage&sa=D')
check('轉址:google /url?q= 拆出 real.example.com', u1.finalUrl === 'https://real.example.com/page')
check('轉址:標記 wrapped', u1.wrapped === true)
check('轉址:hops 至少兩層', u1.hops.length === 2)

const u2 = unwrapRedirect('https://l.facebook.com/l.php?u=https%3A%2F%2Fevil.example.org%2Fphish&h=abc')
check('轉址:facebook l.php?u= 拆出目標', u2.finalUrl === 'https://evil.example.org/phish')

const u3 = unwrapRedirect('https://nemo.safelinks.protection.outlook.com/?url=https%3A%2F%2Fdest.com%2Fx')
check('轉址:outlook safelinks 拆出目標', u3.finalUrl === 'https://dest.com/x')

const u4 = unwrapRedirect('https://plain.example.com/article?id=1')
check('轉址:一般網址不被當轉址', u4.wrapped === false && u4.finalUrl === 'https://plain.example.com/article?id=1')

// 巢狀:google 包 facebook 包 real
const nested = 'https://www.google.com/url?q=' +
  encodeURIComponent('https://l.facebook.com/l.php?u=' + encodeURIComponent('https://final.example.net/x'))
const u5 = unwrapRedirect(nested)
check('轉址:多層巢狀一路拆到底', u5.finalUrl === 'https://final.example.net/x')
check('轉址:巢狀 hops 三層', u5.hops.length === 3)

// 通用強參數名(任意 host)
const u6 = unwrapRedirect('https://some-redirector.io/go?target=https%3A%2F%2Fwanted.com%2Fy')
check('轉址:通用 target= 參數拆出', u6.finalUrl === 'https://wanted.com/y')

// 自指不應誤拆(同 host)
const u7 = unwrapRedirect('https://site.com/search?q=https://site.com/other')
check('轉址:同 host 自指不誤拆', u7.wrapped === false)

// --- processUrl:先拆轉址再清追蹤 ---
const p1 = processUrl('https://www.google.com/url?q=' +
  encodeURIComponent('https://shop.com/p?utm_source=ad&id=5'))
check('整合:拆轉址後最終目標正確', p1.unwrap.finalUrl.startsWith('https://shop.com/p'))
check('整合:最終目標被清掉 utm', !p1.clean.cleaned.includes('utm_') && p1.clean.cleaned.includes('id=5'))
check('整合:回報移除了 utm_source', p1.clean.removed.includes('utm_source'))

if (fail) {
  console.error(`\n${fail} 個測試未通過`)
  process.exit(1)
} else {
  console.log('\n全部通過 ✅')
}
