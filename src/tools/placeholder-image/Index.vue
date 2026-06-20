<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import { buildSvg, svgToDataUri, autoFontSize, type PlaceholderOptions } from '@/features/placeholder'

/*
  佔位圖產生器 —— 做網頁 / 簡報 / 排版示意圖時的灰底尺寸圖,
  可自訂尺寸、顏色、文字、對角線,輸出 SVG / PNG。全程在你的瀏覽器產生,不連網、不上傳。
*/

const width = ref(640)
const height = ref(480)
const bg = ref('#cbd5e1')
const fg = ref('#475569')
const text = ref('')
const cross = ref(false)
const autoFs = ref(true)
const fontSize = ref(60)

const presets = [
  { label: '橫幅 1920×480', w: 1920, h: 480 },
  { label: '方形 600×600', w: 600, h: 600 },
  { label: 'FB 貼文 1200×630', w: 1200, h: 630 },
  { label: 'IG 1080×1080', w: 1080, h: 1080 },
  { label: '縮圖 320×180', w: 320, h: 180 },
  { label: '頭像 200×200', w: 200, h: 200 },
]
function applyPreset(w: number, h: number) {
  width.value = w
  height.value = h
}

const opts = computed<PlaceholderOptions>(() => ({
  width: Math.max(1, Math.round(width.value || 1)),
  height: Math.max(1, Math.round(height.value || 1)),
  bg: bg.value,
  fg: fg.value,
  text: text.value,
  cross: cross.value,
  fontSize: autoFs.value ? undefined : fontSize.value,
}))

const svg = computed(() => buildSvg(opts.value))
const dataUri = computed(() => svgToDataUri(svg.value))
const effectiveFs = computed(() =>
  autoFs.value ? autoFontSize(opts.value.width, opts.value.height) : fontSize.value,
)

const copied = ref('')
function copy(str: string, tag: string) {
  navigator.clipboard?.writeText(str)
  copied.value = tag
  setTimeout(() => (copied.value = ''), 1200)
}

function downloadSvg() {
  const blob = new Blob([svg.value], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `placeholder-${opts.value.width}x${opts.value.height}.svg`
  a.click()
  URL.revokeObjectURL(url)
}

const pngBusy = ref(false)
function downloadPng() {
  pngBusy.value = true
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = opts.value.width
    canvas.height = opts.value.height
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(img, 0, 0)
      const a = document.createElement('a')
      a.href = canvas.toDataURL('image/png')
      a.download = `placeholder-${opts.value.width}x${opts.value.height}.png`
      a.click()
    }
    pngBusy.value = false
  }
  img.onerror = () => {
    pngBusy.value = false
  }
  img.src = dataUri.value
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label">寬度(px)</label>
          <input v-model.number="width" type="number" min="1" max="8000" class="field-input" />
        </div>
        <div>
          <label class="field-label">高度(px)</label>
          <input v-model.number="height" type="number" min="1" max="8000" class="field-input" />
        </div>
      </div>

      <div class="flex flex-wrap gap-2 text-xs">
        <button
          v-for="p in presets"
          :key="p.label"
          class="rounded-full border border-ink-200 px-3 py-1 text-ink-600 hover:border-brand-400 hover:text-brand-700"
          @click="applyPreset(p.w, p.h)"
        >
          {{ p.label }}
        </button>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label">背景色</label>
          <div class="flex items-center gap-2">
            <input v-model="bg" type="color" class="h-10 w-12 rounded border border-ink-200" />
            <input v-model="bg" class="field-input font-mono" spellcheck="false" />
          </div>
        </div>
        <div>
          <label class="field-label">文字 / 線條色</label>
          <div class="flex items-center gap-2">
            <input v-model="fg" type="color" class="h-10 w-12 rounded border border-ink-200" />
            <input v-model="fg" class="field-input font-mono" spellcheck="false" />
          </div>
        </div>
      </div>

      <div>
        <label class="field-label">文字(留空 = 顯示尺寸)</label>
        <input v-model="text" class="field-input" placeholder="例:Banner、Logo、Photo" />
      </div>

      <div class="flex flex-wrap items-center gap-4 text-sm">
        <label class="flex items-center gap-2"><input v-model="cross" type="checkbox" />畫對角交叉線</label>
        <label class="flex items-center gap-2"><input v-model="autoFs" type="checkbox" />自動字級</label>
        <label v-if="!autoFs" class="flex items-center gap-2">
          字級
          <input v-model.number="fontSize" type="number" min="6" max="400" class="field-input w-24" />
        </label>
        <span class="text-xs text-ink-400">目前字級 {{ effectiveFs }}px</span>
      </div>
    </div>

    <div class="card p-4 space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <button class="btn-secondary" @click="downloadSvg">下載 SVG</button>
        <button class="btn-secondary" :disabled="pngBusy" @click="downloadPng">
          {{ pngBusy ? '產生中…' : '下載 PNG' }}
        </button>
        <button class="btn-secondary" @click="copy(svg, 'svg')">{{ copied === 'svg' ? '✓ 已複製' : '複製 SVG 碼' }}</button>
        <button class="btn-secondary" @click="copy(dataUri, 'uri')">{{ copied === 'uri' ? '✓ 已複製' : '複製 data URI' }}</button>
      </div>
      <div
        class="flex justify-center overflow-auto rounded-lg p-4"
        style="background-image: repeating-conic-gradient(#f1f5f9 0 25%, #ffffff 0 50%); background-size: 20px 20px"
      >
        <img :src="dataUri" :alt="`佔位圖 ${opts.width}×${opts.height}`" class="max-w-full" />
      </div>
      <p class="field-hint">背後棋盤格只是預覽底,圖片本身為你選的背景色。</p>
    </div>

    <div class="text-sm text-ink-500">
      想做<RouterLink to="/tools/favicon-gen" class="font-semibold text-brand-700 underline hover:text-brand-800">favicon</RouterLink>、
      <RouterLink to="/tools/text-card" class="font-semibold text-brand-700 underline hover:text-brand-800">文字卡</RouterLink>,或
      <RouterLink to="/tools/aspect-ratio" class="font-semibold text-brand-700 underline hover:text-brand-800">算長寬比尺寸</RouterLink>?
    </div>

    <LegalNote title="說明">
      <ul class="list-disc pl-5 space-y-1">
        <li>產生的是<strong>向量 SVG</strong>,可無限放大不失真;下載 PNG 為依輸入尺寸點陣化的圖。</li>
        <li>「自動字級」取較短邊的 1/8(夾在 12–160px),適合大多數示意圖。</li>
        <li>data URI 可直接貼進 HTML 的 <code>&lt;img src&gt;</code> 或 CSS <code>background</code>。</li>
        <li>全程<strong>在你的瀏覽器</strong>產生,不連網、不上傳、無浮水印。</li>
      </ul>
    </LegalNote>
  </div>
</template>
