<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'

/*
  色彩工坊 —— ① HEX/RGB/HSL 互轉 ② 從上傳圖片抽出主色調色盤。
  全程在瀏覽器(Canvas),圖片不上傳。
*/
const hex = ref('#1f9a7e')
const palette = ref<string[]>([])
const copied = ref('')

function hexToRgb(h: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(h.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h /= 6
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}
const rgb = computed(() => hexToRgb(hex.value))
const hsl = computed(() => (rgb.value ? rgbToHsl(...rgb.value) : null))

async function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  const url = URL.createObjectURL(f)
  const img = new Image()
  await new Promise((res, rej) => {
    img.onload = res
    img.onerror = rej
    img.src = url
  })
  const size = 120
  const scale = Math.min(size / img.naturalWidth, size / img.naturalHeight, 1)
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h).data
  const buckets = new Map<string, { c: number; r: number; g: number; b: number }>()
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const key = `${r >> 5},${g >> 5},${b >> 5}` // 量化成桶
    const e2 = buckets.get(key) || { c: 0, r: 0, g: 0, b: 0 }
    e2.c++; e2.r += r; e2.g += g; e2.b += b
    buckets.set(key, e2)
  }
  palette.value = [...buckets.values()]
    .sort((a, b) => b.c - a.c)
    .slice(0, 8)
    .map((e2) => {
      const r = Math.round(e2.r / e2.c), g = Math.round(e2.g / e2.c), b = Math.round(e2.b / e2.c)
      return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')
    })
  URL.revokeObjectURL(url)
  ;(e.target as HTMLInputElement).value = ''
}

async function copy(v: string) {
  try {
    await navigator.clipboard.writeText(v)
    copied.value = v
    setTimeout(() => (copied.value = ''), 1200)
  } catch {
    /* 忽略 */
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div class="font-semibold text-ink-900">色碼互轉</div>
      <div class="flex items-center gap-3">
        <input v-model="hex" type="color" class="h-12 w-16 cursor-pointer rounded-lg border border-line" />
        <input v-model="hex" class="field-input flex-1 font-mono" placeholder="#1f9a7e" />
      </div>
      <div v-if="rgb && hsl" class="grid gap-2 sm:grid-cols-3">
        <button class="rounded-xl border border-line bg-white px-3 py-2 text-left text-sm font-mono hover:border-brand-300" @click="copy(hex.toUpperCase())">{{ hex.toUpperCase() }}</button>
        <button class="rounded-xl border border-line bg-white px-3 py-2 text-left text-sm font-mono hover:border-brand-300" @click="copy(`rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`)">rgb({{ rgb[0] }}, {{ rgb[1] }}, {{ rgb[2] }})</button>
        <button class="rounded-xl border border-line bg-white px-3 py-2 text-left text-sm font-mono hover:border-brand-300" @click="copy(`hsl(${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%)`)">hsl({{ hsl[0] }}, {{ hsl[1] }}%, {{ hsl[2] }}%)</button>
      </div>
      <p v-else class="text-sm text-red-500">請輸入正確的色碼,例如 #1f9a7e</p>
    </div>

    <div class="card p-6 space-y-4">
      <div class="font-semibold text-ink-900">從圖片抽主色</div>
      <input type="file" accept="image/*" class="field-input" @change="onFile" />
      <p class="field-hint">上傳照片/logo,抽出最常出現的顏色。圖片只在你瀏覽器處理,不上傳。</p>
      <div v-if="palette.length" class="grid grid-cols-4 gap-2 sm:grid-cols-8">
        <button
          v-for="c in palette"
          :key="c"
          class="group flex flex-col items-center"
          @click="copy(c)"
        >
          <span class="h-14 w-full rounded-xl border border-line" :style="{ background: c }" />
          <span class="mt-1 text-[10px] font-mono text-ink-500">{{ c.toUpperCase() }}</span>
        </button>
      </div>
    </div>

    <p v-if="copied" class="text-center text-sm text-brand-700">已複製 {{ copied }} ✓</p>

    <LegalNote title="說明">
      <ul class="list-disc pl-5 space-y-1">
        <li>點任一色碼即可複製。</li>
        <li>「從圖片抽主色」適合抓 logo / 照片的配色,圖片<strong>不上傳</strong>,設計取色更安心。</li>
      </ul>
    </LegalNote>
  </div>
</template>
