/*
  文字資料抽取引擎回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-dataextract.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `dataextract-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/dataExtract.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { extractEmails, extractUrls, extractMobiles, extractVats, normalizeMobile, extractAll } =
  await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}
const eqArr = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// --- Email ---
check('抽 email', eqArr(extractEmails('寄到 a@x.com 或 b.c@mail.co.uk 謝謝'), ['a@x.com', 'b.c@mail.co.uk']))
check('email 去重(忽略大小寫)', eqArr(extractEmails('A@X.com a@x.com'), ['A@X.com']))
check('無 email 回空', eqArr(extractEmails('沒有電子郵件'), []))

// --- URL ---
check('抽網址', eqArr(extractUrls('看 https://example.com/path 這裡'), ['https://example.com/path']))
check('去尾端中文句號', eqArr(extractUrls('連結是 https://a.com/b。'), ['https://a.com/b']))
check('去尾端括號標點', eqArr(extractUrls('(https://a.com/x).'), ['https://a.com/x']))
check('多個網址去重', eqArr(extractUrls('http://a.com http://a.com https://b.com'), ['http://a.com', 'https://b.com']))
check('不抓無協定字串', eqArr(extractUrls('www.naked.com 不算'), []))

// --- 手機 ---
check('normalizeMobile 去分隔', normalizeMobile('0912-345-678') === '0912345678')
check('normalizeMobile +886 轉 0', normalizeMobile('+886 912 345 678') === '0912345678')
check('抽手機(多格式)', eqArr(extractMobiles('打 0912345678 或 0912-345-678'), ['0912345678']))
check('抽手機 +886', eqArr(extractMobiles('客服 +886-912-345-678'), ['0912345678']))
check('市話不誤抓成手機', eqArr(extractMobiles('02-12345678'), []))
check('不足碼不抓', eqArr(extractMobiles('0912-345'), []))

// --- 統編(檢查碼驗證)---
// 台積電 22099131、鴻海 04541302 為有效統編;12345678 多半無效
check('抽有效統編', eqArr(extractVats('公司統編 22099131 與 04541302'), ['22099131', '04541302']))
check('過濾無效 8 碼', eqArr(extractVats('亂數 11111111 22099131'), ['22099131'])) // 11111111 檢查碼無效
check('不從長數字中誤抓', eqArr(extractVats('訂單 1220991319999'), []))
check('統編去重', eqArr(extractVats('22099131 / 22099131'), ['22099131']))

// --- extractAll 整合 ---
const blob = `
聯絡人:王小明 a@x.com,手機 0912-345-678
公司網站 https://acme.com.tw,統編 22099131
備用信箱 a@x.com(重複)
`
const all = extractAll(blob)
check('整合 email', eqArr(all.emails, ['a@x.com']))
check('整合 url', eqArr(all.urls, ['https://acme.com.tw']))
check('整合 mobile', eqArr(all.mobiles, ['0912345678']))
check('整合 vat', eqArr(all.vats, ['22099131']))

// --- 空輸入 ---
const empty = extractAll('')
check('空輸入全空', empty.emails.length === 0 && empty.urls.length === 0 && empty.mobiles.length === 0 && empty.vats.length === 0)

console.log(fail === 0 ? '\n全部通過 ✅' : `\n${fail} 筆失敗 ❌`)
process.exit(fail === 0 ? 0 : 1)
