<script setup lang="ts">
import { ref, computed } from 'vue'
import ResultStat from '@/components/ResultStat.vue'
import LegalNote from '@/components/LegalNote.vue'
import { ntd, num } from '@/utils/format'

// 投保薪資上限(勞保最高投保薪資等級,2024 起為 45,800)
const SALARY_CAP = 45800

const avgSalary = ref<number | null>(null) // 最高 60 個月平均月投保薪資
const years = ref<number | null>(null) // 投保年資(年)
// 相對法定請領年齡(65 歲)提前/延後幾年:-5 ~ +5
const offset = ref<number>(0)

const offsetOptions = [
  { v: -5, label: '提前 5 年(60 歲)' },
  { v: -4, label: '提前 4 年(61 歲)' },
  { v: -3, label: '提前 3 年(62 歲)' },
  { v: -2, label: '提前 2 年(63 歲)' },
  { v: -1, label: '提前 1 年(64 歲)' },
  { v: 0, label: '法定年齡(65 歲)' },
  { v: 1, label: '延後 1 年(66 歲)' },
  { v: 2, label: '延後 2 年(67 歲)' },
  { v: 3, label: '延後 3 年(68 歲)' },
  { v: 4, label: '延後 4 年(69 歲)' },
  { v: 5, label: '延後 5 年(70 歲)' },
]

const result = computed(() => {
  const salaryRaw = avgSalary.value ?? 0
  const y = years.value ?? 0
  if (salaryRaw <= 0 || y <= 0) return null

  const salary = Math.min(salaryRaw, SALARY_CAP)
  const capped = salaryRaw > SALARY_CAP

  // 兩式擇優
  const a = salary * y * 0.00775 + 3000
  const b = salary * y * 0.0155
  const baseMonthly = Math.max(a, b)
  const chosen = a >= b ? 'A' : 'B'

  // 提前每年減 4%、延後每年增 4%(各上限 5 年 ±20%)
  const factor = 1 + 0.04 * offset.value
  const monthly = baseMonthly * factor

  return {
    salary,
    capped,
    a,
    b,
    chosen,
    baseMonthly,
    monthly,
    factor,
    annual: monthly * 12,
    adjustPct: 0.04 * offset.value * 100,
    enoughYears: y >= 15,
  }
})
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-5">
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label" for="avg-salary">平均月投保薪資</label>
          <input
            id="avg-salary"
            v-model.number="avgSalary"
            type="number"
            min="0"
            placeholder="例:43000"
            class="field-input"
          />
          <p class="mt-1 text-xs text-ink-500">加保期間最高 60 個月的平均;上限 {{ num(SALARY_CAP) }} 元。</p>
        </div>
        <div>
          <label class="field-label" for="years">投保年資(年)</label>
          <input
            id="years"
            v-model.number="years"
            type="number"
            min="0"
            step="0.5"
            placeholder="例:30"
            class="field-input"
          />
          <p class="mt-1 text-xs text-ink-500">領年金需年資滿 15 年。</p>
        </div>
      </div>

      <div>
        <label class="field-label" for="offset">請領年齡</label>
        <select id="offset" v-model.number="offset" class="field-input">
          <option v-for="o in offsetOptions" :key="o.v" :value="o.v">{{ o.label }}</option>
        </select>
        <p class="mt-1 text-xs text-ink-500">
          法定請領年齡 116 年(2027)起為 65 歲。提前每年減 4%、延後每年增 4%。
        </p>
      </div>
    </div>

    <div v-if="result" class="space-y-4">
      <div
        v-if="!result.enoughYears"
        class="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm leading-relaxed text-amber-800"
      >
        <span class="font-semibold">⚠️ 提醒:</span>年資未滿 15 年無法請領「年金(按月領)」,僅能請領「老年一次金給付」。下方數字僅供了解年金公式參考。
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <ResultStat
          label="預估每月可領"
          :value="ntd(result.monthly)"
          highlight
          :hint="offset === 0 ? '依較優公式計算' : (offset < 0 ? '已含提前減給' : '已含延後增給')"
        />
        <ResultStat label="預估每年可領" :value="ntd(result.annual)" />
      </div>

      <div class="grid gap-4 sm:grid-cols-3">
        <ResultStat
          label="法定年齡基準金額"
          :value="ntd(result.baseMonthly)"
          hint="未計提前/延後"
        />
        <ResultStat
          label="A 式(+3000)"
          :value="ntd(result.a)"
          :hint="result.chosen === 'A' ? '★ 採用此式' : '較低'"
          :highlight="result.chosen === 'A'"
        />
        <ResultStat
          label="B 式(1.55%)"
          :value="ntd(result.b)"
          :hint="result.chosen === 'B' ? '★ 採用此式' : '較低'"
          :highlight="result.chosen === 'B'"
        />
      </div>

      <div
        v-if="offset !== 0"
        class="rounded-2xl border border-line bg-white p-5 text-sm leading-relaxed text-ink-700"
      >
        <span class="font-semibold">調整幅度:</span>
        {{ offset < 0 ? '提前' : '延後' }} {{ Math.abs(offset) }} 年,
        金額{{ offset < 0 ? '減' : '增' }} {{ num(Math.abs(result.adjustPct), 0) }}%。
      </div>

      <p v-if="result.capped" class="text-sm text-amber-700">
        ※ 你輸入的投保薪資已超過上限,實際以最高 {{ num(SALARY_CAP) }} 元計算。
      </p>

      <LegalNote title="計算依據與重要前提">
        <p>依《勞工保險條例》第 58 條之 1,勞保老年年金以下列兩式<strong>擇優發給</strong>:</p>
        <p>　A 式:平均月投保薪資 × 年資 × <strong>0.775%</strong> + 3,000 元</p>
        <p>　B 式:平均月投保薪資 × 年資 × <strong>1.55%</strong></p>
        <p>「平均月投保薪資」按加保期間<strong>最高 60 個月</strong>之月投保薪資平均計算。</p>
        <p>
          未達法定年齡而<strong>提前請領</strong>者,每提前 1 年減給 4%(最多 5 年減 20%);達年齡而<strong>延後請領</strong>者,每延後 1 年增給 4%(最多 5 年增 20%)。
        </p>
        <p class="text-ink-500">
          本工具為概算:未計入展延年資加計、遺屬年金、職業災害等情形,且投保薪資分級表、法定年齡可能調整。實際給付金額請以勞動部勞工保險局核定為準,僅供參考。
        </p>
      </LegalNote>
    </div>

    <div v-else class="card p-8 text-center text-ink-500">
      填入平均月投保薪資與投保年資,即可估算每月可領的勞保老年年金。
    </div>
  </div>
</template>
