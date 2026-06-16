<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { buildIco, type IcoEntry } from '@/features/ico'

/*
  網站圖示 / Favicon 產生器 —— 上傳一張圖,輸出 favicon.ico(16/32/48 多尺寸)、
  apple-touch-icon(180)、PWA 圖示(192/512)與可直接貼上的 HTML。全程 canvas 處理,圖片不上傳。
*/
const PNG_SIZES = [180, 192, 512] // 各自獨立輸出的 PNG
const ICO_SIZES = [16, 32, 48] // 包進 favicon.ico

const imgEl = ref<HTMLImageElement | null>(null)
const imgUrl = ref('')
const fit = ref<'contain' | 'cover'>('contain') // 完整留白 / 填滿裁切
const bg = ref('transparent') // transparent | 色碼
const busy = ref(false)
const error = ref('')
const ready = ref(false)
const previews = ref<{ size: number; url: string }[]>([])

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
  ready.value = false
  error.value = ''
  try {
    const url = URL.createObjectURL(f)
    imgEl.value = await loadImage(url)
    imgUrl.value = url
    revokePreviews()
    // 預覽幾個常見尺寸
    previews.value = await Promise.all(
      [16, 32, 180].map(async (s) => ({ size: s, url: URL.createObjectURL(await renderPng(s)) })),
    )
  } catch {
    error.value = '無法讀取這張圖片,請換一張試試。'
  }
}

// 把圖畫進 size×size 的 canvas,依 fit/bg 設定,回傳 PNG blob
function renderPng(size: number): Promise<Blob> {
  const img = imgEl.value!
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  if (bg.value !== 'transparent') {
    ctx.fillStyle = bg.value
    ctx.fillRect(0, 0, size, size)
  }
  const iw = img.naturalWidth
  const ih = img.naturalHeight
  const scale = fit.value === 'contain' ? Math.min(size / iw, size / ih) : Math.max(size / iw, size / ih)
  const dw = iw * scale
  const dh = ih * scale
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh)
  return new Promise((res) => canvas.toBlob((b) => res(b!), 'image/png'))
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function downloadIco() {
  if (!imgEl.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const entries: IcoEntry[] = []
    for (const s of ICO_SIZES) {
      const blob = await renderPng(s)
      entries.push({ size: s, png: new Uint8Array(await blob.arrayBuffer()) })
    }
    const ico = buildIco(entries)
    triggerDownload(new Blob([ico as BlobPart], { type: 'image/x-icon' }), 'favicon.ico')
    ready.value = true
  } catch (e) {
    error.value = '產生失敗:' + (e as Error).message
  } finally {
    busy.value = false
  }
}

async function downloadPng(size: number) {
  if (!imgEl.value || busy.value) return
  busy.value = true
  try {
    const name = size === 180 ? 'apple-touch-icon.png' : `icon-${size}.png`
    triggerDownload(await renderPng(size), name)
    ready.value = true
  } catch (e) {
    error.value = '產生失敗:' + (e as Error).message
  } finally {
    busy.value = false
  }
}

function revokePreviews() {
  previews.value.forEach((p) => URL.revokeObjectURL(p.url))
  previews.value = []
}

const snippet = computed(
  () => `<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">
<link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png">`,
)

const copied = ref(false)
async function copySnippet() {
  try {
    await navigator.clipboard.writeText(snippet.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    error.value = '無法複製,請手動選取。'
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
      <div>
        <label class="field-label">選擇要做成網站圖示的圖片(正方形、線條簡單的 logo 效果最好)</label>
        <input type="file" accept="image/*" class="field-input" @change="onFile" />
        <p class="field-hint">圖片只在你的瀏覽器處理,不會上傳。建議來源至少 512×512。</p>
      </div>

      <template v-if="imgEl">
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="field-label">縮放方式</span>
            <select v-model="fit" class="field-input">
              <option value="contain">完整顯示(留白,適合 logo)</option>
              <option value="cover">填滿裁切(適合照片)</option>
            </select>
          </label>
          <label class="block">
            <span class="field-label">背景</span>
            <select v-model="bg" class="field-input">
              <option value="transparent">透明</option>
              <option value="#ffffff">白色</option>
              <option value="#000000">黑色</option>
              <option value="#1f9a7e">品牌綠</option>
            </select>
          </label>
        </div>

        <div v-if="previews.length" class="flex flex-wrap items-end gap-4">
          <div v-for="p in previews" :key="p.size" class="text-center">
            <img
              :src="p.url"
              :alt="`${p.size} 預覽`"
              :width="Math.min(p.size, 96)"
              :height="Math.min(p.size, 96)"
              class="rounded border border-line bg-brand-50/40"
            />
            <p class="mt-1 text-xs text-ink-500">{{ p.size }}px</p>
          </div>
          <p class="text-xs text-ink-400">(換縮放/背景後重新下載即可套用)</p>
        </div>

        <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

        <div class="flex flex-wrap items-center gap-3">
          <button class="btn-primary" :disabled="busy" @click="downloadIco">
            {{ busy ? '產生中…' : '下載 favicon.ico(16/32/48)' }}
          </button>
          <button
            v-for="s in PNG_SIZES"
            :key="s"
            class="rounded-lg border border-line bg-white px-3 py-2 text-sm hover:border-brand-400 disabled:opacity-40"
            :disabled="busy"
            @click="downloadPng(s)"
          >
            {{ s === 180 ? 'apple-touch (180)' : `icon-${s}.png` }}
          </button>
        </div>

        <div v-if="ready" class="space-y-2">
          <label class="field-label">貼進 HTML &lt;head&gt;(把上面下載的檔放到網站根目錄)</label>
          <textarea :value="snippet" rows="4" readonly class="field-input font-mono text-xs"></textarea>
          <button
            class="rounded-lg border border-line bg-white px-4 py-2 text-sm hover:border-brand-400"
            @click="copySnippet"
          >
            {{ copied ? '已複製 ✓' : '複製 HTML' }}
          </button>
        </div>
      </template>
    </div>

    <LegalNote title="使用說明與為什麼用這個">
      <ul class="list-disc space-y-1 pl-5">
        <li><strong>不上傳</strong>:logo 常是還沒公開的品牌素材,本工具全程在你瀏覽器處理,不送任何伺服器。</li>
        <li><strong>多數線上 favicon 產生器要你上傳圖、夾廣告,有的還在輸出綁追蹤</strong> —— 這裡乾淨、免費、無浮水印。</li>
        <li><code>favicon.ico</code> 內含 16/32/48 三種尺寸,瀏覽器分頁、書籤、桌面捷徑會各取所需。</li>
        <li><code>apple-touch-icon.png</code>(180)給 iPhone/iPad 加到主畫面;192/512 給 PWA。</li>
        <li>把下載的檔放到網站根目錄,再把右上角的 HTML 貼進 <code>&lt;head&gt;</code> 即可。</li>
      </ul>
    </LegalNote>
  </div>
</template>
