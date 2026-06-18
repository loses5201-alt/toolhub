<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { simulatePixels, CVD_LABELS, type CvdType } from '@/features/colorBlind'

/*
  色盲 / 色弱模擬器 —— 把上傳的圖表、簡報、網頁截圖換成色覺障礙者看到的樣子,
  檢查紅綠等配色是否仍分得出來。全程在瀏覽器用 Canvas + 純像素運算處理,圖片不上傳。
  像素轉換在 src/features/colorBlind.ts(可測)。
*/
const MAX_DIM = 2000 // 過大圖先等比縮到此邊長,兼顧效能與記憶體

const source = ref<ImageData | null>(null)
const fileName = ref('')
const type = ref<CvdType>('deuteranopia')
const severity = ref(100)
const busy = ref(false)
const error = ref('')

const origCanvas = ref<HTMLCanvasElement | null>(null)
const simCanvas = ref<HTMLCanvasElement | null>(null)

const types: CvdType[] = ['deuteranopia', 'protanopia', 'tritanopia', 'achromatopsia']

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('無法讀取此圖片'))
    img.src = url
  })
}

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f) return
  if (!f.type.startsWith('image/')) {
    error.value = '請選擇圖片檔(JPG／PNG／WebP 等)。'
    return
  }
  busy.value = true
  error.value = ''
  const url = URL.createObjectURL(f)
  try {
    const img = await loadImage(url)
    const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')!
    ctx.drawImage(img, 0, 0, w, h)
    source.value = ctx.getImageData(0, 0, w, h)
    fileName.value = f.name.replace(/\.[^.]+$/, '')
  } catch (err) {
    error.value = '讀取失敗:' + (err as Error).message
  } finally {
    URL.revokeObjectURL(url)
    busy.value = false
  }
}

function drawOriginal() {
  const src = source.value
  const c = origCanvas.value
  if (!src || !c) return
  c.width = src.width
  c.height = src.height
  c.getContext('2d')!.putImageData(src, 0, 0)
}

function drawSimulated() {
  const src = source.value
  const c = simCanvas.value
  if (!src || !c) return
  c.width = src.width
  c.height = src.height
  const out = simulatePixels(
    { data: src.data, width: src.width, height: src.height },
    type.value,
    severity.value,
  )
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(src.width, src.height)
  img.data.set(out)
  ctx.putImageData(img, 0, 0)
}

watch([source, type, severity], () => {
  void nextTick(() => {
    drawOriginal()
    drawSimulated()
  })
})

function download() {
  const c = simCanvas.value
  if (!c || !source.value) return
  c.toBlob((blob) => {
    if (!blob) {
      error.value = '輸出失敗,請再試一次。'
      return
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileName.value || '圖片'}_${type.value}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, 'image/png')
}

function clearAll() {
  source.value = null
  fileName.value = ''
  error.value = ''
}

const dims = computed(() => (source.value ? `${source.value.width}×${source.value.height}` : ''))

onUnmounted(clearAll)
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
      <div>
        <label class="field-label">選擇要檢查的圖片(圖表、簡報、網頁截圖、地圖…)</label>
        <input type="file" accept="image/*" class="field-input" @change="onFile" />
        <p class="field-hint">圖片只在你的瀏覽器處理、不會上傳。建議放有顏色區分的圖表或配色稿。</p>
      </div>

      <template v-if="source">
        <div class="space-y-3">
          <div>
            <span class="field-label">模擬哪一種色覺障礙</span>
            <div class="grid gap-2 sm:grid-cols-2">
              <button
                v-for="t in types"
                :key="t"
                type="button"
                class="rounded-xl border px-3 py-2 text-left text-sm transition"
                :class="
                  type === t
                    ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-300'
                    : 'border-line bg-white hover:border-brand-300'
                "
                @click="type = t"
              >
                <span class="block font-medium text-ink-800">{{ CVD_LABELS[t] }}</span>
              </button>
            </div>
          </div>

          <label class="flex items-center gap-3 text-sm">
            <span class="text-ink-600 whitespace-nowrap">程度 {{ severity }}</span>
            <input
              v-model.number="severity"
              type="range"
              min="0"
              max="100"
              class="w-full accent-brand-600"
            />
          </label>
          <p class="text-xs text-ink-500">
            100 = 完全色盲(看不見該色);往左為較輕的色弱。拉動可看出配色在不同嚴重度下的差別。
          </p>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-1.5">
            <p class="text-sm font-medium text-ink-600">原圖</p>
            <div class="overflow-auto rounded-xl border border-line bg-ink-50 p-2">
              <canvas ref="origCanvas" class="mx-auto block max-w-full"></canvas>
            </div>
          </div>
          <div class="space-y-1.5">
            <p class="text-sm font-medium text-ink-600">模擬:{{ CVD_LABELS[type] }}</p>
            <div class="overflow-auto rounded-xl border border-line bg-ink-50 p-2">
              <canvas ref="simCanvas" class="mx-auto block max-w-full"></canvas>
            </div>
          </div>
        </div>
        <p class="text-xs text-ink-500">{{ dims }}　若原圖兩種顏色到了右圖變得幾乎一樣,代表這組配色對色盲使用者不友善。</p>

        <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

        <div class="flex flex-wrap items-center gap-3">
          <button class="btn-primary !py-2 text-sm" :disabled="busy" @click="download">
            下載模擬圖(PNG)
          </button>
          <button
            class="text-ink-400 underline text-sm hover:text-red-500 disabled:opacity-40"
            :disabled="busy"
            @click="clearAll"
          >
            清空重來
          </button>
        </div>
      </template>

      <p v-else-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>
    </div>

    <LegalNote title="為什麼需要檢查色盲友善?">
      <ul class="list-disc pl-5 space-y-1">
        <li>
          台灣<strong>約每 12 位男性就有 1 位</strong>紅綠色覺異常;用紅綠來區分的圖表、地圖、紅字提醒,他們可能看不出差別。
        </li>
        <li>
          綠色盲(Deuteranopia)最常見,紅色盲(Protanopia)次之;藍色盲與全色盲很罕見,但一併提供做完整檢查。
        </li>
        <li>
          <strong>不上傳</strong>:圖片全程留在你的裝置處理,不送到陌生伺服器。
        </li>
        <li>
          建議搭配「顏色可讀性檢測」確認文字對比,以及不要只靠顏色 —— 多用<strong>形狀、線型、標籤、深淺</strong>來區分。
        </li>
        <li>
          模擬採用 Machado 等人(2009)的色彩矩陣,屬學術常用近似,實際個人感受會有差異,僅供設計參考。
        </li>
      </ul>
    </LegalNote>
  </div>
</template>
