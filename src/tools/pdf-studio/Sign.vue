<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import {
  renderPageDataUrl,
  signPdf,
  dataUrlToBytes,
  downloadBlob,
  fmtSize,
  type SignPlacement,
} from './lib'

/*
  PDF 簽名 —— 手寫或上傳簽名圖,拖到 PDF 上指定位置蓋章。
  不用印出來再掃描;線上簽名工具要把機密合約上傳,本工具全程在瀏覽器處理、不上傳。
  簽名以透明 PNG 蓋上頁面;上傳的白底簽名可一鍵去白底,蓋上去才不會擋住內容。
*/
const file = ref<File | null>(null)
let buffer: ArrayBuffer | null = null
const loading = ref(false)
const busy = ref(false)
const error = ref('')

// 預覽頁
const pageIndex = ref(0) // 0-based
const pageCount = ref(0)
const preview = reactive({ dataUrl: '', dispW: 0, dispH: 0 })

// 簽名圖
const mode = ref<'draw' | 'upload'>('draw')
const sigUrl = ref('') // 透明 PNG dataUrl
const sigAspect = ref(2.9) // 寬/高

// 簽名框(預覽座標 px,左上原點)
const box = reactive({ left: 0, top: 0, w: 0 })
const boxH = computed(() => (sigAspect.value > 0 ? box.w / sigAspect.value : box.w))
const widthPct = ref(35)

function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!f || !(f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))) return
  file.value = f
  pageIndex.value = 0
  loadPage()
}

async function loadPage() {
  if (!file.value) return
  loading.value = true
  error.value = ''
  try {
    if (!buffer) buffer = await file.value.arrayBuffer()
    const r = await renderPageDataUrl(buffer, pageIndex.value, 560)
    pageCount.value = r.count
    const s = 560 / Math.max(r.wpt, r.hpt)
    preview.dataUrl = r.dataUrl
    preview.dispW = Math.round(r.wpt * s)
    preview.dispH = Math.round(r.hpt * s)
    if (sigUrl.value) resetBox()
  } catch (err) {
    error.value = '無法讀取此 PDF,可能損毀或受密碼保護:' + (err as Error).message
  } finally {
    loading.value = false
  }
}

function gotoPage(i: number) {
  if (i < 0 || i >= pageCount.value || i === pageIndex.value) return
  pageIndex.value = i
  loadPage()
}

function resetBox() {
  box.w = Math.round((preview.dispW * widthPct.value) / 100)
  box.left = Math.round((preview.dispW - box.w) / 2)
  box.top = Math.round(Math.min(preview.dispH * 0.72, preview.dispH - boxH.value))
  clampBox()
}

function onWidth() {
  box.w = Math.round((preview.dispW * widthPct.value) / 100)
  clampBox()
}

function clampBox() {
  box.w = Math.max(20, Math.min(box.w, preview.dispW))
  box.left = Math.max(0, Math.min(box.left, preview.dispW - box.w))
  box.top = Math.max(0, Math.min(box.top, preview.dispH - boxH.value))
}

// ── 拖曳簽名框 ──
const wrapEl = ref<HTMLElement | null>(null)
let dragDX = 0
let dragDY = 0
function startDrag(e: PointerEvent) {
  if (!wrapEl.value) return
  const rect = wrapEl.value.getBoundingClientRect()
  dragDX = e.clientX - rect.left - box.left
  dragDY = e.clientY - rect.top - box.top
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  window.addEventListener('pointermove', onDrag)
  window.addEventListener('pointerup', endDrag)
  e.preventDefault()
}
function onDrag(e: PointerEvent) {
  if (!wrapEl.value) return
  const rect = wrapEl.value.getBoundingClientRect()
  box.left = e.clientX - rect.left - dragDX
  box.top = e.clientY - rect.top - dragDY
  clampBox()
}
function endDrag() {
  window.removeEventListener('pointermove', onDrag)
  window.removeEventListener('pointerup', endDrag)
}

// ── 手寫板 ──
const pad = ref<HTMLCanvasElement | null>(null)
let drawing = false
let lastX = 0
let lastY = 0
const hasInk = ref(false)
function padPos(e: PointerEvent) {
  const c = pad.value!
  const rect = c.getBoundingClientRect()
  return { x: ((e.clientX - rect.left) / rect.width) * c.width, y: ((e.clientY - rect.top) / rect.height) * c.height }
}
function padDown(e: PointerEvent) {
  const p = padPos(e)
  drawing = true
  lastX = p.x
  lastY = p.y
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
}
function padMove(e: PointerEvent) {
  if (!drawing) return
  const c = pad.value!
  const ctx = c.getContext('2d')!
  const p = padPos(e)
  ctx.strokeStyle = '#0b1a3a'
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(lastX, lastY)
  ctx.lineTo(p.x, p.y)
  ctx.stroke()
  lastX = p.x
  lastY = p.y
  hasInk.value = true
}
function padUp() {
  drawing = false
  if (hasInk.value) commitDraw()
}
function clearPad() {
  const c = pad.value
  if (c) c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
  hasInk.value = false
  sigUrl.value = ''
}
function commitDraw() {
  const c = pad.value!
  sigAspect.value = c.width / c.height
  sigUrl.value = c.toDataURL('image/png')
  resetBox()
}

// ── 上傳簽名圖 ──
const removeWhite = ref(true)
function onSigFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!f || !f.type.startsWith('image/')) return
  const img = new Image()
  img.onload = () => {
    const c = document.createElement('canvas')
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    const ctx = c.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    if (removeWhite.value) {
      const d = ctx.getImageData(0, 0, c.width, c.height)
      const a = d.data
      for (let i = 0; i < a.length; i += 4) {
        if (a[i] > 235 && a[i + 1] > 235 && a[i + 2] > 235) a[i + 3] = 0
      }
      ctx.putImageData(d, 0, 0)
    }
    sigAspect.value = c.width / c.height
    sigUrl.value = c.toDataURL('image/png')
    resetBox()
  }
  img.onerror = () => (error.value = '無法讀取此圖片')
  img.src = URL.createObjectURL(f)
}

const ready = computed(() => !!buffer && !!sigUrl.value && preview.dispW > 0)

async function apply() {
  if (!buffer || !sigUrl.value || !ready.value) return
  busy.value = true
  error.value = ''
  try {
    const png = await dataUrlToBytes(sigUrl.value)
    const place: SignPlacement = {
      pageIndex: pageIndex.value,
      xPct: box.left / preview.dispW,
      yPct: box.top / preview.dispH,
      wPct: box.w / preview.dispW,
      hPct: boxH.value / preview.dispH,
    }
    const bytes = await signPdf(buffer, png, place)
    const base = file.value!.name.replace(/\.[^.]+$/, '')
    downloadBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `${base}_已簽名.pdf`)
  } catch (e) {
    error.value = '簽署失敗:' + (e as Error).message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="field-label">選擇要簽名的 PDF</label>
      <input type="file" accept="application/pdf" class="field-input" @change="onFile" />
      <p class="field-hint">
        <template v-if="file">已選:📄 {{ file.name }}（{{ fmtSize(file.size) }}）</template>
        <template v-else>檔案只在你的瀏覽器處理,不會上傳。簽完直接下載已簽名的新檔。</template>
      </p>
    </div>

    <p v-if="loading" class="text-ink-500">正在渲染頁面預覽…</p>
    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

    <template v-if="file && preview.dataUrl">
      <!-- 簽名來源 -->
      <div class="rounded-xl border border-line bg-stone-50 p-3 space-y-3">
        <div class="flex gap-2">
          <button
            type="button"
            class="rounded-lg border px-3 py-1.5 text-sm transition"
            :class="mode === 'draw' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-700'"
            @click="mode = 'draw'"
          >✍️ 手寫簽名</button>
          <button
            type="button"
            class="rounded-lg border px-3 py-1.5 text-sm transition"
            :class="mode === 'upload' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-700'"
            @click="mode = 'upload'"
          >🖼️ 上傳簽名圖</button>
        </div>

        <div v-if="mode === 'draw'" class="space-y-2">
          <canvas
            ref="pad"
            width="640"
            height="200"
            class="w-full touch-none rounded-lg border border-dashed border-stone-300 bg-white"
            style="aspect-ratio: 640 / 200"
            @pointerdown="padDown"
            @pointermove="padMove"
            @pointerup="padUp"
            @pointerleave="padUp"
          ></canvas>
          <div class="flex items-center gap-3 text-sm">
            <button type="button" class="text-brand-700 underline" @click="clearPad">清除重寫</button>
            <span class="text-ink-500">用滑鼠或手指在框內簽名</span>
          </div>
        </div>

        <div v-else class="space-y-2">
          <input type="file" accept="image/*" class="field-input" @change="onSigFile" />
          <label class="flex items-center gap-2 text-sm text-ink-700">
            <input v-model="removeWhite" type="checkbox" class="h-4 w-4 accent-brand-600" />
            去掉白底(把接近白色的背景變透明,蓋上去才不擋內容)
          </label>
        </div>
      </div>

      <!-- 頁面選擇 -->
      <div v-if="pageCount > 1" class="flex items-center gap-2 text-sm">
        <button class="rounded border border-line px-2 py-1 disabled:opacity-30" :disabled="pageIndex === 0" @click="gotoPage(pageIndex - 1)">◀ 上一頁</button>
        <span class="text-ink-600">第 {{ pageIndex + 1 }} / {{ pageCount }} 頁</span>
        <button class="rounded border border-line px-2 py-1 disabled:opacity-30" :disabled="pageIndex === pageCount - 1" @click="gotoPage(pageIndex + 1)">下一頁 ▶</button>
      </div>

      <!-- 定位預覽 -->
      <div class="overflow-auto">
        <div
          ref="wrapEl"
          class="relative mx-auto select-none border border-line bg-white shadow-sm"
          :style="{ width: preview.dispW + 'px', height: preview.dispH + 'px' }"
        >
          <img :src="preview.dataUrl" alt="頁面預覽" class="block h-full w-full" draggable="false" />
          <div
            v-if="sigUrl"
            class="absolute cursor-move touch-none rounded ring-2 ring-brand-500/70"
            :style="{ left: box.left + 'px', top: box.top + 'px', width: box.w + 'px', height: boxH + 'px' }"
            @pointerdown="startDrag"
          >
            <img :src="sigUrl" alt="簽名" class="pointer-events-none block h-full w-full" draggable="false" />
          </div>
        </div>
      </div>
      <p v-if="!sigUrl" class="field-hint">先在上方完成手寫或上傳簽名,簽名框就會出現在預覽上,可拖曳到要簽的位置。</p>

      <div v-if="sigUrl">
        <label class="field-label">簽名大小:{{ widthPct }}%(頁寬)</label>
        <input v-model.number="widthPct" type="range" min="10" max="90" step="1" class="w-full accent-brand-600" @input="onWidth" />
      </div>

      <button class="btn-primary w-full sm:w-auto" :disabled="!ready || busy" @click="apply">
        {{ busy ? '簽署中…' : !sigUrl ? '請先完成簽名' : `把簽名蓋到第 ${pageIndex + 1} 頁並下載` }}
      </button>
      <p class="field-hint">提示:簽名會合進該頁內容成為圖像。如需多處簽名,可重複用「已簽名」的檔再簽一次。本工具僅疊上圖像,非具法律效力的數位憑證簽章。</p>
    </template>
  </div>
</template>
