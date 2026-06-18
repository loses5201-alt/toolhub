<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import LegalNote from '@/components/LegalNote.vue'

/*
  螢幕錄影 —— 用瀏覽器內建 getDisplayMedia + MediaRecorder 在本機錄製,
  影片不上傳。錄教學步驟、把畫面問題錄給家人/同事看最方便。
*/
const status = ref<'idle' | 'recording' | 'done' | 'error'>('idle')
const seconds = ref(0)
const videoUrl = ref('')
const errMsg = ref('')

let recorder: MediaRecorder | null = null
let stream: MediaStream | null = null
let chunks: Blob[] = []
let timer: number | undefined

function fmt(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, '0')
  return `${m}:${(s % 60).toString().padStart(2, '0')}`
}

async function start() {
  errMsg.value = ''
  if (videoUrl.value) { URL.revokeObjectURL(videoUrl.value); videoUrl.value = '' }
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
    chunks = []
    recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm' })
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' })
      videoUrl.value = URL.createObjectURL(blob)
      status.value = 'done'
      stream?.getTracks().forEach((t) => t.stop())
      stream = null
      window.clearInterval(timer)
    }
    // 使用者在瀏覽器原生面板按「停止分享」時也要收尾
    stream.getVideoTracks()[0].addEventListener('ended', () => stop())
    recorder.start()
    status.value = 'recording'
    seconds.value = 0
    timer = window.setInterval(() => (seconds.value += 1), 1000)
  } catch (e) {
    errMsg.value = e instanceof Error ? e.message : String(e)
    status.value = 'error'
  }
}

function stop() {
  if (recorder && recorder.state !== 'inactive') recorder.stop()
}

function download() {
  if (!videoUrl.value) return
  const a = document.createElement('a')
  a.href = videoUrl.value
  a.download = `螢幕錄影_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}.webm`
  a.click()
}

onUnmounted(() => {
  window.clearInterval(timer)
  stream?.getTracks().forEach((t) => t.stop())
})
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4 text-center">
      <div v-if="status === 'recording'" class="text-4xl font-black text-red-600">
        <span class="mr-2 inline-block h-3 w-3 animate-pulse rounded-full bg-red-600 align-middle" />{{ fmt(seconds) }}
      </div>

      <div class="flex flex-wrap justify-center gap-3">
        <button v-if="status !== 'recording'" class="btn-primary" @click="start">
          {{ status === 'done' ? '重新錄製' : '開始錄影' }}
        </button>
        <button v-else class="rounded-xl bg-red-600 px-6 py-3 text-lg font-semibold text-white hover:bg-red-700" @click="stop">
          停止錄影
        </button>
      </div>
      <p class="text-sm text-ink-500">按「開始錄影」後,瀏覽器會問你要錄整個螢幕、視窗或分頁。要錄聲音請在面板勾選「分享系統音訊」。</p>
      <p v-if="status === 'error'" class="text-sm text-red-600">無法錄影:{{ errMsg }}(可能你按了取消,或瀏覽器/權限不支援)。</p>
    </div>

    <div v-if="status === 'done' && videoUrl" class="card p-5 space-y-3">
      <video :src="videoUrl" controls class="w-full rounded-xl" />
      <button class="btn-primary w-full sm:w-auto" @click="download">下載影片(.webm)</button>
      <p class="text-sm text-ink-500">.webm 可用 Chrome/Edge 直接播放,或用 VLC(見下載中心)開啟。</p>
    </div>

    <LegalNote title="為什麼用這個">
      <ul class="list-disc pl-5 space-y-1">
        <li>錄製全程在你電腦完成,<strong>影片不上傳</strong> —— 線上錄影網站常加浮水印、限時長或偷上傳。</li>
        <li>適合:錄操作教學給長輩、把電腦畫面問題錄下來請人幫忙看。</li>
        <li>需用 Chrome / Edge 等支援的瀏覽器;手機瀏覽器多半不支援螢幕錄影。</li>
      </ul>
    </LegalNote>
  </div>
</template>
