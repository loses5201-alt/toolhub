/*
  日文假名 ↔ 羅馬字轉換引擎(純函式、無 DOM,可在 Node 直接測)。
  - 平假名 ↔ 片假名:Unicode 區段相差 0x60,直接位移。
  - 假名 → 羅馬字:採修正赫本式(Hepburn),處理拗音(きゃ kya)、促音(っ 重複下個子音、
    っち → tchi)、長音記號 ー(重複前一母音)、撥音 ん(母音/y/n 前作 n')。
  - 羅馬字 → 假名:貪婪最長比對,處理雙子音促音(kk→っk、tch→っch)與單獨 n。
  全程在使用者瀏覽器執行、不連網。は/へ/を 以字面讀音 ha/he/wo 處理(助詞實際發音 wa/e/o 需依語境)。
*/

// 假名(平假名)→ 羅馬字 對照(含拗音,先列雙字拗音以利最長比對)
const KANA_ROMAJI: [string, string][] = [
  // 拗音(2 字)
  ['きゃ', 'kya'], ['きゅ', 'kyu'], ['きょ', 'kyo'],
  ['しゃ', 'sha'], ['しゅ', 'shu'], ['しょ', 'sho'],
  ['ちゃ', 'cha'], ['ちゅ', 'chu'], ['ちょ', 'cho'],
  ['にゃ', 'nya'], ['にゅ', 'nyu'], ['にょ', 'nyo'],
  ['ひゃ', 'hya'], ['ひゅ', 'hyu'], ['ひょ', 'hyo'],
  ['みゃ', 'mya'], ['みゅ', 'myu'], ['みょ', 'myo'],
  ['りゃ', 'rya'], ['りゅ', 'ryu'], ['りょ', 'ryo'],
  ['ぎゃ', 'gya'], ['ぎゅ', 'gyu'], ['ぎょ', 'gyo'],
  ['じゃ', 'ja'], ['じゅ', 'ju'], ['じょ', 'jo'],
  ['びゃ', 'bya'], ['びゅ', 'byu'], ['びょ', 'byo'],
  ['ぴゃ', 'pya'], ['ぴゅ', 'pyu'], ['ぴょ', 'pyo'],
  // 五十音(1 字)
  ['あ', 'a'], ['い', 'i'], ['う', 'u'], ['え', 'e'], ['お', 'o'],
  ['か', 'ka'], ['き', 'ki'], ['く', 'ku'], ['け', 'ke'], ['こ', 'ko'],
  ['さ', 'sa'], ['し', 'shi'], ['す', 'su'], ['せ', 'se'], ['そ', 'so'],
  ['た', 'ta'], ['ち', 'chi'], ['つ', 'tsu'], ['て', 'te'], ['と', 'to'],
  ['な', 'na'], ['に', 'ni'], ['ぬ', 'nu'], ['ね', 'ne'], ['の', 'no'],
  ['は', 'ha'], ['ひ', 'hi'], ['ふ', 'fu'], ['へ', 'he'], ['ほ', 'ho'],
  ['ま', 'ma'], ['み', 'mi'], ['む', 'mu'], ['め', 'me'], ['も', 'mo'],
  ['や', 'ya'], ['ゆ', 'yu'], ['よ', 'yo'],
  ['ら', 'ra'], ['り', 'ri'], ['る', 'ru'], ['れ', 're'], ['ろ', 'ro'],
  ['わ', 'wa'], ['ゐ', 'wi'], ['ゑ', 'we'], ['を', 'wo'], ['ん', 'n'],
  ['が', 'ga'], ['ぎ', 'gi'], ['ぐ', 'gu'], ['げ', 'ge'], ['ご', 'go'],
  ['ざ', 'za'], ['じ', 'ji'], ['ず', 'zu'], ['ぜ', 'ze'], ['ぞ', 'zo'],
  ['だ', 'da'], ['ぢ', 'ji'], ['づ', 'zu'], ['で', 'de'], ['ど', 'do'],
  ['ば', 'ba'], ['び', 'bi'], ['ぶ', 'bu'], ['べ', 'be'], ['ぼ', 'bo'],
  ['ぱ', 'pa'], ['ぴ', 'pi'], ['ぷ', 'pu'], ['ぺ', 'pe'], ['ぽ', 'po'],
  ['ぁ', 'a'], ['ぃ', 'i'], ['ぅ', 'u'], ['ぇ', 'e'], ['ぉ', 'o'],
  ['ー', '-'], ['　', ' '],
]

const KANA_TO_ROMAJI = new Map(KANA_ROMAJI)

/** 片假名 → 平假名(逐字位移;非片假名原樣保留) */
export function katakanaToHiragana(s: string): string {
  let out = ''
  for (const ch of s) {
    const c = ch.codePointAt(0)!
    if (c >= 0x30a1 && c <= 0x30f6) out += String.fromCodePoint(c - 0x60)
    else out += ch
  }
  return out
}

/** 平假名 → 片假名(逐字位移;非平假名原樣保留) */
export function hiraganaToKatakana(s: string): string {
  let out = ''
  for (const ch of s) {
    const c = ch.codePointAt(0)!
    if (c >= 0x3041 && c <= 0x3096) out += String.fromCodePoint(c + 0x60)
    else out += ch
  }
  return out
}

function isVowel(c: string): boolean {
  return 'aiueo'.includes(c)
}

/** 假名(平/片)→ 羅馬字(修正赫本式) */
export function kanaToRomaji(input: string): string {
  // 先統一成平假名;但長音記號 ー 由片假名而來也已保留
  const s = katakanaToHiragana(input)
  let out = ''
  let i = 0
  let sokuon = false // 待處理的促音(っ)
  let lastVowel = '' // 供長音 ー 重複

  while (i < s.length) {
    const two = s.substr(i, 2)
    const one = s[i]

    // 促音 っ:標記,實際在下個音節開頭補子音
    if (one === 'っ') {
      sokuon = true
      i += 1
      continue
    }
    // 長音記號 ー:重複前一母音
    if (one === 'ー') {
      out += lastVowel || 'ー'
      i += 1
      continue
    }

    let kana = ''
    let romaji = ''
    if (KANA_TO_ROMAJI.has(two)) {
      kana = two
      romaji = KANA_TO_ROMAJI.get(two)!
    } else if (KANA_TO_ROMAJI.has(one)) {
      kana = one
      romaji = KANA_TO_ROMAJI.get(one)!
    } else {
      // 非假名:原樣輸出一個字元
      out += one
      i += 1
      sokuon = false
      lastVowel = ''
      continue
    }

    // 撥音 ん 的處理:在母音 / y / n 前加上 ' 以消歧義
    if (kana === 'ん') {
      const nextTwo = s.substr(i + 1, 2)
      const nextOne = s[i + 1]
      const nextR =
        (KANA_TO_ROMAJI.get(nextTwo) || KANA_TO_ROMAJI.get(nextOne) || '')[0] || ''
      out += nextR && (isVowel(nextR) || nextR === 'y' || nextR === 'n') ? "n'" : 'n'
      i += 1
      sokuon = false
      continue
    }

    if (sokuon) {
      // っ + ち系(ch) → t;其餘重複首字
      out += romaji.startsWith('ch') ? 't' : romaji[0]
      sokuon = false
    }
    out += romaji
    lastVowel = romaji[romaji.length - 1]
    i += kana.length
  }
  return out
}

// 羅馬字 → 假名 對照(平假名);較長者優先
// 反向比對時排除小寫假名與罕用重複(ぢ/づ/ゐ/ゑ),改用標準 じ/ず 等
const REVERSE_SKIP = new Set(['ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ', 'ぢ', 'づ', 'ゐ', 'ゑ'])
const ROMAJI_KANA: [string, string][] = KANA_ROMAJI
  .filter(([k, r]) => /^[a-z]/.test(r) && r !== 'wi' && r !== 'we' && !REVERSE_SKIP.has(k))
  .map(([k, r]) => [r, k] as [string, string])
// 補上常見替代拼法
const ROMAJI_ALT: [string, string][] = [
  ['shi', 'し'], ['si', 'し'], ['chi', 'ち'], ['ti', 'ち'], ['tsu', 'つ'], ['tu', 'つ'],
  ['fu', 'ふ'], ['hu', 'ふ'], ['ji', 'じ'], ['zi', 'じ'], ['sha', 'しゃ'], ['sya', 'しゃ'],
  ['shu', 'しゅ'], ['syu', 'しゅ'], ['sho', 'しょ'], ['syo', 'しょ'], ['cha', 'ちゃ'],
  ['cya', 'ちゃ'], ['chu', 'ちゅ'], ['cho', 'ちょ'], ['ja', 'じゃ'], ['jya', 'じゃ'],
  ['ju', 'じゅ'], ['jo', 'じょ'], ['n', 'ん'], ["n'", 'ん'], ['nn', 'ん'],
]
const ROMAJI_MAP = new Map<string, string>([...ROMAJI_KANA, ...ROMAJI_ALT])
// 比對時要嘗試的最長字串長度
const MAX_ROMAJI_LEN = 3

/** 羅馬字 → 假名(預設平假名,katakana=true 轉片假名) */
export function romajiToKana(input: string, katakana = false): string {
  const s = input.toLowerCase()
  let out = ''
  let i = 0
  while (i < s.length) {
    const ch = s[i]
    // 促音:相同子音連續(含 tch → っ + ch)
    if (/[a-z]/.test(ch) && !isVowel(ch) && ch !== 'n') {
      const next = s[i + 1]
      if (ch === next || (ch === 't' && s.substr(i + 1, 2) === 'ch')) {
        out += 'っ'
        i += 1
        continue
      }
    }
    // 撥音 n:後面不是母音/y,且不是 na 行等才當 ん
    if (ch === 'n') {
      const next = s[i + 1]
      if (next === "'" ) {
        out += 'ん'
        i += 2
        continue
      }
      if (next === undefined || (!isVowel(next) && next !== 'y')) {
        out += 'ん'
        i += 1
        continue
      }
    }
    // 貪婪最長比對
    let matched = false
    for (let len = MAX_ROMAJI_LEN; len >= 1; len--) {
      const sub = s.substr(i, len)
      if (ROMAJI_MAP.has(sub)) {
        out += ROMAJI_MAP.get(sub)!
        i += len
        matched = true
        break
      }
    }
    if (!matched) {
      out += s[i]
      i += 1
    }
  }
  return katakana ? hiraganaToKatakana(out) : out
}
