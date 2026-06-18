<script setup lang="ts">
import { ref, onMounted } from 'vue'
import LegalNote from '@/components/LegalNote.vue'

/*
  圖片標註編輯器 —— 在截圖/照片上畫箭頭、框重點、打字、畫筆。
  全程在瀏覽器(Canvas),圖片不上傳。採「重繪模型」儲存標註,可乾淨復原。
*/
type Tool = 'pen' | 'arrow' | 'rect' | 'text'
interface Pt { x: number; y: number }
interface Anno { type: Tool; color: string; size: number; pts: Pt[]; text?: string }

const canvasRef = ref<HTMLCanvasElement | null>(null)
const tool = ref<Tool>('arrow')
const color = ref('#e23b3b')
const size = ref(4)
const hasImage = ref(false)

let ctx: CanvasRenderingContext2D | null = null
let baseImg: HTMLImageElement | null = null
const annos: Anno[] = []
let current: Anno | null = null
let drawing = false

async function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  const url = URL.createObjectURL(f)
  const img = new Image()
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url })
  baseImg = img
  const max = 1600
  const scale = Math.min(max / img.naturalWidth, max / img.naturalHeight, 1)
  const c = canvasRef.value!
  c.width = Math.round(img.naturalWidth * scale)
  c.height = Math.round(img.naturalHeight * scale)
  ctx = c.getContext('2d')!
  annos.length = 0
  hasImage.value = true
  render()
  URL.revokeObjectURL(url)
}

function pos(e: PointerEvent): Pt {
  const c = canvasRef.value!
  const r = c.getBoundingClientRect()
  return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height }
}

function drawAnno(a: Anno) {
  if (!ctx) return
  ctx.strokeStyle = a.color
  ctx.fillStyle = a.color
  ctx.lineWidth = a.size
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (a.type === 'pen') {
    ctx.beginPath()
    a.pts.forEach((p, i) => (i ? ctx!.lineTo(p.x, p.y) : ctx!.moveTo(p.x, p.y)))
    ctx.stroke()
  } else if (a.type === 'rect' && a.pts.length === 2) {
    const [p, q] = a.pts
    ctx.strokeRect(p.x, p.y, q.x - p.x, q.y - p.y)
  } else if (a.type === 'arrow' && a.pts.length === 2) {
    const [p, q] = a.pts
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke()
    const ang = Math.atan2(q.y - p.y, q.x - p.x)
    const h = a.size * 4 + 6
    ctx.beginPath()
    ctx.moveTo(q.x, q.y)
    ctx.lineTo(q.x - h * Math.cos(ang - 0.4), q.y - h * Math.sin(ang - 0.4))
    ctx.lineTo(q.x - h * Math.cos(ang + 0.4), q.y - h * Math.sin(ang + 0.4))
    ctx.closePath(); ctx.fill()
  } else if (a.type === 'text' && a.text) {
    ctx.font = `bold ${a.size * 6 + 12}px "Noto Sans TC", sans-serif`
    ctx.textBaseline = 'top'
    ctx.fillText(a.text, a.pts[0].x, a.pts[0].y)
  }
}

function render() {
  if (!ctx || !baseImg) return
  const c = canvasRef.value!
  ctx.clearRect(0, 0, c.width, c.height)
  ctx.drawImage(baseImg, 0, 0, c.width, c.height)
  annos.forEach(drawAnno)
  if (current) drawAnno(current)
}

function down(e: PointerEvent) {
  if (!hasImage.value) return
  const p = pos(e)
  if (tool.value === 'text') {
    const t = window.prompt('輸入文字')
    if (t) { annos.push({ type: 'text', color: color.value, size: size.value, pts: [p], text: t }); render() }
    return
  }
  drawing = true
  current = { type: tool.value, color: color.value, size: size.value, pts: [p] }
  canvasRef.value!.setPointerCapture(e.pointerId)
}
function move(e: PointerEvent) {
  if (!drawing || !current) return
  const p = pos(e)
  if (current.type === 'pen') current.pts.push(p)
  else current.pts[1] = p
  render()
}
function up() {
  if (current) { annos.push(current); current = null }
  drawing = false
  render()
}
function undo() { annos.pop(); render() }
function clearAll() { annos.length = 0; render() }
function download() {
  canvasRef.value!.toBlob((b) => {
    if (!b) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(b)
    a.download = '標註圖.png'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }, 'image/png')
}

onMounted(() => { /* 等使用者選圖 */ })
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <input type="file" accept="image/*" class="field-input" @change="onFile" />

      <div v-if="hasImage" class="flex flex-wrap items-center gap-2">
        <button
          v-for="t in (['arrow', 'rect', 'pen', 'text'] as Tool[])" :key="t"
          class="rounded-lg border px-3 py-1.5 text-sm font-medium transition"
          :class="tool === t ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-700'"
          @click="tool = t"
        >{{ t === 'arrow' ? '箭頭' : t === 'rect' ? '方框' : t === 'pen' ? '畫筆' : '文字' }}</button>
        <input v-model="color" type="color" class="h-8 w-10 cursor-pointer rounded border border-line" />
        <label class="flex items-center gap-1 text-sm text-ink-600">粗細<input v-model.number="size" type="range" min="1" max="12" class="accent-brand-600" /></label>
        <button class="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-600 hover:text-brand-700" @click="undo">復原</button>
        <button class="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-600 hover:text-red-600" @click="clearAll">清除</button>
      </div>

      <div v-show="hasImage" class="overflow-auto rounded-2xl border border-line">
        <canvas
          ref="canvasRef" class="block max-w-full touch-none" style="cursor: crosshair"
          @pointerdown="down" @pointermove="move" @pointerup="up" @pointerleave="up"
        />
      </div>
      <p v-if="!hasImage" class="text-center text-ink-400">選一張截圖或照片開始標註</p>

      <button v-if="hasImage" class="btn-primary w-full sm:w-auto" @click="download">下載標註圖</button>
    </div>

    <LegalNote title="說明">
      <ul class="list-disc pl-5 space-y-1">
        <li>在截圖上畫<strong>箭頭、方框、畫筆、打字</strong>圈重點 —— 做教學步驟、回報問題、標示位置最方便。</li>
        <li>全程在你瀏覽器處理,<strong>圖片不上傳</strong>。文字工具:選「文字」後點畫面即可輸入。</li>
      </ul>
    </LegalNote>
  </div>
</template>
