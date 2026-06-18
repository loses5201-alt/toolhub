/*
  批次 QR Code 引擎 —— 把一份清單(每行一筆)整理成多筆 QR 的「內容 + 標籤 + 檔名」,
  並算出「列印標籤頁」的版面格子。

  這裡只放與環境無關的純資料/版面運算,方便用 Node 跑回歸測試;
  實際呼叫 qrcode 產圖、打包 ZIP、產生 PDF 那段留在 .vue 元件。
*/

export interface QrEntry {
  /** 要編碼進 QR 的內容 */
  content: string
  /** 顯示/檔名用的標籤(可空,空時以內容代替) */
  label: string
}

/**
 * 解析多行輸入。每行一筆,去頭尾空白、略過空行。
 * hasLabel=true 時:以第一個 Tab 或逗號分隔,前段為標籤、後段為內容
 * (找不到分隔時整行當內容、標籤留空)。
 */
export function parseEntries(text: string, hasLabel: boolean): QrEntry[] {
  const out: QrEntry[] = []
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    if (hasLabel) {
      const m = line.match(/^([^\t,]*)[\t,](.*)$/)
      if (m) {
        const label = m[1].trim()
        const content = m[2].trim()
        if (content) out.push({ content, label })
        else if (label) out.push({ content: label, label: '' })
        continue
      }
    }
    out.push({ content: line, label: '' })
  }
  return out
}

/**
 * 把標籤/內容轉成安全檔名(不含副檔名)。去掉路徑與多餘空白、夾長度。
 * 同名去重交給 zipStudio.buildZip 處理,這裡只負責單筆乾淨。
 */
export function safeName(s: string, fallback = 'qr'): string {
  let name = String(s)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '_') // 路徑非法字元
    .replace(/ /g, '_')
    .replace(/_+/g, '_') // 收斂連續底線
    .replace(/^[._]+|[._]+$/g, '') // 去前後的點與底線
  if (name.length > 60) name = name.slice(0, 60).replace(/[._]+$/g, '')
  return name || fallback
}

export interface SheetCell {
  /** 第幾頁(0 起) */
  page: number
  /** 格子左上角 X(以左上為原點的座標系,單位同 pageW) */
  x: number
  /** 格子左上角 Y(以左上為原點) */
  y: number
  /** 格子寬高 */
  w: number
  h: number
}

export interface SheetOptions {
  cols: number
  rows: number
  pageW: number
  pageH: number
  margin: number
  /** 格子之間的間距 */
  gap: number
}

/**
 * 規劃列印標籤頁:把 total 個 QR 依 cols×rows 排到一頁頁的格子中。
 * 回傳每一筆對應的格子(左上原點座標,呼叫端再換算成 PDF 左下原點)。
 */
export function planSheet(total: number, opts: SheetOptions): SheetCell[] {
  const { cols, rows, pageW, pageH, margin, gap } = opts
  if (cols < 1 || rows < 1) throw new Error('每頁欄數與列數需為正整數')
  if (pageW <= 0 || pageH <= 0) throw new Error('頁面尺寸不正確')
  const usableW = pageW - 2 * margin - (cols - 1) * gap
  const usableH = pageH - 2 * margin - (rows - 1) * gap
  if (usableW <= 0 || usableH <= 0) throw new Error('邊界或間距過大,放不下格子')
  const w = usableW / cols
  const h = usableH / rows
  const perPage = cols * rows
  const cells: SheetCell[] = []
  const n = Math.max(0, Math.floor(total))
  for (let i = 0; i < n; i++) {
    const page = Math.floor(i / perPage)
    const idx = i % perPage
    const row = Math.floor(idx / cols)
    const col = idx % cols
    cells.push({
      page,
      x: margin + col * (w + gap),
      y: margin + row * (h + gap),
      w,
      h,
    })
  }
  return cells
}
