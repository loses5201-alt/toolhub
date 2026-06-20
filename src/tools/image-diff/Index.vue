<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { diffImages } from '@/features/imageDiff'

/*
  圖片差異比對 —— 上傳兩張同尺寸的圖(例:改版前後的截圖),逐像素標出哪裡變了、
  變了多少比例。做 UI 改版核對、找出兩張圖差異(大家來找碴)用。
  全程在你的瀏覽器以 canvas 運算,圖片不上傳、不連網。
*/

interface Loaded {
  bitmap: ImageBitmap
  url: string
  width: number
  height: number
}

const imgA = ref<Loaded | null>(null)
const imgB = ref<Loaded | null>(null)
const threshold = ref(0.1)
const error = ref('')
const diffUrl = ref('')
const stats = ref<{ changed: number; total: number; ratio: number } | null>(null)

async function pick(slot: 'a' | 'b', e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  error.value = ''
  if (!file.type.startsWith('image/')) {
    error.value = '請選擇圖片檔'
    return
  }
  try {
    const bitmap = await createImageBitmap(file)
    const loaded: Loaded = {
      bitmap,
      url: URL.createObjectURL(file),
      width: bitmap.width,
      height: bitmap.height,
    }
    const target = slot === 'a' ? imgA : imgB
    if (target.value) URL.revokeObjectURL(target.value.url)
    target.value = loaded
  } catch (err) {
    error.value = '讀取失敗:' + (err as Error).message
  }
}

function getData(img: Loaded, w: number, h: number): Uint8ClampedArray {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img.bitmap, 0, 0)
  return ctx.getImageData(0, 0, w, h).data
}

const sizeMismatch = computed(
  () =>
    !!imgA.value &&
    !!imgB.value &&
    (imgA.value.width !== imgB.value.width || imgA.value.height !== imgB.value.height),
)

function run() {
  if (!imgA.value || !imgB.value) return
  // 以兩圖共同(較小)區域比較,尺寸不同時仍可比對重疊部分
  const w = Math.min(imgA.value.width, imgB.value.width)
  const h = Math.min(imgA.value.height, imgB.value.height)
  const da = getData(imgA.value, w, h)
  const db = getData(imgB.value, w, h)
  const result = diffImages(da, db, w, h, { threshold: threshold.value })
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const imageData = ctx.createImageData(w, h)
  imageData.data.set(result.output)
  ctx.putImageData(imageData, 0, 0)
  if (diffUrl.value) URL.revokeObjectURL(diffUrl.value)
  canvas.toBlob((blob) => {
    if (blob) diffUrl.value = URL.createObjectURL(blob)
  })
  stats.value = { changed: result.changed, total: result.total, ratio: result.ratio }
}

watch([imgA, imgB, threshold], () => {
  if (imgA.value && imgB.value) run()
})

const ratioPct = computed(() => (stats.value ? (stats.value.ratio * 100).toFixed(2) + '%' : ''))

function download() {
  if (!diffUrl.value) return
  const a = document.createElement('a')
  a.href = diffUrl.value
  a.download = 'image-diff.png'
  a.click()
}
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-2 gap-3">
      <label
        v-for="slot in (['a', 'b'] as const)"
        :key="slot"
        class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-200 bg-ink-50/40 px-3 py-6 text-center transition hover:border-brand-300 hover:bg-brand-50/40"
      >
        <span class="text-sm font-medium text-ink-700">{{ slot === 'a' ? '圖 A(原圖)' : '圖 B(對照)' }}</span>
        <img
          v-if="(slot === 'a' ? imgA : imgB)?.url"
          :src="(slot === 'a' ? imgA : imgB)!.url"
          alt=""
          class="max-h-32 rounded object-contain"
        />
        <span v-else class="text-xs text-ink-400">點此選擇圖片</span>
        <span v-if="(slot === 'a' ? imgA : imgB)" class="text-[11px] text-ink-400">
          {{ (slot === 'a' ? imgA : imgB)!.width }} × {{ (slot === 'a' ? imgA : imgB)!.height }}
        </span>
        <input type="file" accept="image/*" class="hidden" @change="(e) => pick(slot, e)" />
      </label>
    </div>

    <div v-if="error" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
      ⚠️ {{ error }}
    </div>
    <div
      v-if="sizeMismatch"
      class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800"
    >
      ⚠️ 兩張圖尺寸不同,將只比對左上角重疊的範圍。建議使用相同尺寸的截圖以得到準確結果。
    </div>

    <div v-if="imgA && imgB" class="card p-4 space-y-3">
      <div class="flex items-center gap-3 text-sm text-ink-600">
        <label for="thr">容忍度</label>
        <input id="thr" v-model.number="threshold" type="range" min="0" max="0.5" step="0.01" class="flex-1" />
        <span class="w-10 text-right font-mono">{{ threshold.toFixed(2) }}</span>
      </div>
      <p class="text-xs text-ink-400">容忍度越高,越能忽略壓縮雜訊與抗鋸齒造成的細微差異。</p>

      <div v-if="stats" class="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <span class="text-ink-600">變化像素:<strong class="text-ink-800">{{ stats.changed.toLocaleString() }}</strong> / {{ stats.total.toLocaleString() }}</span>
        <span
          class="font-semibold"
          :class="stats.changed === 0 ? 'text-emerald-700' : 'text-rose-600'"
        >
          {{ stats.changed === 0 ? '兩圖在此容忍度下完全相同 ✓' : `差異 ${ratioPct}` }}
        </span>
      </div>
    </div>

    <div v-if="diffUrl" class="card p-4 space-y-2">
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-ink-700">差異圖(<span class="text-rose-600">紅色</span> = 不同處)</span>
        <button class="ml-auto text-sm text-brand-700 underline hover:text-brand-800" @click="download">
          下載 PNG
        </button>
      </div>
      <img :src="diffUrl" alt="差異圖" class="w-full rounded-lg border border-ink-100" />
    </div>

    <LegalNote title="這個工具能、不能做什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>能</strong>:逐像素比對兩張圖,用 <strong>YIQ 感知色差</strong>(pixelmatch 風格)標出不同處(紅色),算出變化的像素數與比例。適合 UI 改版前後核對、找出兩張圖的差異。</li>
        <li><strong>能</strong>:調整<strong>容忍度</strong>忽略 JPEG 壓縮雜訊、抗鋸齒造成的細微差異;差異圖可下載 PNG。</li>
        <li><strong>建議</strong>:兩張圖<strong>尺寸相同</strong>時最準;尺寸不同只會比對左上角重疊範圍,且未對齊的內容會整片標紅。</li>
        <li>全程<strong>在你的瀏覽器</strong>以 canvas 運算,圖片<strong>不上傳、不連網</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
