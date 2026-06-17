<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { merge } from '@/features/mailMerge'

/*
  合併列印 / 套印 —— 一份範本({{欄位}} 佔位符)+ 一份名單(第一列為欄位名),
  幫每個人各產生一段填好內容的文字(年節祝福、開會通知、繳費提醒、邀請函)。
  全程在你的瀏覽器處理,含個資的名單不上傳。
*/
const template = ref('親愛的 {{姓名}} 您好:\n提醒您本月應繳金額為 {{金額}} 元,請於月底前完成繳納,謝謝!')
const data = ref('姓名,金額\n王小明,1200\n李小華,980\n陳美麗,1500')

const result = computed(() => merge(template.value, data.value))

const copiedIdx = ref<number | null>(null)
function copyOne(i: number) {
  navigator.clipboard?.writeText(result.value.outputs[i])
  copiedIdx.value = i
  setTimeout(() => (copiedIdx.value = null), 1500)
}
const copiedAll = ref(false)
function copyAll() {
  navigator.clipboard?.writeText(result.value.outputs.join('\n\n———\n\n'))
  copiedAll.value = true
  setTimeout(() => (copiedAll.value = false), 1500)
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">訊息範本</label>
        <textarea v-model="template" rows="5" class="field-input text-sm" />
        <p class="field-hint">用 <code v-text="'{{欄位名}}'" /> 當佔位符,會被替換成下方資料對應欄位的值。</p>
      </div>

      <div>
        <label class="field-label">名單資料(第一列為欄位名,逗號或 Tab 分隔)</label>
        <textarea v-model="data" rows="6" class="field-input font-mono text-sm" />
        <p class="field-hint">可直接從 Excel / Google 試算表複製貼上(會用 Tab 分隔)。全程在你的瀏覽器處理,不上傳。</p>
      </div>

      <div v-if="!result.ok" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
        ⚠️ {{ result.error }}
      </div>

      <template v-else>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span class="text-ink-600">將產生 <strong>{{ result.count }}</strong> 段文字</span>
          <span class="text-ink-400">範本欄位:{{ result.placeholders.join('、') || '(無)' }}</span>
          <button v-if="result.count" class="ml-auto text-brand-700 underline hover:text-brand-800" @click="copyAll">
            {{ copiedAll ? '已複製全部 ✓' : '複製全部' }}
          </button>
        </div>

        <div v-if="result.missingFields.length" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
          ⚠️ 範本用到的欄位在資料中找不到:<strong>{{ result.missingFields.join('、') }}</strong> —— 這些位置會留空。請確認欄位名是否一致。
        </div>
      </template>
    </div>

    <div v-if="result.ok && result.count" class="space-y-3">
      <div v-for="(text, i) in result.outputs" :key="i" class="card p-4">
        <div class="mb-1.5 flex items-center gap-3">
          <span class="text-xs font-semibold text-ink-400">第 {{ i + 1 }} 筆</span>
          <button class="text-sm text-brand-700 underline hover:text-brand-800" @click="copyOne(i)">
            {{ copiedIdx === i ? '已複製 ✓' : '複製' }}
          </button>
        </div>
        <p class="whitespace-pre-wrap text-ink-800">{{ text }}</p>
      </div>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>要傳給很多人、只有姓名/金額不同的訊息(祝福、通知、提醒、邀請),不必一個一個改名字。</li>
        <li>名單可直接從 <strong>Excel / Google 試算表</strong>整塊複製貼上;第一列當欄位名,佔位符用 <code v-text="'{{欄位名}}'" />。</li>
        <li>產生後可逐筆或一次複製,再貼到 LINE、email、簡訊或文件裡寄送。</li>
        <li>本工具<strong>不連網、不上傳、不寄送</strong>,名單與內容只留在你的瀏覽器。</li>
      </ul>
    </LegalNote>
  </div>
</template>
