<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import { analyzeIsbn, isValidIsbn10, isValidIsbn13, normalizeIsbn } from '@/features/isbn'

/*
  ISBN 檢核 / 轉換 —— 驗證書籍 ISBN-10 / ISBN-13 檢查碼有沒有打對,並互相轉換。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

const input = ref('978-0-306-40615-7')
const info = computed(() => analyzeIsbn(input.value))

// 批次:每行一個,標出無效
const batch = ref('')
interface BatchRow {
  raw: string
  norm: string
  valid: boolean
}
const batchRows = computed<BatchRow[]>(() => {
  return batch.value
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .map((raw) => {
      const norm = normalizeIsbn(raw)
      const valid = isValidIsbn10(norm) || isValidIsbn13(norm)
      return { raw, norm, valid }
    })
})
const batchInvalid = computed(() => batchRows.value.filter((r) => !r.valid))

async function copy(text?: string) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* 忽略 */
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">輸入 ISBN(10 碼或 13 碼,可含連字號)</label>
        <input
          v-model="input"
          class="field-input font-mono text-lg"
          placeholder="978-0-306-40615-7 或 0306406152"
          spellcheck="false"
          autocomplete="off"
        />
      </div>

      <div
        v-if="input.trim() !== ''"
        class="rounded-xl border p-4"
        :class="info.valid ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/60'"
      >
        <div class="flex items-center gap-2 font-semibold" :class="info.valid ? 'text-emerald-800' : 'text-amber-800'">
          <span>{{ info.valid ? '✅' : '⚠️' }}</span>
          <span>
            {{ info.valid ? '檢查碼正確' : '檢查碼不正確' }}
            <template v-if="info.kind === 'isbn10'"> · ISBN-10</template>
            <template v-else-if="info.kind === 'isbn13'"> · ISBN-13(前綴 {{ info.prefix }})</template>
          </span>
        </div>
        <p v-if="info.note" class="mt-1 text-sm" :class="info.valid ? 'text-emerald-700' : 'text-amber-700'">
          {{ info.note }}
        </p>

        <div v-if="info.valid" class="mt-3 grid gap-2">
          <button
            v-if="info.isbn13"
            type="button"
            class="rounded-lg bg-white/70 px-3 py-2 text-left transition hover:bg-white"
            title="點一下複製"
            @click="copy(info.isbn13)"
          >
            <div class="text-xs font-semibold text-ink-400">ISBN-13</div>
            <div class="font-mono text-ink-800">{{ info.isbn13 }}</div>
          </button>
          <button
            v-if="info.isbn10"
            type="button"
            class="rounded-lg bg-white/70 px-3 py-2 text-left transition hover:bg-white"
            title="點一下複製"
            @click="copy(info.isbn10)"
          >
            <div class="text-xs font-semibold text-ink-400">ISBN-10</div>
            <div class="font-mono text-ink-800">{{ info.isbn10 }}</div>
          </button>
        </div>
      </div>
    </div>

    <!-- 批次 -->
    <div class="card p-6 space-y-3">
      <div>
        <label class="field-label">批次驗證(一行一個,對整批書單)</label>
        <textarea
          v-model="batch"
          rows="5"
          class="field-input font-mono text-sm"
          placeholder="9780306406157&#10;0306406152&#10;9789571234567"
          spellcheck="false"
        ></textarea>
      </div>
      <div v-if="batchRows.length" class="text-sm">
        <p class="text-ink-600">
          共 {{ batchRows.length }} 筆,
          <span class="font-semibold text-emerald-700">{{ batchRows.length - batchInvalid.length }} 筆有效</span>,
          <span class="font-semibold" :class="batchInvalid.length ? 'text-amber-700' : 'text-ink-400'">
            {{ batchInvalid.length }} 筆無效
          </span>
        </p>
        <div v-if="batchInvalid.length" class="mt-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
          <div class="mb-1 text-xs font-semibold text-amber-700">無效清單</div>
          <ul class="space-y-0.5 font-mono text-xs text-amber-800">
            <li v-for="(r, i) in batchInvalid" :key="i">{{ r.raw }}</li>
          </ul>
        </div>
      </div>
    </div>

    <div class="text-sm text-ink-500">
      要把 ISBN 做成<strong>條碼</strong>列印?用
      <RouterLink to="/tools/barcode-generate" class="font-semibold text-brand-700 underline hover:text-brand-800">
        條碼產生器
      </RouterLink>
      (選 EAN-13)。
    </div>

    <LegalNote title="這個工具能、不能做什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>能</strong>:檢查書籍 ISBN <strong>檢查碼</strong>有沒有打錯一碼,並在 <strong>ISBN-10 ↔ ISBN-13</strong> 之間轉換。</li>
        <li>依據:ISBN-10 用 mod 11 加權(餘數 10 寫成 <code>X</code>);ISBN-13 用 EAN-13 mod 10(交替 1、3 權重)。</li>
        <li>979 開頭的 ISBN-13 <strong>沒有對應的 ISBN-10</strong>(只有 978 可轉),工具會明確告知。</li>
        <li><strong>不能</strong>:檢查碼正確 <strong>不代表真有這本書</strong> —— 只證明號碼本身格式無誤。要查書目請到國家圖書館或書店資料庫。</li>
        <li>全程<strong>在你的瀏覽器</strong>計算,<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
