<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import {
  extractPixels,
  medianCut,
  luminance,
  formatSwatches,
  type Swatch,
} from '@/features/paletteExtract'

/*
  圖片調色盤萃取 —— 上傳一張圖,取出最具代表性的主色(median cut 量化),
  得到可直接用的 HEX / RGB / CSS 變數。做設計取色、配色參考用。
  全程在你的瀏覽器以 canvas 運算,圖片不上傳、不連網。
*/

const count = ref(6)
const previewUrl = ref('')
const swatches = ref<Swatch[]>([])
const busy = ref(false)
const error = ref('')
let lastBitmap: ImageBitmap | null = null

async function loadFile(file: File) {
  error.value = ''
  if (!file.type.startsWith('image/')) {
    error.value = '請選擇圖片檔(JPG / PNG / WebP / GIF 等)'
    return
  }
  busy.value = true
  try {
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = URL.createObjectURL(file)
    lastBitmap = await createImageBitmap(file)
    recompute()
  } catch (e) {
    error.value = '讀取失敗:' + (e as Error).message
  } finally {
    busy.value = false
  }
}

function recompute() {
  if (!lastBitmap) return
  // 縮到最長邊 ≤ 160px 取樣,兼顧速度與代表性
  const max = 160
  const scale = Math.min(1, max / Math.max(lastBitmap.width, lastBitmap.height))
  const w = Math.max(1, Math.round(lastBitmap.width * scale))
  const h = Math.max(1, Math.round(lastBitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    error.value = '無法建立繪圖環境'
    return
  }
  ctx.drawImage(lastBitmap, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h).data
  const pixels = extractPixels(data, { alphaThreshold: 16 })
  swatches.value = medianCut(pixels, count.value)
}

function onInput(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) loadFile(file)
}

function onDrop(e: DragEvent) {
  const file = e.dataTransfer?.files?.[0]
  if (file) loadFile(file)
}

function setCount(n: number) {
  count.value = n
  recompute()
}

const copiedKey = ref('')
function copy(text: string, key: string) {
  navigator.clipboard?.writeText(text)
  copiedKey.value = key
  setTimeout(() => (copiedKey.value = ''), 1200)
}

const hasResult = computed(() => swatches.value.length > 0)
function textColor(s: Swatch): string {
  return luminance(s.rgb) > 0.45 ? '#1a1a1a' : '#ffffff'
}
function pct(s: Swatch): string {
  return (s.ratio * 100).toFixed(s.ratio >= 0.1 ? 0 : 1) + '%'
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <label
        class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-200 bg-ink-50/40 px-4 py-8 text-center transition hover:border-brand-300 hover:bg-brand-50/40"
        @drop.prevent="onDrop"
        @dragover.prevent
      >
        <span class="text-3xl">🎨</span>
        <span class="text-sm font-medium text-ink-700">點此選擇圖片,或拖曳進來</span>
        <span class="text-xs text-ink-400">JPG / PNG / WebP / GIF —— 全程在你的瀏覽器處理,不上傳</span>
        <input type="file" accept="image/*" class="hidden" @change="onInput" />
      </label>

      <div v-if="busy" class="text-sm text-ink-500">處理中…</div>
      <div v-if="error" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
        ⚠️ {{ error }}
      </div>

      <div v-if="hasResult" class="space-y-2">
        <div class="flex items-center gap-2 text-sm text-ink-600">
          <span>主色數量</span>
          <div class="flex flex-wrap gap-1">
            <button
              v-for="n in [4, 5, 6, 8, 10, 12]"
              :key="n"
              type="button"
              class="rounded-md border px-2.5 py-1 text-xs transition"
              :class="count === n ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-500 hover:border-brand-300'"
              @click="setCount(n)"
            >
              {{ n }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="hasResult" class="space-y-4">
      <img
        v-if="previewUrl"
        :src="previewUrl"
        alt="預覽"
        class="max-h-64 w-full rounded-xl object-contain"
      />

      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        <button
          v-for="(s, i) in swatches"
          :key="i"
          type="button"
          class="group flex aspect-[4/3] flex-col items-center justify-center rounded-xl text-center shadow-sm transition hover:scale-[1.02]"
          :style="{ backgroundColor: s.hex, color: textColor(s) }"
          :title="`點擊複製 ${s.hex}`"
          @click="copy(s.hex, 'sw' + i)"
        >
          <span class="font-mono text-sm font-semibold uppercase">{{ copiedKey === 'sw' + i ? '已複製 ✓' : s.hex }}</span>
          <span class="mt-0.5 text-[11px] opacity-80">{{ pct(s) }}</span>
        </button>
      </div>

      <div class="card p-4 space-y-3">
        <div class="flex flex-wrap gap-2 text-sm">
          <button
            v-for="fmt in (['hex', 'rgb', 'css', 'json'] as const)"
            :key="fmt"
            type="button"
            class="rounded-md border border-ink-200 px-3 py-1 text-xs text-ink-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
            @click="copy(formatSwatches(swatches, fmt), 'fmt' + fmt)"
          >
            {{ copiedKey === 'fmt' + fmt ? '已複製 ✓' : '複製 ' + fmt.toUpperCase() }}
          </button>
        </div>
        <pre class="overflow-x-auto rounded-lg bg-ink-900 p-4 text-xs leading-relaxed text-ink-50"><code>{{ formatSwatches(swatches, 'hex') }}</code></pre>
      </div>
    </div>

    <div class="text-sm text-ink-500">
      想進一步調整顏色?用
      <RouterLink to="/tools/color-tools" class="font-semibold text-brand-700 underline hover:text-brand-800">色碼互轉</RouterLink>
      、
      <RouterLink to="/tools/color-scale" class="font-semibold text-brand-700 underline hover:text-brand-800">色階產生</RouterLink>
      或
      <RouterLink to="/tools/contrast-check" class="font-semibold text-brand-700 underline hover:text-brand-800">對比度檢查</RouterLink>
      。
    </div>

    <LegalNote title="這個工具能、不能做什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>能</strong>:從一張圖中以 <strong>median cut 量化</strong>取出 4–12 個最具代表性的主色,附每色的<strong>佔比</strong>與可直接貼用的 HEX / RGB / CSS 變數 / JSON。</li>
        <li><strong>能</strong>:點任一色票即複製該色碼;文字顏色依背景亮度自動取黑或白。</li>
        <li><strong>原理</strong>:為求速度會把圖縮到最長邊約 160px 再取樣,屬<strong>近似</strong>主色,與設計稿原始色票可能略有出入。</li>
        <li>全程<strong>在你的瀏覽器</strong>以 canvas 運算,圖片<strong>不上傳、不連網</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
