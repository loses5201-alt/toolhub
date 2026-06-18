<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  renderThumbnails,
  stampImageOnPdf,
  getPageRotations,
  downloadBlob,
  fmtSize,
  type RenderedPage,
} from './lib'
import { clampBox, centerBox, type Box } from './signLayout'

/*
  PDF 簽名 / 蓋章 —— 把簽名檔或印章圖片直接蓋到 PDF 頁面上,在頁面預覽圖上拖曳定位、調整大小,
  可只蓋某一頁或每頁都蓋,全程在你瀏覽器處理、不上傳機密合約。
  搭配本站「手寫簽名製作」做出透明背景簽名 PNG,流程完全不離開瀏覽器。
*/
const file = ref<File | null>(null)
const buffer = ref<ArrayBuffer | null>(null)
const pages = ref<RenderedPage[]>([])
const rotations = ref<number[]>([])
const cur = ref(0)
const loading = ref(false)
const busy = ref(false)
const error = ref('')

// 圖章圖片(簽名/印章)
const stampUrl = ref('')
const stampBytes = ref<ArrayBuffer | null>(null)
const stampType = ref('')
const stampAspect = ref(1) // 圖高 / 圖寬

const box = ref<Box>({ nx: 0.35, ny: 0.7, nw: 0.3 })
const allPages = ref(false)

const previewEl = ref<HTMLElement | null>(null)

const curPage = computed(() => pages.value[cur.value])
const hasRotated = computed(() => rotations.value.some((r) => r !== 0))

async function onPdf(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!f || !(f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))) return
  loading.value = true
  error.value = ''
  pages.value = []
  try {
    const buf = await f.arrayBuffer()
    buffer.value = buf
    file.value = f
    rotations.value = await getPageRotations(buf.slice(0))
    pages.value = await renderThumbnails(buf.slice(0), 1100)
    cur.value = 0
  } catch (err) {
    error.value = '讀取失敗,可能檔案損毀或受密碼保護:' + (err as Error).message
  } finally {
    loading.value = false
  }
}

function onStamp(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!f || !f.type.startsWith('image/')) return
  const url = URL.createObjectURL(f)
  const img = new Image()
  img.onload = async () => {
    stampAspect.value = img.naturalHeight / img.naturalWidth || 1
    stampBytes.value = await f.arrayBuffer()
    stampType.value = f.type
    if (stampUrl.value) URL.revokeObjectURL(stampUrl.value)
    stampUrl.value = url
    // 放到目前頁面正中央
    const p = curPage.value
    if (p) box.value = centerBox(p.width, p.height, 0.3, stampAspect.value)
  }
  img.onerror = () => {
    error.value = '無法讀取這張圖片'
    URL.revokeObjectURL(url)
  }
  img.src = url
}

// 在預覽圖上拖曳圖章定位
let grabDx = 0
let grabDy = 0
function onDown(e: PointerEvent) {
  const el = previewEl.value
  if (!el || !curPage.value) return
  const rect = el.getBoundingClientRect()
  grabDx = (e.clientX - rect.left) / rect.width - box.value.nx
  grabDy = (e.clientY - rect.top) / rect.height - box.value.ny
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  e.preventDefault()
}
function onMove(e: PointerEvent) {
  const el = previewEl.value
  const p = curPage.value
  if (!el || !p) return
  const rect = el.getBoundingClientRect()
  const nx = (e.clientX - rect.left) / rect.width - grabDx
  const ny = (e.clientY - rect.top) / rect.height - grabDy
  box.value = clampBox({ nx, ny, nw: box.value.nw }, p.width, p.height, stampAspect.value)
}
function onUp() {
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
}

function onSize(e: Event) {
  const p = curPage.value
  if (!p) return
  const nw = Number((e.target as HTMLInputElement).value) / 100
  box.value = clampBox({ ...box.value, nw }, p.width, p.height, stampAspect.value)
}

async function run() {
  if (!buffer.value || !stampBytes.value) return
  busy.value = true
  error.value = ''
  try {
    const targets = allPages.value ? pages.value.map((p) => p.index) : [cur.value]
    const bytes = await stampImageOnPdf(buffer.value.slice(0), {
      imageBytes: stampBytes.value.slice(0),
      imageType: stampType.value,
      pages: targets,
      box: box.value,
      imgAspect: stampAspect.value,
    })
    const base = file.value!.name.replace(/\.[^.]+$/, '')
    downloadBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `${base}_已簽署.pdf`)
  } catch (err) {
    error.value = '處理失敗:' + (err as Error).message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="field-label">選擇要簽名 / 蓋章的 PDF</label>
      <input type="file" accept="application/pdf" class="field-input" @change="onPdf" />
      <p class="field-hint">
        <template v-if="file">已選:📄 {{ file.name }}（{{ fmtSize(file.size) }}）</template>
        <template v-else>檔案只在你的瀏覽器處理,不會上傳。沒有簽名檔?可先用本站「手寫簽名製作」做一張透明背景 PNG。</template>
      </p>
    </div>

    <p v-if="loading" class="text-sm text-ink-500">載入並渲染頁面中…</p>
    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

    <div v-if="pages.length" class="space-y-4">
      <div>
        <label class="field-label">簽名 / 印章圖片(PNG 透明背景最佳,JPG 亦可)</label>
        <input type="file" accept="image/*" class="field-input" @change="onStamp" />
      </div>

      <div v-if="stampUrl">
        <label class="field-label">大小:{{ Math.round(box.nw * 100) }}% 頁寬</label>
        <input
          type="range" min="3" max="90" :value="Math.round(box.nw * 100)"
          class="w-full accent-brand-600" @input="onSize"
        />
        <label class="mt-2 flex items-center gap-2 text-sm text-ink-700">
          <input v-model="allPages" type="checkbox" class="accent-brand-600" />
          每一頁都蓋上(適合印章 / 騎縫;簽名通常只蓋最後一頁)
        </label>
      </div>

      <!-- 頁面切換 -->
      <div v-if="pages.length > 1" class="flex flex-wrap items-center gap-2">
        <span class="text-sm text-ink-600">第 {{ cur + 1 }} / {{ pages.length }} 頁</span>
        <button
          class="rounded-lg border border-line bg-white px-3 py-1 text-sm text-ink-700 transition hover:bg-stone-50 disabled:opacity-40"
          :disabled="cur === 0" @click="cur--"
        >← 上一頁</button>
        <button
          class="rounded-lg border border-line bg-white px-3 py-1 text-sm text-ink-700 transition hover:bg-stone-50 disabled:opacity-40"
          :disabled="cur === pages.length - 1" @click="cur++"
        >下一頁 →</button>
      </div>

      <p v-if="hasRotated" class="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
        ⚠️ 偵測到有頁面被旋轉,蓋章位置可能偏移。建議先用「整理頁面」把頁面轉正再回來蓋章。
      </p>

      <!-- 預覽 + 拖曳定位 -->
      <div
        v-if="curPage"
        ref="previewEl"
        class="relative mx-auto w-full max-w-xl select-none overflow-hidden rounded-lg border border-line bg-stone-100"
      >
        <img :src="curPage.dataUrl" alt="PDF 頁面預覽" class="block w-full" draggable="false" />
        <img
          v-if="stampUrl"
          :src="stampUrl"
          alt="簽名 / 印章"
          draggable="false"
          class="absolute cursor-move touch-none ring-1 ring-brand-400/60"
          :style="{ left: box.nx * 100 + '%', top: box.ny * 100 + '%', width: box.nw * 100 + '%' }"
          @pointerdown="onDown"
        />
      </div>
      <p v-if="stampUrl" class="field-hint">在預覽圖上拖曳簽名到要簽的位置,用上方滑桿調整大小。</p>

      <button class="btn-primary w-full sm:w-auto" :disabled="!stampBytes || busy" @click="run">
        {{ busy ? '處理中…' : !stampBytes ? '請先選擇簽名 / 印章圖片' : '蓋上並下載 PDF' }}
      </button>
      <p class="field-hint">提示:圖章直接合進頁面內容,輸出後不是可單獨刪除的圖層。</p>
    </div>
  </div>
</template>
