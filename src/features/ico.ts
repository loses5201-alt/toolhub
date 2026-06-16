/*
  ICO 容器組裝 —— 純函式、無 DOM、無相依,方便回歸測試。
  把多張已編碼的 PNG(各為一種尺寸)包成一個 .ico 檔(Vista 以後支援 PNG 壓縮的 icon entry)。
  影像本身由瀏覽器 canvas 產生,這裡只負責把它們依 ICO 規格拼起來(全程 little-endian)。
*/
export interface IcoEntry {
  size: number // 正方形邊長(px)
  png: Uint8Array // 該尺寸的 PNG 位元組
}

export function buildIco(entries: IcoEntry[]): Uint8Array {
  const count = entries.length
  const headerSize = 6 + count * 16
  const dir = new Uint8Array(headerSize)
  const dv = new DataView(dir.buffer)
  dv.setUint16(0, 0, true) // reserved
  dv.setUint16(2, 1, true) // type = 1(icon)
  dv.setUint16(4, count, true)

  let offset = headerSize
  entries.forEach((e, i) => {
    const o = 6 + i * 16
    dir[o] = e.size >= 256 ? 0 : e.size // 0 代表 256
    dir[o + 1] = e.size >= 256 ? 0 : e.size
    dir[o + 2] = 0 // color count
    dir[o + 3] = 0 // reserved
    dv.setUint16(o + 4, 1, true) // color planes
    dv.setUint16(o + 6, 32, true) // bits per pixel
    dv.setUint32(o + 8, e.png.length, true) // bytes in resource
    dv.setUint32(o + 12, offset, true) // offset to image data
    offset += e.png.length
  })

  const out = new Uint8Array(offset)
  out.set(dir, 0)
  let p = headerSize
  for (const e of entries) {
    out.set(e.png, p)
    p += e.png.length
  }
  return out
}
