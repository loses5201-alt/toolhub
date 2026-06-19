<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import LegalNote from '@/components/LegalNote.vue'

/*
  去純色背景 → 透明 —— 點一下背景色,把單色背景(白底、綠幕、純色)變透明,輸出 PNG。
  全程 canvas 像素處理,圖片不上傳。與 AI 去背(bg-remove)互補:這支即時、免下載模型,
  最適合 logo、掃描的簽名/印章、線稿、截圖等背景是純色的圖。
*/
const MAX_DIM = 1800 // 過大圖先縮邊,兼顧效能與品質
const previewCanvas = ref<HTMLCanvasElement | null>(null)
let srcData: ImageData | null = null // 原始像素(只讀)
const hasImage = ref(false)
const keyColor = ref('#ffffff')
const tolerance = ref(32) // 0~150 顏色距離門檻
const softness = ref(12) // 邊緣柔化帶寬
const removedPct = ref(0)
const error = ref('')
const outUrl = ref('')

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = () => rej(new Error('無法讀取圖片'))
    img.src = url
  })
}

async function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  error.value = ''
  if (!f || !f.type.startsWith('image/')) {
    error.value = '請選擇圖片檔。'
    return
  }
  const url = URL.createObjectURL(f)
  try {
    const img = await loadImage(url)
    let w = img.naturalWidth
    let h = img.naturalHeight
    const scale = Math.min(1, MAX_DIM / Math.max(w, h))
    w = Math.round(w * scale)
    h = Math.round(h * scale)
    const src = document.createElement('canvas')
    src.width = w
    src.height = h
    const sctx = src.getContext('2d')!
    sctx.drawImage(img, 0, 0, w, h)
    srcData = sctx.getImageData(0, 0, w, h)
    const cv = previewCanvas.value!
    cv.width = w
    cv.height = h
    hasImage.value = true
    // 預設背景色 = 左上角像素
    keyColor.value = pixelHex(0, 0)
    process()
  } catch {
    error.value = '無法讀取這張圖片,請換一張試試。'
  } finally {
    URL.revokeObjectURL(url)
  }
}

function pixelHex(x: number, y: number): string {
  if (!srcData) return '#ffffff'
  const i = (y * srcData.width + x) * 4
  const d = srcData.data
  const h = (n: number) => n.toString(16).padStart(2, '0')
  return `#${h(d[i])}${h(d[i + 1])}${h(d[i + 2])}`
}

function hexToRgb(hex: string): [number, number, number] {
  const s = hex.replace(/^#/, '')
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]
}

// 點圖片吸取背景色
function onCanvasClick(e: MouseEvent) {
  if (!srcData || !previewCanvas.value) return
  const cv = previewCanvas.value
  const rect = cv.getBoundingClientRect()
  const x = Math.floor(((e.clientX - rect.left) / rect.width) * cv.width)
  const y = Math.floor(((e.clientY - rect.top) / rect.height) * cv.height)
  if (x < 0 || y < 0 || x >= cv.width || y >= cv.height) return
  keyColor.value = pixelHex(x, y)
}

function process() {
  if (!srcData || !previewCanvas.value) return
  const [kr, kg, kb] = hexToRgb(keyColor.value)
  const t = tolerance.value
  const soft = Math.max(0, softness.value)
  const out = new ImageData(new Uint8ClampedArray(srcData.data), srcData.width, srcData.height)
  const d = out.data
  let removed = 0
  for (let i = 0; i < d.length; i += 4) {
    const dr = d[i] - kr
    const dg = d[i + 1] - kg
    const db = d[i + 2] - kb
    const dist = Math.sqrt(dr * dr + dg * dg + db * db)
    if (dist <= t) {
      d[i + 3] = 0
      removed++
    } else if (dist <= t + soft) {
      d[i + 3] = Math.round((d[i + 3] * (dist - t)) / soft)
    }
  }
  removedPct.value = Math.round((removed / (d.length / 4)) * 100)
  const ctx = previewCanvas.value.getContext('2d')!
  ctx.putImageData(out, 0, 0)
  if (outUrl.value) URL.revokeObjectURL(outUrl.value)
  outUrl.value = ''
}

watch([keyColor, tolerance, softness], () => {
  if (hasImage.value) process()
})

function download() {
  if (!previewCanvas.value) return
  previewCanvas.value.toBlob((b) => {
    if (!b) return
    const url = URL.createObjectURL(b)
    const a = document.createElement('a')
    a.href = url
    a.download = 'transparent.png'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, 'image/png')
}

onBeforeUnmount(() => {
  if (outUrl.value) URL.revokeObjectURL(outUrl.value)
})
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
      <div>
        <label class="field-label">選擇要去背景的圖片(背景是純色效果最好)</label>
        <input type="file" accept="image/*" class="field-input" @change="onFile" />
        <p class="field-hint">圖片只在你的瀏覽器處理,不會上傳。適合 logo、白底商品圖、掃描的簽名/印章、綠幕、線稿。</p>
      </div>

      <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

      <template v-if="hasImage">
        <div class="grid gap-4 sm:grid-cols-3">
          <label class="block">
            <span class="field-label">要去掉的背景色(可點圖吸取)</span>
            <div class="flex items-center gap-2">
              <input type="color" v-model="keyColor" class="h-10 w-14 rounded border border-line" aria-label="背景色" />
              <input v-model="keyColor" type="text" class="field-input flex-1 font-mono text-sm" />
            </div>
          </label>
          <label class="block">
            <span class="field-label">容差:{{ tolerance }}(越大去越多)</span>
            <input v-model.number="tolerance" type="range" min="0" max="150" class="w-full" />
          </label>
          <label class="block">
            <span class="field-label">邊緣柔化:{{ softness }}</span>
            <input v-model.number="softness" type="range" min="0" max="60" class="w-full" />
          </label>
        </div>

        <p class="text-sm text-ink-600">已去除約 {{ removedPct }}% 的像素。<span class="text-ink-400">點下方圖片任一點可吸取該處顏色當背景色。</span></p>

        <div class="checker overflow-auto rounded-xl border border-line p-2">
          <canvas
            ref="previewCanvas"
            class="mx-auto block max-w-full cursor-crosshair"
            @click="onCanvasClick"
          ></canvas>
        </div>

        <button class="btn-primary" @click="download">下載透明 PNG</button>
      </template>
    </div>

    <LegalNote title="使用說明與為什麼用這個">
      <ul class="list-disc space-y-1 pl-5">
        <li><strong>不上傳</strong>:全程在你瀏覽器用 canvas 處理,圖片不送伺服器、無廣告、無浮水印。</li>
        <li>這支用<strong>顏色比對</strong>去背,即時、不需下載 AI 模型,最適合背景是<strong>純色</strong>的圖(白底 logo、掃描簽名/印章、綠幕、線稿、截圖)。</li>
        <li>若是複雜照片(人、毛髮、漸層背景),請改用「圖片去背」(AI 自動去背)。</li>
        <li>操作:點圖片的背景處吸取顏色,再調「容差」直到背景乾淨;邊緣有殘色就加大「邊緣柔化」。</li>
      </ul>
    </LegalNote>
  </div>
</template>

<style scoped>
.checker {
  background-image:
    linear-gradient(45deg, #e5e7eb 25%, transparent 25%),
    linear-gradient(-45deg, #e5e7eb 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #e5e7eb 75%),
    linear-gradient(-45deg, transparent 75%, #e5e7eb 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
}
</style>
