<script setup lang="ts">
import { ref, reactive, computed, onBeforeUnmount } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  encodeGif,
  planCanvasSize,
  fpsToDelay,
  planVideoFrameTimes,
  type GifFrame,
} from '@/features/gifStudio'

/*
  影片轉 GIF —— 把一小段影片(MP4/WebM/MOV…)轉成會動的 GIF。
  全程在你瀏覽器:用 <video> 逐格定位 + Canvas 取像素 + gifenc 編碼,
  影片不上傳、無廣告、無浮水印、不限時長。線上轉 GIF 站多半要你上傳影片、
  滿廣告、還加浮水印、限大小。
*/
const videoUrl = ref('')
const videoName = ref('')
const duration = ref(0)
const vw = ref(0)
const vh = ref(0)
const videoEl = ref<HTMLVideoElement | null>(null)

const error = ref('')
const busy = ref(false)
const progress = ref('')
const resultUrl = ref('')
const resultSize = ref(0)

const opt = reactive({
  start: 0,
  end: 0,
  width: 360,
  fps: 8,
  maxColors: 256,
  loop: 0,
})

const MAX_FRAMES = 300

function reset() {
  if (videoUrl.value) URL.revokeObjectURL(videoUrl.value)
  videoUrl.value = ''
  videoName.value = ''
  duration.value = 0
  vw.value = 0
  vh.value = 0
  clearResult()
  error.value = ''
}

function loadFile(file: File) {
  if (!file.type.startsWith('video/')) {
    error.value = '請選擇影片檔(MP4、WebM、MOV 等)。'
    return
  }
  reset()
  videoName.value = file.name.replace(/\.[^.]+$/, '')
  videoUrl.value = URL.createObjectURL(file)
}

function onMeta() {
  const v = videoEl.value
  if (!v) return
  duration.value = isFinite(v.duration) ? v.duration : 0
  vw.value = v.videoWidth
  vh.value = v.videoHeight
  opt.start = 0
  opt.end = Math.min(duration.value, 6)
}

function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.[0]) loadFile(input.files[0])
  input.value = ''
}

const dragOver = ref(false)
function onDrop(e: DragEvent) {
  dragOver.value = false
  const f = e.dataTransfer?.files?.[0]
  if (f) loadFile(f)
}

function setStartHere() {
  if (videoEl.value) opt.start = Math.min(round1(videoEl.value.currentTime), Math.max(0, opt.end - 0.1))
}
function setEndHere() {
  if (videoEl.value) opt.end = Math.max(round1(videoEl.value.currentTime), opt.start + 0.1)
}
function round1(n: number) {
  return Math.round(n * 10) / 10
}

const plan = computed(() => {
  try {
    if (!(opt.end > opt.start)) return null
    return planVideoFrameTimes(opt.start, opt.end, opt.fps, MAX_FRAMES)
  } catch {
    return null
  }
})
const frameCount = computed(() => plan.value?.times.length ?? 0)
const canMake = computed(() => !!videoUrl.value && frameCount.value > 0)

function clearResult() {
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
  resultUrl.value = ''
  resultSize.value = 0
}

/** 把 video 定位到某個時間點,等 seek 完成。 */
function seek(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      v.removeEventListener('seeked', finish)
      resolve()
    }
    v.addEventListener('seeked', finish)
    // 保險:某些瀏覽器同一時間點不觸發 seeked,設一個逾時
    setTimeout(finish, 1500)
    v.currentTime = Math.min(t, Math.max(0, v.duration - 0.001))
  })
}

async function make() {
  const v = videoEl.value
  const cur = plan.value
  if (!v || !cur || busy.value) return
  busy.value = true
  error.value = ''
  progress.value = ''
  clearResult()
  const wasPlaying = !v.paused
  v.pause()
  try {
    const { width, height } = planCanvasSize(vw.value, vh.value, opt.width, 1200)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    const delayMs = fpsToDelay(opt.fps)
    const frames: GifFrame[] = []
    for (let i = 0; i < cur.times.length; i++) {
      progress.value = `擷取影格 ${i + 1} / ${cur.times.length}…`
      await seek(v, cur.times[i])
      ctx.drawImage(v, 0, 0, width, height)
      frames.push({ rgba: ctx.getImageData(0, 0, width, height).data, delayMs })
    }
    progress.value = '編碼 GIF…'
    await new Promise((r) => setTimeout(r))
    const bytes = encodeGif(frames, { width, height, maxColors: opt.maxColors, loop: opt.loop })
    const blob = new Blob([bytes as BlobPart], { type: 'image/gif' })
    resultUrl.value = URL.createObjectURL(blob)
    resultSize.value = blob.size
  } catch (e) {
    error.value = (e as Error).message || '轉換失敗,可能是瀏覽器無法解碼此影片格式。'
  } finally {
    busy.value = false
    progress.value = ''
    if (wasPlaying) v.play().catch(() => {})
  }
}

function fmtSize(n: number): string {
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB'
  return (n / 1024 / 1024).toFixed(2) + ' MB'
}
function fmtTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(1)
  return `${m}:${sec.padStart(4, '0')}`
}

const downloadName = computed(() => `${videoName.value || 'video'}_動圖.gif`)

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
        <input type="file" accept="video/*" class="field-input mt-2" @change="onFile" />
        <p class="field-hint">支援瀏覽器能播放的格式(MP4 / WebM / MOV 等)。建議擷取一小段(數秒),GIF 才不會太大。全程在你瀏覽器處理,不會上傳。</p>
      </div>

      <div v-if="videoUrl" class="space-y-3">
        <video
          ref="videoEl"
          :src="videoUrl"
          controls
          playsinline
          class="max-h-80 w-full rounded-xl border border-line bg-black"
          @loadedmetadata="onMeta"
        ></video>
        <p class="text-xs text-ink-500">
          {{ videoName }} · {{ vw }}×{{ vh }} · 長度 {{ fmtTime(duration) }}。先用播放器拖到想要的位置,再按「設為開始 / 設為結束」。
        </p>
      </div>
    </div>

    <div v-if="videoUrl" class="card p-6 space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label">開始時間:{{ opt.start.toFixed(1) }} 秒</label>
          <input v-model.number="opt.start" type="range" min="0" :max="Math.max(0.1, duration)" step="0.1" class="w-full accent-brand-600" />
          <button class="mt-1 text-sm text-brand-700 hover:underline" @click="setStartHere">⤓ 設為目前播放位置</button>
        </div>
        <div>
          <label class="field-label">結束時間:{{ opt.end.toFixed(1) }} 秒</label>
          <input v-model.number="opt.end" type="range" min="0" :max="Math.max(0.1, duration)" step="0.1" class="w-full accent-brand-600" />
          <button class="mt-1 text-sm text-brand-700 hover:underline" @click="setEndHere">⤓ 設為目前播放位置</button>
        </div>
        <div>
          <label class="field-label">輸出寬度:{{ opt.width }} px</label>
          <input v-model.number="opt.width" type="range" min="120" max="720" step="20" class="w-full accent-brand-600" />
          <p class="field-hint">高度依影片比例自動算(最長邊上限 1200px)。</p>
        </div>
        <div>
          <label class="field-label">播放速度:{{ opt.fps }} 張/秒</label>
          <input v-model.number="opt.fps" type="range" min="2" max="24" step="1" class="w-full accent-brand-600" />
          <p class="field-hint">越高越流暢,但影格越多、檔越大、轉檔越久。</p>
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

      <div class="rounded-xl bg-stone-50 p-3 text-sm text-ink-600">
        將擷取約 <strong>{{ frameCount }}</strong> 張影格(時長 {{ Math.max(0, opt.end - opt.start).toFixed(1) }} 秒)。
        <span v-if="plan?.truncated" class="text-amber-700">已達 {{ MAX_FRAMES }} 張上限,請縮短區間或降低速度以涵蓋整段。</span>
      </div>

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

      <div class="flex flex-wrap items-center gap-3">
        <button class="btn-primary" :disabled="!canMake || busy" @click="make">
          {{ busy ? '轉換中…' : '轉成 GIF' }}
        </button>
        <span v-if="progress" class="text-sm text-ink-500">{{ progress }}</span>
      </div>
      <p v-if="!canMake && !busy" class="text-sm text-ink-500">請設定有效的開始 / 結束時間(結束需大於開始)。</p>
    </div>

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
        <li>把<strong>一小段影片(操作示範、精彩片段、貼圖素材)轉成 GIF</strong>,貼進聊天室、簡報、文件、論壇都不必裝播放器就會動。</li>
        <li><strong>全程在你瀏覽器處理、影片不上傳</strong>,私人影片也安心;無廣告、無浮水印、免註冊、不限時長與檔案大小(受限於你裝置記憶體)。</li>
        <li>GIF 為 256 色點陣格式,檔案通常比影片大、漸層可能出現色塊。想要更小,請<strong>縮短片段、降低寬度、顏色數或速度</strong>;太長的影片建議只截取重點數秒。</li>
        <li>能不能讀取由你瀏覽器的影片解碼能力決定;少數特殊編碼(如某些 MOV/HEVC)可能無法解,換成 MP4 通常即可。</li>
      </ul>
    </LegalNote>
  </div>
</template>
