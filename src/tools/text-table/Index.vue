<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseDelimited, toTextTable, type TableStyle } from '@/features/textTable'

/*
  等寬純文字表格 —— 把 CSV/TSV(可從 Excel/Google 試算表整塊複製貼上)轉成在等寬字型下對齊的
  純文字表格,貼進純文字 email、程式碼註解、Slack、README 程式碼區塊、終端機文件。純前端,不上傳。
*/
const input = ref('')
const style = ref<TableStyle>('grid')
const header = ref(true)
const rightNumeric = ref(true)

const sample = `品名,單價,數量
蘋果,30,5
香蕉,18,12
西瓜,150,1`

const output = computed(() => {
  if (!input.value.trim()) return ''
  const rows = parseDelimited(input.value)
  return toTextTable(rows, { style: style.value, header: header.value, rightNumeric: rightNumeric.value })
})

const copied = ref(false)
async function copyOut() {
  if (!output.value) return
  try {
    await navigator.clipboard.writeText(output.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    /* 可手動選取 */
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
      <div>
        <div class="flex items-center justify-between">
          <label class="field-label">貼上 CSV / TSV(可從 Excel、Google 試算表整塊複製貼上)</label>
          <button class="text-xs text-brand-600 hover:underline" @click="input = sample">填入範例</button>
        </div>
        <textarea
          v-model="input"
          rows="7"
          class="field-input font-mono text-xs"
          placeholder="name,age&#10;Bob,25"
        ></textarea>
        <p class="field-hint">含 Tab 自動視為 TSV,否則當 CSV(支援引號、欄內逗號/換行)。全程在你瀏覽器,不上傳。</p>
      </div>

      <div class="grid gap-4 sm:grid-cols-3">
        <label class="block">
          <span class="field-label">樣式</span>
          <select v-model="style" class="field-input">
            <option value="grid">框線(┌─┬─┐ 美觀)</option>
            <option value="ascii">ASCII(+-| 相容性最好)</option>
            <option value="simple">簡潔(空格對齊 + 表頭虛線)</option>
          </select>
        </label>
        <label class="flex items-end gap-2 pb-2 text-sm text-ink-700">
          <input v-model="header" type="checkbox" class="accent-brand-600" /> 第一列當表頭
        </label>
        <label class="flex items-end gap-2 pb-2 text-sm text-ink-700">
          <input v-model="rightNumeric" type="checkbox" class="accent-brand-600" /> 純數字欄右對齊
        </label>
      </div>

      <div v-if="output">
        <div class="flex items-center justify-between">
          <label class="field-label">結果(等寬字型對齊)</label>
          <button class="rounded-md border border-line bg-white px-3 py-1 text-xs hover:border-brand-400" @click="copyOut">{{ copied ? '已複製 ✓' : '複製' }}</button>
        </div>
        <textarea :value="output" rows="10" readonly class="field-input font-mono text-xs whitespace-pre"></textarea>
      </div>
    </div>

    <LegalNote title="使用說明與為什麼用這個">
      <ul class="list-disc space-y-1 pl-5">
        <li>需要在<strong>純文字</strong>環境(email、程式碼註解、Slack、README 的程式碼區塊、終端機)放表格時,用空格對齊比貼圖更清楚、可被搜尋與複製。</li>
        <li>支援 CJK 全形字寬度計算,中文欄位也能對齊(請以<strong>等寬字型</strong>檢視)。</li>
        <li>三種樣式:<strong>框線</strong>最美、<strong>ASCII</strong> 相容性最好(任何字型都不跑版)、<strong>簡潔</strong>最省空間。</li>
        <li>與「CSV ↔ Markdown 表格」(寫 GitHub/Notion 用)、「資料轉換工坊」(格式互轉)互補。全程在你瀏覽器,不上傳。</li>
      </ul>
    </LegalNote>
  </div>
</template>
