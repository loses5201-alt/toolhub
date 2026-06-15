<script setup lang="ts">
import { ref, computed } from 'vue'
import ResultStat from '@/components/ResultStat.vue'
import LegalNote from '@/components/LegalNote.vue'
import { ntd } from '@/utils/format'

// 時薪來源:直接輸入時薪,或用月薪換算(月薪 ÷ 240,即 ÷30天÷8小時)
const mode = ref<'hourly' | 'monthly'>('hourly')
const hourlyInput = ref<number | null>(null)
const monthlyInput = ref<number | null>(null)

const hourly = computed(() => {
  if (mode.value === 'hourly') return hourlyInput.value ?? 0
  return (monthlyInput.value ?? 0) / 240
})

// 平日 / 休息日加班時數
const weekdayHours = ref<number | null>(null)
const restdayHours = ref<number | null>(null)

// 平日:前2小時 ×4/3,第3小時起 ×5/3
function weekdayPay(h: number, rate: number): number {
  const first = Math.min(h, 2)
  const rest = Math.max(h - 2, 0)
  return rate * (first * (4 / 3) + rest * (5 / 3))
}
// 休息日:前2小時 ×4/3,第3小時起 ×5/3(2018年後制度)
function restdayPay(h: number, rate: number): number {
  const first = Math.min(h, 2)
  const rest = Math.max(h - 2, 0)
  return rate * (first * (4 / 3) + rest * (5 / 3))
}

const wkPay = computed(() => weekdayPay(weekdayHours.value ?? 0, hourly.value))
const rdPay = computed(() => restdayPay(restdayHours.value ?? 0, hourly.value))
const total = computed(() => wkPay.value + rdPay.value)

const hasInput = computed(
  () => hourly.value > 0 && ((weekdayHours.value ?? 0) > 0 || (restdayHours.value ?? 0) > 0),
)
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-5">
      <!-- 時薪來源切換 -->
      <div>
        <label class="field-label">時薪計算方式</label>
        <div class="flex gap-2">
          <button
            class="flex-1 rounded-xl border px-4 py-2.5 font-medium transition"
            :class="mode === 'hourly' ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-700'"
            @click="mode = 'hourly'"
          >
            直接輸入時薪
          </button>
          <button
            class="flex-1 rounded-xl border px-4 py-2.5 font-medium transition"
            :class="mode === 'monthly' ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-700'"
            @click="mode = 'monthly'"
          >
            用月薪換算
          </button>
        </div>
      </div>

      <div v-if="mode === 'hourly'">
        <label class="field-label">時薪</label>
        <input v-model.number="hourlyInput" type="number" min="0" placeholder="例:200" class="field-input" />
      </div>
      <div v-else>
        <label class="field-label">月薪</label>
        <input v-model.number="monthlyInput" type="number" min="0" placeholder="例:36000" class="field-input" />
        <p class="field-hint">換算時薪 = 月薪 ÷ 240(月 30 天 × 日 8 小時),目前時薪約 {{ Math.round(hourly) }} 元。</p>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label">平日加班時數</label>
          <input v-model.number="weekdayHours" type="number" min="0" step="0.5" placeholder="例:3" class="field-input" />
        </div>
        <div>
          <label class="field-label">休息日加班時數</label>
          <input v-model.number="restdayHours" type="number" min="0" step="0.5" placeholder="例:0" class="field-input" />
        </div>
      </div>
    </div>

    <div v-if="hasInput" class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-3">
        <ResultStat label="平日加班費" :value="ntd(wkPay)" />
        <ResultStat label="休息日加班費" :value="ntd(rdPay)" />
        <ResultStat label="加班費合計" :value="ntd(total)" highlight />
      </div>

      <LegalNote title="勞基法第 24 條 加班加給">
        <p>平日延長工時:前 2 小時 ×<strong> 1⅓(1.34 倍)</strong>,第 3 小時起 ×<strong> 1⅔(1.67 倍)</strong>。</p>
        <p>休息日工作:前 2 小時 ×<strong> 1⅓</strong>,第 3 小時起 ×<strong> 1⅔</strong>(2018 年勞基法修正後標準)。</p>
        <p class="text-ink-500">
          此為「加班費」金額(已含當小時工資)。國定假日、例假日加班另有加倍規定,不在此工具範圍。實際請以公司計算與勞動契約為準。
        </p>
      </LegalNote>
    </div>

    <div v-else class="card p-8 text-center text-ink-500">
      輸入時薪(或月薪)與加班時數,即可算出加班費。
    </div>
  </div>
</template>
