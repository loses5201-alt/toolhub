<script setup lang="ts">
import { ref, computed } from 'vue'
import ResultStat from '@/components/ResultStat.vue'
import LegalNote from '@/components/LegalNote.vue'
import { ntd, num } from '@/utils/format'

// 平均月工資、年資(年 + 月)
const avgWage = ref<number | null>(null)
const years = ref<number | null>(null)
const months = ref<number | null>(null)

const totalYears = computed(() => {
  const y = years.value ?? 0
  const m = months.value ?? 0
  return y + m / 12
})

// 勞退新制(勞工退休金條例 §12):每滿1年給 0.5 個月,上限 6 個月
const newMonths = computed(() => Math.min(totalYears.value * 0.5, 6))
// 勞基法舊制(§17):每滿1年給 1 個月,無上限
const oldMonths = computed(() => totalYears.value * 1)

const wage = computed(() => avgWage.value ?? 0)
const newPay = computed(() => wage.value * newMonths.value)
const oldPay = computed(() => wage.value * oldMonths.value)

const hasInput = computed(() => wage.value > 0 && totalYears.value > 0)
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-5">
      <div>
        <label class="field-label">平均月工資(離職前 6 個月平均)</label>
        <input v-model.number="avgWage" type="number" min="0" placeholder="例:40000" class="field-input" />
        <p class="field-hint">包含本薪、津貼、固定獎金等經常性給與。</p>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="field-label">年資 — 年</label>
          <input v-model.number="years" type="number" min="0" placeholder="例:3" class="field-input" />
        </div>
        <div>
          <label class="field-label">年資 — 月</label>
          <input v-model.number="months" type="number" min="0" max="11" placeholder="例:6" class="field-input" />
        </div>
      </div>
    </div>

    <div v-if="hasInput" class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <ResultStat
          label="勞退新制 資遣費"
          :value="ntd(newPay)"
          :hint="`= ${num(newMonths, 2)} 個月 × 平均月工資`"
          highlight
        />
        <ResultStat
          label="勞基法舊制 資遣費"
          :value="ntd(oldPay)"
          :hint="`= ${num(oldMonths, 2)} 個月 × 平均月工資`"
        />
      </div>

      <LegalNote>
        <p>
          <strong>新制(2005/7/1 後年資)</strong>:依《勞工退休金條例》第 12 條,每滿 1 年發給
          0.5 個月平均工資,未滿 1 年按比例計算,<strong>最高以 6 個月為限</strong>。
        </p>
        <p>
          <strong>舊制(2005/7/1 前年資)</strong>:依《勞動基準法》第 17 條,每滿 1 年發給 1
          個月平均工資,未滿 1 年按比例計算,無上限。
        </p>
        <p>
          多數 2005 年 7 月後到職者適用新制。若年資橫跨新舊制,需分段計算(舊制段用舊制、新制段用新制)。
        </p>
        <p class="text-ink-500">本工具僅供概算,實際金額請以勞動契約與勞工局認定為準。</p>
      </LegalNote>
    </div>

    <div v-else class="card p-8 text-center text-ink-500">
      請輸入平均月工資與年資,即可看到試算結果。
    </div>
  </div>
</template>
