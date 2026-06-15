/*
  可疑網址檢查引擎的回歸測試(無需測試框架,node 直接跑)。
  用 esbuild 即時把 TS 轉成 ESM 再 import,逐筆斷言判定等級。
  執行:npm test
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `linkcheck-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/linkcheck.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { analyzeUrl } = await import('file://' + out)

// [網址, 期望等級, 說明]
const cases = [
  // 正常網站不應被誤判
  ['https://www.google.com', 'safe', '正常 Google'],
  ['https://line.me/ti/p/abc', 'safe', '正常 LINE'],
  ['https://shopee.tw/item', 'safe', '正常蝦皮'],
  ['https://www.books.com.tw', 'safe', '正常博客來'],
  ['https://www.gov.tw', 'safe', '正常政府網'],
  // 仿冒拼字(typosquatting)
  ['http://goggle.com/login', 'danger', '拼錯 Google'],
  ['http://faceboook.com', 'danger', '多字母 Facebook'],
  // 字形混淆(數字假冒字母)
  ['http://paypa1.com', 'danger', 'paypa1 假冒 PayPal'],
  ['http://g00gle.com', 'danger', 'g00gle 假冒 Google'],
  // 結構性紅旗
  ['http://192.168.1.1/login', 'danger', 'IP 位址'],
  ['http://user@evil.com', 'danger', '@ 騙術'],
  // 寄生免費平台
  ['http://apple-id-verify.web.app', 'danger', '免費平台冒用品牌'],
  ['https://random-blog.netlify.app', 'warn', '免費平台無品牌'],
  // 短網址 / 風險 TLD
  ['https://reurl.cc/abc', 'warn', '短網址'],
  // 新增可信網站不應誤判
  ['https://www.foodpanda.com.tw', 'safe', '正常 foodpanda'],
  ['https://mvdis.gov.tw', 'safe', '正常監理服務網'],
  ['https://www.thsrc.com.tw', 'safe', '正常高鐵'],
  ['https://www.rakuten.com.tw', 'safe', '正常樂天'],
  // 官方網域當幌子(真正網域在後面)
  ['https://cathaybk.com.tw.login-secure.xyz', 'danger', '官方網域當幌子'],
  ['http://line.me.verify-account.cc/x', 'danger', 'line.me 放前面當幌子'],
  // 危險協定
  ['javascript:alert(document.cookie)', 'danger', 'javascript 協定'],
  ['data:text/html,<script>bad()</script>', 'danger', 'data 協定'],
  // 新增品牌假冒
  ['http://foodpanda-tw-coupon.xyz/claim', 'danger', '假冒 foodpanda'],
]

let fail = 0
for (const [url, exp, note] of cases) {
  const r = analyzeUrl(url)
  const ok = r.level === exp
  if (!ok) {
    fail++
    console.log(`✗ [得到 ${r.level},期望 ${exp}] ${note} — ${url}`)
    console.log('   ', r.findings.map((f) => `${f.level}:${f.text.slice(0, 28)}`).join(' | '))
  } else {
    console.log(`✓ ${note}`)
  }
}

if (fail === 0) {
  console.log(`\n全部 ${cases.length} 筆通過 ✅`)
} else {
  console.error(`\n${fail} 筆失敗 ❌`)
  process.exit(1)
}
