<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  parseDate, formatYMD, weekdayName,
  daysBetween, addDays, addBusinessDays, businessDaysBetween,
} from '@/features/dateCalc'

/*
  日期計算機 —— 三種模式:①算兩日期相差幾天 ②從某天加/減 N 天得到日期(可只算工作日)
  ③兩日期間有幾個上班日。常用於契約/退貨鑑賞期/繳費/活動倒數的到期日推算。不上傳。
*/
type Mode = 'diff' | 'add' | 'business'
const mode = ref<Mode>('diff')

const dateA = ref('')
const dateB = ref('')
const baseDate = ref('')
const offset = ref(7)
const onlyBusiness = ref(false)

const pA = computed(() => parseDate(dateA.value))
const pB = computed(() => parseDate(dateB.value))
const pBase = computed(() => parseDate(baseDate.value))

// 模式一:相差天數
const diffResult = computed(() => {
  if (!pA.value || !pB.value) return null
  const d = daysBetween(pA.value, pB.value)
  return { days: Math.abs(d), sign: d, label: `${weekdayName(pA.value)} → ${weekdayName(pB.value)}` }
})

// 模式二:加減天數
const addResult = computed(() => {
  if (!pBase.value) return null
  const n = Math.trunc(offset.value || 0)
  const target = onlyBusiness.value ? addBusinessDays(pBase.value, n) : addDays(pBase.value, n)
  return { date: formatYMD(target), weekday: weekdayName(target) }
})

// 模式三:工作日數
const businessResult = computed(() => {
  if (!pA.value || !pB.value) return null
  const work = businessDaysBetween(pA.value, pB.value)
  const total = Math.abs(daysBetween(pA.value, pB.value)) + 1
  return { work, total, weekend: total - work }
})

const modes: { key: Mode; label: string }[] = [
  { key: 'diff', label: '相差幾天' },
  { key: 'add', label: '加減天數' },
  { key: 'business', label: '工作日數' },
]
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="m in modes"
          :key="m.key"
          class="rounded-xl border px-4 py-2 text-sm font-semibold transition"
          :class="mode === m.key
            ? 'border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-300'
            : 'border-line bg-white text-ink-600 hover:bg-stone-50'"
          @click="mode = m.key"
        >
          {{ m.label }}
        </button>
      </div>

      <!-- 模式一 / 三 共用兩個日期 -->
      <template v-if="mode === 'diff' || mode === 'business'">
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="field-label">起始日期</label>
            <input v-model="dateA" type="date" class="field-input" />
          </div>
          <div>
            <label class="field-label">結束日期</label>
            <input v-model="dateB" type="date" class="field-input" />
          </div>
        </div>

        <div v-if="mode === 'diff' && diffResult" class="rounded-2xl border border-brand-200 bg-brand-50/50 p-5">
          <p class="text-2xl font-bold text-ink-900">相差 {{ diffResult.days }} 天</p>
          <p class="mt-1 text-sm text-ink-500">{{ diffResult.label }}</p>
          <p v-if="diffResult.sign !== 0" class="mt-1 text-sm text-ink-500">
            (含頭尾兩天則為 {{ diffResult.days + 1 }} 天)
          </p>
        </div>

        <div v-if="mode === 'business' && businessResult" class="rounded-2xl border border-brand-200 bg-brand-50/50 p-5 space-y-1">
          <p class="text-2xl font-bold text-ink-900">{{ businessResult.work }} 個工作日</p>
          <p class="text-sm text-ink-500">含起訖兩端、排除週六日;區間共 {{ businessResult.total }} 天,其中週末 {{ businessResult.weekend }} 天。</p>
        </div>
      </template>

      <!-- 模式二:加減天數 -->
      <template v-else>
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="field-label">起算日期</label>
            <input v-model="baseDate" type="date" class="field-input" />
          </div>
          <div>
            <label class="field-label">加(正)/ 減(負)天數</label>
            <input v-model.number="offset" type="number" class="field-input" />
          </div>
        </div>
        <label class="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-700">
          <input v-model="onlyBusiness" type="checkbox" class="accent-brand-600" />
          只算工作日(跳過週六、週日)
        </label>

        <div v-if="addResult" class="rounded-2xl border border-brand-200 bg-brand-50/50 p-5">
          <p class="text-2xl font-bold text-ink-900">{{ addResult.date }}</p>
          <p class="mt-1 text-sm text-ink-500">{{ addResult.weekday }}</p>
        </div>
      </template>
    </div>

    <LegalNote title="使用說明">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>相差幾天</strong>:兩日期間隔的天數(預設不含頭尾;另標示「含頭尾」的天數供參考)。</li>
        <li><strong>加減天數</strong>:從某天起算多少天後/前是哪一天 —— 算繳費、退貨鑑賞期、契約到期日很方便;勾選「只算工作日」會跳過週末。</li>
        <li><strong>工作日數</strong>:兩日期之間(含起訖)有幾個上班日,排除週六日。</li>
        <li>⚠️ 工作日<strong>只排除週末,未扣除國定假日</strong>(假日年年不同);正式期限請再對照政府行事曆。</li>
        <li>本工具<strong>不連網、不上傳</strong>,全部在你的瀏覽器計算。</li>
      </ul>
    </LegalNote>
  </div>
</template>
