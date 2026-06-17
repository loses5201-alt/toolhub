/*
  公平抽籤 / 洗牌 / 分組引擎 —— 純函式、可注入亂數來源,故可在 Node 直接做確定性測試。
  日常用途:尾牙抽獎抽中獎者、把人隨機分組、隨機排出場順序、幫你做決定。
  預設用瀏覽器內建的密碼學亂數(crypto.getRandomValues)+ 拒絕取樣,避免取模偏差(modulo bias),
  每個人中獎機率真正均等;線上轉盤/抽獎站可能暗中作弊或滿是廣告,這種工具就該在本機、可檢視原始碼地跑。
*/

// 回傳 [0, n) 範圍內整數的亂數函式(可注入以利測試)
export type RandInt = (n: number) => number

/** 用密碼學亂數產生無偏差的 [0, n) 整數(拒絕取樣去掉取模偏差)。 */
export function cryptoRandInt(n: number): number {
  if (n <= 0) throw new Error('n 必須為正整數')
  if (n === 1) return 0
  const max = Math.floor(0x100000000 / n) * n
  const buf = new Uint32Array(1)
  let x = 0
  do {
    crypto.getRandomValues(buf)
    x = buf[0]
  } while (x >= max)
  return x % n
}

/** Fisher–Yates 洗牌,回傳新陣列(不改動輸入)。 */
export function shuffle<T>(arr: readonly T[], rand: RandInt = cryptoRandInt): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = rand(i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** 從 items 隨機抽出 count 位不重複的中獎者(count ≥ 全部時回傳全部洗牌)。 */
export function drawWinners<T>(items: readonly T[], count: number, rand: RandInt = cryptoRandInt): T[] {
  const n = Math.max(0, Math.min(Math.floor(count), items.length))
  return shuffle(items, rand).slice(0, n)
}

/**
 * 把 items 隨機平均分成 groupCount 組。
 * 先洗牌再依序輪流發牌(round-robin),確保各組人數最多差 1、且分配本身隨機。
 */
export function makeGroupsByCount<T>(
  items: readonly T[],
  groupCount: number,
  rand: RandInt = cryptoRandInt,
): T[][] {
  const k = Math.max(1, Math.floor(groupCount))
  const groups: T[][] = Array.from({ length: k }, () => [])
  const shuffled = shuffle(items, rand)
  shuffled.forEach((item, i) => {
    groups[i % k].push(item)
  })
  return groups
}

/**
 * 把 items 隨機分組,每組最多 size 人(最後一組可能不足)。
 * 先洗牌再切塊。
 */
export function makeGroupsBySize<T>(
  items: readonly T[],
  size: number,
  rand: RandInt = cryptoRandInt,
): T[][] {
  const s = Math.max(1, Math.floor(size))
  const shuffled = shuffle(items, rand)
  const groups: T[][] = []
  for (let i = 0; i < shuffled.length; i += s) {
    groups.push(shuffled.slice(i, i + s))
  }
  return groups
}

/** 從多行文字解析出名單(一行一筆,去頭尾空白、略過空行)。 */
export function parseNames(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s !== '')
}
