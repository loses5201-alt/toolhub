<script setup lang="ts">
import { ref, reactive, computed, onBeforeUnmount } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { planGridTiles, computeCoverCrop, type GridTile } from '@/features/imageGrid'

/*
  IG 九宮格切圖 —— 把一張圖切成 cols×rows 塊,依序貼到 Instagram 個人檔案,
  在主頁拼回一整張大圖(banner)。全程在你瀏覽器用 Canvas 裁切,圖片不上傳、
  無廣告、無浮水印。
*/
interface Source {
  url: string
  img: HTMLImageElement
  w: number
  h: number
  name: string
}

const source = ref<Source | null>(null)
const error = ref('')
const busy = ref(false)
const dragOver = ref(false)

const opt = reactive({
  cols: 3,
  rows: 3,
  format: 'image/jpeg' as 'image/jpeg' | 'image/png',
  quality: 0.92,
})

interface OutTile extends GridTile {
  url: string
}
const outTiles = ref<OutTile[]>([])

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

async function loadFile(file: File) {
  if (!file.type.startsWith('image/')) {
    error.value = '請選擇圖片檔。'
    return
  }
  clearOut()
  reset()
  error.value = ''
  try {
    const url = URL.createObjectURL(file)
    const img = await loadImage(url)
    source.value = { url, img, w: img.naturalWidth, h: img.naturalHeight, name: file.name.replace(/\.[^.]+$/, '') }
  } catch {
    error.value = '圖片載入失敗。'
  }
}

function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.[0]) loadFile(input.files[0])
  input.value = ''
}
function onDrop(e: DragEvent) {
  dragOver.value = false
  const f = e.dataTransfer?.files?.[0]
  if (f) loadFile(f)
}

function reset() {
  if (source.value) URL.revokeObjectURL(source.value.url)
  source.value = null
}
function clearOut() {
  for (const t of outTiles.value) URL.revokeObjectURL(t.url)
  outTiles.value = []
}

// 預覽:裁切框在原圖上的相對位置(百分比),讓使用者知道會切掉哪些邊
const cropPreview = computed(() => {
  const s = source.value
  if (!s) return null
  const c = computeCoverCrop(s.w, s.h, opt.cols, opt.rows)
  return {
    left: (c.sx / s.w) * 100,
    top: (c.sy / s.h) * 100,
    width: (c.sw / s.w) * 100,
    height: (c.sh / s.h) * 100,
  }
})

const tileCount = computed(() => opt.cols * opt.rows)
const ext = computed(() => (opt.format === 'image/png' ? 'png' : 'jpg'))

function blobOf(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('輸出失敗'))),
      opt.format,
      opt.format === 'image/jpeg' ? opt.quality : undefined,
    )
  })
}

async function split() {
  const s = source.value
  if (!s || busy.value) return
  busy.value = true
  error.value = ''
  clearOut()
  try {
    const tiles = planGridTiles(s.w, s.h, opt.cols, opt.rows)
    const result: OutTile[] = []
    for (const t of tiles) {
      const canvas = document.createElement('canvas')
      // 輸出像素 = 來源裁切像素(維持原解析度,IG 會再自行壓)
      canvas.width = Math.max(1, Math.round(t.src.sw))
      canvas.height = Math.max(1, Math.round(t.src.sh))
      const ctx = canvas.getContext('2d')!
      if (opt.format === 'image/jpeg') {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      ctx.drawImage(s.img, t.src.sx, t.src.sy, t.src.sw, t.src.sh, 0, 0, canvas.width, canvas.height)
      const blob = await blobOf(canvas)
      result.push({ ...t, url: URL.createObjectURL(blob) })
    }
    outTiles.value = result
  } catch (e) {
    error.value = (e as Error).message || '切圖失敗。'
  } finally {
    busy.value = false
  }
}

function tileName(t: OutTile): string {
  const base = source.value?.name || 'grid'
  // 檔名前綴用「發文順序」,方便依序上傳
  return `${base}_${String(t.postOrder).padStart(2, '0')}_格${t.displayIndex}.${ext.value}`
}

async function downloadZip() {
  if (!outTiles.value.length) return
  busy.value = true
  try {
    const { buildZip } = await import('@/features/zipStudio')
    const files = await Promise.all(
      outTiles.value.map(async (t) => ({
        name: tileName(t),
        data: new Uint8Array(await (await fetch(t.url)).arrayBuffer()),
      })),
    )
    const bytes = await buildZip(files, { level: 0 })
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/zip' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${source.value?.name || 'grid'}_九宮格.zip`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  } catch (e) {
    error.value = (e as Error).message || '打包失敗。'
  } finally {
    busy.value = false
  }
}

onBeforeUnmount(() => {
  reset()
  clearOut()
})
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div
        class="rounded-xl border-2 border-dashed p-6 text-center transition-colors"
        :class="dragOver ? 'border-brand-500 bg-brand-50' : 'border-line bg-stone-50'"
        @dragover.prevent="dragOver = true"
        @dragleave.prevent="dragOver = false"
        @drop.prevent="onDrop"
      >
        <label class="field-label">選擇一張圖片(或拖曳到這裡)</label>
        <input type="file" accept="image/*" class="field-input mt-2" @change="onFile" />
        <p class="field-hint">會切成多格,依序貼到 IG 主頁就拼成一整張大圖。全程在你瀏覽器處理,不會上傳。</p>
      </div>
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

      <div v-if="source" class="space-y-3">
        <div class="relative mx-auto max-w-md overflow-hidden rounded-xl border border-line">
          <img :src="source.url" alt="原圖" class="block w-full opacity-60" />
          <div
            v-if="cropPreview"
            class="absolute border-2 border-brand-500 bg-brand-500/10"
            :style="{ left: cropPreview.left + '%', top: cropPreview.top + '%', width: cropPreview.width + '%', height: cropPreview.height + '%' }"
          >
            <div class="pointer-events-none absolute inset-0 grid"
              :style="{ gridTemplateColumns: `repeat(${opt.cols}, 1fr)`, gridTemplateRows: `repeat(${opt.rows}, 1fr)` }">
              <div v-for="n in tileCount" :key="n" class="border border-white/70"></div>
            </div>
          </div>
        </div>
        <p class="text-center text-xs text-ink-500">{{ source.w }}×{{ source.h }} · 框內為實際輸出範圍,框外會被裁掉(置中保留)。</p>
      </div>
    </div>

    <div v-if="source" class="card p-6 space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label">欄數(橫向):{{ opt.cols }}</label>
          <input v-model.number="opt.cols" type="range" min="1" max="5" step="1" class="w-full accent-brand-600" />
          <p class="field-hint">IG 一排是 3 格,最常用 3。</p>
        </div>
        <div>
          <label class="field-label">列數(縱向):{{ opt.rows }}</label>
          <input v-model.number="opt.rows" type="range" min="1" max="5" step="1" class="w-full accent-brand-600" />
          <p class="field-hint">共 {{ tileCount }} 格 = 要發 {{ tileCount }} 則貼文。</p>
        </div>
        <div>
          <label class="field-label">輸出格式</label>
          <select v-model="opt.format" class="field-input">
            <option value="image/jpeg">JPG(檔案小,適合照片)</option>
            <option value="image/png">PNG(無損,適合圖文)</option>
          </select>
        </div>
        <div v-if="opt.format === 'image/jpeg'">
          <label class="field-label">JPG 品質:{{ Math.round(opt.quality * 100) }}%</label>
          <input v-model.number="opt.quality" type="range" min="0.5" max="1" step="0.02" class="w-full accent-brand-600" />
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <button class="btn-primary" :disabled="busy" @click="split">{{ busy ? '處理中…' : '切圖' }}</button>
        <button v-if="outTiles.length" class="inline-flex items-center rounded-xl border border-line bg-white px-5 py-3 font-medium text-ink-700 hover:bg-stone-50" :disabled="busy" @click="downloadZip">打包下載 ZIP</button>
      </div>
    </div>

    <div v-if="outTiles.length" class="card p-6 space-y-3">
      <p class="text-sm text-ink-600">
        切好 {{ outTiles.length }} 格。<strong>發文順序:</strong>請依檔名前面的 01、02… 編號<strong>由小到大</strong>依序上傳到 IG
        (因為 IG 把最新貼文排在最前面,先貼右下角,主頁才會由左上往右下拼成完整大圖)。
      </p>
      <div class="grid gap-2" :style="{ gridTemplateColumns: `repeat(${opt.cols}, minmax(0, 1fr))` }">
        <a v-for="t in outTiles" :key="t.displayIndex" :href="t.url" :download="tileName(t)" class="group relative block overflow-hidden rounded-lg border border-line">
          <img :src="t.url" alt="" class="block aspect-square w-full object-cover" />
          <span class="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-xs text-white">發文 {{ t.postOrder }}</span>
          <span class="absolute inset-0 flex items-center justify-center bg-black/0 text-sm font-medium text-white opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">下載</span>
        </a>
      </div>
    </div>

    <LegalNote title="什麼時候用得到?">
      <ul class="list-disc pl-5 space-y-1">
        <li>把<strong>一張橫幅、海報、合照</strong>切成九宮格,依序發到 Instagram,個人主頁就會拼成一整張<strong>大圖牆(banner)</strong>,視覺超吸睛。</li>
        <li><strong>全程在你瀏覽器裁切、圖片不上傳</strong>,無廣告、無浮水印、免註冊;線上切圖站多半要你上傳照片又加浮水印。</li>
        <li>非正方形的圖會<strong>以中心為準、依格數比例裁切</strong>(預覽框內為保留範圍);想完整不裁切,可先用「圖片裁切」或留白後再切。</li>
        <li>記得<strong>依檔名 01、02… 由小到大依序上傳</strong>;IG 一排固定 3 格,主頁顯示順序與發文順序相反,本工具已幫你算好。</li>
      </ul>
    </LegalNote>
  </div>
</template>
