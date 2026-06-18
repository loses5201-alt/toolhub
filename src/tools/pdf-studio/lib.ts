/*
  PDF 工坊共用工具 —— 全程在瀏覽器處理,不上傳任何檔案。
  合併/整理/圖片轉PDF 用 pdf-lib;PDF 轉圖片用 pdfjs-dist 渲染。
*/
import { PDFDocument, degrees, type PDFImage } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { sheetLayout, cellBox, fitInto } from './nupLayout'
import { imagePlacement, type Box } from './signLayout'

// pdfjs 需要 worker;用 Vite 的 ?url 取得 bundle 後的路徑
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export function fmtSize(n: number): string {
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB'
  return (n / 1024 / 1024).toFixed(2) + ' MB'
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function readArrayBuffer(file: File): Promise<ArrayBuffer> {
  return await file.arrayBuffer()
}

/** 合併多個 PDF(依傳入順序),回傳合併後的 Uint8Array */
export async function mergePdfs(buffers: ArrayBuffer[]): Promise<Uint8Array> {
  const out = await PDFDocument.create()
  for (const buf of buffers) {
    const src = await PDFDocument.load(buf, { ignoreEncryption: true })
    const pages = await out.copyPages(src, src.getPageIndices())
    pages.forEach((p) => out.addPage(p))
  }
  return await out.save()
}

/** 取得單一 PDF 的頁數 */
export async function getPageCount(buffer: ArrayBuffer): Promise<number> {
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true })
  return doc.getPageCount()
}

/**
 * 依指定的頁碼順序(0-based,可重複/省略)產生新 PDF。
 * 刪除 = 不放進 order;重排 = 改變 order 順序;擷取 = 只放部分。
 */
/**
 * 依指定順序(以原始 0-based 頁碼表示)重組 PDF;可選 rotations 為與 order 等長的
 * 額外旋轉角度(度,通常 0/90/180/270),會疊加到該頁原本的旋轉上。
 */
export async function buildFromOrder(
  buffer: ArrayBuffer,
  order: number[],
  rotations?: number[],
): Promise<Uint8Array> {
  const src = await PDFDocument.load(buffer, { ignoreEncryption: true })
  const out = await PDFDocument.create()
  const copied = await out.copyPages(src, order)
  copied.forEach((p, i) => {
    const delta = rotations?.[i]
    if (delta) {
      const base = p.getRotation().angle
      p.setRotation(degrees(((base + delta) % 360 + 360) % 360))
    }
    out.addPage(p)
  })
  return await out.save()
}

export interface ImageInput {
  bytes: ArrayBuffer
  type: string // 'image/jpeg' | 'image/png'
  width: number
  height: number
}

export type PageSize = 'fit' | 'a4'

/**
 * N-up 併頁:把多頁 PDF 縮排到每張 A4 放 2/4/6/9 頁,省紙、印講義用。
 * 來源頁面等比例縮放、置中塞進格子;不足一張的最後幾格留白。
 * 注意:pdf-lib 嵌入頁面不會套用來源頁的 /Rotate,旋轉過的頁面建議先在「整理頁面」轉正。
 */
export async function nUpPdf(
  buffer: ArrayBuffer,
  perSheet: number,
  margin = 28,
  gap = 10,
): Promise<Uint8Array> {
  const src = await PDFDocument.load(buffer, { ignoreEncryption: true })
  const out = await PDFDocument.create()
  const embedded = await out.embedPages(src.getPages())
  const lay = sheetLayout(perSheet)
  const per = lay.perSheet
  for (let i = 0; i < embedded.length; i += per) {
    const sheet = out.addPage([lay.sheetW, lay.sheetH])
    for (let j = 0; j < per && i + j < embedded.length; j++) {
      const ep = embedded[i + j]
      const fit = fitInto(ep.width, ep.height, cellBox(j, lay, margin, gap))
      sheet.drawPage(ep, { x: fit.x, y: fit.y, width: fit.w, height: fit.h })
    }
  }
  return await out.save()
}

/** 圖片轉 PDF:每張一頁。fit = 頁面同圖片大小;a4 = A4 並置中縮放 */
export async function imagesToPdf(
  images: ImageInput[],
  pageSize: PageSize,
): Promise<Uint8Array> {
  const out = await PDFDocument.create()
  const A4 = { w: 595.28, h: 841.89 } // A4 直式 (pt)
  for (const im of images) {
    const embedded = im.type.includes('png')
      ? await out.embedPng(im.bytes)
      : await out.embedJpg(im.bytes)
    if (pageSize === 'a4') {
      const page = out.addPage([A4.w, A4.h])
      const margin = 28
      const maxW = A4.w - margin * 2
      const maxH = A4.h - margin * 2
      const scale = Math.min(maxW / im.width, maxH / im.height, 1)
      const w = im.width * scale
      const h = im.height * scale
      page.drawImage(embedded, {
        x: (A4.w - w) / 2,
        y: (A4.h - h) / 2,
        width: w,
        height: h,
      })
    } else {
      const page = out.addPage([im.width, im.height])
      page.drawImage(embedded, { x: 0, y: 0, width: im.width, height: im.height })
    }
  }
  return await out.save()
}

export interface PdfWatermarkOpts {
  text: string
  colorRGB: string // 例:'220,38,38'
  opacity: number // 0..1
  angleDeg: number
  density: 'sparse' | 'normal' | 'dense'
  sizePct: number // 字級 = 頁面短邊像素 * sizePct / 100
}

const wmGapFactor: Record<string, number> = { sparse: 2.4, normal: 1.5, dense: 0.9 }

// 把斜向重複的浮水印文字畫到透明畫布上,輸出 PNG bytes。
// 用 canvas 畫文字才能支援中文(pdf-lib 內建字型不含 CJK);其餘區域透明,蓋上去不會擋住內容。
async function renderWatermarkPng(wpt: number, hpt: number, o: PdfWatermarkOpts): Promise<Uint8Array> {
  // 以約 2 倍點數的解析度渲染求清晰,並把最長邊上限壓在 2200px 控制記憶體
  const scale = Math.min(2, 2200 / Math.max(wpt, hpt))
  const w = Math.max(1, Math.round(wpt * scale))
  const h = Math.max(1, Math.round(hpt * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const fontPx = Math.max(12, Math.round(Math.min(w, h) * (o.sizePct / 100)))
  ctx.font = `bold ${fontPx}px "Noto Sans TC", "Microsoft JhengHei", sans-serif`
  ctx.fillStyle = `rgba(${o.colorRGB},${o.opacity})`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const gap = wmGapFactor[o.density]
  const textW = ctx.measureText(o.text).width
  const stepX = (textW + fontPx) * gap
  const stepY = fontPx * 2 * gap
  const diag = Math.sqrt(w * w + h * h)
  ctx.translate(w / 2, h / 2)
  ctx.rotate((o.angleDeg * Math.PI) / 180)
  for (let y = -diag; y <= diag; y += stepY) {
    for (let x = -diag; x <= diag; x += stepX) {
      ctx.fillText(o.text, x, y)
    }
  }
  const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), 'image/png'))
  return new Uint8Array(await blob.arrayBuffer())
}

/**
 * 在 PDF 每一頁斜向重複加註浮水印(例:僅供○○使用),防止證件/合約影本被冒用。
 * 浮水印以 canvas 畫成 PNG 後蓋到頁面,支援中文;相同尺寸的頁面共用同一張嵌入圖以節省檔案大小。
 */
export async function watermarkPdf(buffer: ArrayBuffer, o: PdfWatermarkOpts): Promise<Uint8Array> {
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true })
  const text = o.text.trim()
  if (!text) return await doc.save()
  const cache = new Map<string, PDFImage>()
  for (const page of doc.getPages()) {
    const { width: wpt, height: hpt } = page.getSize()
    const key = `${Math.round(wpt)}x${Math.round(hpt)}`
    let img = cache.get(key)
    if (!img) {
      const png = await renderWatermarkPng(wpt, hpt, { ...o, text })
      img = await doc.embedPng(png)
      cache.set(key, img)
    }
    page.drawImage(img, { x: 0, y: 0, width: wpt, height: hpt })
  }
  return await doc.save()
}

export interface PageNumberOpts {
  template: string // 含 {n}(頁碼)與 {total}(總頁數)兩種代號
  position:
    | 'bottom-center'
    | 'bottom-left'
    | 'bottom-right'
    | 'top-center'
    | 'top-left'
    | 'top-right'
  startAt: number // 起始頁碼(預設 1)
  skipFirst: boolean // 第一頁不標(封面常見)
  sizePct: number // 字級 = 頁面短邊像素 * sizePct / 100
  colorRGB: string // 例:'55,65,81'
  marginPt: number // 與頁緣距離(pt)
}

// 把一段頁碼文字畫成「貼齊文字範圍」的透明 PNG,回傳 bytes 與邏輯尺寸(pt)。
// 用 canvas 畫才能支援中文(pdf-lib 內建字型不含 CJK);周圍透明,蓋上去不會擋住內容。
async function renderLabelPng(
  text: string,
  fontPx: number,
  colorRGB: string,
): Promise<{ bytes: Uint8Array; wpt: number; hpt: number }> {
  const scale = 2 // 2 倍解析度求清晰,放回頁面時除回去
  const px = Math.max(1, Math.round(fontPx * scale))
  const measure = document.createElement('canvas').getContext('2d')!
  const font = `bold ${px}px "Noto Sans TC", "Microsoft JhengHei", sans-serif`
  measure.font = font
  const tw = Math.ceil(measure.measureText(text).width)
  const padX = Math.ceil(px * 0.25)
  const cw = Math.max(1, tw + padX * 2)
  const ch = Math.max(1, Math.ceil(px * 1.35))
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')!
  ctx.font = font
  ctx.fillStyle = `rgb(${colorRGB})`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, cw / 2, ch / 2)
  const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), 'image/png'))
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    wpt: cw / scale,
    hpt: ch / scale,
  }
}

/**
 * 在 PDF 每頁加上頁碼(第 X 頁、X / Y 等),交付合約/報告前自動編號,免上傳機密文件。
 * 頁碼以 canvas 畫成 PNG 後蓋到頁面指定角落,支援中文。{total} = 最後一頁印出的號碼。
 */
export async function addPageNumbers(
  buffer: ArrayBuffer,
  o: PageNumberOpts,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true })
  const pages = doc.getPages()
  const total = pages.length
  // 會被標號的頁數:略過封面則少一頁
  const numbered = o.skipFirst ? Math.max(0, total - 1) : total
  if (numbered === 0) return await doc.save()
  const totalShown = o.startAt + numbered - 1 // 最後一頁印出的號碼
  const cache = new Map<string, { img: PDFImage; wpt: number; hpt: number }>()
  let k = 0 // 第幾個被標號的頁(0-based)
  for (let i = 0; i < total; i++) {
    if (o.skipFirst && i === 0) continue
    const page = pages[i]
    const { width: pw, height: ph } = page.getSize()
    const n = o.startAt + k
    k++
    const label = o.template
      .replace(/\{n\}/g, String(n))
      .replace(/\{total\}/g, String(totalShown))
      .trim()
    if (!label) continue
    const fontPx = Math.max(8, Math.round(Math.min(pw, ph) * (o.sizePct / 100)))
    const key = `${label}|${fontPx}`
    let entry = cache.get(key)
    if (!entry) {
      const r = await renderLabelPng(label, fontPx, o.colorRGB)
      entry = { img: await doc.embedPng(r.bytes), wpt: r.wpt, hpt: r.hpt }
      cache.set(key, entry)
    }
    const m = o.marginPt
    const isTop = o.position.startsWith('top')
    let x: number
    if (o.position.endsWith('left')) x = m
    else if (o.position.endsWith('right')) x = pw - m - entry.wpt
    else x = (pw - entry.wpt) / 2
    const y = isTop ? ph - m - entry.hpt : m
    page.drawImage(entry.img, { x, y, width: entry.wpt, height: entry.hpt })
  }
  return await doc.save()
}

export interface CompressOpts {
  scale: number // 渲染倍率(越小越糊越小檔),約 1.0~1.6
  quality: number // JPEG 品質 0..1
}

/**
 * 壓縮 PDF:把每頁用 pdfjs 渲染成 JPEG 再重組成新 PDF。
 * 對「手機掃描/圖片很多」的 PDF(最常見寄不出去的情況)能大幅縮小;
 * 代價是文字會變成影像、無法再選取/搜尋。維持原頁面尺寸(pt)。
 */
export async function compressPdfViaRaster(
  buffer: ArrayBuffer,
  o: CompressOpts,
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const task = pdfjsLib.getDocument({ data: buffer.slice(0) })
  const doc = await task.promise
  const out = await PDFDocument.create()
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const vp1 = page.getViewport({ scale: 1 }) // 原始頁面尺寸(pt)
    const viewport = page.getViewport({ scale: o.scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.ceil(viewport.width))
    canvas.height = Math.max(1, Math.ceil(viewport.height))
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff' // JPEG 無透明,先鋪白底
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvas, canvasContext: ctx, viewport }).promise
    const blob: Blob = await new Promise((res) =>
      canvas.toBlob((b) => res(b!), 'image/jpeg', o.quality),
    )
    const jpg = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()))
    const p = out.addPage([vp1.width, vp1.height])
    p.drawImage(jpg, { x: 0, y: 0, width: vp1.width, height: vp1.height })
    onProgress?.(i, doc.numPages)
  }
  await task.destroy()
  return await out.save()
}

export interface StampSpec {
  imageBytes: ArrayBuffer
  imageType: string // 'image/png' | 'image/jpeg'
  pages: number[] // 要蓋章的頁(0-based)
  box: Box // 畫面座標的圖章框(左上原點,佔頁比例)
  imgAspect: number // 圖高 / 圖寬,維持原比例
}

/**
 * 把一張簽名/印章圖片蓋到 PDF 指定頁面上,全程在瀏覽器處理、不上傳。
 * 位置以畫面座標(左上原點、佔頁比例)表示,經 imagePlacement 轉成 pdf-lib 繪圖座標。
 * 注意:pdf-lib 在頁面 MediaBox(未套 /Rotate)座標系作圖,旋轉過的頁面位置會偏;
 * 旋轉頁建議先用「整理頁面」轉正(UI 已提示)。
 */
export async function stampImageOnPdf(buffer: ArrayBuffer, spec: StampSpec): Promise<Uint8Array> {
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true })
  const img = spec.imageType.includes('png')
    ? await doc.embedPng(spec.imageBytes)
    : await doc.embedJpg(spec.imageBytes)
  const pages = doc.getPages()
  for (const idx of spec.pages) {
    const page = pages[idx]
    if (!page) continue
    const { width, height } = page.getSize()
    const r = imagePlacement(width, height, spec.box, spec.imgAspect)
    page.drawImage(img, { x: r.x, y: r.y, width: r.width, height: r.height })
  }
  return await doc.save()
}

/** 讀每頁的旋轉角度(0/90/180/270),供 UI 提醒旋轉頁蓋章會偏移 */
export async function getPageRotations(buffer: ArrayBuffer): Promise<number[]> {
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true })
  return doc.getPages().map((p) => (((p.getRotation().angle % 360) + 360) % 360))
}

export interface RenderedPage {
  index: number // 0-based
  dataUrl: string // 縮圖
  width: number
  height: number
}

/** 用 pdfjs 渲染每頁成縮圖(給整理頁面預覽用) */
export async function renderThumbnails(
  buffer: ArrayBuffer,
  maxEdge = 220,
): Promise<RenderedPage[]> {
  const task = pdfjsLib.getDocument({ data: buffer.slice(0) })
  const doc = await task.promise
  const out: RenderedPage[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const vp1 = page.getViewport({ scale: 1 })
    const scale = maxEdge / Math.max(vp1.width, vp1.height)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const ctx = canvas.getContext('2d')!
    await page.render({ canvas, canvasContext: ctx, viewport }).promise
    out.push({
      index: i - 1,
      dataUrl: canvas.toDataURL('image/jpeg', 0.7),
      width: vp1.width,
      height: vp1.height,
    })
  }
  await task.destroy()
  return out
}

/** 用 pdfjs 把每頁渲染成圖片 Blob(高解析度,給 PDF 轉圖片用) */
export async function pdfToImageBlobs(
  buffer: ArrayBuffer,
  format: 'image/png' | 'image/jpeg',
  scale: number,
  onProgress?: (done: number, total: number) => void,
): Promise<Blob[]> {
  const task = pdfjsLib.getDocument({ data: buffer.slice(0) })
  const doc = await task.promise
  const blobs: Blob[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const ctx = canvas.getContext('2d')!
    if (format === 'image/jpeg') {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    await page.render({ canvas, canvasContext: ctx, viewport }).promise
    const blob: Blob = await new Promise((res) =>
      canvas.toBlob((b) => res(b!), format, 0.92),
    )
    blobs.push(blob)
    onProgress?.(i, doc.numPages)
  }
  await task.destroy()
  return blobs
}

export interface PageText {
  page: number // 1-based
  text: string
}

/**
 * 用 pdfjs 抽出 PDF 每頁「可選取的文字」(非掃描影像才有)。
 * 依 pdfjs 標記的換行(hasEOL)還原斷行;掃描成圖的 PDF 會抽不到字。
 */
export async function extractPdfText(
  buffer: ArrayBuffer,
  onProgress?: (done: number, total: number) => void,
): Promise<PageText[]> {
  const task = pdfjsLib.getDocument({ data: buffer.slice(0) })
  const doc = await task.promise
  const out: PageText[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    let text = ''
    for (const item of content.items as Array<{ str?: string; hasEOL?: boolean }>) {
      if (typeof item.str !== 'string') continue
      text += item.str
      if (item.hasEOL) text += '\n'
    }
    // 收斂多餘的連續空行,並去掉每行尾端空白
    text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
    out.push({ page: i, text })
    onProgress?.(i, doc.numPages)
  }
  await task.destroy()
  return out
}

/** 取得圖片像素尺寸 */
export function imageSize(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = reject
    img.src = url
  })
}
