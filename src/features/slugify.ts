/*
  網址代稱 / Slug 產生引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  把文章標題/檔名/任意文字洗成乾淨、適合放進網址的 slug:
    "Hello, World! 第一篇"  →  "hello-world-第一篇"(保留 Unicode)或 "hello-world"(僅 ASCII)
  處理:去除重音符號(café→cafe)、標點/空白轉分隔符、收斂多個分隔符、去頭尾分隔符、
        可選小寫、可選保留中文/其他文字、長度上限(不切斷在分隔符尾巴)。
  用途:部落格/CMS 文章網址、錨點 id、檔名。全程在你的瀏覽器,不上傳。
*/

export type SlugSeparator = '-' | '_'

export interface SlugOptions {
  separator: SlugSeparator
  lowercase: boolean
  keepUnicode: boolean // true:保留中文等非 ASCII 文字;false:只留 a-z0-9
  maxLength: number // 0 = 不限
}

export const DEFAULT_OPTIONS: SlugOptions = {
  separator: '-',
  lowercase: true,
  keepUnicode: false,
  maxLength: 0,
}

/** 去除拉丁字母上的重音/變音符號(café→cafe、Ñ→N)。 */
function stripDiacritics(s: string): string {
  // NFD 拆出組合附加符號後刪除(U+0300–U+036F)
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function slugify(input: string, opts: Partial<SlugOptions> = {}): string {
  const o = { ...DEFAULT_OPTIONS, ...opts }
  if (input == null) return ''
  let s = stripDiacritics(String(input))
  if (o.lowercase) s = s.toLowerCase()

  // 把「非保留字元」換成分隔符
  if (o.keepUnicode) {
    // 保留任何語言的字母與數字(\p{L}\p{N}),其餘(標點/空白/符號)→ 分隔符
    s = s.replace(/[^\p{L}\p{N}]+/gu, o.separator)
  } else {
    // 只保留 ASCII 英數
    s = s.replace(/[^a-zA-Z0-9]+/g, o.separator)
  }

  // 收斂多重分隔符 + 去頭尾分隔符
  const sepRe = escapeRe(o.separator)
  s = s.replace(new RegExp(`${sepRe}{2,}`, 'g'), o.separator)
  s = s.replace(new RegExp(`^${sepRe}+|${sepRe}+$`, 'g'), '')

  // 長度上限:切到上限後再去掉可能殘留的尾端分隔符
  if (o.maxLength > 0 && s.length > o.maxLength) {
    s = s.slice(0, o.maxLength).replace(new RegExp(`${sepRe}+$`, 'g'), '')
  }
  return s
}
