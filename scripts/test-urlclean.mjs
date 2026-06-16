/*
  網址清理引擎的回歸測試(無需測試框架,node 直接跑)。
  用 esbuild 即時把 TS 轉成 ESM 再 import,斷言還原轉址與移除追蹤參數的結果。
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
const { cleanUrl, cleanUrls } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// --- 移除追蹤參數 ---
const r1 = cleanUrl('https://example.com/p?utm_source=fb&utm_medium=cpc&id=3')
check('utm_* 被移除、保留 id', r1.cleaned === 'https://example.com/p?id=3')
check('utm 記錄 2 筆', r1.removed.length === 2)
check('utm 結果 changed=true', r1.changed === true)

const r2 = cleanUrl('https://shop.com/item/9?fbclid=ABC123')
check('fbclid 被移除、無殘留問號', r2.cleaned === 'https://shop.com/item/9')

const r3 = cleanUrl('https://youtu.be/dQw4?si=trackme')
check('YouTube si 被移除', r3.cleaned === 'https://youtu.be/dQw4')

// --- 不該動的網址 ---
const r4 = cleanUrl('https://example.com/search?q=貓&page=2')
check('一般 q/page 不被當追蹤(原樣)', r4.cleaned === 'https://example.com/search?q=貓&page=2')
check('無變動 changed=false', r4.changed === false)
check('無變動仍 ok', r4.ok === true)

// --- 還原轉址 ---
const g = cleanUrl('https://www.google.com/url?q=https%3A%2F%2Freal.com%2Fpage&sa=D&usg=xxx')
check('Google /url 還原到 real.com', g.cleaned === 'https://real.com/page')
check('Google 還原標記 unwrapped', g.unwrapped === true)
check('還原鏈含 www.google.com', g.unwrapChain.includes('www.google.com'))

const fb = cleanUrl('https://l.facebook.com/l.php?u=https%3A%2F%2Fexample.org%2Fa%3Futm_source%3Dx&h=AT1')
check('FB 還原後再去掉 utm', fb.cleaned === 'https://example.org/a')

const so = cleanUrl(
  'https://nam12.safelinks.protection.outlook.com/?url=https%3A%2F%2Fdocs.site.com%2Fx&data=05',
)
check('Outlook 安全連結還原', so.cleaned === 'https://docs.site.com/x')

// 非轉址站帶 next= 完整網址 → 不應被當轉址還原
const nx = cleanUrl('https://myshop.com/checkout?next=https://myshop.com/done')
check('非轉址站的 next= 不被還原', nx.unwrapped === false && nx.cleaned === nx.input)

// --- 補 scheme ---
const sc = cleanUrl('example.com/p?utm_source=x')
check('無 scheme 自動補 https 並清理', sc.cleaned === 'https://example.com/p' && sc.schemeAdded === true)

// --- 失敗情境 ---
check('空字串 ok=false', cleanUrl('   ').ok === false)
check('純文字 ok=false', cleanUrl('這不是網址').ok === false)
check('非 http scheme 拒絕', cleanUrl('mailto:a@b.com').ok === false)

// --- 多層轉址 ---
const dbl = cleanUrl(
  'https://www.google.com/url?q=' +
    encodeURIComponent('https://l.facebook.com/l.php?u=' + encodeURIComponent('https://final.com/x')),
)
check('多層轉址逐層還原到 final.com', dbl.cleaned === 'https://final.com/x')
check('多層還原鏈長度 2', dbl.unwrapChain.length === 2)

// --- 批次 ---
const batch = cleanUrls('https://a.com/?utm_source=x\n\n  https://b.com/?fbclid=1  ')
check('批次略過空行、清兩筆', batch.length === 2 && batch[0].cleaned === 'https://a.com/' && batch[1].cleaned === 'https://b.com/')

if (fail) {
  console.error(`\n${fail} 項失敗`)
  process.exit(1)
}
console.log('\n全部通過 ✅')
