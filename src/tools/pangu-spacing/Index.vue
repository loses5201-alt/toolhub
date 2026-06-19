<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { addSpacingWithCount } from '@/features/panguSpacing'

/*
  中文排版「盤古之白」—— 在中日韓文字與英文字母/數字之間自動補半形空格,中英混排更易讀。
  全程在你的瀏覽器,不連網、不上傳。
*/
const SAMPLE =
  '在GitHub上有超過100顆星的Vue3專案\n我昨天買了iPhone15,花了30000元\n用ChatGPT幫忙寫code真的很方便'

const input = ref(SAMPLE)

const processed = computed(() => addSpacingWithCount(input.value))
const output = computed(() => processed.value.result)
const added = computed(() => processed.value.added)

const copied = ref(false)
function copyOut() {
  navigator.clipboard?.writeText(output.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

function applyToInput() {
  input.value = output.value
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-3">
      <div class="flex items-center gap-3">
        <label class="field-label mb-0">貼上中英混排的文字</label>
        <button
          type="button"
          class="ml-auto text-xs text-ink-400 underline hover:text-ink-600"
          @click="input = SAMPLE"
        >
          載入範例
        </button>
        <button
          type="button"
          class="text-xs text-ink-400 underline hover:text-ink-600"
          @click="input = ''"
        >
          清空
        </button>
      </div>
      <textarea
        v-model="input"
        rows="6"
        class="field-input text-sm leading-relaxed"
        spellcheck="false"
        placeholder="例如:在GitHub上有100顆星…"
      />
      <p class="field-hint">
        會在中日韓文字與英文字母/數字之間補上一個半形空格(俗稱「盤古之白」),寫文章、貼文、文件排版更易讀。
        已經有空格的地方不會重複加。全程在你的瀏覽器,<strong>不連網、不上傳</strong>。
      </p>
    </div>

    <!-- 輸出 -->
    <div class="card p-5 space-y-3">
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-ink-700">排版結果</span>
        <span class="text-xs" :class="added > 0 ? 'text-brand-600' : 'text-ink-400'">
          {{ added > 0 ? `已補上 ${added} 個空格` : '沒有需要補空格的地方' }}
        </span>
        <button
          type="button"
          class="ml-auto rounded-lg border border-ink-200 px-3 py-1 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          :disabled="added === 0"
          @click="applyToInput"
        >
          套用回輸入框
        </button>
        <button
          type="button"
          class="rounded-lg border border-ink-200 px-3 py-1 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          @click="copyOut"
        >
          {{ copied ? '已複製' : '複製' }}
        </button>
      </div>
      <pre class="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-800">{{ output || '—' }}</pre>
    </div>

    <LegalNote>
      只在 CJK(中日韓)文字與半形英文字母/數字之間補空格,不會更動標點、不會刪字,可重複套用結果不變。
      若中英之間原本已用標點(逗號、句號)分隔,則不另外加空格。中文標點全形化、繁簡轉換不在本工具範圍。
      與「文字清理工坊」(去空白/全半形/隱形字元)互補。
    </LegalNote>
  </div>
</template>
