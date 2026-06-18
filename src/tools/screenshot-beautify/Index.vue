<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import LegalNote from '@/components/LegalNote.vue'

/*
  截圖美化 —— 幫螢幕截圖加上漸層背景留白、圓角、陰影與視窗列,
  讓貼到簡報、社群、部落格、文件的截圖更好看、更專業。
  全程在你瀏覽器用 Canvas 合成,圖片不上傳;無廣告、無浮水印。
  (線上美化截圖站多半要上傳圖片、加浮水印或要付費。)
*/
const GRADIENTS = [
  { name: '海洋', from: '#2563eb', to: '#38bdf8' },
  { name: '夕陽', from: '#f97316', to: '#ec4899' },
  { name: '薄荷', from: '#10b981', to: '#34d399' },
  { name: '葡萄', from: '#7c3aed', to: '#c084fc' },
  { name: '珊瑚', from: '#f43f5e', to: '#fb923c' },
  { name: '晴空', from: '#0ea5e9', to: '#a78bfa' },
  { name: '蜜桃', from: '#fb7185', to: '#fdba74' },
  { name: '石墨', from: '#334155', to: '#64748b' },
  { name: '午夜', from: '#0f172a', to: '#334155' },
]
const RATIOS: { id: string; label: string; v: number | null }[] = [
  { id: 'auto', label: '原比例', v: null },
  { id: '1:1', label: '1:1 正方', v: 1 },
  { id: '16:9', label: '16:9 寬', v: 16 / 9 },
  { id: '4:3', label: '4:3', v: 4 / 3 },
  { id: '3:2', label: '3:2', v: 3 / 2 },
  { id: '9:16', label: '9:16 直', v: 9 / 16 },
]

const canvasRef = ref<HTMLCanvasElement | null>(null)
const baseImg = ref<HTMLImageElement | null>(null)
const baseName = ref('')
const error = ref('')
const copied = ref(false)
const dragOver = ref(false)

const opt = reactive({
  bgType: 'gradient' as 'gradient' | 'solid' | 'transparent',
  gradient: 0,
  solid: '#e5e7eb',
  padPct: 8, // 留白:相對最長邊百分比
  radiusPct: 3, // 圓角:相對最短邊百分比
  shadow: 55, // 陰影強度 0=關
  windowBar: 'none' as 'none' | 'light' | 'dark',
})

const hasImg = computed(() => !!baseImg.value)

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

async function setFile(f: File | null | undefined) {
  if (!f || !f.type.startsWith('image/')) return
  error.value = ''
  try {
    const url = URL.createObjectURL(f)
    const img = await loadImage(url)
    URL.revokeObjectURL(url)
    baseImg.value = img
    baseName.value = (f.name || 'screenshot').replace(/\.[^.]+$/, '')
    await nextTick()
    render()
  } catch {
    error.value = '圖片載入失敗,請換一張試試。'
  }
}

function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  setFile(input.files?.[0])
  input.value = ''
}

function onDrop(e: DragEvent) {
  dragOver.value = false
  setFile(e.dataTransfer?.files?.[0])
}

function onPaste(e: ClipboardEvent) {
  const item = Array.from(e.clipboardData?.items || []).find((i) => i.type.startsWith('image/'))
  if (item) setFile(item.getAsFile())
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function render() {
  const canvas = canvasRef.value
  const img = baseImg.value
  if (!canvas || !img) return

  let iw = img.naturalWidth
  let ih = img.naturalHeight
  const maxDim = Math.max(iw, ih)
  let pad = Math.round((maxDim * opt.padPct) / 100)
  let barH = opt.windowBar === 'none' ? 0 : Math.max(22, Math.round(iw * 0.045))
  let contentW = iw
  let contentH = ih + barH

  let baseW = contentW + pad * 2
  let baseH = contentH + pad * 2
  let canvasW = baseW
  let canvasH = baseH
  const ratio = RATIOS.find((r) => r.id === ratioId.value)?.v ?? null
  if (ratio) {
    if (baseW / baseH < ratio) canvasW = Math.round(baseH * ratio)
    else canvasH = Math.round(baseW / ratio)
  }

  // 控制記憶體:輸出最長邊上限,超過就整體等比縮小
  const MAX = 6000
  const k = Math.min(1, MAX / Math.max(canvasW, canvasH))
  if (k < 1) {
    iw = Math.round(iw * k); ih = Math.round(ih * k); pad = Math.round(pad * k)
    barH = Math.round(barH * k); contentW = iw; contentH = ih + barH
    canvasW = Math.round(canvasW * k); canvasH = Math.round(canvasH * k)
  }
  const radius = Math.round((Math.min(iw, contentH) * opt.radiusPct) / 100)
  const offX = Math.round((canvasW - contentW) / 2)
  const offY = Math.round((canvasH - contentH) / 2)

  canvas.width = canvasW
  canvas.height = canvasH
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvasW, canvasH)

  if (opt.bgType === 'gradient') {
    const g = GRADIENTS[opt.gradient]
    const grad = ctx.createLinearGradient(0, 0, canvasW, canvasH)
    grad.addColorStop(0, g.from)
    grad.addColorStop(1, g.to)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, canvasW, canvasH)
  } else if (opt.bgType === 'solid') {
    ctx.fillStyle = opt.solid
    ctx.fillRect(0, 0, canvasW, canvasH)
  }

  if (opt.shadow > 0) {
    ctx.save()
    ctx.shadowColor = `rgba(0,0,0,${(opt.shadow / 100) * 0.55})`
    ctx.shadowBlur = Math.round(maxDim * k * 0.04 * (opt.shadow / 100) + 6)
    ctx.shadowOffsetY = Math.round(maxDim * k * 0.02 * (opt.shadow / 100) + 2)
    ctx.fillStyle = '#ffffff'
    roundRect(ctx, offX, offY, contentW, contentH, radius)
    ctx.fill()
    ctx.restore()
  }

  ctx.save()
  roundRect(ctx, offX, offY, contentW, contentH, radius)
  ctx.clip()
  if (barH > 0) {
    ctx.fillStyle = opt.windowBar === 'dark' ? '#1f2937' : '#f1f3f5'
    ctx.fillRect(offX, offY, contentW, barH)
    const dotR = Math.max(3, Math.round(barH * 0.16))
    const cy = offY + Math.round(barH / 2)
    const dots = ['#ff5f57', '#febc2e', '#28c840']
    dots.forEach((c, i) => {
      ctx.fillStyle = c
      ctx.beginPath()
      ctx.arc(offX + Math.round(barH * 0.55) + i * dotR * 3, cy, dotR, 0, Math.PI * 2)
      ctx.fill()
    })
  }
  ctx.drawImage(img, offX, offY + barH, iw, ih)
  ctx.restore()
}

const ratioId = ref('auto')
watch([opt, ratioId], () => render(), { deep: true })

function blobFromCanvas(): Promise<Blob> {
  return new Promise((res, rej) =>
    canvasRef.value!.toBlob((b) => (b ? res(b) : rej(new Error('輸出失敗'))), 'image/png'),
  )
}

async function download() {
  if (!hasImg.value) return
  const blob = await blobFromCanvas()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${baseName.value || 'screenshot'}_美化.png`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

async function copyImage() {
  if (!hasImg.value) return
  try {
    const blob = await blobFromCanvas()
    // eslint-disable-next-line no-undef
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    copied.value = true
    setTimeout(() => (copied.value = false), 1800)
  } catch {
    error.value = '這個瀏覽器不支援複製到剪貼簿,請改用「下載 PNG」。'
  }
}

function clearAll() {
  baseImg.value = null
  baseName.value = ''
  error.value = ''
}

onMounted(() => window.addEventListener('paste', onPaste))
onBeforeUnmount(() => window.removeEventListener('paste', onPaste))
</script>

<template>
  <div class="space-y-6">
    <div
      class="card p-6"
      :class="{ 'ring-2 ring-brand-400': dragOver }"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop.prevent="onDrop"
    >
      <label class="field-label">選擇截圖(或直接拖曳 / 貼上 Ctrl+V)</label>
      <input type="file" accept="image/*" class="field-input" @change="onFile" />
      <p class="field-hint">截好圖直接按 Ctrl+V(Mac:Cmd+V)貼進來最快。全程在你瀏覽器處理,圖片不會上傳。</p>
      <p v-if="error" class="mt-2 text-sm text-red-600">{{ error }}</p>
    </div>

    <div v-if="hasImg" class="card p-6 space-y-5">
      <div>
        <label class="field-label">背景</label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="(g, i) in GRADIENTS"
            :key="g.name"
            class="h-9 w-9 rounded-lg border border-line shadow-sm transition hover:scale-110"
            :class="{ 'ring-2 ring-brand-500 ring-offset-1': opt.bgType === 'gradient' && opt.gradient === i }"
            :style="{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }"
            :title="g.name"
            @click="opt.bgType = 'gradient'; opt.gradient = i"
          />
          <label
            class="flex h-9 items-center gap-1.5 rounded-lg border border-line px-2 text-sm"
            :class="{ 'ring-2 ring-brand-500': opt.bgType === 'solid' }"
            title="純色背景"
          >
            <input v-model="opt.solid" type="color" class="h-6 w-6 cursor-pointer rounded" @input="opt.bgType = 'solid'" />
            純色
          </label>
          <button
            class="h-9 rounded-lg border border-line px-3 text-sm"
            :class="{ 'ring-2 ring-brand-500': opt.bgType === 'transparent' }"
            @click="opt.bgType = 'transparent'"
          >
            透明
          </button>
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label">留白:{{ opt.padPct }}%</label>
          <input v-model.number="opt.padPct" type="range" min="0" max="25" step="1" class="w-full accent-brand-600" />
        </div>
        <div>
          <label class="field-label">圓角:{{ opt.radiusPct }}%</label>
          <input v-model.number="opt.radiusPct" type="range" min="0" max="12" step="1" class="w-full accent-brand-600" />
        </div>
        <div>
          <label class="field-label">陰影:{{ opt.shadow === 0 ? '關' : opt.shadow }}</label>
          <input v-model.number="opt.shadow" type="range" min="0" max="100" step="1" class="w-full accent-brand-600" />
        </div>
        <div>
          <label class="field-label">視窗列</label>
          <select v-model="opt.windowBar" class="field-input">
            <option value="none">無</option>
            <option value="light">淺色(含紅黃綠燈)</option>
            <option value="dark">深色(含紅黃綠燈)</option>
          </select>
        </div>
      </div>

      <div>
        <label class="field-label">輸出比例</label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="r in RATIOS"
            :key="r.id"
            class="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-stone-50"
            :class="{ 'border-brand-500 bg-brand-50 text-brand-700': ratioId === r.id }"
            @click="ratioId = r.id"
          >
            {{ r.label }}
          </button>
        </div>
      </div>

      <div class="flex flex-wrap gap-3">
        <button class="btn-primary" @click="download">下載 PNG</button>
        <button class="inline-flex items-center rounded-xl border border-line bg-white px-5 py-3 font-medium text-ink-700 hover:bg-stone-50" @click="copyImage">
          {{ copied ? '已複製 ✓' : '複製到剪貼簿' }}
        </button>
        <button class="inline-flex items-center rounded-xl border border-line bg-white px-5 py-3 font-medium text-ink-700 hover:bg-stone-50" @click="clearAll">換一張</button>
      </div>
    </div>

    <div v-if="hasImg" class="card p-3">
      <div
        class="overflow-auto rounded-xl p-2"
        style="background-image: linear-gradient(45deg, #e7e5e4 25%, transparent 25%), linear-gradient(-45deg, #e7e5e4 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e7e5e4 75%), linear-gradient(-45deg, transparent 75%, #e7e5e4 75%); background-size: 20px 20px; background-position: 0 0, 0 10px, 10px -10px, -10px 0;"
      >
        <canvas ref="canvasRef" class="mx-auto h-auto max-w-full rounded-lg shadow-sm" />
      </div>
    </div>

    <LegalNote title="什麼時候用得到?">
      <ul class="list-disc pl-5 space-y-1">
        <li>把陽春的<strong>螢幕截圖</strong>加上漸層背景、圓角與陰影,貼進<strong>簡報、社群貼文、部落格、產品說明、教學文件</strong>立刻變專業。</li>
        <li>選好<strong>輸出比例</strong>(如 1:1、16:9、9:16)就能直接配合 IG、Facebook、YouTube 縮圖等版位,不用再另外裁切。</li>
        <li>加上 <strong>Mac 風格視窗列(紅黃綠燈)</strong>,App 畫面、網頁截圖看起來更像正式的產品圖。</li>
        <li><strong>全程在你瀏覽器用 Canvas 合成、不上傳</strong>,截圖可能含個資也安心;無廣告、無浮水印,可重複調整即時預覽。</li>
      </ul>
    </LegalNote>
  </div>
</template>
