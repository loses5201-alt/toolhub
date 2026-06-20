<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import { RAMPS, rgbaToAscii, toText, type AsciiResult } from '@/features/asciiArt'

/*
  圖片轉 ASCII 藝術 —— 上傳一張圖,轉成用字元拼出的圖(可純文字或彩色),
  貼進 README、終端機、聊天室、簽名檔。全程在你的瀏覽器以 canvas 運算,圖片不上傳、不連網。
*/

const cols = ref(100)
const rampKey = ref<keyof typeof RAMPS>('standard')
const invert = ref(false)
const colored = ref(false)
const previewUrl = ref('')
const error = ref('')
const busy = ref(false)
const result = ref<AsciiResult | null>(null)
let lastBitmap: ImageBitmap | null = null

const rampLabels: Record<string, string> = {
  standard: '經典(10 階)',
  detailed: '細緻(70 階)',
  blocks: '方塊 █▓▒░',
  simple: '極簡',
  dots: '點陣',
}

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
  // 取樣畫布最長邊 ≤ 400px,兼顧速度與細節;真正的縮取交給引擎平均
  const max = 400
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
  result.value = rgbaToAscii(data, w, h, {
    cols: cols.value,
    ramp: RAMPS[rampKey.value],
    invert: invert.value,
    charAspect: 0.5,
  })
}

watch([cols, rampKey, invert], () => {
  if (lastBitmap) recompute()
})

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

const text = computed(() => (result.value ? toText(result.value) : ''))

const copied = ref(false)
function copyText() {
  if (!text.value) return
  navigator.clipboard?.writeText(text.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1200)
}

function downloadTxt() {
  if (!text.value) return
  const blob = new Blob([text.value], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'ascii-art.txt'
  a.click()
  URL.revokeObjectURL(url)
}

function downloadPng() {
  const r = result.value
  if (!r) return
  const fontSize = 10
  const cw = fontSize * 0.6
  const ch = fontSize
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(r.cols * cw))
  canvas.height = Math.max(1, Math.ceil(r.rows * ch))
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = invert.value ? '#000' : '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.font = `${fontSize}px monospace`
  ctx.textBaseline = 'top'
  for (let row = 0; row < r.rows; row++) {
    for (let col = 0; col < r.cols; col++) {
      const cell = r.cells[row][col]
      if (cell.char === ' ') continue
      ctx.fillStyle = colored.value
        ? `rgb(${cell.r},${cell.g},${cell.b})`
        : invert.value
          ? '#fff'
          : '#111'
      ctx.fillText(cell.char, col * cw, row * ch)
    }
  }
  const url = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = url
  a.download = 'ascii-art.png'
  a.click()
}

// 彩色預覽:每列拼出帶色 span(限制在合理欄數內,避免過多節點)
const coloredRows = computed(() => {
  if (!colored.value || !result.value) return []
  return result.value.cells.map((row) =>
    row.map((c) => ({ char: c.char === ' ' ? ' ' : c.char, color: `rgb(${c.r},${c.g},${c.b})` })),
  )
})
</script>

<template>
  <div class="space-y-6">
    <div
      class="card flex flex-col items-center justify-center gap-2 border-2 border-dashed border-ink-200 p-8 text-center"
      @dragover.prevent
      @drop.prevent="onDrop"
    >
      <p class="text-ink-600">把圖片拖到這裡,或</p>
      <label class="btn-primary cursor-pointer">
        選擇圖片
        <input type="file" accept="image/*" class="hidden" @change="onInput" />
      </label>
      <p class="field-hint">JPG / PNG / WebP / GIF 等;圖片<strong>不會上傳</strong>,全程在你瀏覽器處理。</p>
    </div>

    <div v-if="error" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
      ⚠️ {{ error }}
    </div>

    <div v-if="previewUrl" class="card p-6 space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label">寬度(字元數):{{ cols }}</label>
          <input v-model.number="cols" type="range" min="20" max="200" step="2" class="w-full" />
          <p class="field-hint">越大越細,但文字越長。終端機常用 80–120。</p>
        </div>
        <div>
          <label class="field-label">字元風格</label>
          <select v-model="rampKey" class="field-input">
            <option v-for="(_, k) in RAMPS" :key="k" :value="k">{{ rampLabels[k] }}</option>
          </select>
        </div>
      </div>
      <div class="flex flex-wrap gap-4 text-sm">
        <label class="flex items-center gap-2">
          <input v-model="invert" type="checkbox" />反相(深色背景用)
        </label>
        <label class="flex items-center gap-2">
          <input v-model="colored" type="checkbox" />彩色(保留原圖顏色)
        </label>
      </div>
    </div>

    <div v-if="result" class="card p-4 space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <button class="btn-secondary" @click="copyText">{{ copied ? '✓ 已複製' : '複製文字' }}</button>
        <button class="btn-secondary" @click="downloadTxt">下載 .txt</button>
        <button class="btn-secondary" @click="downloadPng">下載 .png</button>
        <span class="ml-auto text-xs text-ink-400">{{ result.cols }} × {{ result.rows }} 字元</span>
      </div>

      <div
        class="overflow-auto rounded-lg p-3"
        :class="invert ? 'bg-ink-900' : 'bg-ink-50'"
      >
        <pre
          v-if="!colored"
          class="font-mono leading-[0.62em] tracking-tighter"
          :class="invert ? 'text-ink-50' : 'text-ink-900'"
          style="font-size: 7px"
        >{{ text }}</pre>
        <pre
          v-else
          class="font-mono leading-[0.62em] tracking-tighter"
          style="font-size: 7px"
        ><template v-for="(row, ri) in coloredRows" :key="ri"><span
            v-for="(c, ci) in row"
            :key="ci"
            :style="{ color: c.color }"
          >{{ c.char }}</span>{{ '\n' }}</template></pre>
      </div>
      <p class="field-hint">
        預覽縮小顯示以便看全貌;複製/下載得到的是完整字元內容。彩色版適合貼在支援 ANSI/HTML 的地方。
      </p>
    </div>

    <div class="text-sm text-ink-500">
      想做<RouterLink to="/tools/text-card" class="font-semibold text-brand-700 underline hover:text-brand-800">文字卡</RouterLink>、
      <RouterLink to="/tools/image-studio" class="font-semibold text-brand-700 underline hover:text-brand-800">圖片轉檔壓縮</RouterLink>,或
      <RouterLink to="/tools/palette-extract" class="font-semibold text-brand-700 underline hover:text-brand-800">抽出主色調色盤</RouterLink>?
    </div>

    <LegalNote title="說明">
      <ul class="list-disc pl-5 space-y-1">
        <li>把圖片切成「字元格」,每格取平均亮度,再依字元梯度(由深到淺)挑字元拼成圖。</li>
        <li><strong>反相</strong>適合貼在深色背景(終端機、Discord);<strong>彩色</strong>會保留每格的平均顏色。</li>
        <li>透明背景的圖,透明處會視為白色(空白)。</li>
        <li>全程<strong>在你的瀏覽器</strong>以 canvas 運算,圖片不上傳、不連網、無浮水印。</li>
      </ul>
    </LegalNote>
  </div>
</template>
