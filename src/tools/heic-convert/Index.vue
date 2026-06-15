<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'

/*
  HEIC/HEIF → JPG/PNG 轉檔 —— iPhone 拍的 .heic 在 Windows、舊版 LINE、
  很多網站都打不開。免費線上轉檔站要你「上傳」這些可能含人臉/定位的私密照片。
  這裡用 heic2any(libheif WASM)在你瀏覽器內解碼,全程不上傳。
  heic2any 體積大(~1.3MB),用動態 import,真的用到才載入。
*/
interface Item {
  id: number
  name: string
  origSize: number
  status: 'pending' | 'done' | 'error'
  msg?: string
  outUrl?: string
  outSize?: number
  outName?: string
  file: File
}

const items = ref<Item[]>([])
const format = ref<'image/jpeg' | 'image/png'>('image/jpeg')
const quality = ref(90)
const maxEdge = ref<number | null>(null) // 最長邊上限(px),留空=原尺寸
const busy = ref(false)
const loadingLib = ref(false)
let uid = 0

const extOf: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png' }

function fmtSize(n: number): string {
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB'
  return (n / 1024 / 1024).toFixed(2) + ' MB'
}

// 用副檔名判斷,因為瀏覽器常常不替 .heic 設定 MIME type
function isHeic(f: File): boolean {
  return /\.(heic|heif)$/i.test(f.name) || /heic|heif/i.test(f.type)
}

function addFiles(files: FileList | File[]) {
  for (const f of Array.from(files)) {
    if (!isHeic(f)) continue
    items.value.push({
      id: ++uid,
      name: f.name,
      origSize: f.size,
      status: 'pending',
      file: f,
    })
  }
}

function onFiles(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) addFiles(input.files)
  input.value = ''
}

const dragOver = ref(false)
function onDrop(e: DragEvent) {
  dragOver.value = false
  if (e.dataTransfer?.files) addFiles(e.dataTransfer.files)
}

function loadBlobImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (err) => {
      URL.revokeObjectURL(url)
      reject(err)
    }
    img.src = url
  })
}

// 若使用者設了最長邊上限,把已解碼的圖再用 canvas 縮放/重新編碼
async function maybeResize(blob: Blob): Promise<Blob> {
  const limit = maxEdge.value ?? 0
  if (limit <= 0) return blob
  const img = await loadBlobImage(blob)
  let { naturalWidth: w, naturalHeight: h } = img
  if (Math.max(w, h) <= limit) return blob
  const r = limit / Math.max(w, h)
  w = Math.round(w * r)
  h = Math.round(h * r)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  if (format.value === 'image/jpeg') {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
  }
  ctx.drawImage(img, 0, 0, w, h)
  return await new Promise<Blob>((res) =>
    canvas.toBlob((b) => res(b!), format.value, quality.value / 100),
  )
}

async function processAll() {
  busy.value = true
  loadingLib.value = true
  let heic2any: typeof import('heic2any').default
  try {
    heic2any = (await import('heic2any')).default
  } catch {
    busy.value = false
    loadingLib.value = false
    items.value.forEach((it) => {
      if (it.status === 'pending') {
        it.status = 'error'
        it.msg = '轉檔元件載入失敗,請檢查網路後重試'
      }
    })
    return
  }
  loadingLib.value = false
  for (const it of items.value) {
    if (it.status === 'done') continue
    try {
      const result = await heic2any({
        blob: it.file,
        toType: format.value,
        quality: quality.value / 100,
      })
      // 含多張影像的 HEIC(Live Photo / burst)會回傳陣列,取第一張
      let blob = Array.isArray(result) ? result[0] : result
      blob = await maybeResize(blob)
      if (it.outUrl) URL.revokeObjectURL(it.outUrl)
      it.outUrl = URL.createObjectURL(blob)
      it.outSize = blob.size
      it.outName = it.name.replace(/\.[^.]+$/, '') + '.' + extOf[format.value]
      it.status = 'done'
      it.msg = undefined
    } catch {
      it.status = 'error'
      it.msg = '這個檔案無法解碼(可能不是有效的 HEIC,或檔案損毀)'
    }
  }
  busy.value = false
}

function remove(id: number) {
  const i = items.value.findIndex((x) => x.id === id)
  if (i >= 0) {
    if (items.value[i].outUrl) URL.revokeObjectURL(items.value[i].outUrl!)
    items.value.splice(i, 1)
  }
}

function clearAll() {
  items.value.forEach((it) => it.outUrl && URL.revokeObjectURL(it.outUrl))
  items.value = []
}

const pendingCount = computed(() => items.value.filter((i) => i.status !== 'done').length)
const doneItems = computed(() => items.value.filter((i) => i.status === 'done'))

function downloadAll() {
  for (const it of doneItems.value) {
    const a = document.createElement('a')
    a.href = it.outUrl!
    a.download = it.outName!
    document.body.appendChild(a)
    a.click()
    a.remove()
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-5">
      <div>
        <label class="field-label">選擇 HEIC / HEIF 照片(可多選)</label>
        <div
          class="rounded-xl border-2 border-dashed p-5 text-center transition-colors"
          :class="dragOver ? 'border-brand-500 bg-brand-50' : 'border-ink-200'"
          @dragover.prevent="dragOver = true"
          @dragleave.prevent="dragOver = false"
          @drop.prevent="onDrop"
        >
          <input
            id="heic-file"
            type="file"
            accept=".heic,.heif,image/heic,image/heif"
            multiple
            class="field-input"
            @change="onFiles"
          />
          <p class="field-hint mt-2">也可以把照片直接拖曳到這個區塊。檔案只在你的瀏覽器處理,不會上傳。</p>
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-3">
        <div>
          <label class="field-label">輸出格式</label>
          <select v-model="format" class="field-input">
            <option value="image/jpeg">JPG(相片通用、檔小)</option>
            <option value="image/png">PNG(無損、保留透明)</option>
          </select>
        </div>
        <div>
          <label class="field-label">品質:{{ quality }}</label>
          <input
            v-model.number="quality"
            type="range"
            min="40"
            max="100"
            class="w-full accent-brand-600"
            :disabled="format === 'image/png'"
          />
          <p class="field-hint">{{ format === 'image/png' ? 'PNG 無損,品質不適用' : '越低檔越小' }}</p>
        </div>
        <div>
          <label class="field-label">最長邊上限(px,選填)</label>
          <input v-model.number="maxEdge" type="number" min="0" placeholder="例:2048,留空=原尺寸" class="field-input" />
        </div>
      </div>

      <div class="flex flex-wrap gap-3">
        <button class="btn-primary" :disabled="!pendingCount || busy" @click="processAll">
          {{ busy ? (loadingLib ? '載入轉檔元件…' : '轉檔中…') : `開始轉檔(${pendingCount} 張)` }}
        </button>
        <button
          v-if="doneItems.length > 1"
          class="inline-flex items-center rounded-xl border border-line bg-white px-5 py-3 font-semibold text-ink-700 transition hover:border-brand-400 hover:text-brand-700 disabled:opacity-40"
          :disabled="busy"
          @click="downloadAll"
        >
          全部下載({{ doneItems.length }})
        </button>
        <button
          v-if="items.length"
          class="inline-flex items-center rounded-xl border border-line bg-white px-5 py-3 font-semibold text-ink-500 transition hover:text-red-500 disabled:opacity-40"
          :disabled="busy"
          @click="clearAll"
        >
          清空
        </button>
      </div>
      <p v-if="loadingLib" class="text-sm text-ink-500">首次轉檔需載入約 1.3MB 的解碼元件,請稍候(之後離線也能用)。</p>
    </div>

    <div v-if="items.length" class="space-y-3">
      <div v-for="it in items" :key="it.id" class="card flex items-center gap-4 p-4">
        <img
          v-if="it.outUrl"
          :src="it.outUrl"
          alt=""
          class="h-16 w-16 shrink-0 rounded-lg object-cover"
        />
        <div
          v-else
          class="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-2xl"
        >
          {{ it.status === 'error' ? '⚠️' : '📷' }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="truncate font-medium text-ink-900">{{ it.outName || it.name }}</div>
          <div class="text-sm text-ink-500">
            {{ fmtSize(it.origSize) }}
            <template v-if="it.outSize != null"> → {{ fmtSize(it.outSize) }}</template>
          </div>
          <div v-if="it.status === 'error'" class="text-sm text-red-600">{{ it.msg }}</div>
        </div>
        <a
          v-if="it.outUrl"
          :href="it.outUrl"
          :download="it.outName"
          class="btn-primary !py-2 text-sm shrink-0"
          >下載</a
        >
        <button class="shrink-0 text-ink-400 hover:text-red-500" aria-label="移除" @click="remove(it.id)">✕</button>
      </div>
    </div>

    <LegalNote title="為什麼 iPhone 照片要轉檔?用這個有什麼好?">
      <ul class="list-disc pl-5 space-y-1">
        <li>iPhone 預設用 <strong>HEIC</strong> 格式拍照,省空間,但 Windows 舊版、部分網站與長輩的手機常常打不開。轉成 JPG 就到處都能看。</li>
        <li><strong>不上傳</strong>:照片(可能含人臉、定位、證件)全程留在你自己的裝置解碼,不送到陌生伺服器。</li>
        <li><strong>無廣告、無浮水印、免註冊、可批次</strong>,免費。</li>
        <li>重新編碼會自動<strong>清除 EXIF(含 GPS 拍攝地點)</strong>,分享更安心。需要進一步壓縮或縮放,可接著用「圖片工坊」。</li>
      </ul>
    </LegalNote>
  </div>
</template>
