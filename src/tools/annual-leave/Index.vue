<script setup lang="ts">
import { ref, computed } from 'vue'
import ResultStat from '@/components/ResultStat.vue'
import LegalNote from '@/components/LegalNote.vue'

const today = new Date().toISOString().slice(0, 10)
const startDate = ref<string>('')
const asOfDate = ref<string>(today)

// 計算到職到基準日的完整年資(年、月)
const service = computed(() => {
  if (!startDate.value || !asOfDate.value) return null
  const s = new Date(startDate.value)
  const e = new Date(asOfDate.value)
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return null

  let months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth())
  if (e.getDate() < s.getDate()) months -= 1
  if (months < 0) months = 0
  return { years: Math.floor(months / 12), months: months % 12, totalMonths: months }
})

// 依勞基法 §38 對應特休天數
function daysFor(totalMonths: number): number {
  const y = Math.floor(totalMonths / 12)
  if (totalMonths < 6) return 0
  if (totalMonths < 12) return 3 // 6個月以上未滿1年
  if (y < 2) return 7
  if (y < 3) return 10
  if (y < 5) return 14
  if (y < 10) return 15
  return Math.min(15 + (y - 9), 30) // 滿10年起每年+1,上限30
}

const days = computed(() => (service.value ? daysFor(service.value.totalMonths) : null))
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 grid gap-4 sm:grid-cols-2">
      <div>
        <label class="field-label">到職日期</label>
        <input v-model="startDate" type="date" class="field-input" />
      </div>
      <div>
        <label class="field-label">計算基準日</label>
        <input v-model="asOfDate" type="date" class="field-input" />
        <p class="field-hint">預設今天,可改成任一日期試算。</p>
      </div>
    </div>

    <div v-if="service && days !== null" class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <ResultStat
          label="目前應有特別休假"
          :value="`${days} 天`"
          :hint="`年資 ${service.years} 年 ${service.months} 個月`"
          highlight
        />
        <ResultStat
          label="年資(滿)"
          :value="`${service.years} 年`"
          :hint="service.totalMonths < 6 ? '未滿6個月,尚無特休' : '依勞基法第38條'"
        />
      </div>

      <LegalNote title="勞基法第 38 條 特休級距">
        <ul class="list-disc pl-5 space-y-0.5">
          <li>6 個月以上未滿 1 年:<strong>3 天</strong></li>
          <li>1 年以上未滿 2 年:<strong>7 天</strong></li>
          <li>2 年以上未滿 3 年:<strong>10 天</strong></li>
          <li>3 年以上未滿 5 年:每年 <strong>14 天</strong></li>
          <li>5 年以上未滿 10 年:每年 <strong>15 天</strong></li>
          <li>10 年以上:每滿 1 年加 1 天,最高 <strong>30 天</strong></li>
        </ul>
        <p class="text-ink-500">
          特休以「週年制」計算(自到職日起算)。雇主若採曆年制等其他方式,天數可能略有不同但不得低於本標準。
        </p>
      </LegalNote>
    </div>

    <div v-else class="card p-8 text-center text-ink-500">
      請選擇到職日期,即可算出目前應有的特休天數。
    </div>
  </div>
</template>
