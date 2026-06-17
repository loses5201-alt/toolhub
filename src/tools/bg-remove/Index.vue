<script setup lang="ts">
import { ref } from 'vue'
import LegalNote from '@/components/LegalNote.vue'

/*
  圖片去背 —— 用 @imgly/background-removal 在「瀏覽器內」去背,照片不上傳。
  AI 模型於首次使用時下載(WASM/ONNX),稍候片刻;之後會快很多。
  remove.bg 等服務要付費或要你上傳,這裡免費、不上傳。
*/
const previewUrl = ref('')
const resultUrl = ref('')
const status = ref<'idle' | 'running' | 'done' | 'error'>('idle')
const progressText = ref('')
const errMsg = ref('')
let file: File | null = null

function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  file = f
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
  resultUrl.value = ''
  previewUrl.value = URL.createObjectURL(f)
  status.value = 'idle'
}

async function run() {
  if (!file) return
  status.value = 'running'
  errMsg.value = ''
  progressText.value = '準備中…'
  try {
    const { removeBackground } = await import('@imgly/background-removal')
    const blob = await removeBackground(file, {
      progress: (key: string, current: number, total: number) => {
        const pct = total ? Math.round((current / total) * 100) : 0
        progressText.value = key.startsWith('fetch') ? `下載模型… ${pct}%` : `去背處理中… ${pct}%`
      },
    })
    if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
    resultUrl.value = URL.createObjectURL(blob)
    status.value = 'done'
  } catch (e) {
    errMsg.value = e instanceof Error ? e.message : String(e)
    status.value = 'error'
  }
}

function download() {
  if (!resultUrl.value) return
  const a = document.createElement('a')
  a.href = resultUrl.value
  a.download = '去背.png'
  a.click()
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">選擇圖片(人像、商品、物件)</label>
        <input type="file" accept="image/*" class="field-input" @change="onFile" />
        <p class="field-hint">照片只在你瀏覽器處理,不上傳。</p>
      </div>

      <div v-if="previewUrl" class="grid gap-4 sm:grid-cols-2">
        <div>
          <div class="mb-1 text-sm text-ink-500">原圖</div>
          <img :src="previewUrl" alt="原圖" class="max-h-72 rounded-xl border border-line" />
        </div>
        <div v-if="resultUrl">
          <div class="mb-1 text-sm text-ink-500">去背結果(透明背景)</div>
          <img
            :src="resultUrl"
            alt="去背結果"
            class="max-h-72 rounded-xl border border-line bg-[repeating-conic-gradient(#eee_0%_25%,#fff_0%_50%)] bg-[length:20px_20px]"
          />
        </div>
      </div>

      <button class="btn-primary w-full sm:w-auto" :disabled="!previewUrl || status === 'running'" @click="run">
        {{ status === 'running' ? progressText : '開始去背' }}
      </button>
      <button v-if="resultUrl" class="ml-2 rounded-xl border border-line px-5 py-3 font-semibold text-ink-700 hover:border-brand-300" @click="download">
        下載透明 PNG
      </button>

      <p v-if="status === 'running'" class="text-sm text-ink-500">首次使用需下載 AI 模型(約數 MB),請耐心等候;之後會快很多。</p>
      <p v-if="status === 'error'" class="text-sm text-red-600">去背失敗:{{ errMsg }}。請換張圖或檢查網路後再試。</p>
    </div>

    <LegalNote title="為什麼用這個">
      <ul class="list-disc pl-5 space-y-1">
        <li>免費去背,輸出<strong>透明背景 PNG</strong>,可直接拿來做商品圖、大頭貼、貼圖。</li>
        <li>全程在你瀏覽器用 AI 模型處理,<strong>照片不上傳</strong> —— remove.bg 等服務要付費且要你上傳。</li>
        <li>人像、商品、輪廓清楚的物件效果最好;背景雜亂或半透明物體會比較吃力。</li>
      </ul>
    </LegalNote>
  </div>
</template>
