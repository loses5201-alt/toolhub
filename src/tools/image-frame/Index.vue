<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import JSZip from 'jszip'
import LegalNote from '@/components/LegalNote.vue'
import { computeFrame, type FrameAspect } from '@/features/imageFrame'

/*
  照片加邊框 / 改長寬比 —— 把長方形照片加邊框變成正方形(或 4:5、9:16)以利 IG / 限動上傳不被裁切。
  保留原圖原始像素、不放大失真,可批次處理並打包 ZIP。全程在你的瀏覽器以 canvas 運算,照片不上傳。
*/

const aspect = ref<FrameAspect>('square')
const marginPercent = ref(6)
const bg = ref('#ffffff')
const error = ref('')
const busy = ref(false)

const aspects: { id: FrameAspect; label: string }[] = [
  { id: 'square', label: '正方 1:1' },
  { id: '4:5', label: '直式 4:5' },
  { id: '9:16', label: '限動 9:16' },
  { id: '16:9', label: '橫式 16:9' },
  { id: '3:2', label: '3:2' },
  { id: '2:3', label: '2:3' },
  { id: 'original', label: '原比例(只加框)' },
]

interface Item {
  name: string
  url: string
  w: number
  h: number
  bitmap: ImageBitmap
}
const items = ref<Item[]>([])

async function addFiles(files: FileList | File[]) {
  error.value = ''
  busy.value = true
  try {
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      const bitmap = await createImageBitmap(file)
      items.value.push({
        name: file.name.replace(/\.[^.]+$/, ''),
        url: URL.createObjectURL(file),
        w: bitmap.width,
        h: bitmap.height,
        bitmap,
      })
    }
    if (items.value.length === 0) error.value = '請選擇圖片檔(JPG / PNG / WebP 等)'
  } catch (e) {
    error.value = '讀取失敗:' + (e as Error).message
  } finally {
    busy.value = false
  }
}

function onInput(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) addFiles(input.files)
  input.value = ''
}
function onDrop(e: DragEvent) {
  if (e.dataTransfer?.files) addFiles(e.dataTransfer.files)
}
function removeItem(i: number) {
  URL.revokeObjectURL(items.value[i].url)
  items.value.splice(i, 1)
}
function clearAll() {
  items.value.forEach((it) => URL.revokeObjectURL(it.url))
  items.value = []
}

function renderItem(it: Item): HTMLCanvasElement | null {
  const L = computeFrame({
    srcW: it.w,
    srcH: it.h,
    aspect: aspect.value,
    marginPercent: marginPercent.value,
  })
  const canvas = document.createElement('canvas')
  canvas.width = L.canvasW
  canvas.height = L.canvasH
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = bg.value
  ctx.fillRect(0, 0, L.canvasW, L.canvasH)
  ctx.drawImage(it.bitmap, L.drawX, L.drawY, L.drawW, L.drawH)
  return canvas
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((res) => canvas.toBlob((b) => res(b), 'image/png'))
}

async function downloadOne(it: Item) {
  const canvas = renderItem(it)
  if (!canvas) return
  const blob = await toBlob(canvas)
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${it.name}-framed.png`
  a.click()
  URL.revokeObjectURL(url)
}

async function downloadAll() {
  if (items.value.length === 0) return
  busy.value = true
  try {
    const zip = new JSZip()
    for (const it of items.value) {
      const canvas = renderItem(it)
      if (!canvas) continue
      const blob = await toBlob(canvas)
      if (blob) zip.file(`${it.name}-framed.png`, blob)
    }
    const out = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(out)
    const a = document.createElement('a')
    a.href = url
    a.download = 'framed-images.zip'
    a.click()
    URL.revokeObjectURL(url)
  } finally {
    busy.value = false
  }
}

// 預覽用:第一張的版面尺寸文字
const previewInfo = computed(() => {
  const it = items.value[0]
  if (!it) return ''
  const L = computeFrame({ srcW: it.w, srcH: it.h, aspect: aspect.value, marginPercent: marginPercent.value })
  return `${L.canvasW} × ${L.canvasH} px`
})
</script>

<template>
  <div class="space-y-6">
    <div
      class="card flex flex-col items-center justify-center gap-2 border-2 border-dashed border-ink-200 p-8 text-center"
      @dragover.prevent
      @drop.prevent="onDrop"
    >
      <p class="text-ink-600">把照片拖到這裡,或</p>
      <label class="btn-primary cursor-pointer">
        選擇照片(可多選)
        <input type="file" accept="image/*" multiple class="hidden" @change="onInput" />
      </label>
      <p class="field-hint">照片<strong>不會上傳</strong>,全程在你瀏覽器處理、無浮水印。</p>
    </div>

    <div v-if="error" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
      ⚠️ {{ error }}
    </div>

    <div v-if="items.length" class="card p-6 space-y-4">
      <div>
        <label class="field-label">輸出比例</label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="a in aspects"
            :key="a.id"
            class="rounded-full border px-3 py-1 text-sm"
            :class="aspect === a.id ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600 hover:border-brand-400'"
            @click="aspect = a.id"
          >
            {{ a.label }}
          </button>
        </div>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label">邊框寬度:{{ marginPercent }}%</label>
          <input v-model.number="marginPercent" type="range" min="0" max="40" step="1" class="w-full" />
          <p class="field-hint">以原圖較長邊的百分比計算。第一張輸出尺寸:{{ previewInfo }}</p>
        </div>
        <div>
          <label class="field-label">邊框顏色</label>
          <div class="flex items-center gap-2">
            <input v-model="bg" type="color" class="h-10 w-12 rounded border border-ink-200" />
            <input v-model="bg" class="field-input font-mono" spellcheck="false" />
          </div>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <button class="btn-primary" :disabled="busy" @click="downloadAll">
          {{ busy ? '處理中…' : `下載全部 (ZIP,${items.length} 張)` }}
        </button>
        <button class="btn-secondary" @click="clearAll">清空</button>
      </div>
    </div>

    <div v-if="items.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="(it, i) in items" :key="it.url" class="card overflow-hidden">
        <div
          class="flex aspect-square items-center justify-center p-3"
          :style="{ background: bg }"
        >
          <img :src="it.url" :alt="it.name" class="max-h-full max-w-full object-contain shadow" />
        </div>
        <div class="space-y-2 p-3">
          <p class="truncate text-sm text-ink-700" :title="it.name">{{ it.name }}</p>
          <p class="text-xs text-ink-400">{{ it.w }} × {{ it.h }} px</p>
          <div class="flex gap-2">
            <button class="btn-secondary flex-1" @click="downloadOne(it)">下載</button>
            <button class="rounded-lg border border-ink-200 px-3 text-sm text-ink-500 hover:border-rose-300 hover:text-rose-600" @click="removeItem(i)">移除</button>
          </div>
        </div>
      </div>
    </div>

    <div class="text-sm text-ink-500">
      想<RouterLink to="/tools/image-crop" class="font-semibold text-brand-700 underline hover:text-brand-800">裁切</RouterLink>、
      <RouterLink to="/tools/image-fit-size" class="font-semibold text-brand-700 underline hover:text-brand-800">壓到指定 KB</RouterLink>,或
      <RouterLink to="/tools/image-watermark" class="font-semibold text-brand-700 underline hover:text-brand-800">加浮水印</RouterLink>?
    </div>

    <LegalNote title="說明">
      <ul class="list-disc pl-5 space-y-1">
        <li>常見用途:把長方形照片<strong>加白邊變正方形</strong>,IG 貼文 / 限動上傳時不被裁掉邊角。</li>
        <li>圖片<strong>維持原始像素</strong>置中,不放大、不失真;只在四周補上邊框。</li>
        <li>「原比例」只在四周加等寬邊框、不改外形;其餘比例會補滿較短的一邊。</li>
        <li>全程<strong>在你的瀏覽器</strong>以 canvas 運算,照片不上傳、無廣告、無浮水印、可批次。</li>
      </ul>
    </LegalNote>
  </div>
</template>
