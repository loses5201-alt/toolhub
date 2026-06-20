<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseColor } from '@/features/colorMix'
import {
  kelvinToRgb,
  rgbToKelvin,
  rgbToHex,
  describeKelvin,
  LIGHT_SOURCES,
  MIN_KELVIN,
  MAX_KELVIN,
} from '@/features/colorTemp'

/*
  色溫(Kelvin)↔ 顏色 —— 把光源的克氏色溫換成螢幕可顯示的 sRGB 顏色,反之亦然。
  採 Tanner Helland 廣為流傳的近似式;低色溫偏紅黃(暖)、高色溫偏藍(冷)。
  攝影白平衡、選燈泡(暖白/冷白)、UI 模擬不同光線色調都用得到。全程在你瀏覽器計算,不連網、不上傳。
*/

const kelvin = ref(5500)

const info = computed(() => describeKelvin(kelvin.value))
const swatch = computed(() => info.value.hex)

// 反查:輸入一個顏色 → 最接近的色溫
const colorInput = ref('#FFB46B')
const parsed = computed(() => parseColor(colorInput.value))
const reverseKelvin = computed(() => (parsed.value ? rgbToKelvin(parsed.value) : null))
const reverseSwatch = computed(() =>
  reverseKelvin.value ? rgbToHex(kelvinToRgb(reverseKelvin.value)) : '#000000',
)

function pick(k: number) {
  kelvin.value = k
}

const copied = ref('')
async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = text
    setTimeout(() => (copied.value = ''), 1500)
  } catch {
    /* 忽略 */
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- 色溫 → 顏色 -->
    <div class="card p-6 space-y-5">
      <div>
        <label class="field-label" for="k">色溫(K)</label>
        <div class="flex items-center gap-3">
          <input
            id="k"
            v-model.number="kelvin"
            type="number"
            :min="MIN_KELVIN"
            :max="MAX_KELVIN"
            step="100"
            class="field-input w-40 font-mono"
          />
          <span class="text-sm text-ink-500">{{ MIN_KELVIN }}–{{ MAX_KELVIN }} K</span>
        </div>
        <input
          v-model.number="kelvin"
          type="range"
          :min="MIN_KELVIN"
          :max="15000"
          step="50"
          class="mt-3 w-full"
          aria-label="色溫滑桿"
        />
      </div>

      <div class="overflow-hidden rounded-2xl border border-line">
        <div class="h-28" :style="{ backgroundColor: swatch }" />
        <div class="grid gap-3 border-t border-line p-5 sm:grid-cols-4">
          <div>
            <div class="text-xs text-ink-500">色溫</div>
            <div class="text-xl font-bold text-ink-900">{{ info.kelvin }} K</div>
          </div>
          <div>
            <div class="text-xs text-ink-500">HEX</div>
            <button
              type="button"
              class="text-xl font-bold text-ink-900 hover:text-brand-600"
              @click="copy(info.hex)"
            >
              {{ copied === info.hex ? '已複製 ✓' : info.hex }}
            </button>
          </div>
          <div>
            <div class="text-xs text-ink-500">RGB</div>
            <div class="font-mono text-ink-900">{{ info.rgb.r }}, {{ info.rgb.g }}, {{ info.rgb.b }}</div>
          </div>
          <div>
            <div class="text-xs text-ink-500">mired</div>
            <div class="font-mono text-ink-900">{{ info.mired.toFixed(0) }}</div>
          </div>
        </div>
        <p class="border-t border-line px-5 py-3 text-sm text-ink-600">{{ info.tone }}</p>
      </div>

      <!-- 常見光源快選 -->
      <div>
        <div class="field-label">常見光源(點一下套用)</div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="s in LIGHT_SOURCES"
            :key="s.kelvin"
            type="button"
            class="flex items-center gap-2 rounded-xl border border-line px-3 py-1.5 text-sm text-ink-700 transition hover:border-brand-300"
            :class="{ 'border-brand-400 bg-brand-50': kelvin === s.kelvin }"
            @click="pick(s.kelvin)"
          >
            <span
              class="inline-block h-4 w-4 rounded-full border border-line"
              :style="{ backgroundColor: rgbToHex(kelvinToRgb(s.kelvin)) }"
            />
            {{ s.kelvin }}K · {{ s.name }}
          </button>
        </div>
      </div>
    </div>

    <!-- 顏色 → 色溫(反查) -->
    <div class="card p-6 space-y-4">
      <h2 class="text-lg font-semibold text-ink-900">反查:由顏色估色溫</h2>
      <div class="flex items-center gap-3">
        <input
          v-model="colorInput"
          type="color"
          class="h-11 w-14 shrink-0 rounded-xl border border-line"
          aria-label="顏色選擇器"
        />
        <input v-model="colorInput" type="text" class="field-input font-mono" placeholder="#FFB46B" />
      </div>
      <p v-if="!parsed" class="text-sm text-red-600">看不懂這個色碼,請用 #RRGGBB 或 rgb(r,g,b)。</p>
      <div v-else-if="reverseKelvin !== null" class="flex items-center gap-4">
        <span class="inline-block h-10 w-10 rounded-lg border border-line" :style="{ backgroundColor: reverseSwatch }" />
        <div>
          <div class="text-2xl font-bold text-ink-900">≈ {{ reverseKelvin }} K</div>
          <div class="text-sm text-ink-500">在色溫曲線上最接近的色溫(近似值)</div>
        </div>
      </div>
    </div>

    <LegalNote title="色溫是什麼?怎麼用?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>色溫</strong>以克氏溫度(K)描述光源的顏色:把黑體加熱到該溫度時所發出的光色。<strong>數字越低越偏紅黃(暖)、越高越偏藍(冷)</strong> —— 與日常「暖色/冷色」的直覺相反。</li>
        <li>常見參考:燭光約 1850K、暖白燈泡 2700K、日光與閃光燈約 5500K、<strong>D65 標準日光 6500K</strong>、陰天 7000K 以上。</li>
        <li><strong>mired</strong>(倒數色溫 ×10⁶)是攝影色溫濾鏡的刻度,等量的 mired 變化對人眼較均勻。</li>
        <li>本工具採 <strong>Tanner Helland</strong> 廣為流傳的近似式(適用約 1000–40000K),用於選燈泡色溫、模擬白平衡、UI 配色參考;它是<strong>近似值</strong>,非用於印刷/面板的精密色度量測。</li>
        <li>反查(顏色→色溫)是在色溫曲線上找最接近者,僅供參考;偏離曲線太多的顏色(例如純綠、洋紅)沒有對應色溫。</li>
        <li>全程在你的瀏覽器計算,<strong>不連網、不上傳</strong>。需要色碼互轉、取主色或對色,可搭配色彩工坊、色彩混合器、色差計算。</li>
      </ul>
    </LegalNote>
  </div>
</template>
