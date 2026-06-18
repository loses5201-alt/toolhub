<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import LegalNote from '@/components/LegalNote.vue'

/*
  截圖美化 —— 替截圖加上漸層/純色背景、留白、圓角、陰影,做成簡報、社群貼文、
  作品集裡好看的成品圖。全程在瀏覽器用 Canvas 合成,不上傳;線上同類工具(Shots/Pika 等)
  常要上傳截圖、加浮水印或要付費。重新輸出會清掉原圖 EXIF。
*/
interface Loaded {
  img: HTMLImageElement
  w: number
  h: number
  name: string
}

const src = ref<Loaded | null>(null)
const error = ref('')
const busy = ref(false)
const dragOver = ref(false)
const previewCanvas = ref<HTMLCanvasElement | null>(null)
const resultUrl = ref('')
const resultSize = ref(0)
let curUrl = ''

// 漸層底色預設(角度 deg,兩個以上色停)
const gradients: { name: string; angle: number; stops: string[] }[] = [
  { name: '海洋藍', angle: 135, stops: ['#2563eb', '#06b6d4'] },
  { name: '霞紫', angle: 135, stops: ['#7c3aed', '#db2777'] },
  { name: '夕陽', angle: 135, stops: ['#f97316', '#db2777'] },
  { name: '森綠', angle: 135, stops: ['#059669', '#65a30d'] },
  { name: '薄暮', angle: 160, stops: ['#1e293b', '#475569'] },
  { name: '蜜桃', angle: 135, stops: ['#fb7185', '#fdba74'] },
  { name: '天青', angle: 160, stops: ['#0ea5e9', '#a5f3fc'] },
  { name: '石墨', angle: 135, stops: ['#111827', '#374151'] },
]

const ratios: { id: string; label: string; r: number | null }[] = [
  { id: 'auto', label: '自動(貼合圖片)', r: null },
  { id: '1', label: '1:1 方形', r: 1 },
  { id: '16', label: '16:9 寬螢幕', r: 16 / 9 },
  { id: '43', label: '4:3', r: 4 / 3 },
  { id: '34', label: '3:4 直式', r: 3 / 4 },
  { id: '916', label: '9:16 限動', r: 9 / 16 },
]

const opt = reactive({
  bgType: 'gradient' as 'gradient' | 'solid' | 'transparent',
  gradIndex: 0,
  solid: '#e2e8f0',
  padding: 16, // 佔長邊百分比 0–40
  radius: 24, // 圓角 px(對應原圖像素)
  shadow: 28, // 陰影強度 0–80(模糊半徑)
  ratio: 'auto',
  format: 'image/png' as 'image/png' | 'image/jpeg',
  quality: 92,
  scale: 2 as 1 | 2,
})

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}

// 以 scale 倍率把成品畫進一個離屏 canvas
function render(scale: number): HTMLCanvasElement | null {
  const s = src.value
  if (!s) return null
  const pad = Math.round((opt.padding / 100) * Math.max(s.w, s.h))
  let baseW = s.w + pad * 2
  let baseH = s.h + pad * 2
  // 依輸出比例外擴畫布(內容置中),自動則不變
  const rr = ratios.find((x) => x.id === opt.ratio)?.r ?? null
  let cw = baseW
  let ch = baseH
  if (rr) {
    if (baseW / baseH < rr) cw = Math.round(baseH * rr)
    else ch = Math.round(baseW / rr)
  }
  const MAX = 8000
  if (cw * scale > MAX || ch * scale > MAX) scale = Math.min(MAX / cw, MAX / ch)

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(cw * scale)
  canvas.height = Math.round(ch * scale)
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)
  ctx.imageSmoothingQuality = 'high'

  // 背景
  if (opt.bgType === 'gradient') {
    const g = gradients[opt.gradIndex]
    const a = (g.angle * Math.PI) / 180
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    const cx = cw / 2
    const cy = ch / 2
    const half = (Math.abs(dx) * cw + Math.abs(dy) * ch) / 2
    const grad = ctx.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half)
    g.stops.forEach((c, i) => grad.addColorStop(i / (g.stops.length - 1), c))
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, cw, ch)
  } else if (opt.bgType === 'solid') {
    ctx.fillStyle = opt.solid
    ctx.fillRect(0, 0, cw, ch)
  } // transparent: 不填

  const ix = (cw - s.w) / 2
  const iy = (ch - s.h) / 2

  // 陰影:先用圓角矩形投影,再裁切貼圖
  ctx.save()
  if (opt.shadow > 0) {
    ctx.shadowColor = 'rgba(0,0,0,0.35)'
    ctx.shadowBlur = opt.shadow
    ctx.shadowOffsetY = opt.shadow * 0.5
    roundRect(ctx, ix, iy, s.w, s.h, opt.radius)
    ctx.fillStyle = '#fff'
    ctx.fill()
  }
  ctx.restore()

  ctx.save()
  roundRect(ctx, ix, iy, s.w, s.h, opt.radius)
  ctx.clip()
  ctx.drawImage(s.img, ix, iy, s.w, s.h)
  ctx.restore()

  return canvas
}

function drawPreview() {
  const cv = previewCanvas.value
  const s = src.value
  if (!cv || !s) return
  const out = render(1)
  if (!out) return
  cv.width = out.width
  cv.height = out.height
  cv.getContext('2d')!.drawImage(out, 0, 0)
}

function loadFile(file: File) {
  if (!file.type.startsWith('image/')) {
    error.value = '請選擇圖片檔(PNG / JPG 等)。'
    return
  }
  error.value = ''
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.onload = () => {
    src.value = { img, w: img.naturalWidth, h: img.naturalHeight, name: file.name.replace(/\.[^.]+$/, '') }
    URL.revokeObjectURL(url)
    clearResult()
    nextTick(drawPreview)
  }
  img.onerror = () => {
    error.value = '圖片載入失敗,請換一張。'
    URL.revokeObjectURL(url)
  }
  img.src = url
}

function onInput(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (f) loadFile(f)
}

function onDrop(e: DragEvent) {
  dragOver.value = false
  const f = e.dataTransfer?.files?.[0]
  if (f) loadFile(f)
}

function onPaste(e: ClipboardEvent) {
  const item = Array.from(e.clipboardData?.items || []).find((i) => i.type.startsWith('image/'))
  if (item) {
    const f = item.getAsFile()
    if (f) loadFile(f)
  }
}

function clearResult() {
  if (curUrl) URL.revokeObjectURL(curUrl)
  curUrl = ''
  resultUrl.value = ''
  resultSize.value = 0
}

async function exportImage() {
  if (!src.value) return
  busy.value = true
  error.value = ''
  try {
    const canvas = render(opt.scale)
    if (!canvas) return
    if (opt.bgType === 'transparent' && opt.format === 'image/jpeg') {
      // JPG 無透明,改鋪白底避免變黑
      const c2 = document.createElement('canvas')
      c2.width = canvas.width
      c2.height = canvas.height
      const c = c2.getContext('2d')!
      c.fillStyle = '#fff'
      c.fillRect(0, 0, c2.width, c2.height)
      c.drawImage(canvas, 0, 0)
      canvas.getContext('2d')!.drawImage(c2, 0, 0)
    }
    const blob: Blob = await new Promise((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error('輸出失敗'))), opt.format, opt.quality / 100),
    )
    clearResult()
    curUrl = URL.createObjectURL(blob)
    resultUrl.value = curUrl
    resultSize.value = blob.size
  } catch (e) {
    error.value = (e as Error).message || '輸出失敗。'
  } finally {
    busy.value = false
  }
}

function fmtSize(n: number): string {
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB'
  return (n / 1024 / 1024).toFixed(2) + ' MB'
}

const downloadName = computed(
  () => `${src.value?.name || 'screenshot'}_美化.${opt.format === 'image/png' ? 'png' : 'jpg'}`,
)

watch(opt, () => nextTick(drawPreview))
onMounted(() => window.addEventListener('paste', onPaste))
onBeforeUnmount(() => {
  window.removeEventListener('paste', onPaste)
  clearResult()
})
</script>

<template>
  <div class="space-y-6">
    <div
      class="card border-2 border-dashed p-8 text-center transition-colors"
      :class="dragOver ? 'border-brand-500 bg-brand-50/40' : 'border-line'"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop.prevent="onDrop"
    >
      <p class="text-ink-700">把截圖<strong>拖進來</strong>、貼上(Ctrl/⌘+V),或</p>
      <label class="btn-primary mt-3 inline-block cursor-pointer">
        選擇圖片
        <input type="file" accept="image/*" class="hidden" @change="onInput" />
      </label>
      <p class="field-hint mt-3">全程在你瀏覽器處理,不會上傳。支援 PNG / JPG / WebP。</p>
      <p v-if="error" class="mt-2 text-sm text-red-600">{{ error }}</p>
    </div>

    <template v-if="src">
      <div class="card p-6 space-y-4">
        <div>
          <label class="field-label">背景</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="t in [{ k: 'gradient', n: '漸層' }, { k: 'solid', n: '純色' }, { k: 'transparent', n: '透明' }]"
              :key="t.k"
              class="rounded-xl border px-4 py-2 text-sm"
              :class="opt.bgType === t.k ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-700 hover:bg-stone-50'"
              @click="opt.bgType = t.k as any"
            >
              {{ t.n }}
            </button>
          </div>
        </div>

        <div v-if="opt.bgType === 'gradient'" class="flex flex-wrap gap-2">
          <button
            v-for="(g, i) in gradients"
            :key="g.name"
            class="h-10 w-10 rounded-lg ring-offset-2 transition"
            :class="opt.gradIndex === i ? 'ring-2 ring-brand-500' : 'ring-1 ring-line'"
            :style="{ background: `linear-gradient(${g.angle}deg, ${g.stops.join(',')})` }"
            :title="g.name"
            @click="opt.gradIndex = i"
          />
        </div>
        <div v-else-if="opt.bgType === 'solid'">
          <label class="field-label">底色</label>
          <input v-model="opt.solid" type="color" class="h-12 w-full rounded-xl border border-line" />
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="field-label">留白:{{ opt.padding }}%</label>
            <input v-model.number="opt.padding" type="range" min="0" max="40" step="1" class="w-full accent-brand-600" />
          </div>
          <div>
            <label class="field-label">圓角:{{ opt.radius }} px</label>
            <input v-model.number="opt.radius" type="range" min="0" max="80" step="2" class="w-full accent-brand-600" />
          </div>
          <div>
            <label class="field-label">陰影:{{ opt.shadow }}</label>
            <input v-model.number="opt.shadow" type="range" min="0" max="80" step="2" class="w-full accent-brand-600" />
          </div>
          <div>
            <label class="field-label">輸出比例</label>
            <select v-model="opt.ratio" class="field-input">
              <option v-for="r in ratios" :key="r.id" :value="r.id">{{ r.label }}</option>
            </select>
          </div>
          <div>
            <label class="field-label">輸出格式</label>
            <select v-model="opt.format" class="field-input">
              <option value="image/png">PNG(清晰、可透明)</option>
              <option value="image/jpeg">JPG(檔較小)</option>
            </select>
          </div>
          <div v-if="opt.format === 'image/jpeg'">
            <label class="field-label">JPG 品質:{{ opt.quality }}</label>
            <input v-model.number="opt.quality" type="range" min="50" max="100" step="1" class="w-full accent-brand-600" />
          </div>
          <div>
            <label class="field-label">解析度</label>
            <select v-model.number="opt.scale" class="field-input">
              <option :value="1">1×(原尺寸)</option>
              <option :value="2">2×(更清晰,檔較大)</option>
            </select>
          </div>
        </div>

        <div class="flex flex-wrap gap-3">
          <button class="btn-primary" :disabled="busy" @click="exportImage">
            {{ busy ? '輸出中…' : '產生並下載圖' }}
          </button>
          <a v-if="resultUrl" :href="resultUrl" :download="downloadName" class="inline-flex items-center rounded-xl border border-line bg-white px-5 py-3 font-medium text-ink-700 hover:bg-stone-50">
            下載 · {{ fmtSize(resultSize) }}
          </a>
        </div>
        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      </div>

      <div class="card p-6 space-y-3">
        <span class="text-sm text-ink-500">即時預覽</span>
        <div
          class="overflow-auto rounded-xl border border-line p-3"
          style="background-image: linear-gradient(45deg, #f1f5f9 25%, transparent 25%), linear-gradient(-45deg, #f1f5f9 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f1f5f9 75%), linear-gradient(-45deg, transparent 75%, #f1f5f9 75%); background-size: 20px 20px; background-position: 0 0, 0 10px, 10px -10px, -10px 0;"
        >
          <canvas ref="previewCanvas" class="mx-auto block h-auto max-w-full rounded-lg shadow-sm" />
        </div>
      </div>
    </template>

    <LegalNote title="什麼時候用得到?">
      <ul class="list-disc pl-5 space-y-1">
        <li>把產品截圖、App 畫面、程式碼片段加上<strong>漂亮的漸層背景與陰影</strong>,放進<strong>簡報、社群貼文、作品集、教學文章</strong>,質感立刻不一樣。</li>
        <li>可選 <strong>1:1、9:16(IG 限動)、16:9</strong> 等輸出比例,內容自動置中留白,直接符合各平台版位。</li>
        <li><strong>全程在你瀏覽器用 Canvas 合成、不上傳</strong>,截圖可能含個資也安心;無廣告、無浮水印、免註冊。重新輸出會清掉原圖的 EXIF。</li>
      </ul>
    </LegalNote>
  </div>
</template>
