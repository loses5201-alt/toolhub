<script setup lang="ts">
import { ref, onMounted } from 'vue'
import LegalNote from '@/components/LegalNote.vue'

/*
  手寫簽名製作 —— 在畫布上簽名,匯出「透明背景」PNG。
  全程在瀏覽器,簽名不上傳。可直接貼進 PDF/Word 文件電子簽名,免印出再掃。
*/
const canvasRef = ref<HTMLCanvasElement | null>(null)
const color = ref('#1c1a17')
const thickness = ref(3)
const isEmpty = ref(true)
const downloadUrl = ref('')

let ctx: CanvasRenderingContext2D | null = null
let drawing = false
let last = { x: 0, y: 0 }

const W = 700
const H = 280

onMounted(() => {
  const c = canvasRef.value!
  c.width = W
  c.height = H
  ctx = c.getContext('2d')!
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
})

function pos(e: PointerEvent) {
  const rect = canvasRef.value!.getBoundingClientRect()
  return {
    x: ((e.clientX - rect.left) / rect.width) * W,
    y: ((e.clientY - rect.top) / rect.height) * H,
  }
}

function start(e: PointerEvent) {
  drawing = true
  last = pos(e)
  canvasRef.value!.setPointerCapture(e.pointerId)
}
function move(e: PointerEvent) {
  if (!drawing || !ctx) return
  const p = pos(e)
  ctx.strokeStyle = color.value
  ctx.lineWidth = thickness.value
  ctx.beginPath()
  ctx.moveTo(last.x, last.y)
  ctx.lineTo(p.x, p.y)
  ctx.stroke()
  last = p
  isEmpty.value = false
  if (downloadUrl.value) {
    URL.revokeObjectURL(downloadUrl.value)
    downloadUrl.value = ''
  }
}
function end() {
  drawing = false
}

function clear() {
  ctx?.clearRect(0, 0, W, H)
  isEmpty.value = true
  if (downloadUrl.value) {
    URL.revokeObjectURL(downloadUrl.value)
    downloadUrl.value = ''
  }
}

function exportPng() {
  canvasRef.value!.toBlob((blob) => {
    if (!blob) return
    if (downloadUrl.value) URL.revokeObjectURL(downloadUrl.value)
    downloadUrl.value = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl.value
    a.download = '簽名.png'
    a.click()
  }, 'image/png')
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div class="flex flex-wrap items-center gap-4">
        <label class="flex items-center gap-2 text-ink-700">
          顏色
          <input v-model="color" type="color" class="h-9 w-12 cursor-pointer rounded border border-line" />
        </label>
        <label class="flex items-center gap-2 text-ink-700">
          粗細 {{ thickness }}
          <input v-model.number="thickness" type="range" min="1" max="10" class="accent-brand-600" />
        </label>
        <button class="ml-auto rounded-lg border border-line px-3 py-1.5 text-ink-600 hover:text-red-600" @click="clear">
          清除重簽
        </button>
      </div>

      <div class="overflow-hidden rounded-2xl border-2 border-dashed border-line bg-[repeating-conic-gradient(#f3f0e9_0%_25%,#fff_0%_50%)] bg-[length:24px_24px]">
        <canvas
          ref="canvasRef"
          class="block w-full touch-none"
          style="aspect-ratio: 700 / 280; cursor: crosshair"
          @pointerdown="start"
          @pointermove="move"
          @pointerup="end"
          @pointerleave="end"
        />
      </div>
      <p class="text-center text-sm text-ink-400">用滑鼠、觸控筆或手指在上面簽名(棋盤格代表透明背景)</p>

      <button class="btn-primary w-full sm:w-auto" :disabled="isEmpty" @click="exportPng">
        下載透明 PNG
      </button>
    </div>

    <LegalNote title="怎麼用 / 為什麼用這個">
      <ul class="list-disc pl-5 space-y-1">
        <li>下載的 PNG 是<strong>透明背景</strong>,可直接拖進 Word、PDF(用 PDF 工坊)、簡報當電子簽名,<strong>免印出再掃描</strong>。</li>
        <li>簽名全程在你瀏覽器產生,<strong>不上傳</strong> —— 簽名是個資,別丟到陌生網站。</li>
      </ul>
    </LegalNote>
  </div>
</template>
