<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { generateScale, toCss, RATIOS } from '@/features/typeScale'

/*
  字級比例(Type Scale)產生器 —— 用基準字級 + 比例,產生一整套和諧的字級。
  網頁排版常用的模組化比例。全程在你的瀏覽器計算,不連網、不上傳。
*/

const base = ref(16)
const ratio = ref(1.25)
const stepsUp = ref(5)
const stepsDown = ref(2)
const rootPx = ref(16)
const unit = ref<'rem' | 'px'>('rem')
const previewText = ref('敏捷的棕色狐狸 Quick Fox')

const scale = computed(() => {
  try {
    return generateScale({
      base: base.value,
      ratio: ratio.value,
      stepsUp: stepsUp.value,
      stepsDown: stepsDown.value,
      rootPx: rootPx.value,
    })
  } catch {
    return []
  }
})

const css = computed(() => (scale.value.length ? toCss(scale.value, { unit: unit.value }) : ''))

const copied = ref(false)
async function copyCss() {
  try {
    await navigator.clipboard.writeText(css.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    /* 忽略 */
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-5">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label class="field-label" for="base">基準字級(px)</label>
          <input id="base" v-model.number="base" type="number" min="1" step="1" class="field-input font-mono" />
        </div>
        <div>
          <label class="field-label" for="ratio">比例</label>
          <select id="ratio" v-model.number="ratio" class="field-input">
            <option v-for="r in RATIOS" :key="r.key" :value="r.value">{{ r.name }}（{{ r.value }}）</option>
          </select>
        </div>
        <div>
          <label class="field-label" for="ratio2">或自訂比例</label>
          <input id="ratio2" v-model.number="ratio" type="number" min="1" step="0.001" class="field-input font-mono" />
        </div>
        <div>
          <label class="field-label" for="up">往上推幾階</label>
          <input id="up" v-model.number="stepsUp" type="number" min="0" max="12" step="1" class="field-input font-mono" />
        </div>
        <div>
          <label class="field-label" for="down">往下推幾階</label>
          <input id="down" v-model.number="stepsDown" type="number" min="0" max="6" step="1" class="field-input font-mono" />
        </div>
        <div>
          <label class="field-label" for="root">root 字級(rem 換算)</label>
          <input id="root" v-model.number="rootPx" type="number" min="1" step="1" class="field-input font-mono" />
        </div>
      </div>
      <div>
        <label class="field-label" for="prev">預覽文字</label>
        <input id="prev" v-model="previewText" type="text" class="field-input" />
      </div>
    </div>

    <!-- 預覽 -->
    <div class="card divide-y divide-line overflow-hidden">
      <div
        v-for="s in scale"
        :key="s.step"
        class="flex items-baseline gap-4 px-5 py-3"
      >
        <span class="w-16 shrink-0 font-mono text-xs text-ink-400">
          {{ s.step > 0 ? '+' + s.step : s.step }}
        </span>
        <span class="w-24 shrink-0 font-mono text-sm text-ink-500">{{ s.px }}px</span>
        <span class="w-20 shrink-0 font-mono text-sm text-ink-500">{{ s.rem }}rem</span>
        <span class="truncate text-ink-900" :style="{ fontSize: s.px + 'px', lineHeight: 1.1 }">{{ previewText }}</span>
      </div>
      <p v-if="!scale.length" class="px-5 py-6 text-center text-sm text-red-600">請輸入大於 0 的基準字級與比例。</p>
    </div>

    <!-- CSS 輸出 -->
    <div class="card p-6 space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-lg font-semibold text-ink-900">CSS 自訂屬性</h2>
        <div class="flex items-center gap-3">
          <div class="inline-flex rounded-xl border border-line p-1">
            <button
              v-for="u in (['rem', 'px'] as const)"
              :key="u"
              type="button"
              class="rounded-lg px-3 py-1 text-sm font-medium transition"
              :class="unit === u ? 'bg-brand-500 text-white' : 'text-ink-700 hover:bg-brand-50'"
              @click="unit = u"
            >
              {{ u }}
            </button>
          </div>
          <button type="button" class="btn-primary" @click="copyCss">{{ copied ? '已複製 ✓' : '複製' }}</button>
        </div>
      </div>
      <pre class="overflow-auto rounded-xl bg-ink-900 p-4 text-sm text-ink-50"><code>{{ css }}</code></pre>
    </div>

    <LegalNote title="什麼是字級比例(Type Scale)?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>模組化比例</strong>是用單一比例(ratio)把字級串成等比數列,讓標題到內文的大小關係和諧、有層次,是網頁與平面排版常見做法。</li>
        <li>比例沿用音樂音程命名:<strong>小三度 1.2、大三度 1.25、完全五度 1.5、黃金比例 1.618</strong>;比例越大,大小落差越戲劇化。一般內文建議用較小比例(1.125～1.25)。</li>
        <li>每一階 = 基準字級 × 比例的階數次方;0 階就是基準字級,正階變大(標題)、負階變小(註解)。</li>
        <li><strong>rem</strong> 以 root 字級(預設 16px)換算,方便配合使用者瀏覽器設定縮放,對無障礙較友善。</li>
        <li>全程在你的瀏覽器計算,<strong>不連網、不上傳</strong>。可搭配 CSS clamp() 流體字級、CSS 單位換算一起用。</li>
      </ul>
    </LegalNote>
  </div>
</template>
