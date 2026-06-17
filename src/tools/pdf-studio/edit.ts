/*
  PDF 頁面編輯(純 pdf-lib,無 DOM、無 pdfjs)—— 故可在 Node 直接回歸測試。
  與 lib.ts 分開:lib.ts 會 import pdfjs 的 worker ?url(僅 Vite 可解析),
  抽出這支只依賴 pdf-lib 的純邏輯,讓 scripts/test-pdf-rotate.mjs 能跑。
*/
import { PDFDocument, degrees } from 'pdf-lib'

/** 把基準角度加上增量,正規化到 0/90/180/270(0..359) */
export function addAngle(base: number, delta: number): number {
  return (((base + delta) % 360) + 360) % 360
}

export interface PageEdit {
  index: number // 來源頁(0-based)
  rotate: number // 使用者額外旋轉的角度增量(0/90/180/270)
}

/**
 * 依指定的頁面順序與旋轉,產生新 PDF。
 * 刪除 = 不放進 items;重排 = 改變 items 順序;旋轉 = 設定每頁 rotate 增量(疊加到原本方向)。
 * 旋轉常用於把掃描歪掉/側躺的頁面轉正。
 */
export async function buildEdited(
  buffer: ArrayBuffer,
  items: PageEdit[],
): Promise<Uint8Array> {
  const src = await PDFDocument.load(buffer, { ignoreEncryption: true })
  const out = await PDFDocument.create()
  const copied = await out.copyPages(
    src,
    items.map((it) => it.index),
  )
  copied.forEach((p, i) => {
    const delta = items[i].rotate
    if (delta % 360 !== 0) {
      // 疊加到頁面原本的方向(掃描檔常已帶 /Rotate)
      p.setRotation(degrees(addAngle(p.getRotation().angle, delta)))
    }
    out.addPage(p)
  })
  return await out.save()
}
