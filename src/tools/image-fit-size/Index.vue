<script setup lang="ts">
import { ref } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { fmtSize, fitScale, searchQuality } from '@/features/imageFit'

/*
  照片壓到指定大小(KB)—— 報名/考試/上傳系統常限制「照片不得超過 ○○ KB」,
  一般工具只有品質滑桿要自己反覆試。這裡用二分搜尋自動找出「在上限內、品質最高」的 JPEG。
  全程在瀏覽器用 Canvas 編碼,照片不上傳。搜尋演算法在 src/features/imageFit.ts(可測)。
*/
interface Item {
  id: number
  name: string
  img: HTMLImageElement
  origW: number
  origH: number
  origSize: number
  outUrl?: string
  outSize?: number
  outW?: number
  outH?: number
  quality?: number
  ok?: boolean // 是否壓進目標
}

const items = ref<Item[]>([])
const targetKB = ref(500)
const maxEdge = ref<number | null>(null)
const busy = ref(false)
const error = ref('')
let uid = 0

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('無法讀取此圖片'))
    img.src = url
  })
}

async function onFiles(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (!files.length) return
  error.value = ''
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue
    const url = URL.createObjectURL(f)
    try {
      const img = await loadImage(url)
      items.value.push({
        id: uid++,
        name: f.name.replace(/\.[^.]+$/, ''),
        img,
        origW: img.naturalWidth,
        origH: img.naturalHeight,
        origSize: f.size,
      })
    } catch {
      error.value = `「${f.name}」讀取失敗,已略過。`
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

// 把 img 依 scale 畫進 canvas,回傳 canvas
function drawScaled(img: HTMLImageElement, scale: number): HTMLCanvasElement {
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fff' // JPEG 無透明,透明區填白避免變黑
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  return c
}

function encodeSize(c: HTMLCanvasElement, q: number): Promise<{ blob: Blob; size: number }> {
  return new Promise((resolve, reject) => {
    c.toBlob(
      (b) => (b ? resolve({ blob: b, size: b.size }) : reject(new Error('編碼失敗'))),
      'image/jpeg',
      q / 100,
    )
  })
}

async function processOne(it: Item, targetBytes: number) {
  if (it.outUrl) URL.revokeObjectURL(it.outUrl)
  // 起始縮放:套用最長邊上限(若有)
  let scale = fitScale(it.origW, it.origH, maxEdge.value)
  let lastBlob: Blob | null = null
  let lastResult: { quality: number; size: number; ok: boolean } | null = null
  // 最多再縮 8 輪:若連最低品質都超標,縮小尺寸後重試
  for (let round = 0; round < 8; round++) {
    const canvas = drawScaled(it.img, scale)
    const blobs = new Map<number, Blob>()
    const measure = async (q: number) => {
      const { blob, size } = await encodeSize(canvas, q)
      blobs.set(q, blob)
      return size
    }
    const r = await searchQuality(measure, targetBytes, { minQ: 20, maxQ: 92, iters: 9 })
    lastBlob = blobs.get(r.quality) ?? null
    lastResult = { quality: r.quality, size: r.size, ok: r.underTarget }
    it.outW = canvas.width
    it.outH = canvas.height
    if (r.underTarget) break
    // 壓不進去且還能再縮(避免縮到太小)→ 再縮 18%
    if (Math.max(canvas.width, canvas.height) <= 200) break
    scale *= 0.82
  }
  if (lastBlob && lastResult) {
    it.outUrl = URL.createObjectURL(lastBlob)
    it.outSize = lastResult.size
    it.quality = lastResult.quality
    it.ok = lastResult.ok
  }
}

async function run() {
  if (!items.value.length || busy.value) return
  const kb = Number(targetKB.value)
  if (!kb || kb <= 0) {
    error.value = '請輸入有效的大小上限(KB)。'
    return
  }
  busy.value = true
  error.value = ''
  try {
    const targetBytes = Math.round(kb * 1024)
    for (const it of items.value) await processOne(it, targetBytes)
  } catch (e) {
    error.value = '處理失敗:' + (e as Error).message
  } finally {
    busy.value = false
  }
}

function download(it: Item) {
  if (!it.outUrl) return
  const a = document.createElement('a')
  a.href = it.outUrl
  a.download = `${it.name}_${targetKB.value}KB.jpg`
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function remove(id: number) {
  const it = items.value.find((x) => x.id === id)
  if (it?.outUrl) URL.revokeObjectURL(it.outUrl)
  items.value = items.value.filter((x) => x.id !== id)
}

function clearAll() {
  for (const it of items.value) if (it.outUrl) URL.revokeObjectURL(it.outUrl)
  items.value = []
  error.value = ''
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
      <div>
        <label class="field-label">選擇照片(可多選,逐張壓到同一上限)</label>
        <input type="file" accept="image/*" multiple class="field-input" @change="onFiles" />
        <p class="field-hint">照片只在你的瀏覽器處理、不會上傳。輸出為 JPG(壓縮率最佳)。</p>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block text-sm">
          <span class="field-label">大小上限(KB)</span>
          <input
            v-model.number="targetKB"
            type="number"
            min="1"
            class="field-input"
            placeholder="例:500"
          />
          <span class="field-hint">系統若寫「2MB」請填 2048;「100KB」就填 100。</span>
        </label>
        <label class="block text-sm">
          <span class="field-label">最長邊上限(px,選填)</span>
          <input
            v-model.number="maxEdge"
            type="number"
            min="0"
            class="field-input"
            placeholder="留空 = 不限制,僅靠品質壓"
          />
          <span class="field-hint">有些系統也限制像素尺寸,可一併指定。</span>
        </label>
      </div>

      <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

      <div v-if="items.length" class="flex flex-wrap items-center gap-3">
        <button class="btn-primary !py-2 text-sm" :disabled="busy" @click="run">
          {{ busy ? '壓縮中…' : '開始壓到上限內' }}
        </button>
        <button
          class="text-ink-400 underline text-sm hover:text-red-500 disabled:opacity-40"
          :disabled="busy"
          @click="clearAll"
        >
          清空重來
        </button>
      </div>

      <ul v-if="items.length" class="space-y-2">
        <li
          v-for="it in items"
          :key="it.id"
          class="rounded-xl border border-line bg-white p-3 text-sm"
        >
          <div class="flex items-center gap-2">
            <span class="flex-1 truncate font-medium text-ink-700">{{ it.name }}</span>
            <button class="text-ink-400 hover:text-red-500" title="移除" @click="remove(it.id)">
              ✕
            </button>
          </div>
          <p class="mt-1 text-xs text-ink-500">
            原始:{{ it.origW }}×{{ it.origH }}・{{ fmtSize(it.origSize) }}
          </p>
          <div v-if="it.outUrl" class="mt-2 flex flex-wrap items-center gap-3">
            <span
              class="rounded px-2 py-0.5 text-xs font-medium"
              :class="it.ok ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'"
            >
              {{ it.ok ? '已達標' : '已是最小,仍略大' }}:{{ fmtSize(it.outSize!) }}
            </span>
            <span class="text-xs text-ink-500">
              {{ it.outW }}×{{ it.outH }}・品質 {{ it.quality }}
            </span>
            <button class="btn-primary !py-1.5 !px-3 text-xs" @click="download(it)">下載</button>
          </div>
        </li>
      </ul>
    </div>

    <LegalNote title="為什麼需要這個?">
      <ul class="list-disc pl-5 space-y-1">
        <li>
          報名、考試、政府或公司系統常規定「照片不得超過 ○○ KB」,一般工具只有品質滑桿,要自己反覆試;
          這支用<strong>二分搜尋自動找出上限內畫質最高</strong>的設定。
        </li>
        <li>
          <strong>不上傳</strong>:大頭照、證件照全程留在你的裝置處理,不送到陌生網站。
        </li>
        <li>
          若連最低品質都還超過上限,會自動<strong>逐步縮小尺寸</strong>再試;標示「仍略大」時請放寬上限或尺寸。
        </li>
        <li>需要排成 4×6 沖洗或固定一吋/二吋尺寸,請改用「證件照排版」。</li>
        <li>輸出為 JPG;透明背景會填白(JPG 不支援透明)。結果僅供上傳,正式用途請確認系統其他規定。</li>
      </ul>
    </LegalNote>
  </div>
</template>
