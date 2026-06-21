/*
  Identicon 頭像產生器 —— 純函式、無 DOM,可在 Node 直接測試。
  由一段文字(暱稱 / Email / ID)決定性地產生 GitHub 風格的對稱像素頭像:
  相同輸入永遠得到相同圖案與顏色,可當預設大頭貼、留言板頭像、區別帳號用。
  原理:FNV-1a 32 位元雜湊 → 取低位元決定左半格子(再左右鏡射成對稱)、
  取高位元決定色相。全程在你的瀏覽器計算,不連網、不上傳。
*/

/** FNV-1a 32 位元雜湊(對 ASCII 與標準測試向量相符)。回傳無號 32 位整數。 */
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export interface IdenticonData {
  hash: number
  hue: number
  color: string // hsl(...)
  cells: boolean[][] // [row][col],已左右對稱
  gridSize: number
}

/** 由文字算出 identicon 的格子與顏色。gridSize 須為奇數(預設 5)。 */
export function identiconData(text: string, gridSize = 5): IdenticonData {
  const size = gridSize % 2 === 0 ? gridSize + 1 : gridSize
  const hash = hashString(text)
  const half = Math.ceil(size / 2) // 含中央列的左半欄數

  // 色相由高位元決定,飽和度/明度固定在悅目範圍
  const hue = (hash >>> 16) % 360
  const sat = 60 + ((hash >>> 8) % 25) // 60–84%
  const light = 45 + (hash % 15) // 45–59%
  const color = `hsl(${hue}, ${sat}%, ${light}%)`

  // 低位元決定左半格子的開關;位元不足時用衍生雜湊補充
  const cells: boolean[][] = []
  let bitSource = hash
  let bitsLeft = 32
  let salt = 1
  const nextBit = (): boolean => {
    if (bitsLeft === 0) {
      bitSource = hashString(text + '#' + salt++)
      bitsLeft = 32
    }
    const bit = bitSource & 1
    bitSource >>>= 1
    bitsLeft--
    return bit === 1
  }

  for (let r = 0; r < size; r++) {
    const row: boolean[] = new Array(size).fill(false)
    for (let c = 0; c < half; c++) {
      const on = nextBit()
      row[c] = on
      row[size - 1 - c] = on // 左右鏡射
    }
    cells.push(row)
  }

  return { hash, hue, color, cells, gridSize: size }
}

export interface SvgOptions {
  size?: number // 圖片邊長(px)
  padding?: number // 內距佔比 0–0.4
  background?: string // 底色
}

/** 把 identicon 資料轉成 SVG 字串。 */
export function identiconSvg(data: IdenticonData, opts: SvgOptions = {}): string {
  const size = opts.size ?? 120
  const padRatio = Math.min(0.4, Math.max(0, opts.padding ?? 0.1))
  const bg = opts.background ?? '#f0f0f0'
  const pad = size * padRatio
  const inner = size - pad * 2
  const cell = inner / data.gridSize

  let rects = ''
  for (let r = 0; r < data.gridSize; r++) {
    for (let c = 0; c < data.gridSize; c++) {
      if (!data.cells[r][c]) continue
      const x = pad + c * cell
      const y = pad + r * cell
      // 多 0.5px 重疊避免縫隙
      rects += `<rect x="${round(x)}" y="${round(y)}" width="${round(cell + 0.5)}" height="${round(
        cell + 0.5,
      )}" fill="${data.color}"/>`
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
    `viewBox="0 0 ${size} ${size}">` +
    `<rect width="${size}" height="${size}" fill="${bg}"/>` +
    rects +
    `</svg>`
  )
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
