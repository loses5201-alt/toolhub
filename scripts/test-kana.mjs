/*
  日文假名 ↔ 羅馬字引擎回歸測試(node 直接跑)。
  執行:node scripts/test-kana.mjs
  oracle:修正赫本式(Hepburn)標準拼法、Unicode 平/片假名位移、常見詞彙已知拼音。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `kana-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/kana.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { katakanaToHiragana, hiraganaToKatakana, kanaToRomaji, romajiToKana } =
  await import('file://' + out)

let fail = 0
let pass = 0
function eq(got, want, msg) {
  if (got === want) pass++
  else {
    fail++
    console.error(`✗ FAIL: ${msg}（got ${JSON.stringify(got)}, want ${JSON.stringify(want)}）`)
  }
}

// ---- 平/片假名互轉 ----
eq(hiraganaToKatakana('あいうえお'), 'アイウエオ', '平→片 五母音')
eq(katakanaToHiragana('アイウエオ'), 'あいうえお', '片→平 五母音')
eq(hiraganaToKatakana('にほんご'), 'ニホンゴ', '平→片 含濁音')
eq(katakanaToHiragana('コーヒー'), 'こーひー', '片→平 保留長音記號')
eq(hiraganaToKatakana('abc あ'), 'abc ア', '非假名原樣保留')

// ---- 假名 → 羅馬字:基本 ----
eq(kanaToRomaji('あいうえお'), 'aiueo', '五母音')
eq(kanaToRomaji('かきくけこ'), 'kakikukeko', 'か行')
eq(kanaToRomaji('し'), 'shi', 'し=shi(赫本)')
eq(kanaToRomaji('ち'), 'chi', 'ち=chi')
eq(kanaToRomaji('つ'), 'tsu', 'つ=tsu')
eq(kanaToRomaji('ふ'), 'fu', 'ふ=fu')
eq(kanaToRomaji('じ'), 'ji', 'じ=ji')

// ---- 濁音 / 半濁音 ----
eq(kanaToRomaji('がぎぐげご'), 'gagigugego', '濁音 が行')
eq(kanaToRomaji('ぱぴぷぺぽ'), 'papipupepo', '半濁音 ぱ行')

// ---- 拗音 ----
eq(kanaToRomaji('きゃきゅきょ'), 'kyakyukyo', '拗音 きゃ')
eq(kanaToRomaji('しゃしゅしょ'), 'shashusho', '拗音 しゃ=sha')
eq(kanaToRomaji('ちゃ'), 'cha', '拗音 ちゃ=cha')
eq(kanaToRomaji('じゃじゅじょ'), 'jajujo', '拗音 じゃ=ja')

// ---- 促音 っ ----
eq(kanaToRomaji('がっこう'), 'gakkou', '促音重複子音 gakkou')
eq(kanaToRomaji('きって'), 'kitte', 'きって=kitte')
eq(kanaToRomaji('まっちゃ'), 'matcha', '促音+ち系 → matcha')

// ---- 撥音 ん ----
eq(kanaToRomaji('にほん'), 'nihon', 'にほん=nihon')
eq(kanaToRomaji('しんかんせん'), 'shinkansen', 'しんかんせん')
eq(kanaToRomaji('こんや'), "kon'ya", "撥音在 y 前 → n'(こんや=kon'ya)")
eq(kanaToRomaji('しんあい'), "shin'ai", "撥音在母音前加 '")

// ---- 長音記號 ー(片假名)----
eq(kanaToRomaji('コーヒー'), 'koohii', '長音重複母音 koohii')
eq(kanaToRomaji('ラーメン'), 'raamen', 'ラーメン=raamen')

// ---- 片假名直接轉 ----
eq(kanaToRomaji('トウキョウ'), 'toukyou', '片假名 トウキョウ')

// ---- 羅馬字 → 假名 ----
eq(romajiToKana('konnichiwa'), 'こんにちわ', 'konnichiwa→こんにちわ')
eq(romajiToKana('arigatou'), 'ありがとう', 'arigatou→ありがとう')
eq(romajiToKana('nihon'), 'にほん', 'nihon→にほん')
eq(romajiToKana('sushi'), 'すし', 'sushi→すし')
eq(romajiToKana('gakkou'), 'がっこう', '促音 gakkou→がっこう')
eq(romajiToKana('matcha'), 'まっちゃ', 'tch 促音 matcha→まっちゃ')
eq(romajiToKana('kya'), 'きゃ', '拗音 kya→きゃ')
eq(romajiToKana('shashusho'), 'しゃしゅしょ', 'sha/shu/sho')
eq(romajiToKana('tokyo', true), 'トキョ', 'katakana 模式輸出片假名')
eq(romajiToKana('konnichiwa', true), 'コンニチワ', '片假名 konnichiwa')

// ---- 往返一致(無促音/長音的乾淨詞)----
for (const w of ['さくら', 'ともだち', 'やまもと', 'すずき']) {
  eq(romajiToKana(kanaToRomaji(w)), w, `往返一致:${w}`)
}

console.log(`\nkana: ${pass} 通過, ${fail} 失敗`)
process.exit(fail ? 1 : 0)
