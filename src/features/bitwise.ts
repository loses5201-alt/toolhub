/*
  位元運算引擎 —— 純函式、無 DOM,可單獨被回歸測試。
  以 BigInt 運算,支援 8 / 16 / 32 / 64 位元固定寬度與二補數(two's complement)。
  JS 的 BigInt 位元運算對負數採無限長二補數語意,& 遮罩後即得固定寬度表示,
  故 wrap() 對「正數溢位」與「負數補碼」都正確。
*/

export type Width = 8 | 16 | 32 | 64
export const WIDTHS: Width[] = [8, 16, 32, 64]

export function maskFor(bits: Width): bigint {
  return (1n << BigInt(bits)) - 1n
}

// 把任意 BigInt 收斂到指定寬度的「無號表示」(負數自動轉二補數,正數自動取低位)
export function wrap(value: bigint, bits: Width): bigint {
  return value & maskFor(bits)
}

// 把無號表示依最高位元解讀成有號(二補數)值
export function asSigned(unsigned: bigint, bits: Width): bigint {
  const signBit = 1n << BigInt(bits - 1)
  return unsigned & signBit ? unsigned - (1n << BigInt(bits)) : unsigned
}

export interface ParseResult {
  ok: boolean
  value?: bigint // 原始解析值(可能為負、可能超出寬度,交給呼叫端 wrap)
  error?: string
}

// 解析整數字面值:支援 0x / 0b / 0o 前綴與十進位,允許前導 +/-、底線或空白分組
export function parseIntInput(raw: string): ParseResult {
  let s = (raw ?? '').trim().replace(/[_\s]/g, '')
  if (s === '') return { ok: false, error: '請輸入數字' }
  let neg = false
  if (s.startsWith('+')) s = s.slice(1)
  else if (s.startsWith('-')) {
    neg = true
    s = s.slice(1)
  }
  if (s === '') return { ok: false, error: '請輸入數字' }

  let base = 10
  let body = s
  const lower = s.toLowerCase()
  if (lower.startsWith('0x')) {
    base = 16
    body = s.slice(2)
  } else if (lower.startsWith('0b')) {
    base = 2
    body = s.slice(2)
  } else if (lower.startsWith('0o')) {
    base = 8
    body = s.slice(2)
  }
  if (body === '') return { ok: false, error: '前綴後面沒有數字' }

  const re =
    base === 16
      ? /^[0-9a-fA-F]+$/
      : base === 8
        ? /^[0-7]+$/
        : base === 2
          ? /^[01]+$/
          : /^[0-9]+$/
  if (!re.test(body)) {
    const name = base === 16 ? '十六' : base === 8 ? '八' : base === 2 ? '二' : '十'
    return { ok: false, error: `含有不屬於${name}進位的字元` }
  }

  let v: bigint
  try {
    v =
      base === 10
        ? BigInt(body)
        : BigInt((base === 16 ? '0x' : base === 8 ? '0o' : '0b') + body)
  } catch {
    return { ok: false, error: '無法解析數字' }
  }
  return { ok: true, value: neg ? -v : v }
}

export interface OpRow {
  key: string
  label: string
  value: bigint
}

// 計算所有位元運算結果。aRaw / bRaw 為原始值(尚未 wrap),shift 為位移量。
export function compute(aRaw: bigint, bRaw: bigint, bits: Width, shift: number): OpRow[] {
  const m = maskFor(bits)
  const a = wrap(aRaw, bits)
  const b = wrap(bRaw, bits)
  const n = BigInt(Math.max(0, Math.min(Math.trunc(shift) || 0, bits)))
  return [
    { key: 'and', label: 'A AND B', value: a & b },
    { key: 'or', label: 'A OR B', value: a | b },
    { key: 'xor', label: 'A XOR B', value: a ^ b },
    { key: 'nand', label: 'A NAND B', value: ~(a & b) & m },
    { key: 'nor', label: 'A NOR B', value: ~(a | b) & m },
    { key: 'xnor', label: 'A XNOR B', value: ~(a ^ b) & m },
    { key: 'nota', label: 'NOT A', value: ~a & m },
    { key: 'notb', label: 'NOT B', value: ~b & m },
    { key: 'shl', label: `A << ${shift}`, value: (a << n) & m },
    { key: 'shr', label: `A >>> ${shift}(邏輯右移)`, value: a >> n },
    { key: 'sar', label: `A >> ${shift}(算術右移)`, value: (asSigned(a, bits) >> n) & m },
  ]
}

// 計算設定位元(set bit)個數,即 popcount / Hamming weight
export function popcount(value: bigint): number {
  let x = value < 0n ? -value : value
  let c = 0
  while (x > 0n) {
    c += Number(x & 1n)
    x >>= 1n
  }
  return c
}

export function toBin(value: bigint, bits: Width): string {
  return wrap(value, bits).toString(2).padStart(bits, '0')
}

export function toHex(value: bigint, bits: Width): string {
  return wrap(value, bits)
    .toString(16)
    .toUpperCase()
    .padStart(bits / 4, '0')
}

// 二進位字串每 4 位以空白分組,便於閱讀
export function groupBin(bin: string): string {
  const out: string[] = []
  for (let i = bin.length; i > 0; i -= 4) {
    out.unshift(bin.slice(Math.max(0, i - 4), i))
  }
  return out.join(' ')
}

export interface ValueViews {
  unsigned: string
  signed: string
  hex: string
  bin: string
  binGrouped: string
  bits: number // 設定位元數
}

// 把一個值整理成多種檢視(無號十進位、有號十進位、Hex、Bin)
export function views(value: bigint, bits: Width): ValueViews {
  const u = wrap(value, bits)
  const bin = toBin(u, bits)
  return {
    unsigned: u.toString(10),
    signed: asSigned(u, bits).toString(10),
    hex: '0x' + toHex(u, bits),
    bin,
    binGrouped: groupBin(bin),
    bits: popcount(u),
  }
}
