<script setup lang="ts">
import { ref } from 'vue'
import { imagesToPdf, imageSize, downloadBlob, type PageSize, type ImageInput } from './lib'

// 圖片轉 PDF —— 多張圖合成一份 PDF,每張一頁,可排序
interface Item {
  id: number
  file: File
  url: string
}
const items = ref<Item[]>([])
const pageSize = ref<PageSize>('a4')
const busy = ref(false)
const error = ref('')
let uid = 0

function onFiles(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (!files) return
  for (const f of Array.from(files)) {
    if (!f.type.startsWith('image/')) continue
    items.value.push({ id: ++uid, file: f, url: URL.createObjectURL(f) })
  }
  ;(e.target as HTMLInputElement).value = ''
}

function move(i: number, dir: -1 | 1) {
  const j = i + dir
  if (j < 0 || j >= items.value.length) return
  const arr = items.value
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
}
function remove(id: number) {
  const it = items.value.find((x) => x.id === id)
  if (it) URL.revokeObjectURL(it.url)
  items.value = items.value.filter((x) => x.id !== id)
}

async function run() {
  if (!items.value.length) return
  busy.value = true
  error.value = ''
  try {
    const inputs: ImageInput[] = []
    for (const it of items.value) {
      const { w, h } = await imageSize(it.url)
      const isPng = it.file.type.includes('png')
      // pdf-lib 只能嵌入 JPG/PNG;其他格式(webp/gif…)先用 canvas 轉 PNG
      if (isPng || it.file.type.includes('jpeg') || it.file.type.includes('jpg')) {
        inputs.push({ bytes: await it.file.arrayBuffer(), type: it.file.type, width: w, height: h })
      } else {
        const bytes = await toPngBytes(it.url, w, h)
        inputs.push({ bytes, type: 'image/png', width: w, height: h })
      }
    }
    const pdf = await imagesToPdf(inputs, pageSize.value)
    downloadBlob(new Blob([pdf as BlobPart], { type: 'application/pdf' }), '圖片轉檔.pdf')
  } catch (e) {
    error.value = '轉換失敗:' + (e as Error).message
  } finally {
    busy.value = false
  }
}

function toPngBytes(url: string, w: number, h: number): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      c.getContext('2d')!.drawImage(img, 0, 0)
      c.toBlob((b) => (b ? b.arrayBuffer().then(resolve) : reject(new Error('轉檔失敗'))), 'image/png')
    }
    img.onerror = reject
    img.src = url
  })
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="field-label">選擇圖片(可多選;JPG/PNG/WebP 等)</label>
      <input type="file" accept="image/*" multiple class="field-input" @change="onFiles" />
      <p class="field-hint">每張圖會變成 PDF 的一頁,順序 = 下方由上到下。檔案不會上傳。</p>
    </div>

    <div>
      <label class="field-label">頁面大小</label>
      <select v-model="pageSize" class="field-input">
        <option value="a4">A4 直式(置中縮放,適合列印)</option>
        <option value="fit">符合圖片(每頁大小 = 圖片原始尺寸)</option>
      </select>
    </div>

    <ul v-if="items.length" class="space-y-2">
      <li v-for="(it, i) in items" :key="it.id" class="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2">
        <span class="font-mono text-sm text-ink-400 w-6 shrink-0">{{ i + 1 }}.</span>
        <img :src="it.url" alt="" class="h-12 w-12 shrink-0 rounded object-cover" />
        <span class="min-w-0 flex-1 truncate text-ink-800">{{ it.file.name }}</span>
        <button class="shrink-0 px-1.5 text-ink-400 hover:text-brand-700 disabled:opacity-30" :disabled="i === 0" aria-label="上移" @click="move(i, -1)">▲</button>
        <button class="shrink-0 px-1.5 text-ink-400 hover:text-brand-700 disabled:opacity-30" :disabled="i === items.length - 1" aria-label="下移" @click="move(i, 1)">▼</button>
        <button class="shrink-0 px-1.5 text-ink-400 hover:text-red-500" aria-label="移除" @click="remove(it.id)">✕</button>
      </li>
    </ul>

    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

    <button class="btn-primary w-full sm:w-auto" :disabled="!items.length || busy" @click="run">
      {{ busy ? '轉換中…' : items.length ? `把 ${items.length} 張圖轉成 PDF` : '請先選圖片' }}
    </button>
  </div>
</template>
