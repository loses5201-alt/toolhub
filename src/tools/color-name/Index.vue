<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import { describeColor } from '@/features/colorName'

/*
  CSS 命名顏色查詢 —— 輸入任何 HEX / rgb() / hsl() / 顏色英文名,告訴你「這個顏色叫什麼」:
  完全相符就給名稱,否則用感知距離列出最接近的 CSS 標準命名色。全程在你的瀏覽器執行、不連網。
*/

const input = ref('#6495ed')
const info = computed(() => describeColor(input.value))

const samples = ['#3498db', 'rgb(220, 20, 60)', 'hsl(204, 70%, 53%)', 'teal', '#663399', '#f5deb3']

const copied = ref('')
function copy(text: string, tag: string) {
  navigator.clipboard?.writeText(text)
  copied.value = tag
  setTimeout(() => (copied.value = ''), 1200)
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">輸入顏色</label>
        <div class="flex items-center gap-3">
          <input
            v-model="input"
            class="field-input font-mono"
            spellcheck="false"
            placeholder="#3498db、rgb(52,152,219)、hsl(204,70%,53%) 或 teal"
          />
          <span
            class="h-10 w-10 shrink-0 rounded-lg border border-ink-200 shadow-inner"
            :style="{ background: info.ok ? info.hex : 'transparent' }"
            aria-hidden="true"
          />
        </div>
        <p class="field-hint">支援 HEX(3/6/8 碼)、rgb()/rgba()、hsl()/hsla() 與 148 個 CSS 標準色名。</p>
      </div>

      <div class="flex flex-wrap gap-2 text-xs">
        <button
          v-for="s in samples"
          :key="s"
          class="rounded-full border border-ink-200 px-3 py-1 font-mono text-ink-600 hover:border-brand-400 hover:text-brand-700"
          @click="input = s"
        >
          {{ s }}
        </button>
      </div>
    </div>

    <div v-if="!info.ok" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
      ⚠️ {{ info.error }}
    </div>

    <template v-else>
      <div class="card p-6 space-y-4">
        <div class="flex items-center gap-4">
          <div class="h-20 w-20 shrink-0 rounded-xl border border-ink-200 shadow-inner" :style="{ background: info.hex }" />
          <div>
            <div class="text-2xl font-bold text-ink-900">
              {{ info.exactName ?? info.nearest![0].name }}
              <span v-if="!info.exactName" class="text-sm font-normal text-ink-500">(最接近)</span>
            </div>
            <div class="text-sm text-ink-500">
              {{ info.exactName ? '這個顏色就是這個 CSS 標準色名' : `與最接近的命名色差距 ${info.nearest![0].distance}` }}
            </div>
          </div>
        </div>
        <div class="grid gap-2 sm:grid-cols-3">
          <button class="rounded-lg bg-ink-50 px-3 py-2 text-left font-mono text-sm hover:bg-ink-100" @click="copy(info.hex!, 'hex')">
            <span class="block text-xs text-ink-400">HEX{{ copied === 'hex' ? ' ✓ 已複製' : '' }}</span>{{ info.hex }}
          </button>
          <button class="rounded-lg bg-ink-50 px-3 py-2 text-left font-mono text-sm hover:bg-ink-100" @click="copy(info.rgbString!, 'rgb')">
            <span class="block text-xs text-ink-400">RGB{{ copied === 'rgb' ? ' ✓ 已複製' : '' }}</span>{{ info.rgbString }}
          </button>
          <button class="rounded-lg bg-ink-50 px-3 py-2 text-left font-mono text-sm hover:bg-ink-100" @click="copy(info.hslString!, 'hsl')">
            <span class="block text-xs text-ink-400">HSL{{ copied === 'hsl' ? ' ✓ 已複製' : '' }}</span>{{ info.hslString }}
          </button>
        </div>
      </div>

      <div class="card p-4 space-y-2">
        <h2 class="text-sm font-semibold text-ink-700">最接近的命名色</h2>
        <ul class="divide-y divide-ink-100">
          <li
            v-for="m in info.nearest"
            :key="m.name"
            class="flex items-center gap-3 py-2 text-sm"
          >
            <span class="h-7 w-7 shrink-0 rounded border border-ink-200" :style="{ background: m.hex }" />
            <button class="font-medium text-brand-700 hover:underline" @click="input = m.name">{{ m.name }}</button>
            <span class="font-mono text-ink-400">{{ m.hex }}</span>
            <span class="ml-auto text-xs text-ink-400">{{ m.distance === 0 ? '完全相符' : `差距 ${m.distance}` }}</span>
          </li>
        </ul>
      </div>
    </template>

    <div class="text-sm text-ink-500">
      想做<RouterLink to="/tools/color-tools" class="font-semibold text-brand-700 underline hover:text-brand-800">色碼互轉與抽色盤</RouterLink>、
      <RouterLink to="/tools/color-mix" class="font-semibold text-brand-700 underline hover:text-brand-800">混色</RouterLink>,或
      <RouterLink to="/tools/contrast-check" class="font-semibold text-brand-700 underline hover:text-brand-800">檢查對比度</RouterLink>?
    </div>

    <LegalNote title="說明">
      <ul class="list-disc pl-5 space-y-1">
        <li>資料為 <strong>CSS Color Module Level 4</strong> 的 148 個標準命名色(含 <code>gray</code>/<code>grey</code> 等同義拼法)。</li>
        <li>「最接近」用 <strong>redmean</strong> 加權 RGB 距離 —— 比單純歐氏距離更貼近人眼感受;距離 0 代表完全相符。</li>
        <li>同一個 HEX 的同義名(如 <code>cyan</code>/<code>aqua</code>)在清單中只列出一個。</li>
        <li>全程<strong>在你的瀏覽器</strong>計算,不連網、不上傳。</li>
      </ul>
    </LegalNote>
  </div>
</template>
