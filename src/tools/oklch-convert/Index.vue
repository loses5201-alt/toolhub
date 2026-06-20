<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseColor } from '@/features/colorMix'
import {
  rgbToOklch,
  oklchToRgb,
  oklchToOklab,
  rgbToHex,
  formatOklch,
  type OkLch,
} from '@/features/oklch'

/*
  OKLCH / OKLab 色彩轉換 —— HEX/RGB ↔ OKLCH 雙向轉換,並可直接拉明度 L、彩度 C、
  色相 H 三條滑桿即時預覽。OKLCH 是 CSS Color 4 的現代色彩空間,感知均勻、調色不偏色,
  做漸層、色階、無障礙配色比 HSL 自然。會標出超出 sRGB 色域的顏色。
  全程在你瀏覽器計算、不上傳。與色彩工坊、色階產生器、漸層產生器互補。
*/

// 以 OKLCH 為單一事實來源
const lch = ref<OkLch>(rgbToOklch({ r: 37, g: 99, b: 235 })) // #2563EB
const hexInput = ref('#2563EB')
const hexError = ref(false)

const result = computed(() => oklchToRgb(lch.value))
const hex = computed(() => rgbToHex(result.value.rgb))
const oklab = computed(() => oklchToOklab(lch.value))
const cssOklch = computed(() => formatOklch(lch.value))
const cssRgb = computed(() => {
  const { r, g, b } = result.value.rgb
  return `rgb(${r}, ${g}, ${b})`
})

// HEX/RGB 輸入 → 更新 OKLCH
function applyHex() {
  const rgb = parseColor(hexInput.value)
  if (!rgb) {
    hexError.value = true
    return
  }
  hexError.value = false
  lch.value = rgbToOklch({ r: rgb.r, g: rgb.g, b: rgb.b })
}

// 滑桿改動 → 同步 hex 輸入框
function syncHexFromLch() {
  hexInput.value = hex.value
  hexError.value = false
}

const Lpct = computed({
  get: () => Math.round(lch.value.L * 1000) / 10,
  set: (v: number) => {
    lch.value = { ...lch.value, L: v / 100 }
    syncHexFromLch()
  },
})
const C = computed({
  get: () => Math.round(lch.value.C * 1000) / 1000,
  set: (v: number) => {
    lch.value = { ...lch.value, C: v }
    syncHexFromLch()
  },
})
const H = computed({
  get: () => Math.round(lch.value.H * 10) / 10,
  set: (v: number) => {
    lch.value = { ...lch.value, H: v }
    syncHexFromLch()
  },
})

const copied = ref('')
async function copy(text: string, key: string) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = key
    setTimeout(() => (copied.value = ''), 1200)
  } catch {
    /* 忽略 */
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-5">
      <div>
        <label class="field-label" for="hex">輸入顏色(HEX / rgb())</label>
        <div class="flex items-center gap-3">
          <input
            v-model="hexInput"
            type="color"
            class="h-11 w-14 shrink-0 rounded-xl border border-line"
            aria-label="顏色選擇器"
            @input="applyHex"
          />
          <input
            id="hex"
            v-model="hexInput"
            type="text"
            class="field-input font-mono"
            placeholder="#2563EB"
            @keyup.enter="applyHex"
            @blur="applyHex"
          />
          <button type="button" class="rounded-xl border border-line px-4 py-2 text-sm text-ink-700 transition hover:border-brand-300" @click="applyHex">
            轉換
          </button>
        </div>
        <p v-if="hexError" class="mt-1 text-sm text-red-600">看不懂這個色碼,請用 #RRGGBB 或 rgb(r,g,b)。</p>
      </div>

      <!-- OKLCH 滑桿 -->
      <div class="space-y-4 border-t border-line pt-5">
        <div>
          <div class="flex items-baseline justify-between">
            <label class="field-label" for="sl-L">明度 L</label>
            <span class="font-mono text-sm text-ink-700">{{ Lpct }}%</span>
          </div>
          <input id="sl-L" v-model.number="Lpct" type="range" min="0" max="100" step="0.1" class="w-full" />
        </div>
        <div>
          <div class="flex items-baseline justify-between">
            <label class="field-label" for="sl-C">彩度 C</label>
            <span class="font-mono text-sm text-ink-700">{{ C.toFixed(3) }}</span>
          </div>
          <input id="sl-C" v-model.number="C" type="range" min="0" max="0.4" step="0.001" class="w-full" />
        </div>
        <div>
          <div class="flex items-baseline justify-between">
            <label class="field-label" for="sl-H">色相 H</label>
            <span class="font-mono text-sm text-ink-700">{{ H.toFixed(1) }}°</span>
          </div>
          <input id="sl-H" v-model.number="H" type="range" min="0" max="360" step="0.1" class="w-full" />
        </div>
      </div>
    </div>

    <div class="card overflow-hidden">
      <div class="h-24" :style="{ backgroundColor: hex }" />
      <div class="border-t border-line p-6 space-y-4">
        <p v-if="!result.inGamut" class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          ⚠ 這個 OKLCH 超出 sRGB 色域,螢幕上顯示的是夾鉗後最接近的可顯示色(實際印刷/廣色域螢幕可能不同)。
        </p>

        <div class="grid gap-3 sm:grid-cols-2">
          <button
            v-for="item in [
              { key: 'oklch', label: 'CSS oklch()', value: cssOklch },
              { key: 'hex', label: 'HEX', value: hex },
              { key: 'rgb', label: 'rgb()', value: cssRgb },
              { key: 'oklab', label: 'OKLab L / a / b', value: `${oklab.L.toFixed(4)} / ${oklab.a.toFixed(4)} / ${oklab.b.toFixed(4)}` },
            ]"
            :key="item.key"
            type="button"
            class="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 text-left transition hover:border-brand-300"
            @click="copy(item.value, item.key)"
          >
            <span>
              <span class="block text-xs text-ink-500">{{ item.label }}</span>
              <span class="block font-mono text-sm text-ink-900">{{ item.value }}</span>
            </span>
            <span class="shrink-0 text-xs" :class="copied === item.key ? 'text-brand-700' : 'text-ink-400'">
              {{ copied === item.key ? '已複製' : '複製' }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <LegalNote title="OKLCH / OKLab 是什麼?為什麼比 HSL 好?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>OKLab</strong>(Björn Ottosson, 2020)是感知均勻的色彩空間;<strong>OKLCH</strong> 是它的極座標版 —— L 明度、C 彩度、H 色相角,正是 CSS Color 4 的 <code>oklch()</code>。</li>
        <li>比 <strong>HSL</strong> 更貼近人眼:同一個 L 的不同色相「看起來一樣亮」(HSL 的黃色會比藍色亮很多);調整彩度也不會偏色相。做<strong>漸層、色階、無障礙配色</strong>特別自然。</li>
        <li><strong>L</strong> 約 0–100%、<strong>C</strong> 一般 0–0.37(sRGB 內)、<strong>H</strong> 0–360°。提高 C 很容易超出 sRGB 色域,本工具會標示並夾鉗到最接近的可顯示色。</li>
        <li>可雙向操作:貼上 HEX/rgb() 看它的 OKLCH,或直接拉三條滑桿調色並複製 <code>oklch()</code>。</li>
        <li>轉換矩陣採 Ottosson 公布值,已用三原色參考值與大量 sRGB 往返測試驗證。全程在你瀏覽器計算,<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
