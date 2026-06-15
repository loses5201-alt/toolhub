<script setup lang="ts">
import { ref, computed } from 'vue'
import ResultStat from '@/components/ResultStat.vue'
import LegalNote from '@/components/LegalNote.vue'
import { num } from '@/utils/format'

const birth = ref<string>('') // yyyy-mm-dd

const result = computed(() => {
  if (!birth.value) return null
  const b = new Date(birth.value + 'T00:00:00')
  if (isNaN(b.getTime())) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (b > today) return null

  // 實歲:足歲的年、月、日
  let years = today.getFullYear() - b.getFullYear()
  let months = today.getMonth() - b.getMonth()
  let dayDiff = today.getDate() - b.getDate()
  if (dayDiff < 0) {
    months--
    // 借上個月的天數
    const prevMonthDays = new Date(today.getFullYear(), today.getMonth(), 0).getDate()
    dayDiff += prevMonthDays
  }
  if (months < 0) {
    years--
    months += 12
  }

  // 虛歲(常用簡式):今年 - 出生年 + 1
  const nominalAge = today.getFullYear() - b.getFullYear() + 1

  // 保險年齡:足歲,未滿一歲的零數滿 6 個月者進位加 1(各家定義略有不同)
  const insuranceAge = months >= 6 ? years + 1 : years

  // 已活天數
  const livedDays = Math.floor((today.getTime() - b.getTime()) / 86400000)

  // 下次生日倒數
  let nextBday = new Date(today.getFullYear(), b.getMonth(), b.getDate())
  if (nextBday <= today) nextBday = new Date(today.getFullYear() + 1, b.getMonth(), b.getDate())
  const daysToBday = Math.round((nextBday.getTime() - today.getTime()) / 86400000)

  return { years, months, dayDiff, nominalAge, insuranceAge, livedDays, daysToBday }
})
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6">
      <label class="field-label" for="birth">出生日期</label>
      <input id="birth" v-model="birth" type="date" class="field-input" />
      <p class="field-hint">輸入西元出生年月日,馬上算出實歲、虛歲與保險年齡。</p>
    </div>

    <div v-if="result" class="space-y-4">
      <ResultStat
        label="實歲(足歲)"
        :value="`${result.years} 歲 ${result.months} 個月 ${result.dayDiff} 天`"
        highlight
      />
      <div class="grid gap-4 sm:grid-cols-2">
        <ResultStat label="虛歲" :value="`${result.nominalAge} 歲`" hint="今年 − 出生年 + 1" />
        <ResultStat label="保險年齡" :value="`${result.insuranceAge} 歲`" hint="足歲滿 6 個月進位" />
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <ResultStat label="已經活了" :value="`${num(result.livedDays)} 天`" />
        <ResultStat
          label="距離下次生日"
          :value="result.daysToBday === 0 ? '就是今天 🎂' : `${result.daysToBday} 天`"
        />
      </div>

      <LegalNote title="幾種年齡的算法">
        <ul class="list-disc pl-5 space-y-1">
          <li><strong>實歲(足歲)</strong>:從出生日算起實際滿幾年,法律與日常多用此。</li>
          <li><strong>虛歲</strong>:傳統算法,出生即算 1 歲、每逢過年加 1。此處用常見簡式「今年 − 出生年 + 1」,與依農曆春節精算可能差 1 歲。</li>
          <li><strong>保險年齡</strong>:人壽保險常用,以足歲計、未滿一歲的零數超過 6 個月者進位加 1。各家保險公司定義可能略有不同。</li>
        </ul>
        <p class="text-ink-500">本工具以你裝置的今日日期計算,僅供參考。</p>
      </LegalNote>
    </div>

    <div v-else-if="birth" class="card p-8 text-center text-ink-500">
      日期看起來不太對,請確認出生日期不晚於今天。
    </div>
    <div v-else class="card p-8 text-center text-ink-500">
      選擇出生日期,即可算出實歲、虛歲、保險年齡與生日倒數。
    </div>
  </div>
</template>
