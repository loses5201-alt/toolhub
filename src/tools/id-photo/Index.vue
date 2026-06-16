<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick } from 'vue'
import LegalNote from '@/components/LegalNote.vue'

/*
  證件照排版 —— 上傳一張大頭照,鎖定比例框出臉部,排成一張 4×6 相片紙(多張一吋/二吋)。
  全程在瀏覽器用 Canvas 處理,臉部照片不上傳;重新編碼會自動清除 EXIF(含 GPS)。
  沖印店要錢、線上排版站要上傳你的臉 —— 這種隱私敏感的事就該在本機做。
*/
const DPI = 300 // 沖印常用解析度
const PAPER = { w: 4, h: 6 } // 4×6 吋相紙
const MARGIN_CM = 0.3 // 紙邊留白
const GAP_CM = 0.2 // 相片間距(方便裁切)
const cmToPx = (cm: number) => Math.round((cm / 2.54) * DPI)

interface Spec {
  id: string
  name: string
  w: number // cm
  h: number // cm
  note: string
}
const SPECS: Spec[] = [
  { id: '2', name: '二吋(3.5 × 4.5 cm)', w: 3.5, h: 4.5, note: '護照、身分證、駕照、健保卡常用' },
  { id: '1', name: '一吋(2.8 × 3.5 cm)', w: 2.8, h: 3.5, note: '履歷、學生證、各式申請表常用' },
]

const imgEl = ref<HTMLImageElement | null>(null)
const imgUrl = ref('')
const imgName = ref('')
const imgW = ref(0)
const imgH = ref(0)
const specId = ref('2')
const spec = computed(() => SPECS.find((s) => s.id === specId.value)!)
const quality = ref(95)
const busy = ref(false)
const error = ref('')

// 排版結果
const sheetUrl = ref('')
const sheetCount = ref(0)
const sheetLandscape = ref(false)

const wrapper = ref<HTMLElement | null>(null)
const previewCanvas = ref<HTMLCanvasElement | null>(null)
// 裁切框(以顯示圖片的 0..1 比例表示),比例鎖定為證件尺寸
const box = reactive({ x: 0.2, y: 0.1, w: 0.6, h: 0.6, dragging: false, startX: 0, startY: 0 })

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

async function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!f || !f.type.startsWith('image/')) return
  if (imgUrl.value) URL.revokeObjectURL(imgUrl.value)
  resetSheet()
  error.value = ''
  try {
    const url = URL.createObjectURL(f)
    const img = await loadImage(url)
    imgUrl.value = url
    imgEl.value = img
    imgW.value = img.naturalWidth
    imgH.value = img.naturalHeight
    imgName.value = f.name
    centerBox()
  } catch {
    error.value = '無法讀取這張圖片,請換一張試試。'
  }
}

// 顯示空間中的縱橫比換算:讓裁切框的「像素比例」等於證件尺寸 w:h
function aspectInFrac() {
  // pixelW/pixelH = (fracW*imgW)/(fracH*imgH) 要等於 spec.w/spec.h
  // => fracH = fracW * (imgW/imgH) / (spec.w/spec.h)
  return (imgW.value / imgH.value) / (spec.value.w / spec.value.h)
}

function centerBox() {
  if (!imgW.value) return
  let w = 0.6
  let h = w * aspectInFrac()
  if (h > 0.92) {
    h = 0.92
    w = h / aspectInFrac()
  }
  box.w = w
  box.h = h
  box.x = (1 - w) / 2
  box.y = Math.max(0, (1 - h) / 2 - 0.05) // 略偏上,留肩膀
  // 初次載入(canvas 尚未掛載)或換尺寸(canvas 尺寸屬性會重設並清空)後才畫,確保畫得到
  void nextTick(drawPreview)
}

watch(specId, () => {
  if (imgEl.value) centerBox()
  resetSheet()
})

// ── 拖曳裁切框(整體移動;比例固定,大小用滑桿調)──
function frac(clientX: number, clientY: number) {
  const r = wrapper.value!.getBoundingClientRect()
  return {
    x: (clientX - r.left) / r.width,
    y: (clientY - r.top) / r.height,
  }
}
function onDown(e: PointerEvent) {
  if (!imgEl.value) return
  ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  const p = frac(e.clientX, e.clientY)
  box.dragging = true
  box.startX = p.x - box.x
  box.startY = p.y - box.y
}
function onMove(e: PointerEvent) {
  if (!box.dragging) return
  const p = frac(e.clientX, e.clientY)
  box.x = Math.min(1 - box.w, Math.max(0, p.x - box.startX))
  box.y = Math.min(1 - box.h, Math.max(0, p.y - box.startY))
}
function onUp() {
  if (!box.dragging) return
  box.dragging = false
  drawPreview()
}

// 裁切框大小(以寬度比例為主,高度依比例連動;夾在邊界內)
const sizePct = ref(60)
watch(sizePct, (v) => {
  let w = Math.min(1, Math.max(0.15, v / 100))
  let h = w * aspectInFrac()
  if (h > 1) {
    h = 1
    w = h / aspectInFrac()
  }
  box.w = w
  box.h = h
  box.x = Math.min(box.x, 1 - w)
  box.y = Math.min(box.y, 1 - h)
  drawPreview()
})

// 裁切區域換算成原圖像素
function cropPx() {
  const sx = Math.round(box.x * imgW.value)
  const sy = Math.round(box.y * imgH.value)
  const sw = Math.round(box.w * imgW.value)
  const sh = Math.round(box.h * imgH.value)
  return { sx, sy, sw, sh }
}

function drawPreview() {
  const cv = previewCanvas.value
  const img = imgEl.value
  if (!cv || !img) return
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, cv.width, cv.height)
  const { sx, sy, sw, sh } = cropPx()
  if (sw > 0 && sh > 0) ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cv.width, cv.height)
}

function resetSheet() {
  if (sheetUrl.value) URL.revokeObjectURL(sheetUrl.value)
  sheetUrl.value = ''
  sheetCount.value = 0
}

// 在指定方向的紙上算可排幾欄幾列
function layoutFor(paperW: number, paperH: number, cellW: number, cellH: number) {
  const m = cmToPx(MARGIN_CM)
  const g = cmToPx(GAP_CM)
  const cols = Math.floor((paperW - 2 * m + g) / (cellW + g))
  const rows = Math.floor((paperH - 2 * m + g) / (cellH + g))
  return { cols: Math.max(0, cols), rows: Math.max(0, rows), m, g }
}

async function generateSheet() {
  if (!imgEl.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const cellW = cmToPx(spec.value.w)
    const cellH = cmToPx(spec.value.h)
    const pW = cmToPx(PAPER.w)
    const pH = cmToPx(PAPER.h)
    // 直式與橫式各算一次,取能放最多張的方向
    const portrait = layoutFor(pW, pH, cellW, cellH)
    const landscape = layoutFor(pH, pW, cellW, cellH)
    const nP = portrait.cols * portrait.rows
    const nL = landscape.cols * landscape.rows
    const useL = nL > nP
    const lay = useL ? landscape : portrait
    const canvasW = useL ? pH : pW
    const canvasH = useL ? pW : pH
    const count = lay.cols * lay.rows
    if (count < 1) {
      error.value = '這個尺寸排不進 4×6 相紙,請改選其他尺寸。'
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = canvasW
    canvas.height = canvasH
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvasW, canvasH)
    // 置中整個相片陣列
    const gridW = lay.cols * cellW + (lay.cols - 1) * lay.g
    const gridH = lay.rows * cellH + (lay.rows - 1) * lay.g
    const offX = Math.round((canvasW - gridW) / 2)
    const offY = Math.round((canvasH - gridH) / 2)
    const { sx, sy, sw, sh } = cropPx()
    for (let r = 0; r < lay.rows; r++) {
      for (let c = 0; c < lay.cols; c++) {
        const x = offX + c * (cellW + lay.g)
        const y = offY + r * (cellH + lay.g)
        ctx.drawImage(imgEl.value, sx, sy, sw, sh, x, y, cellW, cellH)
        ctx.strokeStyle = '#d0d0d0' // 淺灰裁切參考線
        ctx.lineWidth = 1
        ctx.strokeRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1)
      }
    }
    const blob = await new Promise<Blob>((res) =>
      canvas.toBlob((b) => res(b!), 'image/jpeg', quality.value / 100),
    )
    resetSheet()
    sheetUrl.value = URL.createObjectURL(blob)
    sheetCount.value = count
    sheetLandscape.value = useL
  } catch (e) {
    error.value = '排版失敗:' + (e as Error).message
  } finally {
    busy.value = false
  }
}

function downloadSheet() {
  if (!sheetUrl.value) return
  const a = document.createElement('a')
  a.href = sheetUrl.value
  a.download = `${(imgName.value.replace(/\.[^.]+$/, '') || '證件照')}_${spec.value.id}吋_4x6.jpg`
  document.body.appendChild(a)
  a.click()
  a.remove()
}

async function downloadSingle() {
  if (!imgEl.value || busy.value) return
  const { sx, sy, sw, sh } = cropPx()
  const cv = document.createElement('canvas')
  cv.width = cmToPx(spec.value.w)
  cv.height = cmToPx(spec.value.h)
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, cv.width, cv.height)
  ctx.drawImage(imgEl.value, sx, sy, sw, sh, 0, 0, cv.width, cv.height)
  const blob = await new Promise<Blob>((res) =>
    cv.toBlob((b) => res(b!), 'image/jpeg', quality.value / 100),
  )
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(imgName.value.replace(/\.[^.]+$/, '') || '證件照')}_${spec.value.id}吋_單張.jpg`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function pct(v: number) {
  return v * 100 + '%'
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
      <div>
        <label class="field-label">選擇一張大頭照(臉部清楚、背景單純為佳)</label>
        <input type="file" accept="image/*" class="field-input" @change="onFile" />
        <p class="field-hint">照片只在你的瀏覽器處理,不會上傳。建議先用單色背景拍攝,或用「圖片裁切/旋轉」轉正。</p>
      </div>

      <template v-if="imgEl">
        <div>
          <label class="field-label">證件尺寸</label>
          <div class="grid gap-2 sm:grid-cols-2">
            <label
              v-for="s in SPECS"
              :key="s.id"
              class="flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2"
              :class="specId === s.id ? 'border-brand-500 bg-brand-50' : 'border-line bg-white'"
            >
              <input v-model="specId" type="radio" :value="s.id" class="mt-1 accent-brand-600" />
              <span>
                <span class="block font-medium text-ink-800">{{ s.name }}</span>
                <span class="block text-xs text-ink-500">{{ s.note }}</span>
              </span>
            </label>
          </div>
        </div>

        <div class="grid gap-5 sm:grid-cols-[1fr_auto]">
          <div>
            <p class="mb-2 text-sm text-ink-500">
              拖曳藍框移到臉部,框的比例已鎖定為證件尺寸(不會變形)。用下方滑桿調整大小。
            </p>
            <div class="overflow-auto">
              <div
                ref="wrapper"
                class="relative inline-block max-w-full select-none touch-none"
                @pointerdown="onDown"
                @pointermove="onMove"
                @pointerup="onUp"
                @pointercancel="onUp"
              >
                <img :src="imgUrl" alt="大頭照" class="block max-w-full" draggable="false" />
                <div
                  class="absolute cursor-move border-2 border-brand-500 bg-brand-400/10"
                  :style="{ left: pct(box.x), top: pct(box.y), width: pct(box.w), height: pct(box.h) }"
                ></div>
              </div>
            </div>
            <label class="mt-3 flex items-center gap-2 text-sm">
              <span class="text-ink-600 whitespace-nowrap">框大小</span>
              <input v-model.number="sizePct" type="range" min="20" max="100" class="w-full accent-brand-600" />
            </label>
          </div>

          <div class="shrink-0">
            <p class="mb-2 text-sm text-ink-500">單張預覽</p>
            <canvas
              ref="previewCanvas"
              :width="140"
              :height="Math.round(140 * spec.h / spec.w)"
              class="rounded-lg border border-line shadow-sm"
            ></canvas>
          </div>
        </div>

        <label class="flex items-center gap-2 text-sm">
          <span class="text-ink-600">輸出品質 {{ quality }}</span>
          <input v-model.number="quality" type="range" min="70" max="100" class="accent-brand-600" />
        </label>

        <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

        <div class="flex flex-wrap items-center gap-3">
          <button class="btn-primary" :disabled="busy" @click="generateSheet">
            {{ busy ? '排版中…' : '排成 4×6 相片紙' }}
          </button>
          <button
            class="rounded-lg border border-line bg-white px-4 py-2 text-sm hover:border-brand-400 disabled:opacity-40"
            :disabled="busy"
            @click="downloadSingle"
          >
            只下載單張證件照
          </button>
        </div>

        <div v-if="sheetUrl" class="space-y-3 rounded-2xl border border-line bg-brand-50/40 p-4">
          <p class="text-sm text-ink-700">
            已排好 <strong class="text-brand-700">{{ sheetCount }}</strong> 張{{ spec.name.split('(')[0] }},
            {{ sheetLandscape ? '橫式' : '直式' }} 4×6 相紙(300 DPI)。拿這張檔案到沖印店或自助機台沖洗即可。
          </p>
          <img :src="sheetUrl" alt="排版好的相片紙" class="mx-auto max-h-96 rounded-lg border border-line shadow" />
          <button class="btn-primary w-full sm:w-auto" @click="downloadSheet">下載相片紙(JPG)</button>
        </div>
      </template>
    </div>

    <LegalNote title="使用說明與為什麼用這個">
      <ul class="list-disc space-y-1 pl-5">
        <li><strong>不上傳</strong>:臉部照片是高度敏感的個資,本工具全程在你瀏覽器處理,不送任何伺服器。</li>
        <li><strong>沖印店要錢、線上排版站要你上傳臉</strong> —— 這裡免費、無廣告、無浮水印。</li>
        <li>輸出為 300 DPI、4×6 吋標準相紙尺寸,可直接拿去 7-11／全家相片機或沖印店沖洗。</li>
        <li>淺灰線為裁切參考,沖洗後沿線剪開即可。</li>
        <li>各機關對證件照(背景顏色、頭部比例、不露齒等)各有規定,請依該機關公告為準;本工具只負責尺寸排版。</li>
        <li>重新編碼會自動清除 EXIF(含拍攝地點)。</li>
      </ul>
    </LegalNote>
  </div>
</template>
