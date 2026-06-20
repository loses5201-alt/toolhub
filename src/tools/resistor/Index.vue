<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  COLORS,
  COLOR_MAP,
  decodeBands,
  encodeValue,
  parseSmd,
  formatOhms,
} from '@/features/resistor'

/*
  電阻色環 / SMD 碼計算 —— 色環 ↔ 阻值雙向換算,IEC 60062 標準色碼。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

const bandCount = ref<4 | 5 | 6>(4)

// 各環的預設顏色(對應「棕黑紅金」= 1kΩ)
const bands = ref<string[]>(['brown', 'black', 'red', 'gold'])

// 每一環可選的顏色(數字環不能金銀;倍率環全部;誤差環只列有誤差者;溫度環只列有 tempco 的數字色)
function optionsFor(index: number): string[] {
  const n = bandCount.value
  const digitCount = n === 4 ? 2 : 3
  if (index < digitCount) return COLORS.filter((c) => c.digit !== null).map((c) => c.key)
  if (index === digitCount) return COLORS.map((c) => c.key) // 倍率
  if (index === digitCount + 1) return COLORS.filter((c) => c.tolerance !== null).map((c) => c.key)
  return COLORS.filter((c) => c.tempco !== null && c.digit !== null).map((c) => c.key) // 溫度係數
}

function labelFor(index: number): string {
  const n = bandCount.value
  const digitCount = n === 4 ? 2 : 3
  if (index < digitCount) return `第 ${index + 1} 位數字`
  if (index === digitCount) return '倍率'
  if (index === digitCount + 1) return '誤差'
  return '溫度係數'
}

// 切換環數時補/截色環到合法長度
watch(bandCount, (n) => {
  const defaults4 = ['brown', 'black', 'red', 'gold']
  const defaults5 = ['brown', 'black', 'black', 'brown', 'brown']
  const defaults6 = ['brown', 'black', 'black', 'brown', 'brown', 'red']
  bands.value = n === 4 ? defaults4 : n === 5 ? defaults5 : defaults6
})

const decoded = computed(() => decodeBands(bands.value))
const decodedOk = computed(() => (decoded.value && !('error' in decoded.value) ? decoded.value : null))

// 阻值 → 色環
const targetOhms = ref(4700)
const targetTol = ref(5)
const encResult = computed(() => encodeValue(targetOhms.value, bandCount.value, targetTol.value))
const encBands = computed(() => (Array.isArray(encResult.value) ? encResult.value : null))

function applyEncoded() {
  if (encBands.value) bands.value = [...encBands.value]
}

// SMD
const smdInput = ref('472')
const smdValue = computed(() => parseSmd(smdInput.value))

const toleranceOptions = COLORS.filter((c) => c.tolerance !== null)
</script>

<template>
  <div class="space-y-6">
    <!-- 環數 -->
    <div class="card p-5 flex flex-wrap items-center gap-3">
      <span class="field-label mb-0">色環數</span>
      <div class="inline-flex rounded-xl border border-line p-1">
        <button
          v-for="n in [4, 5, 6]"
          :key="n"
          type="button"
          class="rounded-lg px-4 py-1.5 text-sm font-medium transition"
          :class="bandCount === n ? 'bg-brand-500 text-white' : 'text-ink-700 hover:bg-brand-50'"
          @click="bandCount = n as 4 | 5 | 6"
        >
          {{ n }} 環
        </button>
      </div>
    </div>

    <!-- 色環 → 阻值 -->
    <div class="card p-6 space-y-5">
      <h2 class="text-lg font-semibold text-ink-900">色環 → 阻值</h2>

      <!-- 電阻外觀 -->
      <div class="relative mx-auto flex h-16 w-full max-w-md items-center">
        <div class="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 bg-ink-300" />
        <div class="relative mx-auto flex h-12 w-3/4 items-center justify-center gap-2 rounded-lg bg-[#e8d9b5] px-4 shadow-inner">
          <div
            v-for="(b, i) in bands"
            :key="i"
            class="h-full w-3 rounded-sm"
            :style="{ backgroundColor: COLOR_MAP[b]?.hex }"
            :title="COLOR_MAP[b]?.name"
          />
        </div>
      </div>

      <div class="grid gap-3" :style="{ gridTemplateColumns: `repeat(${bandCount}, minmax(0, 1fr))` }">
        <div v-for="(_, i) in bands" :key="i">
          <label class="field-label text-xs">{{ labelFor(i) }}</label>
          <select v-model="bands[i]" class="field-input text-sm" :aria-label="labelFor(i)">
            <option v-for="key in optionsFor(i)" :key="key" :value="key">
              {{ COLOR_MAP[key].name }}
            </option>
          </select>
        </div>
      </div>

      <div v-if="decodedOk" class="rounded-xl bg-brand-50 p-5">
        <div class="text-3xl font-black text-ink-900">{{ formatOhms(decodedOk.ohms) }}</div>
        <div class="mt-1 text-ink-600">
          誤差 ±{{ decodedOk.tolerance }}%
          <template v-if="decodedOk.tempco !== null"> · 溫度係數 {{ decodedOk.tempco }} ppm/K</template>
          <span class="ml-2 text-sm">(範圍 {{ formatOhms(decodedOk.ohms * (1 - (decodedOk.tolerance ?? 0) / 100)) }} ～ {{ formatOhms(decodedOk.ohms * (1 + (decodedOk.tolerance ?? 0) / 100)) }})</span>
        </div>
      </div>
      <div v-else-if="decoded && 'error' in decoded" class="rounded-xl bg-red-50 p-4 text-sm text-red-700">
        {{ decoded.error }}
      </div>
    </div>

    <!-- 阻值 → 色環 -->
    <div class="card p-6 space-y-4">
      <h2 class="text-lg font-semibold text-ink-900">阻值 → 色環</h2>
      <div class="flex flex-wrap items-end gap-3">
        <div>
          <label class="field-label" for="ohms">阻值(Ω)</label>
          <input id="ohms" v-model.number="targetOhms" type="number" min="0" step="any" class="field-input w-40 font-mono" />
        </div>
        <div>
          <label class="field-label" for="tol">誤差</label>
          <select id="tol" v-model.number="targetTol" class="field-input w-28">
            <option v-for="c in toleranceOptions" :key="c.key" :value="c.tolerance">±{{ c.tolerance }}%</option>
          </select>
        </div>
      </div>
      <div v-if="encBands" class="flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-2">
          <span
            v-for="(b, i) in encBands"
            :key="i"
            class="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-sm"
          >
            <span class="inline-block h-4 w-4 rounded-sm" :style="{ backgroundColor: COLOR_MAP[b].hex }" />
            {{ COLOR_MAP[b].name }}
          </span>
        </div>
        <button type="button" class="btn-primary" @click="applyEncoded">套用到上方</button>
      </div>
      <div v-else-if="encResult && 'error' in encResult" class="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
        {{ encResult.error }}
      </div>
    </div>

    <!-- SMD -->
    <div class="card p-6 space-y-3">
      <h2 class="text-lg font-semibold text-ink-900">SMD 數字碼 → 阻值</h2>
      <div class="flex items-center gap-3">
        <input v-model="smdInput" type="text" class="field-input w-40 font-mono text-lg" placeholder="472 / 4702 / 4R7" />
        <span v-if="smdValue !== null" class="text-2xl font-bold text-ink-900">= {{ formatOhms(smdValue) }}</span>
        <span v-else class="text-sm text-red-600">看不懂這個碼(支援 3 碼、4 碼、R 表小數如 4R7)</span>
      </div>
    </div>

    <LegalNote title="電阻色碼怎麼讀?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>4 環</strong>:兩位數字 + 倍率 + 誤差。<strong>5 / 6 環</strong>:三位數字 + 倍率 + 誤差(6 環再加溫度係數)。</li>
        <li>數字色:黑0、棕1、紅2、橙3、黃4、綠5、藍6、紫7、灰8、白9;倍率同色為 10ⁿ,金 ×0.1、銀 ×0.01。</li>
        <li>誤差色:棕±1%、紅±2%、綠±0.5%、藍±0.25%、紫±0.1%、灰±0.05%、金±5%、銀±10%。</li>
        <li>讀色環時誤差環(金/銀,或與本體有間距的一環)放右邊,從另一端開始讀。</li>
        <li><strong>SMD</strong>:3 碼「472」= 47×10² = 4.7kΩ;4 碼「4702」= 470×10² = 47kΩ;「R」代表小數點,4R7 = 4.7Ω。</li>
        <li>採 IEC 60062 標準色碼;全程在你的瀏覽器計算,<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
