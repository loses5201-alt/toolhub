<script setup lang="ts">
import { ref, computed, onUnmounted, nextTick } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { timeToSample, sliceChannels, applyFade, encodeWav, wavByteSize } from '@/features/wavEncode'

/*
  音訊裁剪工坊 —— 載入一段音檔(mp3/wav/m4a/ogg…),用瀏覽器內建 AudioContext 解碼,
  裁出想要的片段、可選淡入淡出,匯出無損 WAV。全程在你裝置進行,音檔不上傳。
  線上音訊剪輯站常要把(可能含隱私的)錄音上傳到別人伺服器、滿廣告又限時長/檔數;
  本工具免註冊、不上傳。輸出 WAV 為無損且所有播放器都吃。與「錄音機」「螢幕錄影」互補。
*/

type Status = 'idle' | 'decoding' | 'ready' | 'error'
const status = ref<Status>('idle')
const errMsg = ref('')
const fileName = ref('')
const sampleRate = ref(0)
const duration = ref(0)
const numChannels = ref(0)
let channels: Float32Array[] = []
let peaks: number[] = [] // 預算好的波形峰值(0–1),畫圖用

const start = ref(0)
const end = ref(0)
const fadeIn = ref(0)
const fadeOut = ref(0)

const outUrl = ref('')
const outSize = ref(0)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const selDuration = computed(() => Math.max(0, end.value - start.value))
const estSize = computed(() =>
  wavByteSize(Math.round(selDuration.value * sampleRate.value), numChannels.value || 1),
)

function fmt(s: number): string {
  if (!isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(2).padStart(5, '0')
  return `${m}:${sec}`
}
function fmtSize(b: number): string {
  if (b >= 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + ' MB'
  if (b >= 1024) return (b / 1024).toFixed(0) + ' KB'
  return b + ' B'
}

function resetOut() {
  if (outUrl.value) URL.revokeObjectURL(outUrl.value)
  outUrl.value = ''
  outSize.value = 0
}

async function onFile(file: File | undefined | null) {
  if (!file) return
  resetOut()
  status.value = 'decoding'
  errMsg.value = ''
  fileName.value = file.name
  try {
    const buf = await file.arrayBuffer()
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const audio = await ctx.decodeAudioData(buf)
    await ctx.close().catch(() => {})
    channels = []
    for (let i = 0; i < audio.numberOfChannels; i++) channels.push(audio.getChannelData(i).slice())
    sampleRate.value = audio.sampleRate
    duration.value = audio.duration
    numChannels.value = audio.numberOfChannels
    start.value = 0
    end.value = audio.duration
    fadeIn.value = 0
    fadeOut.value = 0
    computePeaks()
    status.value = 'ready'
    await nextTick()
    draw()
  } catch (e) {
    errMsg.value = e instanceof Error ? e.message : String(e)
    status.value = 'error'
  }
}

function computePeaks() {
  const W = 600
  peaks = new Array(W).fill(0)
  if (!channels.length) return
  const total = channels[0].length
  const step = Math.max(1, Math.floor(total / W))
  for (let x = 0; x < W; x++) {
    let peak = 0
    const from = x * step
    const to = Math.min(total, from + step)
    for (const ch of channels) {
      for (let i = from; i < to; i++) {
        const v = Math.abs(ch[i])
        if (v > peak) peak = v
      }
    }
    peaks[x] = Math.min(1, peak)
  }
}

function draw() {
  const cv = canvasRef.value
  if (!cv) return
  const ctx = cv.getContext('2d')
  if (!ctx) return
  const W = cv.width
  const H = cv.height
  ctx.clearRect(0, 0, W, H)
  // 選取區間底色
  if (duration.value > 0) {
    const sx = (start.value / duration.value) * W
    const ex = (end.value / duration.value) * W
    ctx.fillStyle = 'rgba(99,102,241,0.14)'
    ctx.fillRect(sx, 0, Math.max(1, ex - sx), H)
    ctx.fillStyle = 'rgba(99,102,241,0.9)'
    ctx.fillRect(sx - 1, 0, 2, H)
    ctx.fillRect(ex - 1, 0, 2, H)
  }
  // 波形
  ctx.fillStyle = '#94a3b8'
  const n = peaks.length
  const bw = W / n
  for (let x = 0; x < n; x++) {
    const h = peaks[x] * (H - 4)
    ctx.fillRect(x * bw, (H - h) / 2, Math.max(1, bw - 0.5), h || 1)
  }
}

// 拉動任一控制項就重畫選取框、並讓上次的輸出失效
function onAdjust() {
  if (start.value < 0) start.value = 0
  if (end.value > duration.value) end.value = duration.value
  if (start.value > end.value) start.value = end.value
  resetOut()
  draw()
}

function makeWav() {
  if (status.value !== 'ready' || !channels.length) return
  const total = channels[0].length
  const a = timeToSample(start.value, sampleRate.value, total)
  const b = timeToSample(end.value, sampleRate.value, total)
  if (b <= a) {
    errMsg.value = '結束時間要大於開始時間'
    return
  }
  errMsg.value = ''
  const cut = sliceChannels(channels, a, b)
  const fi = Math.round(fadeIn.value * sampleRate.value)
  const fo = Math.round(fadeOut.value * sampleRate.value)
  if (fi > 0 || fo > 0) applyFade(cut, fi, fo)
  const bytes = encodeWav(cut, sampleRate.value)
  resetOut()
  const blob = new Blob([bytes as BlobPart], { type: 'audio/wav' })
  outUrl.value = URL.createObjectURL(blob)
  outSize.value = blob.size
}

function download() {
  if (!outUrl.value) return
  const base = fileName.value.replace(/\.[^.]+$/, '') || '音訊'
  const a = document.createElement('a')
  a.href = outUrl.value
  a.download = `${base}_裁剪.wav`
  a.click()
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  onFile(e.dataTransfer?.files?.[0])
}

onUnmounted(resetOut)
</script>

<template>
  <div class="space-y-6">
    <!-- 載入 -->
    <label
      class="card flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed border-line p-8 text-center transition hover:border-brand-300"
      @dragover.prevent
      @drop="onDrop"
    >
      <span class="text-3xl">🎵</span>
      <span class="font-semibold text-ink-700">點此選擇或拖入音檔</span>
      <span class="text-sm text-ink-500">支援 MP3 / WAV / M4A / OGG / FLAC 等(依瀏覽器而定),音檔不上傳</span>
      <input type="file" accept="audio/*" class="hidden" @change="onFile(($event.target as HTMLInputElement).files?.[0])" />
    </label>

    <p v-if="status === 'decoding'" class="text-center text-ink-500">解碼中…</p>
    <p v-if="status === 'error'" class="text-sm text-red-600">無法處理:{{ errMsg }}(此格式瀏覽器可能不支援解碼,可改用 WAV/MP3)。</p>

    <template v-if="status === 'ready'">
      <div class="card space-y-5 p-5">
        <div class="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-500">
          <span class="truncate font-medium text-ink-700">{{ fileName }}</span>
          <span>{{ numChannels === 1 ? '單聲道' : numChannels + ' 聲道' }} · {{ sampleRate }} Hz · 全長 {{ fmt(duration) }}</span>
        </div>

        <canvas ref="canvasRef" width="600" height="120" class="w-full rounded-lg bg-paper" />

        <!-- 開始 / 結束 -->
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="block text-sm font-medium text-ink-700">開始時間:{{ fmt(start) }}</label>
            <input v-model.number="start" type="range" min="0" :max="duration" step="0.01" class="w-full" @input="onAdjust" />
          </div>
          <div>
            <label class="block text-sm font-medium text-ink-700">結束時間:{{ fmt(end) }}</label>
            <input v-model.number="end" type="range" min="0" :max="duration" step="0.01" class="w-full" @input="onAdjust" />
          </div>
        </div>

        <!-- 淡入 / 淡出 -->
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block text-sm">
            <span class="font-medium text-ink-700">淡入(秒)</span>
            <input v-model.number="fadeIn" type="number" min="0" :max="selDuration" step="0.1" class="field-input mt-1 w-full" @input="onAdjust" />
          </label>
          <label class="block text-sm">
            <span class="font-medium text-ink-700">淡出(秒)</span>
            <input v-model.number="fadeOut" type="number" min="0" :max="selDuration" step="0.1" class="field-input mt-1 w-full" @input="onAdjust" />
          </label>
        </div>

        <div class="flex flex-wrap items-center gap-3 text-sm text-ink-500">
          <button class="btn-primary" @click="makeWav">產生裁剪後音檔</button>
          <span>選取長度 {{ fmt(selDuration) }} · 預估 WAV 約 {{ fmtSize(estSize) }}</span>
        </div>
        <p v-if="errMsg && status === 'ready'" class="text-sm text-red-600">{{ errMsg }}</p>
      </div>

      <div v-if="outUrl" class="card space-y-3 p-5">
        <audio :src="outUrl" controls class="w-full" />
        <div class="flex flex-wrap items-center gap-3">
          <button class="btn-primary" @click="download">下載 WAV({{ fmtSize(outSize) }})</button>
          <span class="text-sm text-ink-500">先試聽確認再下載;檔名沿用原檔加「_裁剪」。</span>
        </div>
      </div>
    </template>

    <LegalNote title="為什麼用這個">
      <ul class="list-disc space-y-1 pl-5">
        <li>裁剪全程在你的裝置完成,<strong>音檔不上傳</strong> —— 線上音訊剪輯站常要上傳你的錄音、加廣告或限時長。</li>
        <li>適合:剪鈴聲、擷取一段訪談 / 會議 / 歌曲、把錄音去頭去尾、加淡入淡出。</li>
        <li>輸出為<strong>無損 WAV</strong>,所有電腦 / 手機播放器都能開;檔案會比原 MP3 大屬正常(WAV 不壓縮)。</li>
        <li>能否載入某格式取決於你的瀏覽器解碼能力;若某檔打不開,可先轉成 WAV / MP3 再進來。</li>
        <li>提醒:剪輯他人錄音或受著作權保護的內容,請確認你有合法使用權利。</li>
      </ul>
    </LegalNote>
  </div>
</template>
