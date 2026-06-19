/*
  命名格式轉換引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  把一段識別字/詞句拆成單字,再組成各種命名慣例:
    camelCase / PascalCase / snake_case / CONSTANT_CASE / kebab-case /
    COBOL-CASE / Train-Case / dot.case / path/case / Title Case / Sentence case /
    全小寫 / 全大寫
  用途:寫程式時在不同語言/規範間轉換變數名、欄位名;批次(每行一筆)一次轉一整欄。
  全程在你的瀏覽器,不連網、不上傳。
*/

export type CaseId =
  | 'camel'
  | 'pascal'
  | 'snake'
  | 'constant'
  | 'kebab'
  | 'cobol'
  | 'train'
  | 'dot'
  | 'path'
  | 'title'
  | 'sentence'
  | 'lower'
  | 'upper'

export interface CaseFormat {
  id: CaseId
  label: string
  example: string
}

export const CASE_FORMATS: CaseFormat[] = [
  { id: 'camel', label: 'camelCase', example: 'myVariableName' },
  { id: 'pascal', label: 'PascalCase', example: 'MyVariableName' },
  { id: 'snake', label: 'snake_case', example: 'my_variable_name' },
  { id: 'constant', label: 'CONSTANT_CASE', example: 'MY_VARIABLE_NAME' },
  { id: 'kebab', label: 'kebab-case', example: 'my-variable-name' },
  { id: 'cobol', label: 'COBOL-CASE', example: 'MY-VARIABLE-NAME' },
  { id: 'train', label: 'Train-Case', example: 'My-Variable-Name' },
  { id: 'dot', label: 'dot.case', example: 'my.variable.name' },
  { id: 'path', label: 'path/case', example: 'my/variable/name' },
  { id: 'title', label: 'Title Case', example: 'My Variable Name' },
  { id: 'sentence', label: 'Sentence case', example: 'My variable name' },
  { id: 'lower', label: '全小寫', example: 'my variable name' },
  { id: 'upper', label: '全大寫', example: 'MY VARIABLE NAME' },
]

/**
 * 把任意字串拆成「單字」陣列。
 * 處理:明確分隔符(空白 _ - . / : \)、camelCase 邊界、縮寫接一般字
 * (HTMLParser → HTML Parser)。字母與數字相連不拆(version2 視為一字)。
 * 回傳的單字保留原始大小寫,交給格式化函式再決定。
 */
export function splitWords(input: string): string[] {
  if (!input) return []
  let s = input
  // 明確分隔符 → 空白
  s = s.replace(/[_\-./:\\]+/g, ' ')
  // 小寫/數字 後接 大寫 → 邊界(fooBar → foo Bar)
  s = s.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  // 連續大寫(縮寫)後接「大寫+小寫」→ 邊界(HTMLParser → HTML Parser)
  s = s.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
  return s.split(/\s+/).filter(Boolean)
}

const lower = (w: string) => w.toLowerCase()
const upper = (w: string) => w.toUpperCase()
const cap = (w: string) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w)

/** 依指定命名慣例把單字組回字串。 */
export function joinWords(words: string[], id: CaseId): string {
  if (words.length === 0) return ''
  switch (id) {
    case 'camel':
      return words.map((w, i) => (i === 0 ? lower(w) : cap(w))).join('')
    case 'pascal':
      return words.map(cap).join('')
    case 'snake':
      return words.map(lower).join('_')
    case 'constant':
      return words.map(upper).join('_')
    case 'kebab':
      return words.map(lower).join('-')
    case 'cobol':
      return words.map(upper).join('-')
    case 'train':
      return words.map(cap).join('-')
    case 'dot':
      return words.map(lower).join('.')
    case 'path':
      return words.map(lower).join('/')
    case 'title':
      return words.map(cap).join(' ')
    case 'sentence':
      return words.map((w, i) => (i === 0 ? cap(w) : lower(w))).join(' ')
    case 'lower':
      return words.map(lower).join(' ')
    case 'upper':
      return words.map(upper).join(' ')
  }
}

/** 把單一字串轉成指定命名慣例。 */
export function convertCase(input: string, id: CaseId): string {
  return joinWords(splitWords(input), id)
}

/**
 * 批次:逐行各自轉換(從 Excel/試算表複製一整欄常見)。
 * 空白行原樣保留;每行前後空白不影響拆字。
 */
export function convertLines(input: string, id: CaseId): string {
  return input
    .split('\n')
    .map((line) => (line.trim() === '' ? '' : convertCase(line, id)))
    .join('\n')
}

/** 一次回傳所有格式(單一字串輸入)。 */
export function convertAll(input: string): Record<CaseId, string> {
  const words = splitWords(input)
  const out = {} as Record<CaseId, string>
  for (const f of CASE_FORMATS) out[f.id] = joinWords(words, f.id)
  return out
}
