<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  type AudioData,
  encodeWav,
  sliceAudio,
  applyGain,
  applyFade,
  normalize,
  mixToMono,
  duration,
  estimateWavBytes,
} from '@/features/audioStudio'

/*
  音訊工坊 —— 載入音檔(mp3/m4a/wav/ogg/webm…),裁剪片段、淡入淡出、調音量、
  峰值正規化、轉單聲道,匯出無失真 WAV。做鈴聲、剪訪談/會議、截一段音訊都好用。
  解碼用瀏覽器的 AudioContext.decodeAudioData(支援格式依瀏覽器);其餘運算與編碼為純前端。
  與「錄音機」「螢幕錄影」互補(那兩支是擷取,這支是編輯)。全程在你裝置,聲音不上傳。
*/
const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const errMsg = ref('')
const fileName = ref('')

let source: AudioData | null = null
const srcDuration = ref(0)
const srcChannels = ref(0)
const srcRate = ref(0)

// 編輯參數
const startSec = ref(0)
const endSec = ref(0)
const fadeIn = ref(0)
const fadeOut = ref(0)
const gainDb = ref(0)
const doNormalize = ref(false)
const toMono = ref(false)

const previewUrl = ref('')
const outSize = ref(0)
const busy = ref(false)

const fmt = (s: number) => {
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(1).padStart(4, '0')
  return `${m}:${sec}`
}
const humanSize = (b: number) =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`

const selDuration = computed(() => Math.max(0, endSec.value - startSec.value))

function decodeCtx(): AudioContext {
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  return new Ctx()
}

async function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  status.value = 'loading'
  errMsg.value = ''
  clearPreview()
  fileName.value = file.name
  try {
    const buf = await file.arrayBuffer()
    const ctx = decodeCtx()
    const audioBuf = await ctx.decodeAudioData(buf.slice(0))
    ctx.close().catch(() => {})
    const channels: Float32Array[] = []
    for (let c = 0; c < audioBuf.numberOfChannels; c++) {
      channels.push(audioBuf.getChannelData(c).slice())
    }
    source = { sampleRate: audioBuf.sampleRate, channels }
    srcDuration.value = duration(source)
    srcChannels.value = channels.length
    srcRate.value = audioBuf.sampleRate
    startSec.value = 0
    endSec.value = srcDuration.value
    fadeIn.value = 0
    fadeOut.value = 0
    gainDb.value = 0
    doNormalize.value = false
    toMono.value = false
    status.value = 'ready'
  } catch (err) {
    errMsg.value = err instanceof Error ? err.message : String(err)
    status.value = 'error'
    source = null
  } finally {
    ;(e.target as HTMLInputElement).value = ''
  }
}

/** 依目前參數產生處理後的音訊(管線:裁剪→淡化→增益→正規化→轉單聲道) */
function process(): AudioData | null {
  if (!source) return null
  let d = sliceAudio(source, startSec.value, endSec.value)
  if (fadeIn.value > 0 || fadeOut.value > 0) d = applyFade(d, fadeIn.value, fadeOut.value)
  if (gainDb.value !== 0) d = applyGain(d, Math.pow(10, gainDb.value / 20))
  if (doNormalize.value) d = normalize(d)
  if (toMono.value) d = mixToMono(d)
  return d
}

function clearPreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
  outSize.value = 0
}

async function makePreview() {
  if (!source) return
  busy.value = true
  clearPreview()
  // 讓 UI 先更新 busy 狀態
  await new Promise((r) => setTimeout(r, 0))
  try {
    const d = process()
    if (!d || d.channels[0].length === 0) {
      errMsg.value = '選取區段是空的,請調整起訖時間'
      return
    }
    errMsg.value = ''
    const wav = encodeWav(d)
    outSize.value = wav.byteLength
    const blob = new Blob([wav as BlobPart], { type: 'audio/wav' })
    previewUrl.value = URL.createObjectURL(blob)
  } catch (err) {
    errMsg.value = err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
  }
}

function download() {
  if (!previewUrl.value) return
  const base = fileName.value.replace(/\.[^.]+$/, '') || '音訊'
  const a = document.createElement('a')
  a.href = previewUrl.value
  a.download = `${base}_編輯.wav`
  a.click()
}

// 估算輸出大小(即時,免先產生)
const estSize = computed(() => {
  if (!source) return 0
  const ch = toMono.value ? 1 : srcChannels.value
  const frames = Math.round(selDuration.value * srcRate.value)
  return estimateWavBytes({ sampleRate: srcRate.value, channels: Array(ch).fill(new Float32Array(frames)) })
})

onUnmounted(clearPreview)
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <label class="block">
        <span class="mb-2 block font-semibold text-ink-700">選擇音檔(mp3 / m4a / wav / ogg / aac…)</span>
        <input
          type="file"
          accept="audio/*"
          class="block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-brand-500 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-brand-600"
          @change="onFile"
        />
      </label>
      <p v-if="status === 'loading'" class="text-sm text-ink-500">解碼中…(大檔請稍候)</p>
      <p v-if="status === 'error'" class="text-sm text-red-600">
        無法讀取:{{ errMsg }}(可能此格式瀏覽器不支援解碼,可改用 Chrome/Edge,或先轉成 mp3/wav)。
      </p>
      <p v-if="status === 'ready'" class="text-sm text-ink-500">
        已載入 <strong>{{ fileName }}</strong> —— 長度 {{ fmt(srcDuration) }}、{{ srcChannels }} 聲道、{{ srcRate }} Hz
      </p>
    </div>

    <div v-if="status === 'ready'" class="card p-6 space-y-5">
      <!-- 裁剪 -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <span class="font-semibold text-ink-700">裁剪片段</span>
          <span class="text-sm text-ink-500">選取 {{ fmt(selDuration) }}</span>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="mb-1 block text-sm text-ink-600">起點(秒):{{ startSec.toFixed(2) }}</span>
            <input v-model.number="startSec" type="range" min="0" :max="srcDuration" step="0.01" class="w-full" />
          </label>
          <label class="block">
            <span class="mb-1 block text-sm text-ink-600">終點(秒):{{ endSec.toFixed(2) }}</span>
            <input v-model.number="endSec" type="range" min="0" :max="srcDuration" step="0.01" class="w-full" />
          </label>
        </div>
      </div>

      <!-- 淡入淡出 -->
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block">
          <span class="mb-1 block text-sm text-ink-600">淡入(秒):{{ fadeIn.toFixed(1) }}</span>
          <input v-model.number="fadeIn" type="range" min="0" :max="Math.min(10, selDuration)" step="0.1" class="w-full" />
        </label>
        <label class="block">
          <span class="mb-1 block text-sm text-ink-600">淡出(秒):{{ fadeOut.toFixed(1) }}</span>
          <input v-model.number="fadeOut" type="range" min="0" :max="Math.min(10, selDuration)" step="0.1" class="w-full" />
        </label>
      </div>

      <!-- 音量 -->
      <label class="block">
        <span class="mb-1 block text-sm text-ink-600">音量增減:{{ gainDb > 0 ? '+' : '' }}{{ gainDb }} dB</span>
        <input v-model.number="gainDb" type="range" min="-24" max="24" step="1" class="w-full" />
      </label>

      <div class="flex flex-wrap gap-4">
        <label class="flex items-center gap-2 text-sm text-ink-700">
          <input v-model="doNormalize" type="checkbox" class="h-4 w-4" /> 自動正規化音量(拉到不破音的最大聲)
        </label>
        <label class="flex items-center gap-2 text-sm text-ink-700">
          <input v-model="toMono" type="checkbox" class="h-4 w-4" /> 轉單聲道(檔案減半)
        </label>
      </div>

      <div class="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <button class="btn-primary" :disabled="busy || selDuration <= 0" @click="makePreview">
          {{ busy ? '處理中…' : '套用並試聽' }}
        </button>
        <span class="text-sm text-ink-500">預估輸出 WAV 約 {{ humanSize(estSize) }}</span>
      </div>
    </div>

    <div v-if="previewUrl" class="card p-5 space-y-3">
      <audio :src="previewUrl" controls class="w-full" />
      <div class="flex flex-wrap items-center gap-3">
        <button class="btn-primary" @click="download">下載 WAV({{ humanSize(outSize) }})</button>
        <span class="text-sm text-ink-500">滿意再下載;改參數後請再按一次「套用並試聽」。</span>
      </div>
    </div>

    <LegalNote title="關於這個工具">
      <ul class="list-disc pl-5 space-y-1">
        <li>全程在你的瀏覽器處理,<strong>音檔不上傳</strong> —— 線上音訊剪輯站常要上傳檔案、限時長或加浮水印。</li>
        <li>可做:擷取一段做<strong>手機鈴聲</strong>、剪掉訪談/會議的前後空白、調整音量、加淡入淡出。</li>
        <li>輸出為 <strong>WAV(無失真)</strong>,任何裝置都開得了;因無壓縮,檔案會比 mp3 大。</li>
        <li>能讀哪些格式取決於你的瀏覽器解碼能力(mp3/m4a/wav/ogg 一般都支援;少數格式可能讀不到)。</li>
        <li>處理大檔(數十分鐘)會吃較多記憶體與時間,建議先裁剪需要的片段。</li>
      </ul>
    </LegalNote>
  </div>
</template>
