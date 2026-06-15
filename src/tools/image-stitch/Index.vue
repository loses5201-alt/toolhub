<script setup lang="ts">
import { ref, reactive, computed, onBeforeUnmount } from 'vue'
import LegalNote from '@/components/LegalNote.vue'

/*
  圖片拼接 —— 把多張截圖/相片接成一張長圖(縱向)或長條(橫向),
  全程在瀏覽器用 Canvas 處理,不上傳。常用於把一段 LINE 對話、
  一長串收據或網頁多張截圖併成單張好分享、好存檔。重新編碼會清除 EXIF。
*/
interface Item {
  id: number
  url: string
  img: HTMLImageElement
  w: number
  h: number
  name: string
}

let seq = 0
const items = ref<Item[]>([])
const imgName = ref('')
const error = ref('')
const busy = ref(false)
const resultUrl = ref('')
const resultSize = ref(0)

const opt = reactive({
  direction: 'vertical' as 'vertical' | 'horizontal',
  align: 'center' as 'start' | 'center' | 'end',
  normalize: true, // 縱向統一寬度 / 橫向統一高度
  gap: 0,
  bg: '#ffffff',
  format: 'image/png' as 'image/png' | 'image/jpeg',
  quality: 92,
})

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

async function onFiles(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files || []).filter((f) => f.type.startsWith('image/'))
  input.value = ''
  if (!files.length) return
  error.value = ''
  for (const f of files) {
    try {
      const url = URL.createObjectURL(f)
      const img = await loadImage(url)
      items.value.push({ id: ++seq, url, img, w: img.naturalWidth, h: img.naturalHeight, name: f.name })
      if (!imgName.value) imgName.value = f.name.replace(/\.[^.]+$/, '')
    } catch {
      error.value = '有圖片載入失敗,已略過。'
    }
  }
}

function move(i: number, dir: -1 | 1) {
  const j = i + dir
  if (j < 0 || j >= items.value.length) return
  const arr = items.value
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
}

function remove(i: number) {
  const [it] = items.value.splice(i, 1)
  if (it) URL.revokeObjectURL(it.url)
}

function clearResult() {
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
  resultUrl.value = ''
  resultSize.value = 0
}

function clearAll() {
  for (const it of items.value) URL.revokeObjectURL(it.url)
  items.value = []
  clearResult()
  error.value = ''
}

const canStitch = computed(() => items.value.length >= 2)

async function stitch() {
  if (!canStitch.value) return
  busy.value = true
  error.value = ''
  clearResult()
  try {
    const list = items.value
    const vertical = opt.direction === 'vertical'
    // 跨軸基準尺寸:縱向取寬、橫向取高
    const cross = vertical
      ? Math.max(...list.map((it) => it.w))
      : Math.max(...list.map((it) => it.h))

    // 算出每張縮放後的繪製尺寸
    const draws = list.map((it) => {
      if (!opt.normalize) return { it, w: it.w, h: it.h }
      if (vertical) {
        const s = cross / it.w
        return { it, w: cross, h: Math.round(it.h * s) }
      }
      const s = cross / it.h
      return { it, w: Math.round(it.w * s), h: cross }
    })

    const gap = Math.max(0, Math.round(opt.gap))
    const main = draws.reduce((sum, d) => sum + (vertical ? d.h : d.w), 0) + gap * (draws.length - 1)
    const crossSize = opt.normalize
      ? cross
      : Math.max(...draws.map((d) => (vertical ? d.w : d.h)))

    const canvasW = vertical ? crossSize : main
    const canvasH = vertical ? main : crossSize
    const MAX = 12000 // 控制記憶體,避免超大畫布讓瀏覽器當掉
    if (canvasW > MAX || canvasH > MAX) {
      throw new Error(`拼接後尺寸 ${canvasW}×${canvasH} 過大(上限 ${MAX}px),請減少張數或縮小圖片。`)
    }

    const canvas = document.createElement('canvas')
    canvas.width = canvasW
    canvas.height = canvasH
    const ctx = canvas.getContext('2d')!
    // JPG 無透明,先鋪底色;PNG 也鋪底色讓對齊留白有顏色
    if (opt.format === 'image/jpeg' || opt.bg) {
      ctx.fillStyle = opt.bg
      ctx.fillRect(0, 0, canvasW, canvasH)
    }

    let pos = 0
    for (const d of draws) {
      let x: number, y: number
      if (vertical) {
        const free = crossSize - d.w
        x = opt.align === 'start' ? 0 : opt.align === 'end' ? free : Math.round(free / 2)
        y = pos
      } else {
        const free = crossSize - d.h
        y = opt.align === 'start' ? 0 : opt.align === 'end' ? free : Math.round(free / 2)
        x = pos
      }
      ctx.drawImage(d.it.img, x, y, d.w, d.h)
      pos += (vertical ? d.h : d.w) + gap
    }

    const blob: Blob = await new Promise((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error('輸出失敗'))), opt.format, opt.quality / 100),
    )
    resultUrl.value = URL.createObjectURL(blob)
    resultSize.value = blob.size
  } catch (e) {
    error.value = (e as Error).message || '拼接失敗。'
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
  () => `${imgName.value || 'stitched'}_拼接.${opt.format === 'image/png' ? 'png' : 'jpg'}`,
)

const alignLabel = computed(() =>
  opt.direction === 'vertical'
    ? { start: '靠左', center: '置中', end: '靠右' }
    : { start: '靠上', center: '置中', end: '靠下' },
)

onBeforeUnmount(clearAll)
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">選擇多張圖片</label>
        <input type="file" accept="image/*" multiple class="field-input" @change="onFiles" />
        <p class="field-hint">可一次選多張,或多次加入。順序可在下方調整。全程在你瀏覽器處理,不會上傳。</p>
      </div>

      <div v-if="items.length" class="space-y-2">
        <div
          v-for="(it, i) in items"
          :key="it.id"
          class="flex items-center gap-3 rounded-xl border border-line bg-white p-2"
        >
          <span class="w-6 text-center text-sm text-ink-400 tabular-nums">{{ i + 1 }}</span>
          <img :src="it.url" alt="" class="h-12 w-12 rounded object-cover" />
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm text-ink-800">{{ it.name }}</div>
            <div class="text-xs text-ink-500">{{ it.w }} × {{ it.h }}</div>
          </div>
          <button class="px-2 text-ink-500 hover:text-brand-700 disabled:opacity-30" :disabled="i === 0" title="上移" @click="move(i, -1)">▲</button>
          <button class="px-2 text-ink-500 hover:text-brand-700 disabled:opacity-30" :disabled="i === items.length - 1" title="下移" @click="move(i, 1)">▼</button>
          <button class="px-2 text-rose-500 hover:text-rose-700" title="移除" @click="remove(i)">✕</button>
        </div>
      </div>
    </div>

    <div v-if="items.length" class="card p-6 space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label">拼接方向</label>
          <select v-model="opt.direction" class="field-input">
            <option value="vertical">縱向(由上往下,長圖)</option>
            <option value="horizontal">橫向(由左往右,長條)</option>
          </select>
        </div>
        <div>
          <label class="field-label">對齊方式</label>
          <select v-model="opt.align" class="field-input">
            <option value="start">{{ alignLabel.start }}</option>
            <option value="center">{{ alignLabel.center }}</option>
            <option value="end">{{ alignLabel.end }}</option>
          </select>
        </div>
        <div>
          <label class="field-label">間距:{{ opt.gap }} px</label>
          <input v-model.number="opt.gap" type="range" min="0" max="80" step="2" class="w-full accent-brand-600" />
        </div>
        <div>
          <label class="field-label">底色 / 留白顏色</label>
          <input v-model="opt.bg" type="color" class="h-12 w-full rounded-xl border border-line" />
        </div>
        <div>
          <label class="field-label">輸出格式</label>
          <select v-model="opt.format" class="field-input">
            <option value="image/png">PNG(清晰、可保留透明)</option>
            <option value="image/jpeg">JPG(檔較小)</option>
          </select>
        </div>
        <div v-if="opt.format === 'image/jpeg'">
          <label class="field-label">JPG 品質:{{ opt.quality }}</label>
          <input v-model.number="opt.quality" type="range" min="50" max="100" step="1" class="w-full accent-brand-600" />
        </div>
      </div>
      <label class="flex items-center gap-2 text-sm text-ink-700">
        <input v-model="opt.normalize" type="checkbox" class="accent-brand-600" />
        {{ opt.direction === 'vertical' ? '把每張縮放成相同寬度(推薦,長圖較整齊)' : '把每張縮放成相同高度(推薦,長條較整齊)' }}
      </label>

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

      <div class="flex flex-wrap gap-3">
        <button class="btn-primary" :disabled="!canStitch || busy" @click="stitch">
          {{ busy ? '拼接中…' : '開始拼接' }}
        </button>
        <button class="inline-flex items-center rounded-xl border border-line bg-white px-5 py-3 font-medium text-ink-700 hover:bg-stone-50" @click="clearAll">清空</button>
      </div>
      <p v-if="!canStitch" class="text-sm text-ink-500">至少加入兩張圖片才能拼接。</p>
    </div>

    <div v-if="resultUrl" class="card p-6 space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-sm text-ink-500">拼接結果 · {{ fmtSize(resultSize) }}</span>
        <a :href="resultUrl" :download="downloadName" class="btn-primary !py-1.5 text-sm">下載圖片</a>
      </div>
      <div class="max-h-[28rem] overflow-auto rounded-xl border border-line bg-ink-50/40 p-2">
        <img :src="resultUrl" alt="拼接結果" class="mx-auto h-auto max-w-full" />
      </div>
    </div>

    <LegalNote title="什麼時候用得到?">
      <ul class="list-disc pl-5 space-y-1">
        <li>把一段 <strong>LINE 對話、一長串收據或網頁的多張截圖</strong>接成一張長圖,分享或存檔都方便,不必傳一堆零散圖片。</li>
        <li><strong>縱向</strong>適合對話/網頁截圖,<strong>橫向</strong>適合做前後對比或時間軸。寬高不一時可勾選自動縮放對齊。</li>
        <li><strong>全程在你瀏覽器用 Canvas 合成、不上傳</strong>,截圖可能含個資也安心;無廣告、無浮水印。重新輸出會自動清除照片的 EXIF。</li>
      </ul>
    </LegalNote>
  </div>
</template>
