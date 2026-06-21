<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import { analyzeQrContent } from '@/features/qrScam'

/*
  QR 詐騙(quishing)安全檢查 —— 上傳含 QR 的圖片或貼上掃到的內容,先判讀它要帶你做什麼
  (開網址 / 連 Wi-Fi / 轉加密貨幣 / 撥電話 / 發簡訊…),並針對 QR 釣魚手法給警示。
  全程在你瀏覽器解碼與判讀,不上傳圖片、無廣告。掃路邊/帳單上的 QR 前,先過這一關。
*/

const text = ref('')
const busy = ref(false)
const decodeError = ref('')
const previewUrl = ref('')

const result = computed(() => (text.value.trim() ? analyzeQrContent(text.value) : null))

const LEVEL_STYLE: Record<string, { box: string; badge: string; label: string }> = {
  danger: { box: 'border-rose-300 bg-rose-50/70', badge: 'bg-rose-600 text-white', label: '危險' },
  warn: { box: 'border-amber-300 bg-amber-50/70', badge: 'bg-amber-500 text-white', label: '請小心' },
  safe: { box: 'border-emerald-300 bg-emerald-50/70', badge: 'bg-emerald-600 text-white', label: '看起來正常' },
  info: { box: 'border-ink-200 bg-ink-50/60', badge: 'bg-ink-500 text-white', label: '資訊' },
}
const FINDING_ICON: Record<string, string> = { danger: '⛔', warn: '⚠️', ok: '✅', info: 'ℹ️' }

async function decodeImageData(data: ImageData): Promise<string | null> {
  const jsQR = (await import('jsqr')).default
  const code = jsQR(data.data, data.width, data.height, { inversionAttempts: 'attemptBoth' })
  return code?.data ?? null
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

async function handleFile(file: File) {
  if (!file.type.startsWith('image/')) {
    decodeError.value = '請選擇圖片檔(含 QR Code 的截圖或照片)。'
    return
  }
  busy.value = true
  decodeError.value = ''
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = URL.createObjectURL(file)
  try {
    const img = await loadImage(previewUrl.value)
    const maxEdge = 1000
    const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(img, 0, 0, w, h)
    const decoded = await decodeImageData(ctx.getImageData(0, 0, w, h))
    if (decoded) text.value = decoded
    else decodeError.value = '這張圖裡找不到可辨識的 QR Code。試試裁切到只剩 QR Code、或用更清晰的圖片。'
  } catch {
    decodeError.value = '解碼失敗,請換一張圖片試試。'
  } finally {
    busy.value = false
  }
}

function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (f) void handleFile(f)
}
function onPaste(e: ClipboardEvent) {
  const item = Array.from(e.clipboardData?.items || []).find((it) => it.type.startsWith('image/'))
  const f = item?.getAsFile()
  if (f) {
    e.preventDefault()
    void handleFile(f)
  }
}
</script>

<template>
  <div class="space-y-6" @paste="onPaste">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">上傳含 QR Code 的圖片</label>
        <input type="file" accept="image/*" class="field-input" @change="onFile" />
        <p class="field-hint">
          可上傳截圖或拍下的照片,也可直接 <kbd class="rounded border border-ink-200 bg-ink-50 px-1">Ctrl/⌘+V</kbd> 貼上。圖片只在你瀏覽器解碼,不會上傳。
        </p>
      </div>

      <p v-if="busy" class="text-sm text-ink-500">解碼中…</p>
      <p v-if="decodeError" class="text-sm text-rose-600">{{ decodeError }}</p>

      <div v-if="previewUrl && !decodeError" class="flex justify-center">
        <img :src="previewUrl" alt="" class="max-h-44 w-auto rounded-xl border border-ink-200" />
      </div>

      <div>
        <label class="field-label" for="qr-text">或直接貼上掃到的 QR 內容</label>
        <textarea
          id="qr-text"
          v-model="text"
          rows="3"
          class="field-input font-mono text-sm"
          spellcheck="false"
          placeholder="例:https://… 或 WIFI:S:…;T:…;P:…;;"
        />
      </div>
    </div>

    <div
      v-if="result"
      class="card border-2 p-5 space-y-4"
      :class="LEVEL_STYLE[result.level].box"
    >
      <div class="flex flex-wrap items-center gap-3">
        <span class="rounded-full px-3 py-1 text-sm font-bold" :class="LEVEL_STYLE[result.level].badge">
          {{ LEVEL_STYLE[result.level].label }}
        </span>
        <span class="text-lg font-semibold text-ink-800">{{ result.title }}</span>
      </div>

      <dl v-if="Object.keys(result.detail).length" class="grid gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
        <template v-for="(v, k) in result.detail" :key="k">
          <dt class="font-medium text-ink-500">{{ k }}</dt>
          <dd class="break-all text-ink-800">{{ v }}</dd>
        </template>
      </dl>

      <ul class="space-y-1.5 text-sm">
        <li v-for="(f, i) in result.findings" :key="i" class="flex gap-2 text-ink-700">
          <span aria-hidden="true">{{ FINDING_ICON[f.level] }}</span>
          <span>{{ f.text }}</span>
        </li>
      </ul>

      <div v-if="result.advice.length" class="rounded-lg bg-white/60 p-3">
        <p class="mb-1 text-sm font-semibold text-ink-700">建議</p>
        <ul class="list-disc space-y-1 pl-5 text-sm text-ink-700">
          <li v-for="(a, i) in result.advice" :key="i">{{ a }}</li>
        </ul>
      </div>

      <p v-if="result.url" class="text-xs text-ink-400">
        想單獨再查這個網址?到
        <RouterLink to="/tools/link-check" class="font-semibold text-brand-700 underline">可疑網址檢查器</RouterLink>
        貼上 <span class="break-all font-mono">{{ result.url }}</span>
      </p>
    </div>

    <div class="text-sm text-ink-500">
      收到可疑簡訊?用
      <RouterLink to="/tools/sms-check" class="font-semibold text-brand-700 underline hover:text-brand-800">詐騙簡訊檢查</RouterLink>
      。想認得常見詐騙手法,看
      <RouterLink to="/tools/scam-guide" class="font-semibold text-brand-700 underline hover:text-brand-800">常見詐騙手法圖鑑</RouterLink>
      。
    </div>

    <LegalNote title="關於 QR 詐騙(quishing)">
      <ul class="list-disc pl-5 space-y-1">
        <li>詐騙集團會把假冒的 QR 貼在<strong>停車繳費單、交通罰單、餐廳菜單、海報、共享設備</strong>上,掃了就導去釣魚網站騙帳密或付款。</li>
        <li>這個工具會先<strong>判讀 QR 內容的類型</strong>(網址 / Wi-Fi / 加密貨幣付款 / 電話 / 簡訊 / 聯絡人 / 純文字),並針對手法給警示;網址部分套用與「可疑網址檢查器」相同的啟發式判斷。</li>
        <li>判斷為「看起來正常」<strong>不等於保證安全</strong>;判斷僅供參考,真正要辦事請自己打開官方 App 或手動輸入官網,別只信掃來的 QR。</li>
        <li>全程<strong>在你的瀏覽器</strong>解碼與判讀,圖片與內容<strong>不上傳、不連網</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
