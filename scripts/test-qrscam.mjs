// QR 詐騙檢查引擎回歸測試。esbuild 打包 TS 後執行。
import { execSync } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'qrscam-'))
const entry = join(dir, 'entry.mjs')
const src = join(process.cwd(), 'src/features/qrScam.ts').replace(/\\/g, '\\\\')
writeFileSync(entry, `export { analyzeQrContent } from '${src}'`)
const outFile = join(dir, 'bundle.mjs')
execSync(`npx esbuild ${entry} --bundle --format=esm --platform=node --outfile=${outFile}`, {
  stdio: ['ignore', 'ignore', 'inherit'],
})
const { analyzeQrContent } = await import('file://' + outFile)

let pass = 0
let fail = 0
function eq(a, e, msg) {
  if (a === e) pass++
  else {
    fail++
    console.error(`✗ ${msg}\n   期望 ${JSON.stringify(e)} 實得 ${JSON.stringify(a)}`)
  }
}
function ok(c, msg) {
  if (c) pass++
  else {
    fail++
    console.error(`✗ ${msg}`)
  }
}

// 空 / 純文字
eq(analyzeQrContent('').kind, 'text', '空內容 kind=text')
eq(analyzeQrContent('').level, 'info', '空內容 level=info')
const plain = analyzeQrContent('歡迎光臨本店')
eq(plain.kind, 'text', '純文字 kind')
eq(plain.level, 'info', '純文字 level')
ok(plain.findings.length > 0 && plain.advice.length > 0, '純文字有 findings 與建議')

// 正常網址 → safe
const good = analyzeQrContent('https://line.me/ti/p/abc')
eq(good.kind, 'url', '網址 kind=url')
eq(good.level, 'safe', '正常 LINE 網址 safe')
eq(good.url, 'https://line.me/ti/p/abc', 'url 欄位帶回原網址')
ok(good.urlAnalysis && good.urlAnalysis.host.includes('line.me'), 'urlAnalysis host')

// 釣魚網址 → danger,並含 quishing 警語
const bad = analyzeQrContent('http://line.me.verify-account.cc/x')
eq(bad.kind, 'url', '釣魚網址 kind=url')
eq(bad.level, 'danger', '官方網域當幌子 → danger')
ok(bad.findings[0].level === 'danger' && bad.findings[0].text.includes('quishing'), 'danger 時置頂 quishing 警語')
ok(bad.advice.some((a) => a.includes('不要點開')), 'danger 建議含不要點開')

// 危險協定
eq(analyzeQrContent('javascript:alert(1)').level, 'danger', 'javascript 協定 danger')
eq(analyzeQrContent('javascript:alert(1)').kind, 'url', 'javascript 協定 kind=url')

// Wi-Fi
const wifi = analyzeQrContent('WIFI:S:CafeFree;T:nopass;P:;;')
eq(wifi.kind, 'wifi', 'Wi-Fi kind')
eq(wifi.level, 'warn', 'Wi-Fi level=warn')
eq(wifi.detail['網路名稱 (SSID)'], 'CafeFree', 'Wi-Fi SSID 解析')
ok(wifi.findings.some((f) => f.text.includes('開放網路')), '無密碼 Wi-Fi 額外警示')
const wifiWpa = analyzeQrContent('WIFI:S:Home;T:WPA;P:secret123;;')
eq(wifiWpa.detail['加密'], 'WPA', 'WPA 加密顯示')
ok(wifiWpa.findings.some((f) => f.level === 'ok'), 'WPA 給 ok 訊號')

// 加密貨幣付款 → danger
const btc = analyzeQrContent('bitcoin:1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa?amount=0.1')
eq(btc.kind, 'crypto', '加密貨幣 kind')
eq(btc.level, 'danger', '加密貨幣 danger')
eq(btc.detail['收款地址'], '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', '比特幣地址解析(去掉參數)')
ok(btc.advice.some((a) => a.includes('165')), '加密貨幣建議含報警 165')

// 電話
const tel = analyzeQrContent('tel:+886212345678')
eq(tel.kind, 'tel', '電話 kind')
eq(tel.level, 'warn', '電話 warn')
eq(tel.detail['號碼'], '+886212345678', '電話號碼解析')

// 簡訊
const sms = analyzeQrContent('SMSTO:55123:訂閱貼圖')
eq(sms.kind, 'sms', '簡訊 kind')
eq(sms.level, 'warn', '簡訊 warn')
eq(sms.detail['號碼'], '55123', '簡訊號碼')
eq(sms.detail['內容'], '訂閱貼圖', '簡訊內容')

// Email
const mail = analyzeQrContent('mailto:hi@example.com?subject=x')
eq(mail.kind, 'email', 'Email kind')
eq(mail.detail['收件者'], 'hi@example.com', 'Email 收件者(去參數)')

// geo
eq(analyzeQrContent('geo:25.03,121.56').kind, 'geo', 'geo kind')

// 聯絡人
const card = analyzeQrContent('MECARD:N:王小明;TEL:0912345678;;')
eq(card.kind, 'contact', '聯絡人 kind')
eq(card.detail['姓名'], '王小明', '名片姓名')
eq(card.detail['電話'], '0912345678', '名片電話')
const vcard = analyzeQrContent('BEGIN:VCARD\nFN:Alice\nTEL:0911222333\nEND:VCARD')
eq(vcard.kind, 'contact', 'vCard kind')
eq(vcard.detail['姓名'], 'Alice', 'vCard 姓名')

// 純文字內含網址 → 一併檢查
const embed = analyzeQrContent('快來看 http://goggle.com/login 領獎')
eq(embed.kind, 'text', '含網址文字 kind=text')
eq(embed.level, 'danger', '內含釣魚網址 → danger')
eq(embed.url, 'http://goggle.com/login', '抽出內含網址')

console.log(`\nqrScam: ${pass} 通過, ${fail} 失敗`)
if (fail > 0) process.exit(1)
