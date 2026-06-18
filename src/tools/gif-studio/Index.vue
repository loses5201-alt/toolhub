<script setup lang="ts">
import { ref, reactive, computed, onBeforeUnmount } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { encodeGif, planCanvasSize, fpsToDelay, type GifFrame } from '@/features/gifStudio'

/*
  動圖工坊 —— 把多張圖片做成一張會動的 GIF。全程在你瀏覽器用 Canvas + gifenc
  編碼,不上傳、無廣告、無浮水印。線上 GIF 製作站多半要你上傳照片、滿廣告、
  還加浮水印;這裡照片留在你電腦裡。
*/
interface Item {
  id: number
  url: string
  img: HTMLImageElement
  w: number
  h: number
  name: string
}

let seq = 0
const items = ref<Item[]>([])
const baseName = ref('')
const error = ref('')
const busy = ref(false)
const progress = ref('')
const resultUrl = ref('')
const resultSize = ref(0)

const opt = reactive({
  width: 480,
  fps: 8,
  maxColors: 256,
  loop: 0, // 0 = 無限
  fit: 'contain' as 'contain' | 'cover' | 'stretch',
  bg: '#ffffff',
})

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

async function addFiles(fileList: FileList | File[]) {
  const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'))
  if (!files.length) return
  error.value = ''
  for (const f of files) {
    try {
      const url = URL.createObjectURL(f)
      const img = await loadImage(url)
      items.value.push({ id: ++seq, url, img, w: img.naturalWidth, h: img.naturalHeight, name: f.name })
      if (!baseName.value) baseName.value = f.name.replace(/\.[^.]+$/, '')
    } catch {
      error.value = '有圖片載入失敗,已略過。'
    }
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
  if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files)
}

function move(i: number, dir: -1 | 1) {
  const j = i + dir
  if (j < 0 || j >= items.value.length) return
  const arr = items.value
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
}

function remove(i: number) {
  const [it] = items.value.splice(i, 1)
  if (it) URL.revokeObjectURL(it.url)
}

function clearResult() {
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
  resultUrl.value = ''
  resultSize.value = 0
}

function clearAll() {
  for (const it of items.value) URL.revokeObjectURL(it.url)
  items.value = []
  clearResult()
  error.value = ''
  baseName.value = ''
}

const canMake = computed(() => items.value.length >= 2)

/** 把一張圖依 fit 模式畫到固定尺寸畫布,取出 RGBA。 */
function rasterize(it: Item, width: number, height: number): Uint8ClampedArray {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = opt.bg
  ctx.fillRect(0, 0, width, height)
  if (opt.fit === 'stretch') {
    ctx.drawImage(it.img, 0, 0, width, height)
  } else {
    const scale =
      opt.fit === 'cover'
        ? Math.max(width / it.w, height / it.h)
        : Math.min(width / it.w, height / it.h)
    const dw = it.w * scale
    const dh = it.h * scale
    ctx.drawImage(it.img, (width - dw) / 2, (height - dh) / 2, dw, dh)
  }
  return ctx.getImageData(0, 0, width, height).data
}

async function make() {
  if (!canMake.value || busy.value) return
  busy.value = true
  error.value = ''
  progress.value = ''
  clearResult()
  try {
    const first = items.value[0]
    const { width, height } = planCanvasSize(first.w, first.h, opt.width, 1200)
    const delayMs = fpsToDelay(opt.fps)
    const frames: GifFrame[] = []
    for (let i = 0; i < items.value.length; i++) {
      progress.value = `處理影格 ${i + 1} / ${items.value.length}…`
      // 讓畫面有機會更新進度(編碼是同步的)
      await new Promise((r) => setTimeout(r))
      frames.push({ rgba: rasterize(items.value[i], width, height), delayMs })
    }
    progress.value = '編碼 GIF…'
    await new Promise((r) => setTimeout(r))
    const bytes = encodeGif(frames, { width, height, maxColors: opt.maxColors, loop: opt.loop })
    const blob = new Blob([bytes as BlobPart], { type: 'image/gif' })
    resultUrl.value = URL.createObjectURL(blob)
    resultSize.value = blob.size
  } catch (e) {
    error.value = (e as Error).message || '製作失敗。'
  } finally {
    busy.value = false
    progress.value = ''
  }
}

function fmtSize(n: number): string {
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB'
  return (n / 1024 / 1024).toFixed(2) + ' MB'
}

const downloadName = computed(() => `${baseName.value || 'animation'}_動圖.gif`)

onBeforeUnmount(clearAll)
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div
        class="rounded-xl border-2 border-dashed p-6 text-center transition-colors"
        :class="dragOver ? 'border-brand-500 bg-brand-50' : 'border-line bg-stone-50'"
        @dragover.prevent="dragOver = true"
        @dragleave.prevent="dragOver = false"
        @drop.prevent="onDrop"
      >
        <label class="field-label">選擇多張圖片(或拖曳到這裡)</label>
        <input type="file" accept="image/*" multiple class="field-input mt-2" @change="onFiles" />
        <p class="field-hint">依下方順序播放成動畫。可一次選多張或多次加入。全程在你瀏覽器處理,不會上傳。</p>
      </div>

      <div v-if="items.length" class="space-y-2">
        <div
          v-for="(it, i) in items"
          :key="it.id"
          class="flex items-center gap-3 rounded-xl border border-line bg-white p-2"
        >
          <span class="w-6 text-center text-sm text-ink-400 tabular-nums">{{ i + 1 }}</span>
          <img :src="it.url" alt="" class="h-12 w-12 rounded object-cover" />
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm text-ink-800">{{ it.name }}</div>
            <div class="text-xs text-ink-500">{{ it.w }} × {{ it.h }}</div>
          </div>
          <button class="px-2 text-ink-500 hover:text-brand-700 disabled:opacity-30" :disabled="i === 0" title="上移" @click="move(i, -1)">▲</button>
          <button class="px-2 text-ink-500 hover:text-brand-700 disabled:opacity-30" :disabled="i === items.length - 1" title="下移" @click="move(i, 1)">▼</button>
          <button class="px-2 text-rose-500 hover:text-rose-700" title="移除" @click="remove(i)">✕</button>
        </div>
      </div>
    </div>

    <div v-if="items.length" class="card p-6 space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label">輸出寬度:{{ opt.width }} px</label>
          <input v-model.number="opt.width" type="range" min="120" max="800" step="20" class="w-full accent-brand-600" />
          <p class="field-hint">高度依第一張比例自動算(最長邊上限 1200px)。</p>
        </div>
        <div>
          <label class="field-label">播放速度:{{ opt.fps }} 張/秒</label>
          <input v-model.number="opt.fps" type="range" min="1" max="24" step="1" class="w-full accent-brand-600" />
          <p class="field-hint">每張停留約 {{ Math.round(1000 / opt.fps) }} 毫秒。</p>
        </div>
        <div>
          <label class="field-label">縮放方式</label>
          <select v-model="opt.fit" class="field-input">
            <option value="contain">完整顯示(留白補底色)</option>
            <option value="cover">填滿裁切(不留白)</option>
            <option value="stretch">拉伸變形</option>
          </select>
        </div>
        <div>
          <label class="field-label">底色 / 留白顏色</label>
          <input v-model="opt.bg" type="color" class="h-12 w-full rounded-xl border border-line" />
        </div>
        <div>
          <label class="field-label">顏色數:{{ opt.maxColors }}</label>
          <input v-model.number="opt.maxColors" type="range" min="8" max="256" step="8" class="w-full accent-brand-600" />
          <p class="field-hint">越多越細緻、檔越大;照片建議 256,簡單圖示可降低。</p>
        </div>
        <div>
          <label class="field-label">循環</label>
          <select v-model.number="opt.loop" class="field-input">
            <option :value="0">無限循環</option>
            <option :value="1">只播一次</option>
            <option :value="3">播 3 次</option>
            <option :value="5">播 5 次</option>
          </select>
        </div>
      </div>

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

      <div class="flex flex-wrap items-center gap-3">
        <button class="btn-primary" :disabled="!canMake || busy" @click="make">
          {{ busy ? '製作中…' : '製作 GIF' }}
        </button>
        <button class="inline-flex items-center rounded-xl border border-line bg-white px-5 py-3 font-medium text-ink-700 hover:bg-stone-50" @click="clearAll">清空</button>
        <span v-if="progress" class="text-sm text-ink-500">{{ progress }}</span>
      </div>
      <p v-if="!canMake" class="text-sm text-ink-500">至少加入兩張圖片才能做成動畫。</p>
    </div>

    <div v-if="resultUrl" class="card p-6 space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-sm text-ink-500">動圖結果 · {{ fmtSize(resultSize) }}</span>
        <a :href="resultUrl" :download="downloadName" class="btn-primary !py-1.5 text-sm">下載 GIF</a>
      </div>
      <div class="flex justify-center rounded-xl border border-line bg-ink-50/40 p-4">
        <img :src="resultUrl" alt="動圖預覽" class="h-auto max-w-full" />
      </div>
    </div>

    <LegalNote title="什麼時候用得到?">
      <ul class="list-disc pl-5 space-y-1">
        <li>把<strong>一連串截圖、商品多角度照、操作步驟圖</strong>做成會動的 GIF,貼進群組、簡報、商品頁都比一疊靜圖搶眼。</li>
        <li><strong>全程在你瀏覽器用 Canvas + gifenc 編碼、不上傳</strong>,照片可能含個資也安心;無廣告、無浮水印、免註冊。重新輸出會清除原圖 EXIF。</li>
        <li>GIF 為 256 色點陣格式,檔案會比影片大、漸層可能出現色塊;想要更小更清晰的動畫可改用影片。降低寬度或顏色數可縮小檔案。</li>
      </ul>
    </LegalNote>
  </div>
</template>
