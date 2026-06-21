/*
  雜湊類型識別引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  給一段雜湊字串,依「長度 + 字元集 + 已知前綴格式」推測它可能是哪種演算法。
  - 先比對有明確結構的「加鹽雜湊格式」(bcrypt $2a$、sha512crypt $6$、Argon2、LDAP {SSHA}…),命中即高信心。
  - 否則看是不是純十六進位 / Base64,再依長度對應到一組候選演算法(MD5/SHA-1/SHA-256…)。
  無法判定的回空陣列。所有判斷都是「可能性」,同長度的不同演算法無法只憑雜湊值區分。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

export interface HashCandidate {
  name: string // 演算法名稱
  bits?: number // 輸出位元數(若適用)
  note?: string // 補充說明
  confidence: 'high' | 'medium' | 'low'
}

export interface IdentifyResult {
  input: string
  charset: 'hex' | 'base64' | 'mixed' | 'other'
  length: number
  candidates: HashCandidate[]
}

const HEX_RE = /^[0-9a-fA-F]+$/
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/

// 有明確前綴/結構的雜湊格式(可高信心判定)。每筆:正則 + 產生候選。
interface PrefixRule {
  test: RegExp
  make: (s: string) => HashCandidate[]
}
const PREFIX_RULES: PrefixRule[] = [
  {
    test: /^\$2[abxy]?\$\d{2}\$[./A-Za-z0-9]{53}$/,
    make: () => [{ name: 'bcrypt', confidence: 'high', note: 'Blowfish 基底的密碼雜湊,含成本因子與鹽,共 60 字元' }],
  },
  {
    test: /^\$argon2(id|i|d)\$/,
    make: (s) => [
      { name: `Argon2${/argon2id/.test(s) ? 'id' : /argon2i/.test(s) ? 'i' : 'd'}`, confidence: 'high', note: '現代記憶體困難密碼雜湊(PHC 格式)' },
    ],
  },
  {
    test: /^\$scrypt\$/,
    make: () => [{ name: 'scrypt', confidence: 'high', note: '記憶體困難密碼雜湊(PHC 格式)' }],
  },
  {
    test: /^\$1\$[./A-Za-z0-9]{1,8}\$[./A-Za-z0-9]{22}$/,
    make: () => [{ name: 'md5crypt', bits: 128, confidence: 'high', note: 'Unix crypt(系統 shadow 常見),$1$ 前綴' }],
  },
  {
    test: /^\$5\$/,
    make: () => [{ name: 'sha256crypt', bits: 256, confidence: 'high', note: 'Unix crypt,$5$ 前綴' }],
  },
  {
    test: /^\$6\$/,
    make: () => [{ name: 'sha512crypt', bits: 512, confidence: 'high', note: 'Unix crypt(現代 Linux shadow 預設),$6$ 前綴' }],
  },
  {
    test: /^\{SSHA\}/,
    make: () => [{ name: 'SSHA (salted SHA-1)', bits: 160, confidence: 'high', note: 'LDAP / OpenLDAP 密碼格式' }],
  },
  {
    test: /^\{SHA\}/,
    make: () => [{ name: 'SHA-1 (LDAP {SHA})', bits: 160, confidence: 'high', note: 'LDAP Base64 格式' }],
  },
  {
    test: /^\*[0-9A-F]{40}$/,
    make: () => [{ name: 'MySQL 4.1+ (SHA-1 雙重)', bits: 160, confidence: 'high', note: 'MySQL PASSWORD(),星號開頭 41 字元' }],
  },
]

// 純十六進位長度 → 候選演算法。
const HEX_LENGTH_MAP: Record<number, HashCandidate[]> = {
  8: [{ name: 'CRC-32', bits: 32, confidence: 'medium', note: '校驗碼,非密碼學雜湊' }, { name: 'Adler-32', bits: 32, confidence: 'low' }],
  16: [{ name: 'MySQL 3.x (OLD_PASSWORD)', bits: 64, confidence: 'medium' }, { name: 'CRC-64', bits: 64, confidence: 'low' }],
  32: [
    { name: 'MD5', bits: 128, confidence: 'high', note: '最常見的 32 字元雜湊' },
    { name: 'NTLM', bits: 128, confidence: 'medium', note: 'Windows 密碼雜湊(常為大寫)' },
    { name: 'MD4', bits: 128, confidence: 'low' },
    { name: 'MD2', bits: 128, confidence: 'low' },
  ],
  40: [
    { name: 'SHA-1', bits: 160, confidence: 'high' },
    { name: 'RIPEMD-160', bits: 160, confidence: 'low' },
  ],
  56: [
    { name: 'SHA-224', bits: 224, confidence: 'medium' },
    { name: 'SHA3-224', bits: 224, confidence: 'low' },
  ],
  64: [
    { name: 'SHA-256', bits: 256, confidence: 'high' },
    { name: 'SHA3-256', bits: 256, confidence: 'low' },
    { name: 'BLAKE2s-256', bits: 256, confidence: 'low' },
    { name: 'RIPEMD-256', bits: 256, confidence: 'low' },
  ],
  96: [
    { name: 'SHA-384', bits: 384, confidence: 'high' },
    { name: 'SHA3-384', bits: 384, confidence: 'low' },
  ],
  128: [
    { name: 'SHA-512', bits: 512, confidence: 'high' },
    { name: 'SHA3-512', bits: 512, confidence: 'low' },
    { name: 'BLAKE2b-512', bits: 512, confidence: 'low' },
    { name: 'Whirlpool', bits: 512, confidence: 'low' },
  ],
}

function detectCharset(s: string): IdentifyResult['charset'] {
  if (HEX_RE.test(s)) return 'hex'
  if (BASE64_RE.test(s) && /[+/=]|[a-z]/.test(s) && s.length % 4 === 0) return 'base64'
  if (BASE64_RE.test(s)) return 'base64'
  return 'other'
}

/** 識別雜湊字串可能的演算法。回 IdentifyResult(candidates 由高到低信心)。 */
export function identifyHash(raw: string): IdentifyResult {
  const input = (raw ?? '').trim()
  const result: IdentifyResult = {
    input,
    charset: 'other',
    length: input.length,
    candidates: [],
  }
  if (!input) return result

  // 1) 先比對有明確前綴/結構的格式
  for (const rule of PREFIX_RULES) {
    if (rule.test.test(input)) {
      result.candidates = rule.make(input)
      result.charset = HEX_RE.test(input.replace(/^\*/, '')) ? 'hex' : 'mixed'
      return result
    }
  }

  result.charset = detectCharset(input)

  // 2) 純十六進位 → 依長度查表
  if (result.charset === 'hex') {
    const byLen = HEX_LENGTH_MAP[input.length]
    if (byLen) {
      result.candidates = byLen.map((c) => ({ ...c }))
      return result
    }
    // 偶數長十六進位但長度不在表中 → 一般雜湊摘要(無法判定演算法)
    if (input.length % 2 === 0) {
      result.candidates = [
        { name: `未知十六進位雜湊(${(input.length * 4)} 位元)`, bits: input.length * 4, confidence: 'low', note: '長度不對應常見演算法' },
      ]
    }
    return result
  }

  // 3) Base64 → 依解碼後位元組長度推測
  if (result.charset === 'base64') {
    const bytes = base64ByteLength(input)
    const bits = bytes * 8
    const map: Record<number, string> = { 16: 'MD5 / MD4', 20: 'SHA-1', 28: 'SHA-224', 32: 'SHA-256 / BLAKE2s', 48: 'SHA-384', 64: 'SHA-512 / BLAKE2b' }
    if (map[bytes]) {
      result.candidates = [{ name: `${map[bytes]}(Base64 編碼)`, bits, confidence: 'medium', note: `解碼後 ${bytes} 位元組` }]
    }
    return result
  }

  return result
}

/** 估算 Base64 字串解碼後的位元組數(依結尾 padding)。 */
export function base64ByteLength(s: string): number {
  const clean = s.replace(/=+$/, '')
  const pad = s.length - clean.length
  return Math.floor((s.length / 4) * 3) - pad
}
