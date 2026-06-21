/*
  血型遺傳計算引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  以孟德爾遺傳法則(ABO 三等位基因 A/B/O,A、B 對 O 為顯性、AB 共顯性;
  Rh 以 D 對 d 顯性)計算子女「可能的血型」與在指定父母基因型下的精確機率(龐尼特方格)。
  - 只看遺傳法則,結果為數學上的確定推論,不需任何外部資料。
  - 罕見的 cis-AB、孟買型(Bombay)等特例不在此模型內,屬極少數例外。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

export type ABOPheno = 'A' | 'B' | 'AB' | 'O'
export type RhPheno = '+' | '-'

// 各表現型對應的可能基因型(基因型以排序後字串表示,例如 'AO'、'OO')
const ABO_GENOTYPES: Record<ABOPheno, string[]> = {
  A: ['AA', 'AO'],
  B: ['BB', 'BO'],
  AB: ['AB'],
  O: ['OO'],
}
const RH_GENOTYPES: Record<RhPheno, string[]> = {
  '+': ['DD', 'Dd'],
  '-': ['dd'],
}

function sortGeno(a: string, b: string): string {
  return [a, b].sort().join('')
}

export function abacoPhenotypeOf(genotype: string): ABOPheno {
  const g = genotype.split('').sort().join('')
  if (g === 'OO') return 'O'
  if (g === 'AB') return 'AB'
  if (g === 'AA' || g === 'AO') return 'A'
  if (g === 'BB' || g === 'BO') return 'B'
  throw new Error(`未知 ABO 基因型:${genotype}`)
}

function rhPhenotypeOf(genotype: string): RhPheno {
  return genotype.includes('D') ? '+' : '-'
}

// 表現型 → 機率(0~1)的分布
export type Dist<T extends string> = Partial<Record<T, number>>


/** 兩個基因型雜交,回子代「基因型」機率分布(每個配子組合各 1/4)。 */
function crossGenotypes(g1: string, g2: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const a of g1) {
    for (const b of g2) {
      const child = sortGeno(a, b)
      out[child] = (out[child] ?? 0) + 0.25
    }
  }
  return out
}

/** 指定父母「基因型」下,子代 ABO 表現型機率分布。 */
export function aboPhenotypeDist(g1: string, g2: string): Dist<ABOPheno> {
  const geno = crossGenotypes(g1, g2)
  const dist: Dist<ABOPheno> = {}
  for (const [g, p] of Object.entries(geno)) {
    const ph = abacoPhenotypeOf(g)
    dist[ph] = (dist[ph] ?? 0) + p
  }
  return dist
}

/** 指定父母「基因型」下,子代 Rh 表現型機率分布。 */
export function rhPhenotypeDist(g1: string, g2: string): Dist<RhPheno> {
  const geno = crossGenotypes(g1, g2)
  const dist: Dist<RhPheno> = {}
  for (const [g, p] of Object.entries(geno)) {
    const ph = rhPhenotypeOf(g)
    dist[ph] = (dist[ph] ?? 0) + p
  }
  return dist
}

const ABO_ORDER: ABOPheno[] = ['A', 'B', 'AB', 'O']

/** 只知父母「表現型」時,列出子代所有可能的 ABO 血型(確定的集合,不含機率)。 */
export function possibleABO(p1: ABOPheno, p2: ABOPheno): ABOPheno[] {
  const set = new Set<ABOPheno>()
  for (const g1 of ABO_GENOTYPES[p1]) {
    for (const g2 of ABO_GENOTYPES[p2]) {
      for (const ph of Object.keys(aboPhenotypeDist(g1, g2)) as ABOPheno[]) set.add(ph)
    }
  }
  return ABO_ORDER.filter((p) => set.has(p))
}

/** 只知父母「表現型」時,列出子代所有可能的 Rh 別。 */
export function possibleRh(p1: RhPheno, p2: RhPheno): RhPheno[] {
  const set = new Set<RhPheno>()
  for (const g1 of RH_GENOTYPES[p1]) {
    for (const g2 of RH_GENOTYPES[p2]) {
      for (const ph of Object.keys(rhPhenotypeDist(g1, g2)) as RhPheno[]) set.add(ph)
    }
  }
  return (['+', '-'] as RhPheno[]).filter((p) => set.has(p))
}

/** 判斷某個 ABO 血型的子女,在此父母組合下是否「可能」出現。 */
export function isABOPossible(p1: ABOPheno, p2: ABOPheno, child: ABOPheno): boolean {
  return possibleABO(p1, p2).includes(child)
}

/**
 * 完整推論:給父母表現型,回子代可能 ABO 與 Rh,以及「若父母皆為異型合子最大不確定」時的
 * 機率分布(把每個父母可能基因型視為等機率的綜合分布,供參考)。
 * meanDist 為「父母基因型在其表現型下等機率」假設的綜合分布(僅供參考,非確定值)。
 */
export function summarizeABO(p1: ABOPheno, p2: ABOPheno): {
  possible: ABOPheno[]
  impossible: ABOPheno[]
  meanDist: Dist<ABOPheno>
} {
  const g1s = ABO_GENOTYPES[p1]
  const g2s = ABO_GENOTYPES[p2]
  const dist: Dist<ABOPheno> = {}
  const weight = 1 / (g1s.length * g2s.length)
  for (const g1 of g1s) {
    for (const g2 of g2s) {
      const d = aboPhenotypeDist(g1, g2)
      for (const ph of Object.keys(d) as ABOPheno[]) dist[ph] = (dist[ph] ?? 0) + (d[ph] as number) * weight
    }
  }
  const possible = possibleABO(p1, p2)
  const impossible = ABO_ORDER.filter((p) => !possible.includes(p))
  return { possible, impossible, meanDist: dist }
}

/** 把機率(0~1)格式化成百分比字串,整除時不留小數。 */
export function pct(p: number): string {
  const v = p * 100
  return Number.isInteger(v) ? `${v}%` : `${v.toFixed(1)}%`
}
