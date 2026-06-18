<script setup lang="ts">
import { ref, reactive, computed, onBeforeUnmount } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { encodeGif, planCanvasSize, planFrameTimes, type GifFrame } from '@/features/gifStudio'

/*
  影片轉 GIF —— 把一段影片(或其中一小段)轉成會動的 GIF,做成 LINE/社群可貼的
  動圖。全程在你瀏覽器用 <video> 逐格擷取 + Canvas + gifenc 編碼,影片不上傳、
  無廣告、無浮水印、不限時長/大小;線上轉檔站多半要你上傳影片、滿廣告又加浮水印。
  與「動圖工坊」(多張圖片做 GIF)互補。
*/
const videoEl = ref<HTMLVideoElement | null>(null)
const srcUrl = ref('')
const fileName = ref('')
const duration = ref(0) // 秒
const natW = ref(0)
const natH = ref(0)

const error = ref('')
const busy = ref(false)
const progress = ref('')
const resultUrl = ref('')
const resultSize = ref(0)

const opt = reactive({
  start: 0,
  end: 0,
  width: 480,
  fps: 10,
  maxColors: 256,
  maxFrames: 150,
  loop: 0, // 0 = 無限
})

const ready = computed(() => duration.value > 0 && natW.value > 0)
const clipLen = computed(() => Math.max(0, opt.end - opt.start))

function reset() {
  if (srcUrl.value) URL.revokeObjectURL(srcUrl.value)
  srcUrl.value = ''
  fileName.value = ''
  duration.value = 0
  natW.value = 0
  natH.value = 0
  clearResult()
  error.value = ''
}

function clearResult() {
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
  resultUrl.value = ''
  resultSize.value = 0
}

async function pickFile(fileList: FileList | File[]) {
  const file = Array.from(fileList).find((f) => f.type.startsWith('video/'))
  if (!file) {
    error.value = '請選擇影片檔(MP4、WebM、MOV 等)。'
    return
  }
  reset()
  fileName.value = file.name.replace(/\.[^.]+$/, '')
  srcUrl.value = URL.createObjectURL(file)
}

function onFiles(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) pickFile(input.files)
  input.value = ''
}

const dragOver = ref(false)
function onDrop(e: DragEvent) {
  dragOver.value = false
  if (e.dataTransfer?.files?.length) pickFile(e.dataTransfer.files)
}

// 影片中繼資料載入後,記錄長度/尺寸並預設選取整段(過長則預設前 10 秒)
function onMeta() {
  const v = videoEl.value
  if (!v || !Number.isFinite(v.duration) || v.duration <= 0) {
    error.value = '無法讀取這個影片的長度,可能是瀏覽器不支援的格式。'
    return
  }
  duration.value = v.duration
  natW.value = v.videoWidth
  natH.value = v.videoHeight
  opt.start = 0
  opt.end = Math.min(v.duration, 10)
  if (opt.width > natW.value) opt.width = natW.value
}

/** 設定播放位置並等待該幀解碼完成(seeked)。 */
function seekTo(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const target = Math.min(Math.max(0, t), Math.max(0, v.duration - 0.001))
    let done = false
    const onSeeked = () => {
      if (done) return
      done = true
      v.removeEventListener('seeked', onSeeked)
      clearTimeout(timer)
      resolve()
    }
    const timer = setTimeout(() => {
      if (done) return
      done = true
      v.removeEventListener('seeked', onSeeked)
      reject(new Error('影片跳轉逾時'))
    }, 8000)
    v.addEventListener('seeked', onSeeked)
    v.currentTime = target
  })
}

const canMake = computed(() => ready.value && clipLen.value > 0 && !busy.value)

async function make() {
  const v = videoEl.value
  if (!v || !canMake.value) return
  busy.value = true
  error.value = ''
  progress.value = ''
  clearResult()
  try {
    const { width, height } = planCanvasSize(natW.value, natH.value, opt.width, 1200)
    const plan = planFrameTimes(opt.start, opt.end, opt.fps, opt.maxFrames)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('無法建立繪圖畫布')

    const frames: GifFrame[] = []
    const total = plan.times.length
    for (let i = 0; i < total; i++) {
      progress.value = `擷取影格 ${i + 1} / ${total}…`
      await seekTo(v, plan.times[i])
      // contain:等比縮放置中,維持原片比例
      const scale = Math.min(width / natW.value, height / natH.value)
      const dw = natW.value * scale
      const dh = natH.value * scale
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(v, (width - dw) / 2, (height - dh) / 2, dw, dh)
      frames.push({ rgba: ctx.getImageData(0, 0, width, height).data, delayMs: plan.delayMs })
      // 讓進度與 UI 有機會更新
      await new Promise((r) => setTimeout(r))
    }
    progress.value = '編碼 GIF…'
    await new Promise((r) => setTimeout(r))
    const bytes = encodeGif(frames, { width, height, maxColors: opt.maxColors, loop: opt.loop })
    const blob = new Blob([bytes as BlobPart], { type: 'image/gif' })
    resultUrl.value = URL.createObjectURL(blob)
    resultSize.value = blob.size
  } catch (e) {
    error.value = (e as Error).message || '轉換失敗。'
  } finally {
    busy.value = false
    progress.value = ''
  }
}

function fmtTime(s: number): string {
  if (!Number.isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}
function fmtSize(n: number): string {
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB'
  return (n / 1024 / 1024).toFixed(2) + ' MB'
}

const estFrames = computed(() => (ready.value && clipLen.value > 0 ? planFrameTimes(opt.start, opt.end, opt.fps, opt.maxFrames).times.length : 0))
const downloadName = computed(() => `${fileName.value || 'video'}_動圖.gif`)

// 確保起訖不交錯
function fixRange() {
  if (opt.start < 0) opt.start = 0
  if (opt.end > duration.value) opt.end = duration.value
  if (opt.start >= opt.end) opt.start = Math.max(0, opt.end - 0.1)
}

onBeforeUnmount(reset)
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
        <label class="field-label">選擇影片(或拖曳到這裡)</label>
        <input type="file" accept="video/*" class="field-input mt-2" @change="onFiles" />
        <p class="field-hint">支援 MP4 / WebM / MOV 等瀏覽器可播放的格式。全程在你瀏覽器處理,不會上傳。</p>
      </div>

      <!-- 影片需在 DOM 中且可解碼才能逐格擷取;設小尺寸預覽 -->
      <video
        v-show="srcUrl"
        ref="videoEl"
        :src="srcUrl"
        muted
        playsinline
        preload="auto"
        crossorigin="anonymous"
        class="mx-auto max-h-64 w-full rounded-xl border border-line bg-black"
        @loadedmetadata="onMeta"
      ></video>

      <p v-if="ready" class="text-sm text-ink-500">
        {{ fileName }} · {{ natW }}×{{ natH }} · 全長 {{ fmtTime(duration) }}
      </p>
    </div>

    <div v-if="ready" class="card p-6 space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label">開始時間:{{ fmtTime(opt.start) }}</label>
          <input v-model.number="opt.start" type="range" min="0" :max="duration" step="0.1" class="w-full accent-brand-600" @change="fixRange" />
        </div>
        <div>
          <label class="field-label">結束時間:{{ fmtTime(opt.end) }}</label>
          <input v-model.number="opt.end" type="range" min="0" :max="duration" step="0.1" class="w-full accent-brand-600" @change="fixRange" />
          <p class="field-hint">擷取片段長度約 {{ clipLen.toFixed(1) }} 秒。</p>
        </div>
        <div>
          <label class="field-label">輸出寬度:{{ opt.width }} px</label>
          <input v-model.number="opt.width" type="range" min="120" max="800" step="20" class="w-full accent-brand-600" />
          <p class="field-hint">高度依原片比例自動算(最長邊上限 1200px)。</p>
        </div>
        <div>
          <label class="field-label">流暢度:{{ opt.fps }} 張/秒</label>
          <input v-model.number="opt.fps" type="range" min="2" max="20" step="1" class="w-full accent-brand-600" />
          <p class="field-hint">越高越順但檔越大;一般 8～12 張即足夠。</p>
        </div>
        <div>
          <label class="field-label">顏色數:{{ opt.maxColors }}</label>
          <input v-model.number="opt.maxColors" type="range" min="8" max="256" step="8" class="w-full accent-brand-600" />
          <p class="field-hint">越多越細緻、檔越大。</p>
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

      <p class="text-sm text-ink-500">
        預計輸出約 <strong class="text-ink-800">{{ estFrames }}</strong> 張影格<span v-if="estFrames >= opt.maxFrames">(已達上限,會自動拉長每張停留時間維持總長,避免檔案過大)</span>。
      </p>

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

      <div class="flex flex-wrap items-center gap-3">
        <button class="btn-primary" :disabled="!canMake" @click="make">
          {{ busy ? '轉換中…' : '轉成 GIF' }}
        </button>
        <button class="inline-flex items-center rounded-xl border border-line bg-white px-5 py-3 font-medium text-ink-700 hover:bg-stone-50" @click="reset">換一部影片</button>
        <span v-if="progress" class="text-sm text-ink-500">{{ progress }}</span>
      </div>
      <p v-if="clipLen <= 0" class="text-sm text-ink-500">請調整起訖時間,選出一段要轉換的片段。</p>
    </div>

    <div v-else-if="srcUrl && !error" class="card p-6 text-sm text-ink-500">影片載入中…</div>

    <div v-if="resultUrl" class="card p-6 space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-sm text-ink-500">GIF 結果 · {{ fmtSize(resultSize) }}</span>
        <a :href="resultUrl" :download="downloadName" class="btn-primary !py-1.5 text-sm">下載 GIF</a>
      </div>
      <div class="flex justify-center rounded-xl border border-line bg-ink-50/40 p-4">
        <img :src="resultUrl" alt="GIF 預覽" class="h-auto max-w-full" />
      </div>
    </div>

    <LegalNote title="什麼時候用得到?">
      <ul class="list-disc pl-5 space-y-1">
        <li>把<strong>一小段影片(精彩片段、操作示範、寵物/小孩的可愛瞬間)</strong>轉成 GIF,貼進 LINE、群組、社群、簡報、商品頁,免播放器自動會動。</li>
        <li><strong>全程在你瀏覽器擷取與編碼、影片不上傳</strong>,可能含隱私的家庭影片也安心;無廣告、無浮水印、免註冊、不限時長與大小。</li>
        <li>GIF 為 256 色點陣格式,<strong>片段越長、寬度與流暢度越高,檔案越大</strong>;想縮小可縮短片段、降低寬度、減少顏色數或流暢度。建議片段控制在數秒內。</li>
        <li>少數影片(特定編碼或無音訊軌的格式)瀏覽器可能無法解碼;若載入失敗,可先用「圖片工坊 / 動圖工坊」或轉成 MP4 再試。</li>
      </ul>
    </LegalNote>
  </div>
</template>
