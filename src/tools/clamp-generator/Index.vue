<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { buildClamp, resolveAt, type ClampInput, type ClampUnit } from '@/features/clampCss'

/*
  CSS clamp() 流體字級 / 間距產生器 —— 給「小螢幕 + 大螢幕」各自的尺寸,
  自動算出隨視窗寬度平滑縮放的 clamp() CSS(中間用 vw、兩端夾住),免手刻公式。
  附互動預覽:拖動視窗寬度看實際解析出的尺寸。全程在你的瀏覽器計算,不上傳。
*/

const minViewport = ref(320)
const maxViewport = ref(1280)
const minSize = ref(16)
const maxSize = ref(24)
const rootFontSize = ref(16)
const unit = ref<ClampUnit>('rem')
const propName = ref<'font-size' | 'padding' | 'margin' | 'gap' | 'border-radius'>('font-size')

const input = computed<ClampInput>(() => ({
  minViewport: minViewport.value,
  maxViewport: maxViewport.value,
  minSize: minSize.value,
  maxSize: maxSize.value,
  rootFontSize: rootFontSize.value,
  unit: unit.value,
}))

const result = computed(() => buildClamp(input.value))
const declaration = computed(() => `${propName.value}: ${result.value.css};`)

// 預覽:可拖的視窗寬度
const previewVw = ref(800)
const resolvedPx = computed(() => resolveAt(input.value, previewVw.value))

const PRESETS: { label: string; v: Partial<ClampInput> }[] = [
  { label: '內文 16→20', v: { minSize: 16, maxSize: 20 } },
  { label: '小標 20→28', v: { minSize: 20, maxSize: 28 } },
  { label: '大標 28→48', v: { minSize: 28, maxSize: 48 } },
  { label: '英雄標題 40→80', v: { minSize: 40, maxSize: 80 } },
  { label: '間距 16→32', v: { minSize: 16, maxSize: 32 } },
]
function applyPreset(v: Partial<ClampInput>) {
  if (v.minSize != null) minSize.value = v.minSize
  if (v.maxSize != null) maxSize.value = v.maxSize
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
    <!-- 設定 -->
    <div class="card p-5 space-y-4">
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <label class="block text-sm">
          <span class="text-ink-500">小螢幕寬度 (px)</span>
          <input v-model.number="minViewport" type="number" min="0" class="cl-input" />
        </label>
        <label class="block text-sm">
          <span class="text-ink-500">小螢幕尺寸 (px)</span>
          <input v-model.number="minSize" type="number" min="0" class="cl-input" />
        </label>
        <label class="block text-sm">
          <span class="text-ink-500">大螢幕寬度 (px)</span>
          <input v-model.number="maxViewport" type="number" min="0" class="cl-input" />
        </label>
        <label class="block text-sm">
          <span class="text-ink-500">大螢幕尺寸 (px)</span>
          <input v-model.number="maxSize" type="number" min="0" class="cl-input" />
        </label>
      </div>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <label class="block text-sm">
          <span class="text-ink-500">根字級 1rem = ? px</span>
          <input v-model.number="rootFontSize" type="number" min="1" class="cl-input" />
        </label>
        <label class="block text-sm">
          <span class="text-ink-500">兩端單位</span>
          <select v-model="unit" class="cl-input">
            <option value="rem">rem(建議)</option>
            <option value="px">px</option>
          </select>
        </label>
        <label class="block text-sm">
          <span class="text-ink-500">CSS 屬性</span>
          <select v-model="propName" class="cl-input">
            <option value="font-size">font-size</option>
            <option value="padding">padding</option>
            <option value="margin">margin</option>
            <option value="gap">gap</option>
            <option value="border-radius">border-radius</option>
          </select>
        </label>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="p in PRESETS"
          :key="p.label"
          type="button"
          class="rounded-lg border border-ink-200 px-3 py-1.5 text-sm text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          @click="applyPreset(p.v)"
        >
          {{ p.label }}
        </button>
      </div>
    </div>

    <!-- 警告 -->
    <p
      v-for="(w, i) in result.warnings"
      :key="i"
      class="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700"
    >
      ⚠️ {{ w }}
    </p>

    <!-- 輸出 -->
    <div class="card p-5 space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm font-semibold text-ink-700">產生的 CSS</span>
        <button
          type="button"
          class="ml-auto rounded-lg border border-ink-200 px-3 py-1 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          @click="copy(result.css, 'val')"
        >
          {{ copied === 'val' ? '已複製' : '複製 clamp()' }}
        </button>
        <button
          type="button"
          class="rounded-lg border border-ink-200 px-3 py-1 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          @click="copy(declaration, 'decl')"
        >
          {{ copied === 'decl' ? '已複製' : '複製宣告' }}
        </button>
      </div>
      <pre class="whitespace-pre-wrap break-all font-mono text-sm text-ink-800">{{ declaration }}</pre>
    </div>

    <!-- 互動預覽 -->
    <div class="card p-5 space-y-4">
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-ink-700">預覽</span>
        <span class="ml-auto text-sm text-ink-500">
          視窗 {{ previewVw }}px → {{ resolvedPx.toFixed(1) }}px
        </span>
      </div>
      <label class="block text-sm">
        <span class="text-ink-500">拖動模擬視窗寬度</span>
        <input
          v-model.number="previewVw"
          type="range"
          :min="Math.min(minViewport, maxViewport) - 100"
          :max="Math.max(minViewport, maxViewport) + 200"
          class="w-full accent-brand-600"
        />
      </label>
      <div class="rounded-lg bg-ink-50 p-6 overflow-hidden">
        <p
          class="font-semibold text-ink-800 leading-tight transition-all"
          :style="{ fontSize: resolvedPx + 'px' }"
        >
          字級隨視窗縮放 Aa 月
        </p>
      </div>
      <p class="text-xs text-ink-400">
        ※ 此處用 JS 重算同一條公式預覽;實際頁面交給瀏覽器的 clamp() 原生處理,結果一致。
      </p>
    </div>

    <LegalNote>
      clamp(最小, 偏好值, 最大):視窗在「小螢幕寬度」以下時固定為最小值,在「大螢幕寬度」以上時固定為最大值,
      中間以 <code>vw</code> 線性平滑縮放。建議兩端用 <code>rem</code> 以尊重使用者的瀏覽器字級設定(無障礙)。
      根字級預設 1rem = 16px,如你有改 <code>html { font-size }</code> 請一併調整。全程在你的瀏覽器計算,不連網、不上傳。
    </LegalNote>
  </div>
</template>

<style scoped>
.cl-input {
  width: 100%;
  margin-top: 0.25rem;
  border: 1px solid var(--color-ink-200, #e2e8f0);
  border-radius: 0.5rem;
  padding: 0.375rem 0.5rem;
  font-size: 0.875rem;
}
</style>
