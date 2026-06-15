// 共用格式化工具

/** 格式化為新台幣字串,如 12345 -> "NT$ 12,345" */
export function ntd(n: number): string {
  if (!isFinite(n)) return '—'
  return 'NT$ ' + Math.round(n).toLocaleString('en-US')
}

/** 千分位數字,保留指定小數位 */
export function num(n: number, digits = 0): string {
  if (!isFinite(n)) return '—'
  return n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}
