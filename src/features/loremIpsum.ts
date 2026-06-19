/*
  假文 / 佔位文字產生引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  做版面/設計稿時填入的「假內文」。多數線上 lorem ipsum 只有拉丁文;
  本引擎同時支援:
    · 拉丁 Lorem Ipsum(可選經典開頭 "Lorem ipsum dolor sit amet…")
    · 中文假文(常用字組句、中文標點,給中文版面/設計稿排版用)
  亂數來源可注入(seed)故同 seed 可重現同一批,且測試可確定性驗證。
  全程在你的瀏覽器,不連網、不上傳。
*/

export type LoremLang = 'latin' | 'cjk'
export type LoremUnit = 'paragraphs' | 'sentences' | 'words'

export interface LoremOptions {
  lang: LoremLang
  unit: LoremUnit
  count: number
  startWithClassic: boolean // 拉丁:以經典 "Lorem ipsum dolor sit amet" 開頭
  seed?: number // 指定後可重現
}

export const DEFAULT_OPTIONS: LoremOptions = {
  lang: 'latin',
  unit: 'paragraphs',
  count: 3,
  startWithClassic: true,
}

const LATIN_WORDS = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
  'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
  'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
  'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo',
  'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit', 'voluptate',
  'velit', 'esse', 'cillum', 'eu', 'fugiat', 'nulla', 'pariatur', 'excepteur',
  'sint', 'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui',
  'officia', 'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum',
]

const CLASSIC_OPENER = ['lorem', 'ipsum', 'dolor', 'sit', 'amet']

// 中文常用字(取常見字,組句用)
const CJK_CHARS =
  '的一是不了人我在有他這為之大來以個中上們到說國和地也子時道出而要於就下得可你年生自會那後能對著事其裡所去行過家十用發天如然作方成者多日都三小軍二無同麼經法當起與好看學進種將還分此心前面又定見只主沒公從'

function makeRng(seed?: number): () => number {
  if (seed === undefined) return Math.random
  let s = seed >>> 0 || 1
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const randInt = (rng: () => number, min: number, max: number) =>
  min + Math.floor(rng() * (max - min + 1))

const pick = <T>(rng: () => number, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]

const pickChar = (rng: () => number, str: string): string =>
  str.charAt(Math.floor(rng() * str.length))

const capitalize = (w: string) => (w ? w[0].toUpperCase() + w.slice(1) : w)

// ---- 拉丁 ----

function latinSentence(rng: () => number): string {
  const len = randInt(rng, 6, 14)
  const words: string[] = []
  for (let i = 0; i < len; i++) words.push(pick(rng, LATIN_WORDS))
  // 隨機在中段插入一個逗號
  if (len > 8 && rng() < 0.6) {
    const at = randInt(rng, 3, len - 3)
    words[at] = words[at] + ','
  }
  return capitalize(words.join(' ')) + '.'
}

function latinParagraph(rng: () => number, classic: boolean): string {
  const n = randInt(rng, 3, 6)
  const sentences: string[] = []
  for (let i = 0; i < n; i++) {
    if (classic && i === 0) {
      sentences.push(capitalize(CLASSIC_OPENER.join(' ')) + ' ' + latinSentence(rng))
    } else {
      sentences.push(latinSentence(rng))
    }
  }
  return sentences.join(' ')
}

// ---- 中文 ----

const CJK_END = ['。', '。', '。', '!', '?'] // 句號為主

function cjkSentence(rng: () => number): string {
  // 由數段「詞組」以頓號/逗號連接,組成一句
  const clauses = randInt(rng, 1, 4)
  const parts: string[] = []
  for (let c = 0; c < clauses; c++) {
    const len = randInt(rng, 3, 9)
    let s = ''
    for (let i = 0; i < len; i++) s += pickChar(rng, CJK_CHARS)
    parts.push(s)
  }
  // 詞組間用逗號(偶爾頓號)連接,最後加句末標點
  const sep = parts.length > 2 && rng() < 0.4 ? '、' : ','
  return parts.join(sep) + pick(rng, CJK_END)
}

function cjkParagraph(rng: () => number): string {
  const n = randInt(rng, 3, 6)
  let out = ''
  for (let i = 0; i < n; i++) out += cjkSentence(rng)
  return out
}

// ---- 對外 ----

export function generate(opts: Partial<LoremOptions> = {}): string {
  const o = { ...DEFAULT_OPTIONS, ...opts }
  const count = Math.max(1, Math.min(200, Math.floor(o.count) || 1))
  const rng = makeRng(o.seed)

  if (o.unit === 'words') {
    if (o.lang === 'cjk') {
      let s = ''
      for (let i = 0; i < count; i++) s += pickChar(rng, CJK_CHARS)
      return s
    }
    const words: string[] = []
    for (let i = 0; i < count; i++) {
      if (o.startWithClassic && i < CLASSIC_OPENER.length) words.push(CLASSIC_OPENER[i])
      else words.push(pick(rng, LATIN_WORDS))
    }
    return capitalize(words.join(' '))
  }

  if (o.unit === 'sentences') {
    const out: string[] = []
    for (let i = 0; i < count; i++) {
      if (o.lang === 'cjk') out.push(cjkSentence(rng))
      else if (o.startWithClassic && i === 0)
        out.push(capitalize(CLASSIC_OPENER.join(' ')) + ' ' + latinSentence(rng))
      else out.push(latinSentence(rng))
    }
    return o.lang === 'cjk' ? out.join('') : out.join(' ')
  }

  // paragraphs
  const paras: string[] = []
  for (let i = 0; i < count; i++) {
    if (o.lang === 'cjk') paras.push(cjkParagraph(rng))
    else paras.push(latinParagraph(rng, o.startWithClassic && i === 0))
  }
  return paras.join('\n\n')
}
