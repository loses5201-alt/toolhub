<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  buildBoxShadow,
  buildCss,
  defaultLayer,
  type ShadowLayer,
} from '@/features/boxShadow'

/*
  CSS box-shadow 產生器 —— 視覺化調出一層或多層陰影,即時預覽,一鍵複製可直接貼用的 CSS。
  全程在你的瀏覽器,不連網、不上傳。補齊 gradient-maker / color-scale 視覺工坊系列。
*/
const layers = ref<ShadowLayer[]>([
  { x: 0, y: 10, blur: 30, spread: -6, hex: '#1e293b', alpha: 0.25, inset: false },
])

// 預覽底色與方塊色
const previewBg = ref('#f1f5f9')
const boxColor = ref('#ffffff')
const radius = ref(16)

const shadowValue = computed(() => buildBoxShadow(layers.value))
const cssText = computed(() => buildCss(layers.value))

function addLayer() {
  if (layers.value.length >= 8) return
  layers.value.push({ ...defaultLayer(), y: 4, blur: 8, spread: 0, alpha: 0.12 })
}
function duplicateLayer(i: number) {
  if (layers.value.length >= 8) return
  layers.value.splice(i + 1, 0, { ...layers.value[i] })
}
function removeLayer(i: number) {
  layers.value.splice(i, 1)
}

const PRESETS: { label: string; layers: ShadowLayer[] }[] = [
  {
    label: '柔和卡片',
    layers: [{ x: 0, y: 10, blur: 30, spread: -6, hex: '#1e293b', alpha: 0.25, inset: false }],
  },
  {
    label: '懸浮',
    layers: [
      { x: 0, y: 2, blur: 4, spread: 0, hex: '#000000', alpha: 0.08, inset: false },
      { x: 0, y: 12, blur: 28, spread: -4, hex: '#000000', alpha: 0.18, inset: false },
    ],
  },
  {
    label: '內凹',
    layers: [{ x: 0, y: 2, blur: 6, spread: 0, hex: '#000000', alpha: 0.3, inset: true }],
  },
  {
    label: '霓虹',
    layers: [
      { x: 0, y: 0, blur: 8, spread: 0, hex: '#22d3ee', alpha: 0.8, inset: false },
      { x: 0, y: 0, blur: 24, spread: 2, hex: '#22d3ee', alpha: 0.5, inset: false },
    ],
  },
]
function applyPreset(p: (typeof PRESETS)[number]) {
  layers.value = p.layers.map((l) => ({ ...l }))
}

const copied = ref(false)
function copyCss() {
  navigator.clipboard?.writeText(cssText.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="space-y-6">
    <!-- 預覽 -->
    <div
      class="card p-8 flex items-center justify-center transition-colors"
      :style="{ background: previewBg }"
    >
      <div
        class="h-40 w-56 transition-shadow"
        :style="{
          background: boxColor,
          borderRadius: radius + 'px',
          boxShadow: shadowValue,
        }"
      />
    </div>

    <!-- 預覽設定 -->
    <div class="card p-5 grid grid-cols-3 gap-4">
      <div>
        <label class="field-label">底色</label>
        <input v-model="previewBg" type="color" class="h-9 w-full rounded border border-ink-200" />
      </div>
      <div>
        <label class="field-label">方塊色</label>
        <input v-model="boxColor" type="color" class="h-9 w-full rounded border border-ink-200" />
      </div>
      <div>
        <label class="field-label">圓角 {{ radius }}px</label>
        <input v-model.number="radius" type="range" min="0" max="80" class="w-full accent-brand-600" />
      </div>
    </div>

    <!-- 範本 -->
    <div class="card p-5 space-y-2">
      <span class="text-sm font-semibold text-ink-700">快速套用</span>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="p in PRESETS"
          :key="p.label"
          type="button"
          class="rounded-lg border border-ink-200 px-3 py-1.5 text-sm text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          @click="applyPreset(p)"
        >
          {{ p.label }}
        </button>
      </div>
    </div>

    <!-- 陰影層 -->
    <div
      v-for="(layer, i) in layers"
      :key="i"
      class="card p-5 space-y-3"
    >
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-ink-700">第 {{ i + 1 }} 層</span>
        <label class="flex items-center gap-1.5 text-sm text-ink-600">
          <input v-model="layer.inset" type="checkbox" class="accent-brand-600" /> 內陰影 (inset)
        </label>
        <input v-model="layer.hex" type="color" class="ml-auto h-7 w-10 rounded border border-ink-200" />
        <button
          type="button"
          class="text-xs text-ink-400 underline hover:text-ink-600"
          @click="duplicateLayer(i)"
        >
          複製
        </button>
        <button
          type="button"
          class="text-xs text-red-400 underline hover:text-red-600"
          :disabled="layers.length === 1"
          @click="removeLayer(i)"
        >
          刪除
        </button>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
        <label class="block">
          <span class="text-ink-500">水平 X {{ layer.x }}px</span>
          <input v-model.number="layer.x" type="range" min="-50" max="50" class="w-full accent-brand-600" />
        </label>
        <label class="block">
          <span class="text-ink-500">垂直 Y {{ layer.y }}px</span>
          <input v-model.number="layer.y" type="range" min="-50" max="50" class="w-full accent-brand-600" />
        </label>
        <label class="block">
          <span class="text-ink-500">模糊 {{ layer.blur }}px</span>
          <input v-model.number="layer.blur" type="range" min="0" max="100" class="w-full accent-brand-600" />
        </label>
        <label class="block">
          <span class="text-ink-500">擴散 {{ layer.spread }}px</span>
          <input v-model.number="layer.spread" type="range" min="-50" max="50" class="w-full accent-brand-600" />
        </label>
        <label class="block sm:col-span-2">
          <span class="text-ink-500">不透明度 {{ Math.round(layer.alpha * 100) }}%</span>
          <input v-model.number="layer.alpha" type="range" min="0" max="1" step="0.01" class="w-full accent-brand-600" />
        </label>
      </div>
    </div>

    <button
      type="button"
      class="w-full rounded-lg border border-dashed border-ink-300 py-2.5 text-sm text-ink-500 hover:border-brand-400 hover:text-brand-600 disabled:opacity-40"
      :disabled="layers.length >= 8"
      @click="addLayer"
    >
      ＋ 新增一層陰影
    </button>

    <!-- 輸出 -->
    <div class="card p-5 space-y-3">
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-ink-700">CSS</span>
        <button
          type="button"
          class="ml-auto rounded-lg border border-ink-200 px-3 py-1 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          @click="copyCss"
        >
          {{ copied ? '已複製' : '複製 CSS' }}
        </button>
      </div>
      <pre class="whitespace-pre-wrap break-all font-mono text-sm text-ink-800">{{ cssText }}</pre>
    </div>

    <LegalNote>
      box-shadow 多層陰影由上到下層層疊加(前面的層畫在最上面)。模糊半徑不可為負;不透明度 100% 時輸出
      <code>#RRGGBB</code>,否則輸出 <code>rgba()</code>。預覽僅供參考,實際呈現以你的瀏覽器為準。
      全程在你的瀏覽器,不連網、不上傳。
    </LegalNote>
  </div>
</template>
