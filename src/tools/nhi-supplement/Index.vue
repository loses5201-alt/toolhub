<script setup lang="ts">
import { ref, computed } from 'vue'
import ResultStat from '@/components/ResultStat.vue'
import LegalNote from '@/components/LegalNote.vue'
import { ntd } from '@/utils/format'

const RATE = 0.0211 // 二代健保補充保費費率 2.11%(2021/1 起)
const SINGLE_MIN = 20000 // 單次給付起扣門檻
const SINGLE_MAX = 10_000_000 // 單次扣繳上限

type IncomeType = 'bonus' | 'other'
const type = ref<IncomeType>('other')

// 高額獎金:全年累計超過投保金額 4 倍的部分才計費
const insuredSalary = ref<number | null>(null)
const bonusCumulative = ref<number | null>(null)

// 其他(股利/利息/租金/兼職薪資/執行業務):單次 ≥ 2 萬全額計費
const singleAmount = ref<number | null>(null)

const base = computed(() => {
  if (type.value === 'bonus') {
    const threshold = (insuredSalary.value ?? 0) * 4
    return Math.max((bonusCumulative.value ?? 0) - threshold, 0)
  }
  const amt = singleAmount.value ?? 0
  if (amt < SINGLE_MIN) return 0
  return Math.min(amt, SINGLE_MAX)
})

const fee = computed(() => base.value * RATE)
const hasInput = computed(() =>
  type.value === 'bonus'
    ? (insuredSalary.value ?? 0) > 0 && (bonusCumulative.value ?? 0) > 0
    : (singleAmount.value ?? 0) > 0,
)
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-5">
      <div>
        <label class="field-label">收入類型</label>
        <div class="flex gap-2">
          <button
            class="flex-1 rounded-xl border px-4 py-2.5 font-medium transition"
            :class="type === 'other' ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-700'"
            @click="type = 'other'"
          >
            股利/利息/租金/兼職
          </button>
          <button
            class="flex-1 rounded-xl border px-4 py-2.5 font-medium transition"
            :class="type === 'bonus' ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-700'"
            @click="type = 'bonus'"
          >
            高額獎金
          </button>
        </div>
      </div>

      <template v-if="type === 'other'">
        <div>
          <label class="field-label">單次給付金額</label>
          <input v-model.number="singleAmount" type="number" min="0" placeholder="例:50000" class="field-input" />
          <p class="field-hint">單次給付達 NT$ 20,000 才需扣繳;單次扣繳上限 1,000 萬。</p>
        </div>
      </template>

      <template v-else>
        <div>
          <label class="field-label">月投保金額</label>
          <input v-model.number="insuredSalary" type="number" min="0" placeholder="例:45800" class="field-input" />
        </div>
        <div>
          <label class="field-label">全年累計獎金</label>
          <input v-model.number="bonusCumulative" type="number" min="0" placeholder="例:300000" class="field-input" />
          <p class="field-hint">全年累計獎金超過「月投保金額 × 4」的部分才計費。</p>
        </div>
      </template>
    </div>

    <div v-if="hasInput" class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <ResultStat label="計費基礎" :value="ntd(base)" :hint="base === 0 ? '未達門檻,免扣' : undefined" />
        <ResultStat label="補充保費(2.11%)" :value="ntd(fee)" highlight />
      </div>

      <LegalNote title="二代健保補充保費">
        <p>費率 <strong>2.11%</strong>(2021 年 1 月起)。</p>
        <p>
          <strong>股利、利息、租金、兼職薪資、執行業務所得</strong>:單次給付達
          <strong>NT$ 20,000</strong> 起扣,單次扣繳上限 1,000 萬。
        </p>
        <p>
          <strong>高額獎金</strong>:全年累計獎金超過「當月投保金額 4 倍」的部分,於發放時扣繳。
        </p>
        <p class="text-ink-500">門檻與費率可能隨政策調整,實際以衛福部健保署公告為準。</p>
      </LegalNote>
    </div>

    <div v-else class="card p-8 text-center text-ink-500">
      選擇收入類型並輸入金額,即可算出應扣的補充保費。
    </div>
  </div>
</template>
