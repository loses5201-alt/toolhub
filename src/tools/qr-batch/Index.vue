<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseEntries, safeName, planSheet } from '@/features/qrBatch'
import { buildZip, type ZipInputFile } from '@/features/zipStudio'

/*
  批次 QR Code —— 一次把整份清單做成很多個 QR(每行一筆),
  打包成 ZIP 圖片檔,或排成一張可直接列印的 A4 標籤頁(含文字標籤)。
  活動桌號、座位、設備財產編號、商品連結、Menu… 用得到。
  全程在瀏覽器用 qrcode 函式庫產生,不上傳、不轉址、不追蹤。
  解析與版面計算在 src/features/qrBatch.ts(可測)。
*/
const input = ref('')
const hasLabel = ref(false)
const ecLevel = ref<'L' | 'M' | 'Q' | 'H'>('M')
const cols = ref(3)
const rows = ref(4)
const showLabel = ref(true)
const busy = ref(false)
const error = ref('')
const progress = ref('')

const entries = computed(() => parseEntries(input.value, hasLabel.value))
const count = computed(() => entries.value.length)
const perPage = computed(() => cols.value * rows.value)
const pageCount = computed(() => (count.value ? Math.ceil(count.value / perPage.value) : 0))

// A4(直)單位 pt
const A4 = { pageW: 595.28, pageH: 841.89, margin: 36, gap: 12 }

// 產生單一 QR 的 PNG dataURL
async function qrDataUrl(content: string, size: number): Promise<string> {
  const QRCode = (await import('qrcode')).default
  return QRCode.toDataURL(content, {
    errorCorrectionLevel: ecLevel.value,
    width: size,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
  })
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(',')[1]
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function downloadZip() {
  if (!count.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const files: ZipInputFile[] = []
    let i = 0
    for (const e of entries.value) {
      i++
      progress.value = `產生中… ${i}/${count.value}`
      const png = await qrDataUrl(e.content, 512)
      const base = safeName(e.label || e.content, `qr-${i}`)
      files.push({ name: `${base}.png`, data: dataUrlToBytes(png) })
    }
    const zip = await buildZip(files, { level: 0 }) // PNG 已壓縮,用 STORE 最快
    triggerDownload(new Blob([zip as BlobPart], { type: 'application/zip' }), 'QR_批次.zip')
  } catch (e) {
    error.value = '產生失敗:' + (e as Error).message
  } finally {
    busy.value = false
    progress.value = ''
  }
}

async function downloadPdf() {
  if (!count.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const cells = planSheet(count.value, { cols: cols.value, rows: rows.value, ...A4 })
    const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib')
    const pdf = await PDFDocument.create()
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    const pages = [pdf.addPage([A4.pageW, A4.pageH])]
    for (let p = 1; p < pageCount.value; p++) pages.push(pdf.addPage([A4.pageW, A4.pageH]))

    const labelH = showLabel.value ? 14 : 0
    for (let i = 0; i < cells.length; i++) {
      progress.value = `排版中… ${i + 1}/${count.value}`
      const cell = cells[i]
      const e = entries.value[i]
      const qrSide = Math.max(8, Math.min(cell.w, cell.h - labelH) - 8)
      const png = await qrDataUrl(e.content, Math.round(qrSide * 2))
      const img = await pdf.embedPng(dataUrlToBytes(png))
      const page = pages[cell.page]
      // pdf-lib 原點在左下角:把左上座標換算過去
      const qrX = cell.x + (cell.w - qrSide) / 2
      const qrTopY = cell.y + 2
      const qrY = A4.pageH - qrTopY - qrSide
      page.drawImage(img, { x: qrX, y: qrY, width: qrSide, height: qrSide })
      if (showLabel.value && e.label) {
        // 標籤(僅安全 ASCII 用內建字型畫;非 ASCII 會被內建字型擋,故先濾)
        const text = e.label.replace(/[^\x20-\x7e]/g, '')
        if (text) {
          const fontSize = 8
          const tw = font.widthOfTextAtSize(text, fontSize)
          page.drawText(text, {
            x: cell.x + (cell.w - tw) / 2,
            y: A4.pageH - (cell.y + cell.h) + 2,
            size: fontSize,
            font,
            color: rgb(0.1, 0.1, 0.1),
          })
        }
      }
    }
    const out = await pdf.save()
    triggerDownload(
      new Blob([out as BlobPart], { type: 'application/pdf' }),
      'QR_標籤頁.pdf',
    )
  } catch (e) {
    error.value = 'PDF 製作失敗:' + (e as Error).message
  } finally {
    busy.value = false
    progress.value = ''
  }
}

const hasNonAscii = computed(() =>
  showLabel.value && entries.value.some((e) => /[^\x20-\x7e]/.test(e.label)),
)
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
      <div>
        <label class="field-label" for="qrb-input">清單內容(每行一筆)</label>
        <textarea
          id="qrb-input"
          v-model="input"
          rows="7"
          placeholder="https://example.com/1&#10;https://example.com/2&#10;桌號 A1,https://example.com/a1"
          class="field-input font-mono text-sm"
        ></textarea>
        <p class="field-hint">每一行會做成一個 QR Code。內容可以是網址、文字、財產編號等。</p>
      </div>

      <label class="flex items-center gap-2 text-sm text-ink-700">
        <input v-model="hasLabel" type="checkbox" class="accent-brand-600" />
        每行用逗號或 Tab 分成「標籤,內容」(標籤當檔名/列印文字,例:<span class="font-mono">桌號A1,https://…</span>)
      </label>

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label">容錯等級</label>
          <select v-model="ecLevel" class="field-input">
            <option value="L">L —— 最省、圖最簡單</option>
            <option value="M">M —— 一般建議</option>
            <option value="Q">Q —— 較耐髒污/遮擋</option>
            <option value="H">H —— 最耐損</option>
          </select>
        </div>
        <div class="flex items-end">
          <p class="text-sm text-ink-600">
            共 <strong class="text-ink-800">{{ count }}</strong> 筆<span v-if="count">,列印約 {{ pageCount }} 頁</span>
          </p>
        </div>
      </div>

      <div v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</div>
      <div v-else-if="progress" class="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{{ progress }}</div>

      <div class="space-y-4 border-t border-line pt-4">
        <div>
          <p class="field-label">方式一:打包成 ZIP 圖片檔</p>
          <button class="btn-primary !py-2 text-sm" :disabled="!count || busy" @click="downloadZip">
            {{ busy ? '處理中…' : `下載 ${count || ''} 個 QR(ZIP)` }}
          </button>
          <p class="field-hint">每筆一張 512px PNG,檔名取自標籤(或內容)。適合貼到網站、文件、簡報。</p>
        </div>

        <div>
          <p class="field-label">方式二:排成可列印的 A4 標籤頁(PDF)</p>
          <div class="flex flex-wrap items-end gap-4">
            <label class="text-sm">
              <span class="text-ink-600">每頁欄數</span>
              <input v-model.number="cols" type="number" min="1" max="8" class="field-input w-20" />
            </label>
            <label class="text-sm">
              <span class="text-ink-600">每頁列數</span>
              <input v-model.number="rows" type="number" min="1" max="12" class="field-input w-20" />
            </label>
            <label class="flex items-center gap-2 pb-2 text-sm text-ink-700">
              <input v-model="showLabel" type="checkbox" class="accent-brand-600" />在 QR 下方印標籤文字
            </label>
          </div>
          <button class="btn-primary !py-2 text-sm mt-2" :disabled="!count || busy" @click="downloadPdf">
            {{ busy ? '處理中…' : `下載 A4 標籤頁(每頁 ${perPage} 個)` }}
          </button>
          <p v-if="hasNonAscii" class="field-hint text-amber-700">
            注意:列印文字目前僅支援英數;中文標籤在 PDF 上會略過(QR 本身仍可正常編碼中文)。檔名與 ZIP 模式則完整支援中文。
          </p>
        </div>
      </div>
    </div>

    <LegalNote title="什麼時候用得到?為什麼用這個?">
      <ul class="list-disc pl-5 space-y-1">
        <li>活動<strong>桌號/座位</strong>、設備<strong>財產編號</strong>、商品/菜單連結、問卷連結 —— 一次大量產生最省事。</li>
        <li>全程在你瀏覽器產生,<strong>直接編碼原始內容、不轉址、不追蹤</strong>;很多線上產生器會偷換成它的短網址藉此記錄誰掃了你的碼。</li>
        <li>清單(可能含內部連結、財產資料)<strong>不會上傳</strong>到任何伺服器。</li>
        <li>要列印貼標籤,選 A4 標籤頁;要插入網站/文件,選 ZIP 圖片檔。單一張 QR 可用「QR Code 產生器」。</li>
      </ul>
    </LegalNote>
  </div>
</template>
