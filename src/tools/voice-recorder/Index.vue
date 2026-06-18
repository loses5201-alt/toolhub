<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import LegalNote from '@/components/LegalNote.vue'

/*
  錄音機 —— 用瀏覽器內建 getUserMedia + MediaRecorder 在本機錄音,聲音不上傳。
  錄語音備忘、訪談、會議、長輩口述,直接下載成音檔。
  線上錄音網站常限時長、加浮水印或偷上傳;本工具全程在你裝置完成,免註冊。
  與「螢幕錄影」(錄畫面)互補 —— 這支只錄聲音。
*/
const status = ref<'idle' | 'recording' | 'paused' | 'done' | 'error'>('idle')
const seconds = ref(0)
const audioUrl = ref('')
const errMsg = ref('')
const level = ref(0) // 即時音量 0–1,讓使用者確認麥克風有收到聲音

let recorder: MediaRecorder | null = null
let stream: MediaStream | null = null
let chunks: Blob[] = []
let timer: number | undefined
let audioCtx: AudioContext | null = null
let analyser: AnalyserNode | null = null
let raf: number | undefined
let ext = 'webm'

function fmt(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, '0')
  return `${m}:${(s % 60).toString().padStart(2, '0')}`
}

function pickMime(): string {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  for (const t of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t
  }
  return ''
}

function meter() {
  if (!analyser) return
  const buf = new Uint8Array(analyser.fftSize)
  analyser.getByteTimeDomainData(buf)
  let peak = 0
  for (let i = 0; i < buf.length; i++) {
    const v = Math.abs(buf[i] - 128) / 128
    if (v > peak) peak = v
  }
  level.value = peak
  raf = requestAnimationFrame(meter)
}

async function start() {
  errMsg.value = ''
  if (audioUrl.value) { URL.revokeObjectURL(audioUrl.value); audioUrl.value = '' }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    chunks = []
    const mime = pickMime()
    ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm'
    recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: chunks[0]?.type || 'audio/webm' })
      audioUrl.value = URL.createObjectURL(blob)
      status.value = 'done'
      cleanupStream()
    }
    // 即時音量計
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 1024
    audioCtx.createMediaStreamSource(stream).connect(analyser)
    meter()

    recorder.start()
    status.value = 'recording'
    seconds.value = 0
    timer = window.setInterval(() => { if (status.value === 'recording') seconds.value += 1 }, 1000)
  } catch (e) {
    errMsg.value = e instanceof Error ? e.message : String(e)
    status.value = 'error'
    cleanupStream()
  }
}

function pause() {
  if (recorder && recorder.state === 'recording') {
    recorder.pause()
    status.value = 'paused'
  }
}
function resume() {
  if (recorder && recorder.state === 'paused') {
    recorder.resume()
    status.value = 'recording'
  }
}
function stop() {
  if (recorder && recorder.state !== 'inactive') recorder.stop()
}

function cleanupStream() {
  window.clearInterval(timer)
  if (raf) cancelAnimationFrame(raf)
  level.value = 0
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
  audioCtx?.close().catch(() => {})
  audioCtx = null
  analyser = null
}

function download() {
  if (!audioUrl.value) return
  const a = document.createElement('a')
  a.href = audioUrl.value
  a.download = `錄音_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}.${ext}`
  a.click()
}

onUnmounted(cleanupStream)
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-5 text-center">
      <div v-if="status === 'recording' || status === 'paused'" class="space-y-3">
        <div class="text-4xl font-black" :class="status === 'paused' ? 'text-ink-300' : 'text-red-600'">
          <span
            v-if="status === 'recording'"
            class="mr-2 inline-block h-3 w-3 animate-pulse rounded-full bg-red-600 align-middle"
          />{{ fmt(seconds) }}
        </div>
        <!-- 音量計:有聲音時會跳動,確認麥克風有收音 -->
        <div class="mx-auto h-3 max-w-sm overflow-hidden rounded-full bg-line">
          <div
            class="h-full rounded-full bg-brand-500 transition-[width] duration-75"
            :style="{ width: Math.round(Math.min(1, level * 1.4) * 100) + '%' }"
          />
        </div>
        <p class="text-xs text-ink-500">{{ status === 'paused' ? '已暫停' : '對著麥克風說話,上面的綠條會跳動' }}</p>
      </div>

      <div class="flex flex-wrap justify-center gap-3">
        <button v-if="status === 'idle' || status === 'done' || status === 'error'" class="btn-primary" @click="start">
          {{ status === 'done' ? '重新錄音' : '開始錄音' }}
        </button>
        <template v-else>
          <button
            v-if="status === 'recording'"
            class="inline-flex items-center justify-center rounded-xl border border-line px-6 py-3 text-lg font-semibold text-ink-700 transition hover:border-brand-300"
            @click="pause"
          >
            暫停
          </button>
          <button
            v-else
            class="btn-primary"
            @click="resume"
          >
            繼續
          </button>
          <button class="rounded-xl bg-red-600 px-6 py-3 text-lg font-semibold text-white transition hover:bg-red-700" @click="stop">
            停止
          </button>
        </template>
      </div>
      <p class="text-sm text-ink-500">按「開始錄音」後,瀏覽器會請你允許使用麥克風。全程在你的裝置進行,聲音不會上傳。</p>
      <p v-if="status === 'error'" class="text-sm text-red-600">無法錄音:{{ errMsg }}(可能你拒絕了麥克風權限,或瀏覽器不支援)。</p>
    </div>

    <div v-if="status === 'done' && audioUrl" class="card p-5 space-y-3">
      <audio :src="audioUrl" controls class="w-full" />
      <button class="btn-primary w-full sm:w-auto" @click="download">下載音檔(.{{ ext }})</button>
      <p class="text-sm text-ink-500">音檔可用電腦或手機內建播放器開啟;若對方裝置打不開 .webm,可改用支援的播放器(見下載中心的 VLC)。</p>
    </div>

    <LegalNote title="為什麼用這個">
      <ul class="list-disc pl-5 space-y-1">
        <li>錄音全程在你的裝置完成,<strong>聲音不上傳</strong> —— 線上錄音網站常限時長、加浮水印或偷偷上傳你的錄音。</li>
        <li>適合:語音備忘、訪談、會議記錄、長輩口述故事、練習講稿。</li>
        <li>可<strong>暫停 / 繼續</strong>,中途停頓不必重來;停止後可直接試聽再下載。</li>
        <li>需用支援的瀏覽器(Chrome / Edge / Firefox / Safari);請允許麥克風權限才能錄音。</li>
        <li>提醒:錄製他人談話前,請先取得對方同意,並遵守當地法令。</li>
      </ul>
    </LegalNote>
  </div>
</template>
