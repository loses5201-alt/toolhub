/*
  批次檔案改名核心 —— 純函式、無 DOM、可在 Node 測。
  給一串原始檔名 + 一組規則,算出新檔名。瀏覽器端把改名後的檔案
  重新打包成 ZIP 供下載(瀏覽器無法直接改寫硬碟上的檔名)。
  規則套用順序:尋找取代 → 大小寫 → 加前/後綴 → 流水號 → 補唯一。
  副檔名(最後一個 . 之後)預設保留、不被規則動到。
*/

export interface RenameOptions {
  /** 尋找(空字串=不取代) */
  find?: string
  /** 取代成 */
  replace?: string
  /** 尋找時忽略英文大小寫 */
  findIgnoreCase?: boolean
  /** 主檔名大小寫轉換 */
  caseMode?: 'none' | 'lower' | 'upper'
  /** 前綴 */
  prefix?: string
  /** 後綴(加在主檔名尾、副檔名前) */
  suffix?: string
  /** 啟用流水號 */
  numbering?: boolean
  /** 流水號起始值 */
  start?: number
  /** 每筆遞增 */
  step?: number
  /** 補零位數(如 3 → 001) */
  pad?: number
  /** 流水號位置 */
  numberPosition?: 'prefix' | 'suffix'
  /** 流水號與檔名之間的分隔字串 */
  separator?: string
  /** 保留副檔名(預設 true) */
  keepExtension?: boolean
}

export interface RenameResult {
  original: string
  newName: string
}

/** 把檔名拆成 {主檔名, 副檔名(含點或空字串)}。開頭就是點(如 .gitignore)視為無副檔名。 */
export function splitExtension(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return { base: name, ext: '' }
  return { base: name.slice(0, dot), ext: name.slice(dot) }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function applyToBase(base: string, opts: RenameOptions, index: number): string {
  let b = base
  // 尋找取代(全部出現,字面比對)
  if (opts.find) {
    const flags = opts.findIgnoreCase ? 'gi' : 'g'
    b = b.replace(new RegExp(escapeRegExp(opts.find), flags), opts.replace ?? '')
  }
  // 大小寫
  if (opts.caseMode === 'lower') b = b.toLowerCase()
  else if (opts.caseMode === 'upper') b = b.toUpperCase()
  // 前後綴
  if (opts.prefix) b = opts.prefix + b
  if (opts.suffix) b = b + opts.suffix
  // 流水號
  if (opts.numbering) {
    const start = Number.isFinite(opts.start) ? (opts.start as number) : 1
    const step = Number.isFinite(opts.step) && opts.step !== 0 ? (opts.step as number) : 1
    const n = start + index * step
    const pad = Math.max(0, Math.floor(opts.pad ?? 0))
    const numStr = (n < 0 ? '-' : '') + String(Math.abs(n)).padStart(pad, '0')
    const sep = opts.separator ?? ''
    if (opts.numberPosition === 'prefix') b = numStr + sep + b
    else b = b + sep + numStr
  }
  return b
}

/**
 * 依規則算出每個檔案的新名稱。
 * 結果保證互不相同:若兩筆算出同名,後者自動加「 (2)」「 (3)」…(在副檔名前)。
 * 比對唯一性時忽略大小寫(對應 Windows/macOS 檔案系統)。
 */
export function computeNewNames(names: string[], opts: RenameOptions): RenameResult[] {
  const keepExt = opts.keepExtension ?? true
  const seen = new Set<string>()
  return names.map((original, i) => {
    const { base, ext } = keepExt ? splitExtension(original) : { base: original, ext: '' }
    let newBase = applyToBase(base, opts, i)
    if (newBase.trim() === '') newBase = base.trim() === '' ? `檔案` : base // 不允許空主檔名
    let candidate = newBase + ext
    if (seen.has(candidate.toLowerCase())) {
      let n = 2
      while (seen.has(`${newBase} (${n})${ext}`.toLowerCase())) n++
      candidate = `${newBase} (${n})${ext}`
    }
    seen.add(candidate.toLowerCase())
    return { original, newName: candidate }
  })
}
