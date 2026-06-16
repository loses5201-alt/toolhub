/*
  本機加密引擎的回歸測試(無需測試框架,node 直接跑)。
  用 esbuild 即時把 TS 轉成 ESM 再 import;Node 內建 globalThis.crypto.subtle 可直接驗證
  加解密來回、密碼錯誤偵測、竄改偵測。
  執行:node scripts/test-cryptobox.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `cryptobox-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/cryptoBox.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { encryptText, decryptText, encryptBytes, decryptBytes } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}
async function throws(note, fn) {
  try {
    await fn()
    fail++
    console.error(`✗ ${note}(預期丟錯卻成功)`)
  } catch {
    console.log(`✓ ${note}`)
  }
}

// 文字加解密來回(含中文、emoji)
const secret = '機密:銀行帳號 700-1234567890 🔐 password=ab#1'
const enc = await encryptText(secret, 'p@ss-W0rd')
check('文字解密後與原文相同', (await decryptText(enc, 'p@ss-W0rd')) === secret)
check('密文與原文不同', enc !== secret && enc.length > 0)

// 同一明文兩次加密的密文不同(salt/iv 隨機)
const enc2 = await encryptText(secret, 'p@ss-W0rd')
check('相同明文兩次加密產生不同密文', enc !== enc2)

// 密碼錯誤要失敗
await throws('密碼錯誤時解密失敗', () => decryptText(enc, 'wrong'))

// 空密碼要被擋
await throws('空密碼加密被擋', () => encryptText('x', ''))

// 位元組來回(模擬檔案)
const bytes = new Uint8Array(2048)
for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 37 + 11) & 0xff
const cont = await encryptBytes(bytes, 'pw123')
const back = await decryptBytes(cont, 'pw123')
check('位元組解密後長度相同', back.length === bytes.length)
check(
  '位元組解密後內容完全相同',
  back.every((v, i) => v === bytes[i]),
)

// 竄改任一位元組要被 GCM 抓到
const tampered = cont.slice()
tampered[tampered.length - 1] ^= 0xff
await throws('密文被竄改時解密失敗', () => decryptBytes(tampered, 'pw123'))

// 非本工具格式(magic 不符)要被擋
const garbage = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33])
await throws('非本工具加密的檔案被擋', () => decryptBytes(garbage, 'pw123'))

console.log(fail === 0 ? '\n全部通過 ✅' : `\n${fail} 項失敗 ❌`)
process.exit(fail === 0 ? 0 : 1)
