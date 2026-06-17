<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import {
  shiftMinutes, totalMinutes, formatHM, toDecimalHours, estimatePay, type Shift,
} from '@/features/workHours'

/*
  工時時數表 —— 加總多段班別的工時,自動處理跨午夜夜班、扣除休息時間,並可選填時薪估算原始工資。
  打工/排班族對帳薪資、報工時用。全程在你的瀏覽器計算,不上傳。
*/
interface Row extends Shift {
  label: string
}
const rows = reactive<Row[]>([
  { label: '週一', start: '09:00', end: '18:00', breakMin: 60 },
  { label: '週二', start: '09:00', end: '18:00', breakMin: 60 },
])
const hourlyRate = ref<number | null>(null)

function addRow() {
  rows.push({ label: '', start: '09:00', end: '18:00', breakMin: 60 })
}
function removeRow(i: number) {
  rows.splice(i, 1)
}

const perRow = computed(() => rows.map((r) => shiftMinutes(r)))
const total = computed(() => totalMinutes(rows))
const decimal = computed(() => toDecimalHours(total.value))
const pay = computed(() => (hourlyRate.value ? estimatePay(total.value, hourlyRate.value) : 0))
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-ink-500">
            <tr>
              <th class="px-2 py-1.5 text-left font-medium">標記</th>
              <th class="px-2 py-1.5 text-left font-medium">上班</th>
              <th class="px-2 py-1.5 text-left font-medium">下班</th>
              <th class="px-2 py-1.5 text-left font-medium">休息(分)</th>
              <th class="px-2 py-1.5 text-right font-medium">工時</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in rows" :key="i" class="border-t border-line/70">
              <td class="px-1 py-1.5">
                <input v-model="r.label" type="text" placeholder="日期/班別" class="field-input w-24 py-1.5" />
              </td>
              <td class="px-1 py-1.5"><input v-model="r.start" type="time" class="field-input w-28 py-1.5" /></td>
              <td class="px-1 py-1.5"><input v-model="r.end" type="time" class="field-input w-28 py-1.5" /></td>
              <td class="px-1 py-1.5"><input v-model.number="r.breakMin" type="number" min="0" class="field-input w-20 py-1.5" /></td>
              <td class="px-2 py-1.5 text-right whitespace-nowrap">
                <span class="font-semibold text-ink-800">{{ formatHM(perRow[i].minutes) }}</span>
                <span v-if="perRow[i].overnight" class="ml-1 text-xs text-violet-600" title="跨午夜夜班">🌙</span>
              </td>
              <td class="px-1 py-1.5 text-right">
                <button class="text-ink-400 hover:text-red-600" title="刪除" @click="removeRow(i)">✕</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <button class="rounded-xl border border-line px-4 py-2 text-sm font-medium text-brand-700 hover:bg-stone-50" @click="addRow">
        + 新增一段班別
      </button>

      <div class="flex flex-wrap items-end gap-4 border-t border-line pt-4">
        <div>
          <label class="field-label">時薪(選填)</label>
          <input v-model.number="hourlyRate" type="number" min="0" placeholder="例:200" class="field-input w-32" />
        </div>
      </div>

      <div class="rounded-2xl border border-brand-200 bg-brand-50/50 p-5">
        <div class="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <div>
            <div class="text-sm text-ink-500">總工時</div>
            <div class="text-2xl font-bold text-ink-900">{{ formatHM(total) }}</div>
            <div class="text-sm text-ink-400">= {{ decimal }} 小時</div>
          </div>
          <div v-if="hourlyRate">
            <div class="text-sm text-ink-500">原始工資估算(時數 × 時薪)</div>
            <div class="text-2xl font-bold text-brand-700">${{ pay.toLocaleString() }}</div>
          </div>
        </div>
      </div>
    </div>

    <LegalNote title="說明與注意">
      <ul class="list-disc pl-5 space-y-1">
        <li>下班時間「等於或早於」上班時間時,視為<strong>跨午夜夜班</strong>(自動 +24 小時),例如 22:00 上到隔天 06:00。</li>
        <li>「休息(分)」會從工時中扣除(休息通常不計薪)。</li>
        <li>時薪估算為<strong>「時數 × 時薪」的原始工資</strong>,<strong>未含</strong>加班費加成、夜班津貼、勞健保扣款等。
          要算加班費請改用 <RouterLink to="/tools/overtime-pay" class="font-semibold text-brand-700 underline">加班費計算</RouterLink>。</li>
        <li>本工具<strong>不連網、不上傳</strong>,班表只留在你的瀏覽器。</li>
      </ul>
    </LegalNote>
  </div>
</template>
