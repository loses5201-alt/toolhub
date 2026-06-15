<script setup lang="ts">
import { ref, computed } from 'vue'
import ResultStat from '@/components/ResultStat.vue'
import { ntd, num } from '@/utils/format'

const total = ref<number | null>(null)
const people = ref<number | null>(null)
const servicePct = ref<number | null>(null) // 服務費 %(選填)
const roundUp = ref(true) // 每人金額無條件進位到整數

const grandTotal = computed(() => (total.value ?? 0) * (1 + (servicePct.value ?? 0) / 100))

const perPersonRaw = computed(() => {
  const n = people.value ?? 0
  return n > 0 ? grandTotal.value / n : 0
})
const perPerson = computed(() => (roundUp.value ? Math.ceil(perPersonRaw.value) : perPersonRaw.value))
const collected = computed(() => perPerson.value * (people.value ?? 0))
const diff = computed(() => collected.value - grandTotal.value)

const hasInput = computed(() => (total.value ?? 0) > 0 && (people.value ?? 0) > 0)
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-5">
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label">總金額</label>
          <input v-model.number="total" type="number" min="0" placeholder="例:3000" class="field-input" />
        </div>
        <div>
          <label class="field-label">分帳人數</label>
          <input v-model.number="people" type="number" min="1" placeholder="例:4" class="field-input" />
        </div>
      </div>
      <div>
        <label class="field-label">服務費 / 加成(%,選填)</label>
        <input v-model.number="servicePct" type="number" min="0" placeholder="例:10" class="field-input" />
      </div>
      <label class="flex items-center gap-2 text-ink-700">
        <input v-model="roundUp" type="checkbox" class="h-5 w-5 accent-brand-600" />
        每人金額無條件進位到整數(湊整,方便收錢)
      </label>
    </div>

    <div v-if="hasInput" class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-3">
        <ResultStat label="每人應付" :value="ntd(perPerson)" highlight />
        <ResultStat label="含服務費總額" :value="ntd(grandTotal)" />
        <ResultStat
          label="收齊後"
          :value="ntd(collected)"
          :hint="diff > 0 ? `多收 ${num(diff)} 元(可當小費或找零)` : '剛好'"
        />
      </div>
    </div>

    <div v-else class="card p-8 text-center text-ink-500">輸入總金額與人數,即可算出每人該付多少。</div>
  </div>
</template>
