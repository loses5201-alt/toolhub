<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { applyScan, type ScanMode } from '@/features/docScan'

/*
  文件掃描美化 —— 把「用手機拍的文件照片」處理成像掃描機掃出來的乾淨檔。
  自動拉對比、提亮背景、可轉灰階或黑白(自適應門檻),再匯出乾淨圖片或合併成 PDF。
  全程在瀏覽器用 Canvas + 純像素演算法處理,文件不上傳。像素運算在 src/features/docScan.ts(可測)。
*/
interface Page {
  id: number
  name: string
  width: number
  height: number
  imageData: ImageData // 已(必要時)縮圖過的原始像素,反覆套用設定用
}

const MAX_DIM = 2200 // 過大照片先等比縮到此邊長,兼顧品質與記憶體

const pages = ref<Page[]>([])
const selectedId = ref<number | null>(null)
const mode = ref<ScanMode>('bw')
const strength = ref(50)
const busy = ref(false)
const error = ref('')
let nextId = 1

const previewCanvas = ref<HTMLCanvasElement | null>(null)
const selected = computed(() => pages.value.find((p) => p.id === selectedId.value) ?? null)

const modes: { value: ScanMode; label: string; hint: string }[] = [
  { value: 'bw', label: '黑白(最像掃描)', hint: '字變純黑、紙變純白,檔案最小,適合純文字文件' },
  { value: 'gray', label: '灰階', hint: '去除顏色雜訊、拉高對比,適合有淡淡底色的文件' },
  { value: 'color', label: '彩色增強', hint: '保留印章/螢光筆顏色,只提亮背景、加強對比' },
]

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('無法讀取此圖片'))
    img.src = url
  })
}

async function onFiles(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files ?? [])
  ;(e.target as HTMLInputElement).value = ''
  if (!files.length) return
  busy.value = true
  error.value = ''
  try {
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue
      const url = URL.createObjectURL(f)
      try {
        const img = await loadImage(url)
        const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight))
        const w = Math.max(1, Math.round(img.naturalWidth * scale))
        const h = Math.max(1, Math.round(img.naturalHeight * scale))
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const ctx = c.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)
        pages.value.push({
          id: nextId++,
          name: f.name.replace(/\.[^.]+$/, ''),
          width: w,
          height: h,
          imageData: ctx.getImageData(0, 0, w, h),
        })
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    if (selectedId.value == null && pages.value.length) selectedId.value = pages.value[0].id
  } catch (err) {
    error.value = '讀取失敗:' + (err as Error).message
  } finally {
    busy.value = false
  }
}

// 把某頁依目前設定處理,把結果畫進指定 canvas
function renderTo(page: Page, canvas: HTMLCanvasElement) {
  canvas.width = page.width
  canvas.height = page.height
  const out = applyScan(
    { data: page.imageData.data, width: page.width, height: page.height },
    { mode: mode.value, strength: strength.value },
  )
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(page.width, page.height)
  img.data.set(out)
  ctx.putImageData(img, 0, 0)
}

function refreshPreview() {
  const page = selected.value
  if (page && previewCanvas.value) renderTo(page, previewCanvas.value)
}

watch([selected, mode, strength], () => {
  void nextTick(refreshPreview)
})

function move(idx: number, dir: -1 | 1) {
  const j = idx + dir
  if (j < 0 || j >= pages.value.length) return
  const arr = pages.value
  ;[arr[idx], arr[j]] = [arr[j], arr[idx]]
}
function remove(id: number) {
  pages.value = pages.value.filter((p) => p.id !== id)
  if (selectedId.value === id) selectedId.value = pages.value[0]?.id ?? null
}
function clearAll() {
  pages.value = []
  selectedId.value = null
  error.value = ''
}

function processedBlob(page: Page, type = 'image/jpeg', quality = 0.92): Promise<Blob> {
  const c = document.createElement('canvas')
  renderTo(page, c)
  return new Promise((res, rej) =>
    c.toBlob((b) => (b ? res(b) : rej(new Error('輸出失敗'))), type, quality),
  )
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

async function downloadImages() {
  if (!pages.value.length || busy.value) return
  busy.value = true
  error.value = ''
  try {
    for (const p of pages.value) {
      const blob = await processedBlob(p)
      triggerDownload(blob, `${p.name || '文件'}_掃描.jpg`)
    }
  } catch (e) {
    error.value = '下載失敗:' + (e as Error).message
  } finally {
    busy.value = false
  }
}

async function downloadPdf() {
  if (!pages.value.length || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const { PDFDocument } = await import('pdf-lib')
    const pdf = await PDFDocument.create()
    for (const p of pages.value) {
      const blob = await processedBlob(p)
      const bytes = new Uint8Array(await blob.arrayBuffer())
      const jpg = await pdf.embedJpg(bytes)
      const page = pdf.addPage([p.width, p.height])
      page.drawImage(jpg, { x: 0, y: 0, width: p.width, height: p.height })
    }
    const out = await pdf.save()
    triggerDownload(new Blob([out as BlobPart], { type: 'application/pdf' }), '掃描文件.pdf')
  } catch (e) {
    error.value = 'PDF 製作失敗:' + (e as Error).message
  } finally {
    busy.value = false
  }
}

onUnmounted(clearAll)
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
      <div>
        <label class="field-label">選擇文件照片(可多選,做成多頁)</label>
        <input type="file" accept="image/*" multiple class="field-input" @change="onFiles" />
        <p class="field-hint">
          拍合約、單據、筆記、白板,照片只在你的瀏覽器處理、不會上傳。每張照片是一頁,可調整順序。
        </p>
      </div>

      <template v-if="pages.length">
        <div class="space-y-3">
          <div>
            <span class="field-label">處理方式</span>
            <div class="grid gap-2 sm:grid-cols-3">
              <button
                v-for="m in modes"
                :key="m.value"
                type="button"
                class="rounded-xl border px-3 py-2 text-left text-sm transition"
                :class="
                  mode === m.value
                    ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-300'
                    : 'border-line bg-white hover:border-brand-300'
                "
                @click="mode = m.value"
              >
                <span class="block font-medium text-ink-800">{{ m.label }}</span>
                <span class="mt-0.5 block text-xs leading-snug text-ink-500">{{ m.hint }}</span>
              </button>
            </div>
          </div>

          <label class="flex items-center gap-3 text-sm">
            <span class="text-ink-600 whitespace-nowrap">強度 {{ strength }}</span>
            <input
              v-model.number="strength"
              type="range"
              min="0"
              max="100"
              class="w-full accent-brand-600"
            />
          </label>
          <p class="text-xs text-ink-500">
            {{
              mode === 'bw'
                ? '強度愈高,字筆畫愈粗;若雜點太多可調低。'
                : '強度愈高,背景被提得愈白、對比愈強。'
            }}
          </p>
        </div>

        <div v-if="selected" class="space-y-2">
          <p class="text-sm text-ink-500">
            預覽:<strong class="text-ink-700">{{ selected.name || '文件' }}</strong>
            ({{ selected.width }}×{{ selected.height }})
          </p>
          <div class="overflow-auto rounded-xl border border-line bg-ink-50 p-2">
            <canvas ref="previewCanvas" class="mx-auto block max-w-full"></canvas>
          </div>
        </div>

        <div class="space-y-2">
          <span class="field-label">頁面順序({{ pages.length }} 頁)</span>
          <ul class="space-y-1.5">
            <li
              v-for="(p, idx) in pages"
              :key="p.id"
              class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
              :class="
                p.id === selectedId ? 'border-brand-400 bg-brand-50' : 'border-line bg-white'
              "
            >
              <span class="w-6 text-ink-400">{{ idx + 1 }}.</span>
              <button class="flex-1 truncate text-left hover:text-brand-700" @click="selectedId = p.id">
                {{ p.name || '(未命名)' }}
              </button>
              <button
                class="rounded border border-line px-1.5 hover:border-brand-400 disabled:opacity-30"
                :disabled="idx === 0"
                title="上移"
                @click="move(idx, -1)"
              >
                ↑
              </button>
              <button
                class="rounded border border-line px-1.5 hover:border-brand-400 disabled:opacity-30"
                :disabled="idx === pages.length - 1"
                title="下移"
                @click="move(idx, 1)"
              >
                ↓
              </button>
              <button class="text-ink-400 hover:text-red-500" title="移除" @click="remove(p.id)">
                ✕
              </button>
            </li>
          </ul>
        </div>

        <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

        <div class="flex flex-wrap items-center gap-3">
          <button class="btn-primary !py-2 text-sm" :disabled="busy" @click="downloadPdf">
            {{ busy ? '處理中…' : '合併成 PDF 下載' }}
          </button>
          <button
            class="rounded-lg border border-line bg-white px-3 py-2 text-sm hover:border-brand-400 disabled:opacity-40"
            :disabled="busy"
            @click="downloadImages"
          >
            各頁下載成圖片(JPG)
          </button>
          <button
            class="text-ink-400 underline text-sm hover:text-red-500 disabled:opacity-40"
            :disabled="busy"
            @click="clearAll"
          >
            清空重來
          </button>
        </div>
      </template>
    </div>

    <LegalNote title="為什麼用這個,而不是手機掃描 App 或免費掃描網站?">
      <ul class="list-disc pl-5 space-y-1">
        <li>
          <strong>不上傳</strong>:合約、單據、證件這類私密文件全程留在你的裝置,不送到陌生伺服器。
        </li>
        <li>
          熱門掃描 App(如 CamScanner)<strong>要付費訂閱、會在輸出加浮水印或夾廣告</strong>;這支完全免費、無浮水印、免註冊。
        </li>
        <li>
          黑白模式用<strong>自適應門檻</strong>處理不均勻光線,把字變清楚、檔案變很小,適合 email/上傳。
        </li>
        <li>需要進一步刪頁、加浮水印、加頁碼,可接著用「PDF 工坊」。</li>
      </ul>
    </LegalNote>
  </div>
</template>
