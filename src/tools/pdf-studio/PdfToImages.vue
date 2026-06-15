<script setup lang="ts">
import { ref } from 'vue'
import { pdfToImageBlobs, fmtSize } from './lib'

// PDF 轉圖片 —— 每頁渲染成 PNG/JPG,可單張或全部下載
interface Out {
  page: number
  url: string
  size: number
  name: string
}
const fileBase = ref('')
let buffer: ArrayBuffer | null = null
const format = ref<'image/png' | 'image/jpeg'>('image/png')
const scale = ref(2) // 解析度倍率(2 ≈ 144dpi)
const results = ref<Out[]>([])
const busy = ref(false)
const error = ref('')
const progress = ref('')

function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  error.value = ''
  clearResults()
  fileBase.value = f.name.replace(/\.pdf$/i, '')
  f.arrayBuffer().then((b) => (buffer = b))
}

function clearResults() {
  for (const r of results.value) URL.revokeObjectURL(r.url)
  results.value = []
}

async function run() {
  if (!buffer) return
  busy.value = true
  error.value = ''
  clearResults()
  const ext = format.value === 'image/png' ? 'png' : 'jpg'
  try {
    const blobs = await pdfToImageBlobs(buffer, format.value, scale.value, (d, t) => {
      progress.value = `渲染中… ${d}/${t} 頁`
    })
    results.value = blobs.map((b, i) => ({
      page: i + 1,
      url: URL.createObjectURL(b),
      size: b.size,
      name: `${fileBase.value}_第${i + 1}頁.${ext}`,
    }))
  } catch (e) {
    error.value = '轉換失敗,可能是受密碼保護的 PDF:' + (e as Error).message
  } finally {
    busy.value = false
    progress.value = ''
  }
}

function downloadAll() {
  // 逐張用 a[download] 觸發(已有 object URL,免重複渲染);間隔避免被瀏覽器擋
  results.value.forEach((r, i) => {
    setTimeout(() => downloadViaAnchor(r.url, r.name), i * 150)
  })
}
function downloadViaAnchor(url: string, name: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="field-label">選擇一個 PDF</label>
      <input type="file" accept="application/pdf" class="field-input" @change="onFile" />
      <p class="field-hint">每頁會渲染成一張圖片。檔案只在你的瀏覽器處理,不會上傳。</p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <div>
        <label class="field-label">圖片格式</label>
        <select v-model="format" class="field-input">
          <option value="image/png">PNG(清晰、無損,檔較大)</option>
          <option value="image/jpeg">JPG(檔小,適合相片型內容)</option>
        </select>
      </div>
      <div>
        <label class="field-label">解析度:{{ scale }}×</label>
        <input v-model.number="scale" type="range" min="1" max="4" step="0.5" class="w-full accent-brand-600" />
        <p class="field-hint">越高越清晰,檔也越大(2× 約適合螢幕,3×+ 適合列印)。</p>
      </div>
    </div>

    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

    <div class="flex flex-wrap gap-3">
      <button class="btn-primary" :disabled="!buffer || busy" @click="run">
        {{ busy ? progress || '轉換中…' : '開始轉換' }}
      </button>
      <button v-if="results.length" class="inline-flex items-center rounded-xl border border-line bg-white px-5 py-3 font-medium text-ink-700 hover:bg-stone-50" @click="downloadAll">
        下載全部({{ results.length }} 張)
      </button>
    </div>

    <div v-if="results.length" class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      <div v-for="r in results" :key="r.page" class="rounded-xl border border-line bg-white p-2">
        <img :src="r.url" alt="" class="mx-auto max-h-44 w-auto" />
        <div class="mt-1 flex items-center justify-between text-xs text-ink-500">
          <span>第 {{ r.page }} 頁 · {{ fmtSize(r.size) }}</span>
          <a :href="r.url" :download="r.name" class="text-brand-700 underline">下載</a>
        </div>
      </div>
    </div>
  </div>
</template>
