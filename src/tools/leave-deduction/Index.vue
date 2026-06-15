<script setup lang="ts">
import { ref, computed } from 'vue'
import ResultStat from '@/components/ResultStat.vue'
import LegalNote from '@/components/LegalNote.vue'
import { ntd } from '@/utils/format'

// 各假別的「給薪比例」(雇主仍須發的工資比例),依勞基法/勞工請假規則/性平法
interface LeaveType {
  id: string
  name: string
  payRatio: number // 1 = 全薪、0.5 = 半薪、0 = 無薪
  note: string
}

const leaveTypes: LeaveType[] = [
  { id: 'annual', name: '特別休假', payRatio: 1, note: '工資照給,不扣薪。' },
  { id: 'marriage', name: '婚假(8 日)', payRatio: 1, note: '工資照給。' },
  { id: 'funeral', name: '喪假', payRatio: 1, note: '工資照給,天數依親等。' },
  { id: 'official', name: '公假', payRatio: 1, note: '工資照給。' },
  { id: 'work-injury', name: '公傷病假(職災)', payRatio: 1, note: '職災期間雇主應按原領工資補償。' },
  { id: 'sick', name: '普通傷病假', payRatio: 0.5, note: '全年未超過 30 日部分,工資折半發給。' },
  { id: 'menstrual', name: '生理假', payRatio: 0.5, note: '薪資減半發給(每月 1 日)。' },
  { id: 'personal', name: '事假', payRatio: 0, note: '不給工資,全年上限 14 日。' },
  { id: 'family', name: '家庭照顧假', payRatio: 0, note: '併入事假計算,不給工資,全年上限 7 日。' },
]

const salary = ref<number | null>(null) // 月薪
const typeId = ref<string>('personal')
const days = ref<number | null>(null)
const hours = ref<number | null>(null)

const selected = computed(() => leaveTypes.find((t) => t.id === typeId.value)!)

const result = computed(() => {
  const s = salary.value ?? 0
  if (s <= 0) return null
  const d = (days.value ?? 0) + (hours.value ?? 0) / 8
  if (d <= 0) return null

  const dailyWage = s / 30 // 日薪:月薪 ÷ 30
  const hourlyWage = s / 240 // 時薪:月薪 ÷ 240(每日 8 小時 × 30 日)
  const ratio = selected.value.payRatio
  const grossForDays = d * dailyWage // 這些天數對應的「全薪」
  const paid = grossForDays * ratio // 仍可領
  const deduction = grossForDays * (1 - ratio) // 應扣

  return { dailyWage, hourlyWage, totalDays: d, paid, deduction, ratio }
})
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-5">
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label" for="salary">月薪</label>
          <input
            id="salary"
            v-model.number="salary"
            type="number"
            min="0"
            placeholder="例:36000"
            class="field-input"
          />
          <p class="mt-1 text-xs text-ink-500">月薪制以「月薪 ÷ 30」為日薪、「÷ 240」為時薪。</p>
        </div>
        <div>
          <label class="field-label" for="leave-type">請假類別</label>
          <select id="leave-type" v-model="typeId" class="field-input">
            <option v-for="t in leaveTypes" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </div>
        <div>
          <label class="field-label" for="days">天數</label>
          <input
            id="days"
            v-model.number="days"
            type="number"
            min="0"
            step="0.5"
            placeholder="例:2"
            class="field-input"
          />
        </div>
        <div>
          <label class="field-label" for="hours">另加小時(不足一天)</label>
          <input
            id="hours"
            v-model.number="hours"
            type="number"
            min="0"
            step="0.5"
            placeholder="例:4"
            class="field-input"
          />
          <p class="mt-1 text-xs text-ink-500">以每日 8 小時換算。</p>
        </div>
      </div>

      <div class="rounded-xl bg-brand-50/60 px-4 py-3 text-sm text-ink-700">
        <span class="font-semibold">{{ selected.name }}:</span>{{ selected.note }}
      </div>
    </div>

    <div v-if="result" class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <ResultStat
          label="這次請假應扣薪"
          :value="ntd(result.deduction)"
          highlight
          :hint="`共請 ${result.totalDays} 天`"
        />
        <ResultStat
          label="仍可領到"
          :value="ntd(result.paid)"
          :hint="result.ratio === 1 ? '工資照給' : result.ratio === 0.5 ? '折半發給' : '不給工資'"
        />
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <ResultStat label="日薪(月薪÷30)" :value="ntd(result.dailyWage)" />
        <ResultStat label="時薪(月薪÷240)" :value="ntd(result.hourlyWage)" />
      </div>

      <LegalNote title="計算依據與重要前提">
        <p>依《勞工請假規則》《勞動基準法》《性別工作平等法》:</p>
        <ul class="list-disc pl-5 space-y-1">
          <li>特別休假、婚假、喪假、公假、公傷病假(職災):<strong>工資照給</strong>。</li>
          <li>普通傷病假:全年未超過 30 日部分<strong>折半發給</strong>(住院與否合計上限另有規定)。</li>
          <li>生理假:每月得請 1 日,<strong>薪資減半</strong>;全年 3 日不併入病假。</li>
          <li>事假:<strong>不給工資</strong>,全年上限 14 日;家庭照顧假併入事假、上限 7 日。</li>
        </ul>
        <p class="text-ink-500">
          本工具以「月薪 ÷ 30」估算日薪,為常見實務算法;實際給薪、各假別上限、職災補償與公司優於法令之約定請以勞動契約、工作規則與主管機關函釋為準,僅供參考。
        </p>
      </LegalNote>
    </div>

    <div v-else class="card p-8 text-center text-ink-500">
      填入月薪、選擇假別與天數,即可估算這次請假會被扣多少薪、還能領多少。
    </div>
  </div>
</template>
