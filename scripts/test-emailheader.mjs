/*
  郵件來源檢視引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-emailheader.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `emailheader-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/emailHeader.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
  logLevel: 'silent',
})
const { splitHeaders, parseAddress, rootDomain, analyzeHeaders } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}
const hasDanger = (r, kw) => r.warnings.some((x) => x.severity === 'danger' && x.text.includes(kw))
const hasWarn = (r, kw) => r.warnings.some((x) => (x.severity === 'warn' || x.severity === 'danger') && x.text.includes(kw))

// rootDomain
check('rootDomain 一般網域', rootDomain('mail.example.com') === 'example.com')
check('rootDomain 台灣二級網域', rootDomain('mx1.post.gov.tw') === 'post.gov.tw')
check('rootDomain com.tw', rootDomain('a.b.shopee.com.tw') === 'shopee.com.tw')
check('rootDomain 已是主網域', rootDomain('gmail.com') === 'gmail.com')

// parseAddress
check('parseAddress 顯示名 + 地址', (() => {
  const a = parseAddress('"台灣銀行" <service@bank.com.tw>')
  return a.display === '台灣銀行' && a.address === 'service@bank.com.tw' && a.domain === 'bank.com.tw'
})())
check('parseAddress 純地址', (() => {
  const a = parseAddress('foo@bar.com')
  return a.address === 'foo@bar.com' && a.domain === 'bar.com'
})())

// 折行續行還原
const folded = 'Subject: 這是一封\n 很長的\n 主旨\nFrom: a@b.com\n\n內文'
check('splitHeaders 還原折行主旨', (() => {
  const h = splitHeaders(folded)
  const subj = h.find(([k]) => k === 'Subject')[1]
  return subj.includes('這是一封') && subj.includes('主旨')
})())
check('splitHeaders 只取空行前標頭', splitHeaders(folded).every(([k]) => k !== '內文'))

// 乾淨信:無明顯警訊 → info
const clean = [
  'From: 蝦皮購物 <noreply@shopee.tw>',
  'To: me@x.com',
  'Subject: 您的訂單已出貨',
  'Authentication-Results: mx.google.com; spf=pass; dkim=pass; dmarc=pass',
  '',
  'hi',
].join('\n')
const rClean = analyzeHeaders(clean)
check('乾淨信 from 解析正確', rClean.from.domain === 'shopee.tw')
check('乾淨信 auth 解析', rClean.auth.spf === 'pass' && rClean.auth.dmarc === 'pass')
check('乾淨信為 info、無 danger', rClean.warnings.length === 1 && rClean.warnings[0].severity === 'info')

// 顯示名稱藏別的網域(冒名)
const spoofDisplay = 'From: "service@bank.com.tw" <scammer@evil-phish.com>\nSubject: 帳戶異常\n\nx'
check('顯示名冒名網域 → danger', hasDanger(analyzeHeaders(spoofDisplay), '冒名'))

// Reply-To 網域不同
const replyTo = [
  'From: 採購 <ceo@realcorp.com>',
  'Reply-To: ceo@realcorp-secure.com',
  'Subject: 變更匯款帳號',
  '',
].join('\n')
check('Reply-To 不同網域 → danger', hasDanger(analyzeHeaders(replyTo), '回覆'))

// Return-Path 不同(提醒)
const retPath = 'From: a@goodbank.com\nReturn-Path: <bounce@spam-sender.ru>\nSubject: 通知\n\n'
check('Return-Path 不同網域 → warn', hasWarn(analyzeHeaders(retPath), 'Return-Path'))

// SPF/DKIM/DMARC 失敗
const authFail = [
  'From: a@example.com',
  'Authentication-Results: mx; spf=fail; dkim=fail; dmarc=fail',
  'Subject: hi',
  '',
].join('\n')
const rFail = analyzeHeaders(authFail)
check('SPF fail → danger', hasDanger(rFail, 'SPF'))
check('DKIM fail → danger', hasDanger(rFail, 'DKIM'))
check('DMARC fail → danger', hasDanger(rFail, 'DMARC'))

// 免費信箱卻自稱官方
const freeMail = 'From: "中華郵政客服" <service.post.tw@gmail.com>\nSubject: 包裹通知\n\n'
check('免費信箱自稱機構 → warn', hasWarn(analyzeHeaders(freeMail), '免費信箱'))

// 找不到 From
check('無 From 欄位 → 提示', analyzeHeaders('Subject: x\n\nbody').warnings.some((x) => x.text.includes('From')))

console.log(fail === 0 ? '\n全部通過 ✅' : `\n${fail} 項失敗 ❌`)
process.exit(fail === 0 ? 0 : 1)
