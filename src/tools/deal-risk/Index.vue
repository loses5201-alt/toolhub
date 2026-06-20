<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { QUESTIONS, assess, summaryFor } from '@/features/dealRisk'

/*
  網購 / 交易詐騙風險評估 —— 勾選符合的情況,即時算出風險等級與警訊。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

const answers = ref<Record<string, boolean>>({})
const result = computed(() => assess(answers.value))
const checkedCount = computed(() => Object.values(answers.value).filter(Boolean).length)

const levelStyle: Record<string, string> = {
  無明顯風險: 'text-emerald-700 border-emerald-300 bg-emerald-50',
  低風險: 'text-emerald-700 border-emerald-300 bg-emerald-50',
  中風險: 'text-amber-700 border-amber-300 bg-amber-50',
  高風險: 'text-orange-700 border-orange-300 bg-orange-50',
  極高風險: 'text-rose-700 border-rose-300 bg-rose-50',
}
const barColor: Record<string, string> = {
  無明顯風險: 'bg-emerald-500',
  低風險: 'bg-emerald-500',
  中風險: 'bg-amber-500',
  高風險: 'bg-orange-500',
  極高風險: 'bg-rose-500',
}

function reset() {
  answers.value = {}
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-5">
      <div class="flex items-center justify-between">
        <h3 class="text-base font-semibold text-ink-700">勾選符合這筆交易的情況</h3>
        <button v-if="checkedCount" type="button" class="text-sm text-brand-600 hover:underline" @click="reset">清除重來</button>
      </div>
      <ul class="mt-3 space-y-2">
        <li v-for="q in QUESTIONS" :key="q.id">
          <label
            class="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors"
            :class="answers[q.id] ? 'border-brand-300 bg-brand-50' : 'border-ink-100 hover:bg-ink-50'"
          >
            <input v-model="answers[q.id]" type="checkbox" class="mt-1 accent-brand-600" />
            <span class="text-sm text-ink-700">
              {{ q.text }}
              <span v-if="q.critical" class="ml-1 rounded bg-rose-100 px-1.5 py-0.5 text-xs font-medium text-rose-600">關鍵警訊</span>
            </span>
          </label>
        </li>
      </ul>
    </div>

    <!-- 結果 -->
    <div class="card p-5 space-y-4" :class="levelStyle[result.level]" style="border-width: 2px">
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="text-sm opacity-80">評估結果</div>
          <div class="text-2xl font-bold">{{ result.level }}</div>
        </div>
        <div class="text-right">
          <div class="text-3xl font-bold">{{ result.percent }}%</div>
          <div class="text-xs opacity-70">風險分數 {{ result.score }} / {{ result.maxScore }}</div>
        </div>
      </div>
      <div class="h-2.5 w-full rounded-full bg-white/60 overflow-hidden">
        <div class="h-full rounded-full transition-all" :class="barColor[result.level]" :style="{ width: Math.max(result.percent, result.hasCritical ? 100 : 0) + '%' }" />
      </div>
      <p class="text-sm">{{ summaryFor(result.level) }}</p>
    </div>

    <!-- 命中警訊與建議 -->
    <div v-if="result.hits.length" class="card p-5 space-y-3">
      <h3 class="text-sm font-semibold text-ink-700">針對勾選項目的提醒</h3>
      <ul class="space-y-3">
        <li v-for="h in result.hits" :key="h.id" class="flex gap-3">
          <span class="mt-0.5 shrink-0">{{ h.critical ? '🚨' : '⚠️' }}</span>
          <div>
            <div class="text-sm font-medium text-ink-800">{{ h.text }}</div>
            <div class="text-sm text-ink-600">{{ h.advice }}</div>
          </div>
        </li>
      </ul>
    </div>

    <div class="card p-4 text-sm text-ink-600">
      📞 一有疑慮就打 <strong>165</strong> 反詐騙諮詢專線(免費);查公司可用經濟部「商工登記公示資料查詢」;
      檢查連結可用本站「可疑網址檢查器」。
    </div>

    <LegalNote>
      本工具用常見的網購 / 交易詐騙特徵做加權評估,只要出現「操作 ATM、索取驗證碼、要你退回多付款項」等
      <strong>關鍵警訊</strong>,幾乎可確定是詐騙,風險會直接拉到最高。
      評估結果僅供提高警覺參考,<strong>不代表保證安全或一定是詐騙</strong>;真正可疑時請務必撥打 165 查證。
      全程在你的瀏覽器計算,不連網、不上傳任何輸入。
    </LegalNote>
  </div>
</template>
