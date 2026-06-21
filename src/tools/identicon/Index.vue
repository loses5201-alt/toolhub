<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { identiconData, identiconSvg } from '@/features/identicon'

/*
  Identicon 頭像產生器 —— 由文字決定性產生 GitHub 風格對稱像素頭像。
  全程在你的瀏覽器計算,不連網、不上傳。
*/
const text = ref('alice@example.com')
const grid = ref(5)
const bg = ref('#f0f0f0')

const data = computed(() => identiconData(text.value || ' ', grid.value))
const svg = computed(() => identiconSvg(data.value, { size: 240, background: bg.value, padding: 0.12 }))
const svgDataUri = computed(() => 'data:image/svg+xml;utf8,' + encodeURIComponent(svg.value))

const copied = ref('')
async function copySvg() {
  try {
    await navigator.clipboard.writeText(svg.value)
    copied.value = 'svg'
    setTimeout(() => (copied.value = ''), 1200)
  } catch {
    /* 忽略 */
  }
}

function downloadSvg() {
  const blob = new Blob([svg.value], { type: 'image/svg+xml' })
  triggerDownload(URL.createObjectURL(blob), filename('svg'), true)
}

async function downloadPng(px: number) {
  const big = identiconSvg(data.value, { size: px, background: bg.value, padding: 0.12 })
  const uri = 'data:image/svg+xml;utf8,' + encodeURIComponent(big)
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = px
    canvas.height = px
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(img, 0, 0)
    triggerDownload(canvas.toDataURL('image/png'), filename(`${px}.png`), false)
  }
  img.src = uri
}

function filename(ext: string): string {
  const safe = (text.value || 'identicon').replace(/[^\w.-]+/g, '_').slice(0, 32)
  return `identicon-${safe}.${ext}`
}
function triggerDownload(url: string, name: string, revoke: boolean) {
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  if (revoke) setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const GRIDS = [5, 7, 9]
const PRESET_BGS = ['#f0f0f0', '#ffffff', '#1e1e1e', '#0d1117']
</script>

<template>
  <div class="space-y-6">
    <div class="card p-5 space-y-4">
      <label class="block text-sm">
        <span class="text-ink-500">輸入文字(暱稱 / Email / 任意 ID)</span>
        <input v-model="text" type="text" class="ic-input font-mono" placeholder="輸入任意文字……" />
      </label>

      <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div class="flex items-center gap-2 text-sm">
          <span class="text-ink-500">格數</span>
          <div class="inline-flex rounded-lg border border-ink-200 p-0.5">
            <button
              v-for="g in GRIDS"
              :key="g"
              type="button"
              class="rounded-md px-3 py-1"
              :class="grid === g ? 'bg-brand-50 text-brand-700' : 'text-ink-500'"
              @click="grid = g"
            >
              {{ g }}×{{ g }}
            </button>
          </div>
        </div>

        <div class="flex items-center gap-2 text-sm">
          <span class="text-ink-500">底色</span>
          <input v-model="bg" type="color" class="h-8 w-10 rounded border border-ink-200" aria-label="底色" />
          <button
            v-for="c in PRESET_BGS"
            :key="c"
            type="button"
            class="h-6 w-6 rounded border border-ink-200"
            :style="{ backgroundColor: c }"
            :aria-label="'底色 ' + c"
            @click="bg = c"
          ></button>
        </div>
      </div>
    </div>

    <div class="card p-6 flex flex-col items-center gap-4">
      <!-- v-html 安全:identiconSvg 只輸出我們產生的 rect 與固定屬性,無使用者原始 HTML -->
      <div class="rounded-2xl overflow-hidden shadow-sm" style="width: 240px; height: 240px" v-html="svg"></div>
      <div class="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          class="rounded-lg border border-ink-200 px-3 py-1.5 text-sm text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          @click="copySvg"
        >
          {{ copied === 'svg' ? '已複製' : '複製 SVG' }}
        </button>
        <button
          type="button"
          class="rounded-lg border border-ink-200 px-3 py-1.5 text-sm text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          @click="downloadSvg"
        >
          下載 SVG
        </button>
        <button
          type="button"
          class="rounded-lg border border-ink-200 px-3 py-1.5 text-sm text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          @click="downloadPng(256)"
        >
          下載 PNG 256
        </button>
        <button
          type="button"
          class="rounded-lg border border-ink-200 px-3 py-1.5 text-sm text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          @click="downloadPng(512)"
        >
          下載 PNG 512
        </button>
      </div>
      <!-- 小尺寸預覽,確認當大頭貼縮小後仍可辨識 -->
      <div class="flex items-end gap-3 pt-2">
        <img :src="svgDataUri" alt="48px 預覽" width="48" height="48" class="rounded-lg" />
        <img :src="svgDataUri" alt="32px 預覽" width="32" height="32" class="rounded-lg" />
        <img :src="svgDataUri" alt="24px 預覽" width="24" height="24" class="rounded-md" />
        <span class="text-xs text-ink-400">縮小後的樣子</span>
      </div>
    </div>

    <LegalNote title="Identicon 是什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>
          <strong>Identicon</strong> 是由一段文字「決定性」產生的對稱像素圖案 ——
          同樣的輸入永遠得到同一張圖。GitHub、許多論壇都用它當<strong>預設大頭貼</strong>,
          也方便一眼分辨不同帳號。
        </li>
        <li>本工具用 FNV-1a 雜湊把文字轉成顏色與左右對稱的格子,<strong>純為視覺辨識用途</strong>,不是加密、無法反推原文。</li>
        <li>輸入相同 Email / ID 的人會得到相同頭像,屬正常設計;若要當「不可猜測」的識別碼,請另用隨機 ID。</li>
        <li>全程在你的瀏覽器即時繪製,<strong>不連網、不上傳</strong>;可下載 SVG(向量、無限放大)或 PNG。</li>
      </ul>
    </LegalNote>
  </div>
</template>

<style scoped>
.ic-input {
  width: 100%;
  margin-top: 0.25rem;
  border: 1px solid var(--color-ink-200, #e2e8f0);
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  font-size: 0.95rem;
}
</style>
