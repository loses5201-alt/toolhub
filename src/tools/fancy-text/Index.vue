<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { allVariants } from '@/features/fancyText'

/*
  Unicode 花式字 / 字體產生器 —— 把英數字轉成各種 Unicode 字體變體,
  貼進 IG / Threads / Discord 個人簡介、暱稱、貼文標題。
  這些都是真正的 Unicode 字元、不是圖片,可直接複製貼上。
  全程在你的瀏覽器計算,不連網、不上傳。
*/
const input = ref('Hello 你好 123')

const variants = computed(() => allVariants(input.value))

const copied = ref('')
async function copy(text: string, id: string) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = id
    setTimeout(() => (copied.value = ''), 1200)
  } catch {
    /* 忽略 */
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-5 space-y-2">
      <label class="field-label" for="ft-in">輸入文字(英文字母與數字才會變體,中文與符號維持原樣)</label>
      <textarea
        id="ft-in"
        v-model="input"
        rows="2"
        class="field-input font-mono"
        placeholder="打字看看……"
      ></textarea>
    </div>

    <div class="card divide-y divide-line">
      <div
        v-for="v in variants"
        :key="v.id"
        class="flex items-center gap-3 p-3 sm:p-4"
      >
        <div class="min-w-0 flex-1">
          <div class="text-xs text-ink-400">{{ v.name }}</div>
          <div class="ft-out break-words text-lg text-ink-900">{{ v.text || '—' }}</div>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-lg border border-ink-200 px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          :disabled="!v.text"
          @click="copy(v.text, v.id)"
        >
          {{ copied === v.id ? '已複製' : '複製' }}
        </button>
      </div>
    </div>

    <LegalNote title="這些花式字怎麼來的?能貼到哪?">
      <ul class="list-disc pl-5 space-y-1">
        <li>
          這些不是圖片或特殊字型,而是 <strong>Unicode 標準碼位</strong>裡真實存在的字元
          (多數來自「數學字母符號」區塊),所以能像一般文字一樣<strong>複製貼上</strong>到
          IG / Threads / Facebook / Discord / LINE 的暱稱、個人簡介、貼文。
        </li>
        <li>
          因為是「字元替換」而非字型,<strong>能不能正常顯示要看對方裝置 / App 的字型支援</strong> ——
          少數舊系統或某些欄位可能顯示成空白方框 □,建議貼出前先預覽。
        </li>
        <li>
          <strong>無障礙提醒</strong>:螢幕報讀軟體可能把這些字念錯或念不出來,搜尋引擎也較難索引;
          重要資訊(如真實姓名)建議保留一份正常文字,花式字只用於裝飾。
        </li>
        <li>「刪除線 / 底線」是用<strong>組合符號</strong>疊上去的,在不同編輯器貼上時偶爾會錯位,屬正常現象。</li>
        <li>全程在你的瀏覽器即時轉換,<strong>不連網、不上傳</strong>任何輸入文字。</li>
      </ul>
    </LegalNote>
  </div>
</template>

<style scoped>
.ft-out {
  line-height: 1.6;
}
</style>
