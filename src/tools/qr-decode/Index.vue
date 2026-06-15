<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'

/*
  QR Code 解碼 —— 把含 QR Code 的圖片(截圖/拍照)解出裡面的內容,
  「先看清楚網址再決定要不要開」是防詐關鍵。全程在瀏覽器用 jsQR 解碼,
  圖片不上傳;若解出的是網址,可一鍵丟到可疑網址檢查器。
*/
const result = ref('')
const error = ref('')
const busy = ref(false)
const previewUrl = ref('')

// jsQR 較大,動態載入避免拖累首屏
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
    error.value = '請選擇圖片檔(含 QR Code 的截圖或照片)。'
    return
  }
  busy.value = true
  error.value = ''
  result.value = ''
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = URL.createObjectURL(file)
  try {
    const img = await loadImage(previewUrl.value)
    // 大圖縮到最長邊 1000px 解碼即可,省記憶體又夠準
    const maxEdge = 1000
    const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(img, 0, 0, w, h)
    const data = ctx.getImageData(0, 0, w, h)
    const decoded = await decodeImageData(data)
    if (decoded) {
      result.value = decoded
    } else {
      error.value = '這張圖裡找不到可辨識的 QR Code。試試裁切到只剩 QR Code、或用更清晰的圖片。'
    }
  } catch {
    error.value = '解碼失敗,請換一張圖片試試。'
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

const isUrl = computed(() => /^https?:\/\//i.test(result.value.trim()))

const copied = ref(false)
async function copyResult() {
  if (!result.value) return
  try {
    await navigator.clipboard.writeText(result.value)
  } catch { /* 忽略 */ }
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="space-y-6" @paste="onPaste">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">選擇含 QR Code 的圖片</label>
        <input type="file" accept="image/*" class="field-input" @change="onFile" />
        <p class="field-hint">可上傳截圖或拍下的照片,也可直接 <kbd class="rounded border border-line bg-stone-100 px-1">Ctrl/⌘+V</kbd> 貼上。圖片只在你瀏覽器解碼,不會上傳。</p>
      </div>

      <p v-if="busy" class="text-sm text-ink-500">解碼中…</p>
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

      <div v-if="previewUrl && !error" class="flex justify-center">
        <img :src="previewUrl" alt="" class="max-h-52 w-auto rounded-xl border border-line" />
      </div>
    </div>

    <div v-if="result" class="card p-6 space-y-3">
      <div class="field-label !mb-0">解出的內容</div>
      <div class="rounded-xl border border-line bg-ink-50/40 p-4 font-mono text-sm break-all text-ink-900">{{ result }}</div>

      <div
        v-if="isUrl"
        class="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800"
      >
        ⚠️ 這是一個<strong>網址</strong>。陌生 QR Code 常被用來導到釣魚網站 —— 開啟前,先用下方的可疑網址檢查器看看。
      </div>

      <div class="flex flex-wrap gap-2">
        <button class="inline-flex items-center rounded-xl border border-line bg-white px-4 py-2 text-sm font-medium text-ink-700 hover:bg-stone-50" @click="copyResult">
          {{ copied ? '已複製 ✓' : '複製內容' }}
        </button>
        <RouterLink
          v-if="isUrl"
          :to="{ path: '/tools/link-check', query: { u: result } }"
          class="btn-primary !py-2 text-sm"
        >用可疑網址檢查器檢查 →</RouterLink>
      </div>
    </div>

    <LegalNote title="為什麼要先解碼再開?">
      <ul class="list-disc pl-5 space-y-1">
        <li>路邊貼紙、假停車單、假帳單上的 QR Code 常導向<strong>釣魚或假付款頁</strong>;手機相機直接掃會立刻開啟,風險高。</li>
        <li>先在這裡解出<strong>真正的網址</strong>看清楚,是網址的話可一鍵送到「可疑網址檢查器」評估,再決定要不要開。</li>
        <li><strong>全程在你瀏覽器用 jsQR 解碼、不上傳</strong>圖片,無廣告、免註冊。</li>
      </ul>
    </LegalNote>
  </div>
</template>
