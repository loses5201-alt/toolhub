<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  parseColor,
  toHex,
  toRgbString,
  mix,
  alphaComposite,
  gradientSteps,
  type RGBA,
} from '@/features/colorMix'

/*
  色彩混合器 —— 兩種模式:
   1) 混色:兩個顏色依比例在 sRGB 內插(等同 CSS color-mix)。
   2) 疊色:帶透明度的前景疊在背景上,算出最終看到的實色。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

const mode = ref<'mix' | 'over'>('mix')
const color1 = ref('#3b82f6')
const color2 = ref('#ef4444')
const ratio = ref(50)

// 疊色模式
const fg = ref('rgba(0, 0, 0, 0.5)')
const bg = ref('#ffffff')

const c1 = computed(() => parseColor(color1.value))
const c2 = computed(() => parseColor(color2.value))
const fgc = computed(() => parseColor(fg.value))
const bgc = computed(() => parseColor(bg.value))

const mixed = computed<RGBA | null>(() =>
  c1.value && c2.value ? mix(c1.value, c2.value, ratio.value / 100) : null,
)
const composited = computed<RGBA | null>(() =>
  fgc.value && bgc.value ? alphaComposite(fgc.value, bgc.value) : null,
)

const result = computed(() => (mode.value === 'mix' ? mixed.value : composited.value))

const steps = computed(() =>
  c1.value && c2.value ? gradientSteps(c1.value, c2.value, 9) : [],
)

// 預覽背景:用棋盤格襯托透明
function swatchStyle(c: RGBA | null) {
  if (!c) return {}
  return { background: toRgbString(c) }
}

const copied = ref('')
function copy(text: string, tag: string) {
  navigator.clipboard?.writeText(text)
  copied.value = tag
  setTimeout(() => (copied.value = ''), 1500)
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 flex flex-wrap gap-2">
      <button
        type="button"
        class="rounded-lg border px-3 py-1.5 text-sm"
        :class="mode === 'mix' ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600 hover:bg-ink-50'"
        @click="mode = 'mix'"
      >
        混色(比例內插)
      </button>
      <button
        type="button"
        class="rounded-lg border px-3 py-1.5 text-sm"
        :class="mode === 'over' ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600 hover:bg-ink-50'"
        @click="mode = 'over'"
      >
        疊色(透明度疊背景)
      </button>
    </div>

    <!-- 混色模式 -->
    <div v-if="mode === 'mix'" class="card p-5 space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <label class="block text-sm">
          <span class="text-ink-500">顏色 1</span>
          <div class="mt-1 flex items-center gap-2">
            <input type="color" :value="c1 ? toHex({ ...c1, a: 1 }) : '#000000'" class="h-9 w-12 rounded border border-ink-200" @input="color1 = ($event.target as HTMLInputElement).value" />
            <input v-model="color1" type="text" class="cm-input font-mono" />
          </div>
        </label>
        <label class="block text-sm">
          <span class="text-ink-500">顏色 2</span>
          <div class="mt-1 flex items-center gap-2">
            <input type="color" :value="c2 ? toHex({ ...c2, a: 1 }) : '#000000'" class="h-9 w-12 rounded border border-ink-200" @input="color2 = ($event.target as HTMLInputElement).value" />
            <input v-model="color2" type="text" class="cm-input font-mono" />
          </div>
        </label>
      </div>
      <label class="block text-sm">
        <span class="text-ink-500">混合比例:{{ ratio }}% 顏色 2</span>
        <input v-model.number="ratio" type="range" min="0" max="100" class="w-full accent-brand-600" />
      </label>
    </div>

    <!-- 疊色模式 -->
    <div v-else class="card p-5 space-y-4">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label class="block text-sm">
          <span class="text-ink-500">前景(可帶透明度)</span>
          <input v-model="fg" type="text" class="cm-input font-mono" placeholder="rgba(0,0,0,0.5) 或 #00000080" />
        </label>
        <label class="block text-sm">
          <span class="text-ink-500">背景</span>
          <div class="mt-1 flex items-center gap-2">
            <input type="color" :value="bgc ? toHex({ ...bgc, a: 1 }) : '#ffffff'" class="h-9 w-12 rounded border border-ink-200" @input="bg = ($event.target as HTMLInputElement).value" />
            <input v-model="bg" type="text" class="cm-input font-mono" />
          </div>
        </label>
      </div>
    </div>

    <!-- 結果 -->
    <div v-if="result" class="card p-5 space-y-3">
      <div class="h-24 rounded-lg border border-ink-200" :style="swatchStyle(result)" />
      <div class="flex flex-wrap items-center gap-2">
        <code class="font-mono text-lg text-ink-800">{{ toHex(result) }}</code>
        <button type="button" class="rounded-lg border border-ink-200 px-2.5 py-1 text-xs text-ink-600 hover:bg-ink-50" @click="copy(toHex(result), 'hex')">{{ copied === 'hex' ? '已複製' : '複製 HEX' }}</button>
        <code class="ml-2 font-mono text-sm text-ink-600">{{ toRgbString(result) }}</code>
        <button type="button" class="rounded-lg border border-ink-200 px-2.5 py-1 text-xs text-ink-600 hover:bg-ink-50" @click="copy(toRgbString(result), 'rgb')">{{ copied === 'rgb' ? '已複製' : '複製 RGB' }}</button>
      </div>
    </div>
    <p v-else class="card p-5 text-sm text-ink-500">請輸入有效的顏色(支援 #hex、#hexa、rgb()、rgba())。</p>

    <!-- 混色色階 -->
    <div v-if="mode === 'mix' && steps.length" class="card p-5 space-y-2">
      <span class="text-sm font-semibold text-ink-700">兩色之間的色階</span>
      <div class="flex overflow-hidden rounded-lg border border-ink-200">
        <button
          v-for="(s, i) in steps"
          :key="i"
          type="button"
          class="h-12 flex-1"
          :style="{ background: toRgbString(s) }"
          :title="toHex(s)"
          @click="copy(toHex(s), 'step' + i)"
        />
      </div>
      <p class="text-xs text-ink-400">點任一段可複製該色 HEX。</p>
    </div>

    <LegalNote>
      混色在 sRGB 空間做線性內插(與 CSS <code>color-mix(in srgb, …)</code> 一致);比例 0% 為顏色 1、100% 為顏色 2。
      疊色採 source-over alpha compositing:最終色 = 前景×α + 背景×(1−α);若背景不透明,結果亦為不透明。
      全程在你的瀏覽器計算,不連網、不上傳。
    </LegalNote>
  </div>
</template>

<style scoped>
.cm-input {
  width: 100%;
  border: 1px solid var(--color-ink-200, #e2e8f0);
  border-radius: 0.5rem;
  padding: 0.45rem 0.55rem;
  font-size: 0.875rem;
}
</style>
