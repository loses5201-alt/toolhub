<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import LegalNote from '@/components/LegalNote.vue'

/*
  SVG → PNG / 點陣圖匯出 —— 把向量 SVG 在任意解析度轉成 PNG / JPG / WebP。
  全程用 canvas 在瀏覽器處理,SVG 不上傳。線上 SVG 轉檔站多半要上傳檔案又夾廣告。
*/
const svgText = ref('')
const intrinsicW = ref(0)
const intrinsicH = ref(0)
const parseError = ref('')

const outWidth = ref(512)
const lockAspect = ref(true)
const outHeightManual = ref(512)
const bg = ref<'transparent' | '#ffffff' | '#000000'>('transparent')
const format = ref<'png' | 'jpeg' | 'webp'>('png')
const quality = ref(92)

const aspect = computed(() => (intrinsicW.value && intrinsicH.value ? intrinsicH.value / intrinsicW.value : 0.5))
const outHeight = computed(() =>
  lockAspect.value && aspect.value ? Math.max(1, Math.round(outWidth.value * aspect.value)) : outHeightManual.value,
)

const rendering = ref(false)
const renderUrl = ref('')
const renderedBytes = ref(0)
const renderError = ref('')

// 解析 SVG 取得原始尺寸(width/height,否則 viewBox)
function parseIntrinsic(text: string) {
  parseError.value = ''
  intrinsicW.value = 0
  intrinsicH.value = 0
  const t = text.trim()
  if (!t) return
  const doc = new DOMParser().parseFromString(t, 'image/svg+xml')
  const svg = doc.querySelector('svg')
  if (!svg || doc.querySelector('parsererror')) {
    parseError.value = '這段內容不是有效的 SVG。'
    return
  }
  const num = (v: string | null) => {
    if (!v) return 0
    const m = v.trim().match(/^([\d.]+)\s*(px)?$/i)
    return m ? parseFloat(m[1]) : 0
  }
  let w = num(svg.getAttribute('width'))
  let h = num(svg.getAttribute('height'))
  if (!w || !h) {
    const vb = svg.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number)
    if (vb && vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
      w = w || vb[2]
      h = h || vb[3]
    }
  }
  if (!w || !h) {
    w = 300
    h = 150
  }
  intrinsicW.value = Math.round(w)
  intrinsicH.value = Math.round(h)
  outWidth.value = Math.round(w)
  outHeightManual.value = Math.round(h)
}

watch(svgText, (t) => parseIntrinsic(t))

function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!f) return
  if (!/svg/i.test(f.type) && !/\.svg$/i.test(f.name)) {
    parseError.value = '請選擇 .svg 檔。'
    return
  }
  const reader = new FileReader()
  reader.onload = () => (svgText.value = String(reader.result || ''))
  reader.onerror = () => (parseError.value = '讀取檔案失敗。')
  reader.readAsText(f)
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('SVG 無法被瀏覽器繪製,可能含不支援的外部資源。'))
    img.src = url
  })
}

// 把 SVG 設定為目標尺寸後序列化,確保 Image() 以正確大小載入
function sizedSvg(w: number, h: number): string {
  const doc = new DOMParser().parseFromString(svgText.value, 'image/svg+xml')
  const svg = doc.querySelector('svg')!
  if (!svg.getAttribute('xmlns')) svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  if (!svg.getAttribute('viewBox') && intrinsicW.value && intrinsicH.value)
    svg.setAttribute('viewBox', `0 0 ${intrinsicW.value} ${intrinsicH.value}`)
  svg.setAttribute('width', String(w))
  svg.setAttribute('height', String(h))
  return new XMLSerializer().serializeToString(svg)
}

async function render() {
  if (!intrinsicW.value || rendering.value) return
  rendering.value = true
  renderError.value = ''
  const w = Math.max(1, Math.min(8192, Math.round(outWidth.value)))
  const h = Math.max(1, Math.min(8192, Math.round(outHeight.value)))
  let url = ''
  try {
    const blob = new Blob([sizedSvg(w, h)], { type: 'image/svg+xml;charset=utf-8' })
    url = URL.createObjectURL(blob)
    const img = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    if (bg.value !== 'transparent' || format.value !== 'png') {
      ctx.fillStyle = bg.value === 'transparent' ? '#ffffff' : bg.value
      ctx.fillRect(0, 0, w, h)
    }
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, w, h)
    const mime = `image/${format.value}`
    const out: Blob = await new Promise((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error('輸出失敗'))), mime, quality.value / 100),
    )
    if (renderUrl.value) URL.revokeObjectURL(renderUrl.value)
    renderUrl.value = URL.createObjectURL(out)
    renderedBytes.value = out.size
  } catch (e) {
    renderError.value = (e as Error).message || '轉換失敗。'
  } finally {
    if (url) URL.revokeObjectURL(url)
    rendering.value = false
  }
}

function download() {
  if (!renderUrl.value) return
  const ext = format.value === 'jpeg' ? 'jpg' : format.value
  const a = document.createElement('a')
  a.href = renderUrl.value
  a.download = `image.${ext}`
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

const svgPreview = computed(() =>
  svgText.value && !parseError.value
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText.value)}`
    : '',
)
const scaleHint = computed(() =>
  intrinsicW.value ? `原始 ${intrinsicW.value}×${intrinsicH.value} → 輸出 ${Math.round(outWidth.value)}×${outHeight.value}` : '',
)
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
      <div>
        <label class="field-label">貼上 SVG 原始碼,或選擇 .svg 檔</label>
        <textarea
          v-model="svgText"
          rows="5"
          class="field-input font-mono text-xs"
          placeholder="<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>…</svg>"
        ></textarea>
        <input type="file" accept=".svg,image/svg+xml" class="field-input mt-2" @change="onFile" />
        <p class="field-hint">SVG 只在你的瀏覽器處理,不會上傳。可放大到任意解析度都不模糊。</p>
      </div>

      <p v-if="parseError" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ parseError }}</p>

      <template v-if="intrinsicW">
        <div class="flex flex-wrap items-center gap-4">
          <img :src="svgPreview" alt="SVG 預覽" class="max-h-28 max-w-[10rem] rounded border border-line bg-brand-50/40 p-1" />
          <p class="text-sm text-ink-600">{{ scaleHint }}</p>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="field-label">輸出寬度(px)</span>
            <input v-model.number="outWidth" type="number" min="1" max="8192" class="field-input" />
          </label>
          <label class="block">
            <span class="field-label">輸出高度(px)</span>
            <input
              :value="outHeight"
              @input="outHeightManual = Number(($event.target as HTMLInputElement).value)"
              type="number"
              min="1"
              max="8192"
              class="field-input"
              :disabled="lockAspect"
            />
          </label>
        </div>
        <label class="flex items-center gap-2 text-sm text-ink-700">
          <input v-model="lockAspect" type="checkbox" /> 鎖定原始比例(改寬度自動算高度)
        </label>

        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="field-label">背景</span>
            <select v-model="bg" class="field-input">
              <option value="transparent">透明(僅 PNG / WebP 支援)</option>
              <option value="#ffffff">白色</option>
              <option value="#000000">黑色</option>
            </select>
          </label>
          <label class="block">
            <span class="field-label">輸出格式</span>
            <select v-model="format" class="field-input">
              <option value="png">PNG(無損、支援透明)</option>
              <option value="webp">WebP(較小、支援透明)</option>
              <option value="jpeg">JPG(較小、不支援透明)</option>
            </select>
          </label>
        </div>

        <label v-if="format !== 'png'" class="block">
          <span class="field-label">品質:{{ quality }}%</span>
          <input v-model.number="quality" type="range" min="50" max="100" class="w-full" />
        </label>

        <p v-if="renderError" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ renderError }}</p>

        <button class="btn-primary" :disabled="rendering" @click="render">
          {{ rendering ? '轉換中…' : '轉換成點陣圖' }}
        </button>

        <div v-if="renderUrl" class="space-y-3 rounded-xl border border-line bg-brand-50/30 p-4">
          <img :src="renderUrl" alt="輸出預覽" class="max-h-48 rounded border border-line bg-white" />
          <p class="text-sm text-ink-600">輸出 {{ fmtBytes(renderedBytes) }}({{ Math.round(outWidth) }}×{{ outHeight }})</p>
          <button class="btn-primary" @click="download">下載圖片</button>
        </div>
      </template>
    </div>

    <LegalNote title="使用說明與為什麼用這個">
      <ul class="list-disc space-y-1 pl-5">
        <li><strong>不上傳</strong>:logo / 圖示常是未公開素材,本工具全程在瀏覽器用 canvas 繪製,不送伺服器。</li>
        <li>SVG 是向量,可<strong>放大到任意解析度都不模糊</strong> —— 需要高解析 PNG 印刷、上架、貼圖時很實用。</li>
        <li>透明背景請選 PNG 或 WebP;JPG 不支援透明,會自動填上你選的背景色(預設白)。</li>
        <li>若 SVG 內含外部連結的字型或圖片,瀏覽器可能無法繪製或無法輸出 —— 請改用內嵌(把字型轉外框、圖片轉 data URI)。</li>
      </ul>
    </LegalNote>
  </div>
</template>
