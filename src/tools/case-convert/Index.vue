<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { CASE_FORMATS, convertLines, type CaseId } from '@/features/caseConvert'

/*
  命名格式轉換 —— 把識別字/詞句在 camelCase、snake_case、kebab-case、PascalCase、
  CONSTANT_CASE 等命名慣例之間互轉,支援多行批次(每行一筆)。
  全程在你的瀏覽器,不連網、不上傳。
*/
const SAMPLE = 'getUserProfile\nmax_retry_count\nbackground-color'

const input = ref(SAMPLE)

// 是否多行(批次)
const isBatch = computed(() => input.value.includes('\n'))

// 每個格式對輸入的轉換結果(逐行)
const results = computed(() =>
  CASE_FORMATS.map((f) => ({
    ...f,
    output: convertLines(input.value, f.id as CaseId),
  })),
)

const copiedId = ref<string | null>(null)
function copy(id: string, text: string) {
  navigator.clipboard?.writeText(text)
  copiedId.value = id
  setTimeout(() => {
    if (copiedId.value === id) copiedId.value = null
  }, 1500)
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-3">
      <div class="flex items-center gap-3">
        <label class="field-label mb-0">輸入文字 / 變數名(可多行批次)</label>
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
        rows="4"
        class="field-input text-sm leading-relaxed font-mono"
        spellcheck="false"
        placeholder="輸入一段文字或變數名,例如 getUserProfile;每行一筆可批次轉換…"
      />
      <p class="field-hint">
        自動辨識原本是 camelCase / snake_case / kebab-case / 空白詞句等,拆成單字後組成各種命名慣例。
        <span v-if="isBatch" class="text-brand-600">已偵測多行 —— 每行各自轉換。</span>
        全程在你的瀏覽器,<strong>不連網、不上傳</strong>。
      </p>
    </div>

    <!-- 各格式結果 -->
    <div class="card p-5 space-y-2">
      <span class="text-sm font-semibold text-ink-700">轉換結果(點右側可複製)</span>
      <div class="divide-y divide-ink-100">
        <div
          v-for="r in results"
          :key="r.id"
          class="flex items-start gap-3 py-2.5"
        >
          <div class="w-32 shrink-0 pt-0.5">
            <div class="text-sm font-medium text-ink-700">{{ r.label }}</div>
          </div>
          <pre
            class="flex-1 min-w-0 whitespace-pre-wrap break-all font-mono text-sm text-ink-800 leading-relaxed"
          >{{ r.output || '—' }}</pre>
          <button
            type="button"
            class="shrink-0 rounded-lg border border-ink-200 px-2.5 py-1 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300 disabled:opacity-40"
            :disabled="!r.output"
            @click="copy(r.id, r.output)"
          >
            {{ copiedId === r.id ? '已複製' : '複製' }}
          </button>
        </div>
      </div>
    </div>

    <LegalNote>
      自動拆字會把連續大寫縮寫(如 <code>HTML</code>)當成一個單字,但組回 PascalCase/Title Case 時會正規化成
      <code>Html</code>(這是命名轉換工具的通用行為)。字母與數字相連視為同一個單字(<code>version2</code>)。
      轉換結果僅供參考,套用前請自行確認符合你的語言/規範。
    </LegalNote>
  </div>
</template>
