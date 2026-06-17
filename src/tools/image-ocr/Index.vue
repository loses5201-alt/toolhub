<script setup lang="ts">
import { ref } from 'vue'
import LegalNote from '@/components/LegalNote.vue'

/*
  圖片文字辨識(OCR)—— 用 tesseract.js 在「瀏覽器內」辨識,圖片不上傳。
  語言資料由 tesseract.js 於執行時載入(WASM),首次辨識需下載,稍候片刻。
*/
const lang = ref('chi_tra+eng')
const previewUrl = ref('')
const result = ref('')
const status = ref<'idle' | 'running' | 'done' | 'error'>('idle')
const progress = ref(0)
const errMsg = ref('')
const copied = ref(false)
let file: File | null = null

const langOptions = [
  { v: 'chi_tra+eng', label: '繁體中文 + 英文' },
  { v: 'chi_sim+eng', label: '簡體中文 + 英文' },
  { v: 'eng', label: '英文' },
  { v: 'jpn+eng', label: '日文 + 英文' },
]

function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  file = f
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = URL.createObjectURL(f)
  result.value = ''
  status.value = 'idle'
}

async function run() {
  if (!file) return
  status.value = 'running'
  progress.value = 0
  errMsg.value = ''
  result.value = ''
  try {
    const Tesseract = (await import('tesseract.js')).default
    const { data } = await Tesseract.recognize(file, lang.value, {
      logger: (m: { status: string; progress: number }) => {
        if (m.status === 'recognizing text') progress.value = Math.round(m.progress * 100)
      },
    })
    result.value = (data.text || '').trim()
    status.value = 'done'
  } catch (e) {
    errMsg.value = e instanceof Error ? e.message : String(e)
    status.value = 'error'
  }
}

async function copy() {
  try {
    await navigator.clipboard.writeText(result.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1200)
  } catch {
    /* 忽略 */
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">選擇圖片(截圖、照片、掃描檔)</label>
        <input type="file" accept="image/*" class="field-input" @change="onFile" />
        <p class="field-hint">圖片只在你瀏覽器辨識,不上傳。</p>
      </div>
      <div>
        <label class="field-label">辨識語言</label>
        <select v-model="lang" class="field-input">
          <option v-for="o in langOptions" :key="o.v" :value="o.v">{{ o.label }}</option>
        </select>
      </div>
      <img v-if="previewUrl" :src="previewUrl" alt="預覽" class="max-h-60 rounded-xl border border-line" />
      <button class="btn-primary w-full sm:w-auto" :disabled="!previewUrl || status === 'running'" @click="run">
        {{ status === 'running' ? `辨識中… ${progress}%` : '開始辨識文字' }}
      </button>
      <p v-if="status === 'running'" class="text-sm text-ink-500">首次使用需下載語言資料,請稍候(之後會快很多)。</p>
      <p v-if="status === 'error'" class="text-sm text-red-600">辨識失敗:{{ errMsg }}。請換張清晰一點的圖、或檢查網路後再試。</p>
    </div>

    <div v-if="status === 'done'" class="card p-5 space-y-3">
      <div class="flex items-center justify-between">
        <span class="font-semibold text-ink-900">辨識結果</span>
        <button class="text-sm text-brand-700 hover:underline" @click="copy">{{ copied ? '已複製 ✓' : '複製全部' }}</button>
      </div>
      <textarea :value="result" rows="10" readonly class="field-input resize-y font-mono text-sm" />
      <p v-if="!result" class="text-sm text-ink-500">沒辨識到文字。試試更清晰、文字更大的圖片。</p>
    </div>

    <LegalNote title="為什麼用這個 / 小提醒">
      <ul class="list-disc pl-5 space-y-1">
        <li>把截圖、照片、掃描檔裡的文字抓成可編輯文字 —— <strong>圖片不上傳</strong>,辨識在你電腦完成。</li>
        <li>圖片越清晰、文字越端正,辨識越準;手寫、模糊、藝術字會比較差。</li>
        <li>辨識結果可能有錯字,重要內容請自行校對。</li>
      </ul>
    </LegalNote>
  </div>
</template>
