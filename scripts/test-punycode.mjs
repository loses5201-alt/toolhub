/*
  Punycode / IDN 引擎回歸測試(無需測試框架,node 直接跑)。
  以 Node 內建 punycode 模組為對照基準(oracle)交叉驗證自製實作。
  執行:node scripts/test-punycode.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const oracle = require('punycode') // 已棄用但仍可用,僅供測試對照

const out = join(tmpdir(), `punycode-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/punycode.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const {
  punyEncode,
  punyDecode,
  domainToUnicode,
  domainToAscii,
  labelToUnicode,
  detectScripts,
  analyzeDomain,
} = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// --- 已知向量(RFC / 常見 IDN)---
check('mañana 編碼', punyEncode('mañana') === 'maana-pta')
check('mañana 解碼', punyDecode('maana-pta') === 'mañana')
check('münchen 編碼', punyEncode('münchen') === 'mnchen-3ya')
check('bücher 編碼', punyEncode('bücher') === 'bcher-kva')
check('台灣 解碼往返', punyDecode(punyEncode('台灣')) === '台灣')
check('純中文「臺灣」', punyDecode(punyEncode('臺灣')) === '臺灣')
check('emoji 標籤往返', punyDecode(punyEncode('💩')) === '💩')

// --- 與 oracle 交叉驗證(多組 Unicode 標籤)---
const labels = [
  'mañana', 'münchen', 'bücher', '台灣', '中文', '日本語', '한국어',
  'россия', 'ελληνικά', 'café', 'naïve', 'pokémon', '😀test', 'mixedАa',
]
for (const label of labels) {
  const mine = punyEncode(label)
  const want = oracle.encode(label)
  check(`encode 對照 oracle:${label}`, mine === want)
  check(`decode 對照 oracle:${label}`, punyDecode(mine) === oracle.decode(mine))
}

// --- 隨機往返(與 oracle 雙重確認）---
function randomLabel() {
  const len = 1 + Math.floor(Math.random() * 8)
  let s = ''
  for (let i = 0; i < len; i++) {
    // 混 ASCII 與 BMP 範圍
    const cp = Math.random() < 0.5 ? 97 + Math.floor(Math.random() * 26) : 0x100 + Math.floor(Math.random() * 0x4d00)
    s += String.fromCodePoint(cp)
  }
  return s
}
let rndOk = true
for (let i = 0; i < 300; i++) {
  const label = randomLabel()
  if (punyEncode(label) !== oracle.encode(label)) {
    rndOk = false
    console.error('  隨機不一致:', JSON.stringify(label))
    break
  }
  if (punyDecode(punyEncode(label)) !== label) {
    rndOk = false
    console.error('  往返不一致:', JSON.stringify(label))
    break
  }
}
check('300 組隨機標籤與 oracle 一致且可往返', rndOk)

// --- 網域層級 ---
check('xn-- 網域解回 Unicode', domainToUnicode('xn--maana-pta.com') === 'mañana.com')
check('Unicode 網域轉 ASCII', domainToAscii('台灣.tw') === domainToAscii('台灣.tw') && domainToAscii('台灣.tw').startsWith('xn--'))
check('純 ASCII 網域不動', domainToUnicode('example.com') === 'example.com')
check('多標籤逐段處理', domainToUnicode('xn--maana-pta.example.com') === 'mañana.example.com')
check('解碼失敗的 xn--(不完整序列)原樣保留', labelToUnicode('xn--b') === 'xn--b')

// --- detectScripts ---
check('純拉丁', JSON.stringify(detectScripts('abc')) === JSON.stringify(['latin']))
check('含西里爾', detectScripts('аb').includes('cyrillic'))
check('中文判為 han', detectScripts('台灣').includes('han'))
check('連字號不計入', detectScripts('a-b').filter((x) => x !== 'latin').length === 0)

// --- analyzeDomain 風險偵測 ---
const confusable = 'аpple' // 西里爾 а + 拉丁 pple,長得像 apple
const fakeAscii = domainToAscii(confusable + '.com')
const fake = analyzeDomain(fakeAscii)
check('混合形近字會被編成 xn--', fakeAscii.startsWith('xn--'))
check('偵測到 punycode', fake.hasPunycode === true)
check('解出 Unicode 主機', fake.unicode.split('.')[0] === confusable)
check('標記混合形近字風險', fake.risky === true)

const safe = analyzeDomain('apple.com')
check('正常網域不標風險', safe.risky === false && safe.hasPunycode === false)

const cjk = analyzeDomain('台積電.tw')
check('純中文網域不算形近字風險', cjk.risky === false)

if (fail) {
  console.error(`\n${fail} 個測試失敗`)
  process.exit(1)
}
console.log('\n全部通過')
