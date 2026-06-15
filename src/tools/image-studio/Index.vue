<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'

/*
  圖片工坊 —— 全程在瀏覽器用 Canvas 處理,不上傳任何檔案。
  重新編碼會自然移除 EXIF(含 GPS 定位),是隱私加分。
*/
interface Item {
  id: number
  name: string
  srcUrl: string
  origSize: number
  origW: number
  origH: number
  outUrl?: string
  outSize?: number
  outName?: string
}

const items = ref<Item[]>([])
const format = ref<'image/jpeg' | 'image/png' | 'image/webp'>('image/jpeg')
const quality = ref(85)
const maxEdge = ref<number | null>(null) // 最長邊上限(px),留空=不縮放
const busy = ref(false)
let uid = 0

const extOf: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function fmtSize(n: number): string {
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB'
  return (n / 1024 / 1024).toFixed(2) + ' MB'
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

async function onFiles(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (!files) return
  for (const f of Array.from(files)) {
    if (!f.type.startsWith('image/')) continue
    const url = URL.createObjectURL(f)
    const img = await loadImage(url)
    items.value.push({
      id: ++uid,
      name: f.name,
      srcUrl: url,
      origSize: f.size,
      origW: img.naturalWidth,
      origH: img.naturalHeight,
    })
  }
  ;(e.target as HTMLInputElement).value = ''
}

async function processOne(it: Item) {
  const img = await loadImage(it.srcUrl)
  let { naturalWidth: w, naturalHeight: h } = img
  const limit = maxEdge.value ?? 0
  if (limit > 0 && Math.max(w, h) > limit) {
    const r = limit / Math.max(w, h)
    w = Math.round(w * r)
    h = Math.round(h * r)
  }
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  if (format.value === 'image/jpeg') {
    ctx.fillStyle = '#fff' // JPG 無透明,底色填白避免變黑
    ctx.fillRect(0, 0, w, h)
  }
  ctx.drawImage(img, 0, 0, w, h)
  const blob: Blob = await new Promise((res) =>
    canvas.toBlob((b) => res(b!), format.value, quality.value / 100),
  )
  if (it.outUrl) URL.revokeObjectURL(it.outUrl)
  it.outUrl = URL.createObjectURL(blob)
  it.outSize = blob.size
  it.outName = it.name.replace(/\.[^.]+$/, '') + '.' + extOf[format.value]
}

async function processAll() {
  busy.value = true
  try {
    for (const it of items.value) await processOne(it)
  } finally {
    busy.value = false
  }
}

function remove(id: number) {
  const i = items.value.findIndex((x) => x.id === id)
  if (i >= 0) {
    const it = items.value[i]
    URL.revokeObjectURL(it.srcUrl)
    if (it.outUrl) URL.revokeObjectURL(it.outUrl)
    items.value.splice(i, 1)
  }
}

const totalSaved = computed(() => {
  let orig = 0
  let out = 0
  for (const it of items.value) {
    if (it.outSize != null) {
      orig += it.origSize
      out += it.outSize
    }
  }
  return orig > 0 ? { orig, out, pct: Math.round((1 - out / orig) * 100) } : null
})
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-5">
      <div>
        <label class="field-label">選擇圖片(可多選)</label>
        <input type="file" accept="image/*" multiple class="field-input" @change="onFiles" />
        <p class="field-hint">檔案只在你的瀏覽器處理,不會上傳到任何伺服器。</p>
      </div>

      <div class="grid gap-4 sm:grid-cols-3">
        <div>
          <label class="field-label">輸出格式</label>
          <select v-model="format" class="field-input">
            <option value="image/jpeg">JPG(相片,檔小)</option>
            <option value="image/webp">WebP(最省空間)</option>
            <option value="image/png">PNG(保留透明)</option>
          </select>
        </div>
        <div>
          <label class="field-label">品質:{{ quality }}</label>
          <input v-model.number="quality" type="range" min="40" max="100" class="w-full accent-brand-600" :disabled="format === 'image/png'" />
          <p class="field-hint">{{ format === 'image/png' ? 'PNG 無損,品質不適用' : '越低檔越小' }}</p>
        </div>
        <div>
          <label class="field-label">最長邊上限(px,選填)</label>
          <input v-model.number="maxEdge" type="number" min="0" placeholder="例:1920,留空不縮放" class="field-input" />
        </div>
      </div>

      <button class="btn-primary w-full sm:w-auto" :disabled="!items.length || busy" @click="processAll">
        {{ busy ? '處理中…' : `開始處理(${items.length} 張)` }}
      </button>
      <p v-if="totalSaved" class="text-sm text-brand-700">
        ✅ 已處理:{{ fmtSize(totalSaved.orig) }} → {{ fmtSize(totalSaved.out) }}
        <span v-if="totalSaved.pct > 0">(省下 {{ totalSaved.pct }}%)</span>
      </p>
    </div>

    <div v-if="items.length" class="space-y-3">
      <div v-for="it in items" :key="it.id" class="card flex items-center gap-4 p-4">
        <img :src="it.outUrl || it.srcUrl" alt="" class="h-16 w-16 shrink-0 rounded-lg object-cover" />
        <div class="min-w-0 flex-1">
          <div class="truncate font-medium text-ink-900">{{ it.outName || it.name }}</div>
          <div class="text-sm text-ink-500">
            {{ it.origW }}×{{ it.origH }} · {{ fmtSize(it.origSize) }}
            <template v-if="it.outSize != null"> → {{ fmtSize(it.outSize) }}</template>
          </div>
        </div>
        <a v-if="it.outUrl" :href="it.outUrl" :download="it.outName" class="btn-primary !py-2 text-sm shrink-0">下載</a>
        <button class="shrink-0 text-ink-400 hover:text-red-500" aria-label="移除" @click="remove(it.id)">✕</button>
      </div>
    </div>

    <LegalNote title="為什麼用這個,而不是網路上的免費轉檔站?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>不上傳</strong>:你的照片(可能含定位、人臉、證件)全程留在自己電腦,不送到陌生伺服器。</li>
        <li><strong>無廣告、無浮水印、免註冊、可批次</strong>,免費。</li>
        <li>重新編碼會自動<strong>清除 EXIF(含 GPS 拍攝地點)</strong>,分享照片更安心。</li>
      </ul>
    </LegalNote>
  </div>
</template>
