<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'

/*
  圖片裁切 / 旋轉 —— 把拍歪的照片轉正、裁掉多餘背景,全程在瀏覽器用 Canvas 處理,不上傳。
  以「操作歷史」逐步套用,每步產生新圖,可復原。重新編碼會自動清除 EXIF(含 GPS)。
*/
interface Snapshot {
  url: string
  w: number
  h: number
}

const history = ref<Snapshot[]>([]) // 第 0 筆為原圖,最後一筆為目前狀態
const imgName = ref('')
const format = ref<'image/jpeg' | 'image/png'>('image/jpeg')
const quality = ref(90)
const busy = ref(false)
const error = ref('')

const current = computed<Snapshot | null>(() => history.value[history.value.length - 1] ?? null)
const canUndo = computed(() => history.value.length > 1)

const wrapper = ref<HTMLElement | null>(null)
// 進行中的裁切框(以 0..1 比例表示)
const draft = reactive({ active: false, x: 0, y: 0, w: 0, h: 0, startX: 0, startY: 0 })
const hasCrop = computed(() => draft.w > 0.01 && draft.h > 0.01 && !draft.active)

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

function resetDraft() {
  draft.active = false
  draft.x = draft.y = draft.w = draft.h = 0
}

function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f || !f.type.startsWith('image/')) return
  clearHistory()
  void addFromBlob(f, f.name)
  ;(e.target as HTMLInputElement).value = ''
}

async function addFromBlob(blob: Blob, name?: string) {
  const url = URL.createObjectURL(blob)
  const img = await loadImage(url)
  if (name) imgName.value = name
  history.value.push({ url, w: img.naturalWidth, h: img.naturalHeight })
  resetDraft()
}

function clearHistory() {
  history.value.forEach((s) => URL.revokeObjectURL(s.url))
  history.value = []
  error.value = ''
}

// 共用:把繪製函式套到 canvas 上、轉成 blob 並推進歷史
// 中間步驟一律用無損 PNG 暫存,避免多次旋轉/裁切累積 JPG 失真;
// 真正的格式與品質在「下載」時才套用(旋轉/裁切都會完整覆蓋畫布,無透明縫隙)。
async function commit(outW: number, outH: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  busy.value = true
  error.value = ''
  try {
    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')!
    paint(ctx)
    const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'))
    await addFromBlob(blob)
  } catch (e) {
    error.value = '處理失敗:' + (e as Error).message
  } finally {
    busy.value = false
  }
}

// 旋轉 ±90 度(deg = 90 順時針 / -90 逆時針)
async function rotate(deg: 90 | -90) {
  const cur = current.value
  if (!cur || busy.value) return
  const img = await loadImage(cur.url)
  await commit(cur.h, cur.w, (ctx) => {
    ctx.translate(cur.h / 2, cur.w / 2)
    ctx.rotate((deg * Math.PI) / 180)
    ctx.drawImage(img, -cur.w / 2, -cur.h / 2)
  })
}

// 翻轉(axis = 'h' 水平鏡像 / 'v' 垂直翻轉)
async function flip(axis: 'h' | 'v') {
  const cur = current.value
  if (!cur || busy.value) return
  const img = await loadImage(cur.url)
  await commit(cur.w, cur.h, (ctx) => {
    if (axis === 'h') {
      ctx.translate(cur.w, 0)
      ctx.scale(-1, 1)
    } else {
      ctx.translate(0, cur.h)
      ctx.scale(1, -1)
    }
    ctx.drawImage(img, 0, 0)
  })
}

async function applyCrop() {
  const cur = current.value
  if (!cur || !hasCrop.value || busy.value) return
  const img = await loadImage(cur.url)
  // 把比例換算成原始像素,並夾在邊界內
  const sx = Math.round(draft.x * cur.w)
  const sy = Math.round(draft.y * cur.h)
  const sw = Math.min(Math.round(draft.w * cur.w), cur.w - sx)
  const sh = Math.min(Math.round(draft.h * cur.h), cur.h - sy)
  if (sw < 1 || sh < 1) return
  await commit(sw, sh, (ctx) => {
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
  })
  resetDraft()
}

function undo() {
  if (!canUndo.value) return
  const s = history.value.pop()!
  URL.revokeObjectURL(s.url)
  resetDraft()
}

function reset() {
  while (history.value.length > 1) {
    URL.revokeObjectURL(history.value.pop()!.url)
  }
  resetDraft()
}

const downloadName = computed(() => {
  const base = imgName.value.replace(/\.[^.]+$/, '') || 'image'
  return base + '_已編輯.' + (format.value === 'image/jpeg' ? 'jpg' : 'png')
})

// 下載時依目前選的格式重新編碼,確保副檔名與內容一致(也才會套到品質設定)
async function download() {
  const cur = current.value
  if (!cur || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const img = await loadImage(cur.url)
    const canvas = document.createElement('canvas')
    canvas.width = cur.w
    canvas.height = cur.h
    const ctx = canvas.getContext('2d')!
    if (format.value === 'image/jpeg') {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, cur.w, cur.h)
    }
    ctx.drawImage(img, 0, 0)
    const blob = await new Promise<Blob>((res) =>
      canvas.toBlob((b) => res(b!), format.value, quality.value / 100),
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = downloadName.value
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (e) {
    error.value = '下載失敗:' + (e as Error).message
  } finally {
    busy.value = false
  }
}

// ── 裁切框拖曳 ──
function frac(clientX: number, clientY: number) {
  const r = wrapper.value!.getBoundingClientRect()
  return {
    x: Math.min(1, Math.max(0, (clientX - r.left) / r.width)),
    y: Math.min(1, Math.max(0, (clientY - r.top) / r.height)),
  }
}
function onDown(e: PointerEvent) {
  if (!current.value || busy.value) return
  ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  const p = frac(e.clientX, e.clientY)
  draft.active = true
  draft.startX = p.x
  draft.startY = p.y
  draft.x = p.x
  draft.y = p.y
  draft.w = 0
  draft.h = 0
}
function onMove(e: PointerEvent) {
  if (!draft.active) return
  const p = frac(e.clientX, e.clientY)
  draft.x = Math.min(p.x, draft.startX)
  draft.y = Math.min(p.y, draft.startY)
  draft.w = Math.abs(p.x - draft.startX)
  draft.h = Math.abs(p.y - draft.startY)
}
function onUp() {
  if (!draft.active) return
  draft.active = false
  if (draft.w <= 0.01 || draft.h <= 0.01) resetDraft() // 太小視為誤觸
}
function pct(v: number) {
  return v * 100 + '%'
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
      <div>
        <label class="field-label">選擇要裁切或旋轉的圖片</label>
        <input type="file" accept="image/*" class="field-input" @change="onFile" />
        <p class="field-hint">圖片只在你的瀏覽器處理,不會上傳。適合把拍歪的照片轉正、裁掉多餘背景。</p>
      </div>

      <template v-if="current">
        <div class="flex flex-wrap items-center gap-2 text-sm">
          <button class="rounded-lg border border-line bg-white px-3 py-1.5 hover:border-brand-400 disabled:opacity-40" :disabled="busy" @click="rotate(-90)">↺ 左轉 90°</button>
          <button class="rounded-lg border border-line bg-white px-3 py-1.5 hover:border-brand-400 disabled:opacity-40" :disabled="busy" @click="rotate(90)">↻ 右轉 90°</button>
          <button class="rounded-lg border border-line bg-white px-3 py-1.5 hover:border-brand-400 disabled:opacity-40" :disabled="busy" @click="flip('h')">⇋ 水平鏡像</button>
          <button class="rounded-lg border border-line bg-white px-3 py-1.5 hover:border-brand-400 disabled:opacity-40" :disabled="busy" @click="flip('v')">⇅ 垂直翻轉</button>
          <span class="mx-1 text-ink-300">|</span>
          <label class="flex items-center gap-2">
            <span class="text-ink-600">輸出</span>
            <select v-model="format" class="rounded-lg border border-line bg-white px-2 py-1.5">
              <option value="image/jpeg">JPG</option>
              <option value="image/png">PNG</option>
            </select>
          </label>
          <label v-if="format === 'image/jpeg'" class="flex items-center gap-2">
            <span class="text-ink-600">品質 {{ quality }}</span>
            <input v-model.number="quality" type="range" min="40" max="100" class="accent-brand-600" />
          </label>
        </div>

        <p class="text-sm text-ink-500">在圖片上<strong class="text-ink-700">拖曳</strong>框出要保留的範圍,再按「套用裁切」。目前尺寸:{{ current.w }}×{{ current.h }}</p>

        <div class="overflow-auto">
          <div
            ref="wrapper"
            class="relative inline-block max-w-full select-none touch-none"
            @pointerdown="onDown"
            @pointermove="onMove"
            @pointerup="onUp"
            @pointercancel="onUp"
          >
            <img :src="current.url" alt="編輯中的圖片" class="block max-w-full" draggable="false" />
            <div
              v-if="draft.w > 0.005 && draft.h > 0.005"
              class="absolute border-2 border-dashed border-brand-500 bg-brand-400/15"
              :style="{ left: pct(draft.x), top: pct(draft.y), width: pct(draft.w), height: pct(draft.h) }"
            ></div>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <button class="btn-primary !py-2 text-sm" :disabled="!hasCrop || busy" @click="applyCrop">
            {{ busy ? '處理中…' : '套用裁切' }}
          </button>
          <button class="text-brand-700 underline text-sm disabled:opacity-40" :disabled="!canUndo || busy" @click="undo">復原上一步</button>
          <button class="text-ink-400 underline text-sm hover:text-red-500 disabled:opacity-40" :disabled="!canUndo || busy" @click="reset">回到原圖</button>
        </div>

        <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

        <button class="btn-primary w-full sm:w-auto" :disabled="busy" @click="download">下載目前圖片</button>
      </template>
    </div>

    <LegalNote title="為什麼用這個,而不是網路上的免費裁切站?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>不上傳</strong>:照片(可能含人臉、定位、證件)全程留在你電腦,不送到陌生伺服器。</li>
        <li><strong>無廣告、無浮水印、免註冊</strong>,完全免費。</li>
        <li>裁切與旋轉都會重新編碼,自動<strong>清除 EXIF(含 GPS 拍攝地點)</strong>,分享更安心。</li>
        <li>需要壓縮、改格式或批次處理,可接著用「圖片工坊」。</li>
      </ul>
    </LegalNote>
  </div>
</template>
