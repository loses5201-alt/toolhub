/*
  Unix 檔案權限(chmod)轉換核心 —— 八進位(755)↔ 符號(rwxr-xr-x)互轉,
  含 setuid / setgid / sticky 特殊權限位元。純函式、無 DOM,可在 Node 測。
  全程瀏覽器、不連網、不上傳。
*/

export interface Perms {
  special: number // 0–7:bit2=setuid, bit1=setgid, bit0=sticky
  owner: number // 0–7:bit2=r, bit1=w, bit0=x
  group: number
  other: number
}

export interface ParseResult {
  ok: boolean
  perms?: Perms
  error?: string
}

/** 解析八進位字串(3 或 4 位,如 "755" / "4755")。 */
export function parseOctal(input: string): ParseResult {
  const t = input.trim().replace(/^0o/i, '')
  if (!/^[0-7]{3,4}$/.test(t)) {
    return { ok: false, error: '八進位權限須為 3 或 4 位、每位 0–7(例如 755 或 4755)。' }
  }
  const digits = t.length === 3 ? '0' + t : t
  return {
    ok: true,
    perms: {
      special: parseInt(digits[0], 8),
      owner: parseInt(digits[1], 8),
      group: parseInt(digits[2], 8),
      other: parseInt(digits[3], 8),
    },
  }
}

/** 權限轉八進位字串;always3=true 時若無特殊位元則省略首位。 */
export function permsToOctal(p: Perms, omitLeadingZero = true): string {
  const s = `${p.special}${p.owner}${p.group}${p.other}`
  return omitLeadingZero && p.special === 0 ? s.slice(1) : s
}

/** 把一組 rwx(0–7)加上特殊位元,輸出 3 字元符號。 */
function tripletToSym(bits: number, specialBit: boolean, specialChar: string): string {
  const r = bits & 4 ? 'r' : '-'
  const w = bits & 2 ? 'w' : '-'
  const xExec = (bits & 1) !== 0
  let x: string
  if (specialBit) {
    // 有特殊位元:可執行時小寫(s/t),不可執行時大寫(S/T)
    x = xExec ? specialChar.toLowerCase() : specialChar.toUpperCase()
  } else {
    x = xExec ? 'x' : '-'
  }
  return r + w + x
}

/** 權限轉 9 字元符號表示(如 rwxr-xr-x、rwsr-sr-t)。 */
export function permsToSymbolic(p: Perms): string {
  const setuid = (p.special & 4) !== 0
  const setgid = (p.special & 2) !== 0
  const sticky = (p.special & 1) !== 0
  return (
    tripletToSym(p.owner, setuid, 's') +
    tripletToSym(p.group, setgid, 's') +
    tripletToSym(p.other, sticky, 't')
  )
}

/** 解析 9 字元符號(可含 rwx-/sStT),回權限。 */
export function parseSymbolic(input: string): ParseResult {
  let t = input.trim()
  // 容許開頭的檔案類型字元(如 ls -l 的 - d l 等),取後 9 字元
  if (t.length === 10) t = t.slice(1)
  if (t.length !== 9) {
    return { ok: false, error: '符號權限須為 9 個字元(如 rwxr-xr-x),可含 s/S/t/T。' }
  }
  const triplet = (str: string, specialChar: string): { bits: number; special: boolean } | null => {
    const [rc, wc, xc] = str
    if (rc !== 'r' && rc !== '-') return null
    if (wc !== 'w' && wc !== '-') return null
    let bits = 0
    if (rc === 'r') bits |= 4
    if (wc === 'w') bits |= 2
    let special = false
    const lower = specialChar.toLowerCase()
    const upper = specialChar.toUpperCase()
    if (xc === 'x') bits |= 1
    else if (xc === '-') {
      /* no exec */
    } else if (xc === lower) {
      bits |= 1
      special = true
    } else if (xc === upper) {
      special = true
    } else return null
    return { bits, special }
  }
  const o = triplet(t.slice(0, 3), 's')
  const g = triplet(t.slice(3, 6), 's')
  const ot = triplet(t.slice(6, 9), 't')
  if (!o || !g || !ot) {
    return { ok: false, error: '符號權限含無效字元;每組只接受 r/w/x/-(執行位可為 s/S/t/T)。' }
  }
  let special = 0
  if (o.special) special |= 4
  if (g.special) special |= 2
  if (ot.special) special |= 1
  return { ok: true, perms: { special, owner: o.bits, group: g.bits, other: ot.bits } }
}

const ROLE_NAMES: Array<[keyof Perms, string]> = [
  ['owner', '擁有者 (owner)'],
  ['group', '群組 (group)'],
  ['other', '其他人 (other)'],
]

export interface DescLine {
  role: string
  can: string // 可讀/可寫/可執行 的中文描述
}

/** 產生白話權限說明。 */
export function describe(p: Perms): DescLine[] {
  return ROLE_NAMES.map(([key, role]) => {
    const bits = p[key] as number
    const parts: string[] = []
    parts.push(bits & 4 ? '讀取' : '—')
    parts.push(bits & 2 ? '寫入' : '—')
    parts.push(bits & 1 ? '執行' : '—')
    return { role, can: parts.join(' / ') }
  })
}

/** 特殊位元的白話說明(只列出有設定的)。 */
export function describeSpecial(p: Perms): string[] {
  const out: string[] = []
  if (p.special & 4) out.push('setuid:執行時取得檔案擁有者身分')
  if (p.special & 2) out.push('setgid:執行時取得檔案群組身分(目錄:新檔繼承群組)')
  if (p.special & 1) out.push('sticky:目錄內只有擁有者能刪自己的檔(如 /tmp)')
  return out
}
