<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { checkVat, checkVatBatch } from '@/features/vatCheck'

/*
  統一編號檢核 —— 依財政部「統一編號編配及檢查碼邏輯」,在瀏覽器端驗算 8 碼是否符合檢查碼規則。
  可抓出打錯一碼,或一眼看穿隨便亂編的假統編(常見於假發票、人頭公司)。
  注意:檢查碼正確 ≠ 真的有這家公司;要查是否真實存在,請用財政部官方查詢。全程本機運算、不上傳。
*/
const mode = ref<'single' | 'batch'>('single')

// 單筆
const input = ref('')
const single = computed(() => (input.value.trim() ? checkVat(input.value) : null))

// 批次
const batchText = ref('')
const batch = computed(() => (batchText.value.trim() ? checkVatBatch(batchText.value) : null))

// 經濟部商工登記公示資料查詢(查公司是否真實存在)
const GOV_LOOKUP = 'https://findbiz.nat.gov.tw/fts/query/QueryBar/queryInit.do'

function copyInvalid() {
  if (!batch.value) return
  const lines = batch.value.rows
    .filter((r) => !r.result.valid)
    .map((r) => r.raw)
  navigator.clipboard?.writeText(lines.join('\n'))
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div class="flex gap-2">
        <button
          class="rounded-xl border px-4 py-2 text-sm font-semibold transition"
          :class="mode === 'single'
            ? 'border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-300'
            : 'border-line bg-white text-ink-600 hover:bg-stone-50'"
          @click="mode = 'single'"
        >
          單筆檢核
        </button>
        <button
          class="rounded-xl border px-4 py-2 text-sm font-semibold transition"
          :class="mode === 'batch'
            ? 'border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-300'
            : 'border-line bg-white text-ink-600 hover:bg-stone-50'"
          @click="mode = 'batch'"
        >
          批次檢核(整理名單)
        </button>
      </div>

      <!-- 單筆 -->
      <template v-if="mode === 'single'">
        <div>
          <label class="field-label">輸入統一編號(8 碼)</label>
          <input
            v-model="input"
            type="text"
            inputmode="numeric"
            maxlength="12"
            placeholder="例:22099131"
            class="field-input font-mono text-lg tracking-widest"
          />
          <p class="field-hint">全程在你的瀏覽器計算,不會上傳,也不會儲存。可貼含「-」或空白,會自動清理。</p>
        </div>

        <div v-if="single" class="rounded-2xl border p-5"
          :class="single.valid ? 'border-emerald-200 bg-emerald-50/60' : 'border-red-200 bg-red-50/60'">
          <div class="flex items-center gap-2 text-lg font-bold"
            :class="single.valid ? 'text-emerald-700' : 'text-red-700'">
            <span>{{ single.valid ? '✅' : '❌' }}</span>
            <span>{{ single.valid ? '檢查碼正確' : '檢查碼不正確' }}</span>
            <span v-if="single.normalized" class="font-mono text-base text-ink-500">{{ single.normalized }}</span>
          </div>
          <p class="mt-1.5 text-sm text-ink-700">{{ single.reason }}</p>
          <p v-if="single.valid" class="mt-3 text-sm text-ink-600">
            想確認「真的有這家公司」嗎?到
            <a :href="GOV_LOOKUP" target="_blank" rel="noopener"
              class="font-semibold text-brand-700 underline">經濟部商工登記公示資料查詢</a>
            查登記名稱與狀態。
          </p>
        </div>
      </template>

      <!-- 批次 -->
      <template v-else>
        <div>
          <label class="field-label">貼上多筆統一編號</label>
          <textarea
            v-model="batchText"
            rows="6"
            placeholder="一行一筆,或用逗號、分號、空白分隔皆可。例:&#10;22099131&#10;04541302, 12345678"
            class="field-input font-mono text-sm"
          />
          <p class="field-hint">一次驗算整批,標出無效與重複 —— 對帳、整理廠商名單時很實用。不上傳。</p>
        </div>

        <div v-if="batch" class="space-y-3">
          <div class="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <span class="text-ink-600">共 <strong>{{ batch.total }}</strong> 筆</span>
            <span class="text-emerald-700">✅ 有效 <strong>{{ batch.validCount }}</strong></span>
            <span class="text-red-700">❌ 無效 <strong>{{ batch.invalidCount }}</strong></span>
            <span v-if="batch.duplicateCount" class="text-amber-700">⚠️ 重複 <strong>{{ batch.duplicateCount }}</strong></span>
            <button v-if="batch.invalidCount"
              class="ml-auto text-brand-700 underline hover:text-brand-800"
              @click="copyInvalid">複製無效清單</button>
          </div>

          <div class="overflow-hidden rounded-xl border border-line">
            <table class="w-full text-sm">
              <thead class="bg-stone-50 text-ink-500">
                <tr>
                  <th class="px-3 py-2 text-left font-medium">輸入</th>
                  <th class="px-3 py-2 text-left font-medium">結果</th>
                  <th class="px-3 py-2 text-left font-medium">說明</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(r, i) in batch.rows" :key="i" class="border-t border-line/70">
                  <td class="px-3 py-2 font-mono">{{ r.raw }}</td>
                  <td class="px-3 py-2 whitespace-nowrap">
                    <span v-if="r.result.valid && r.duplicate" class="text-amber-700">⚠️ 重複</span>
                    <span v-else-if="r.result.valid" class="text-emerald-700">✅ 有效</span>
                    <span v-else class="text-red-700">❌ 無效</span>
                  </td>
                  <td class="px-3 py-2 text-ink-600">
                    {{ r.duplicate ? '與前面重複的統一編號。' : r.result.reason }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </div>

    <LegalNote title="這個檢核能做什麼、不能做什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>能</strong>:用財政部公布的檢查碼規則,抓出打錯一碼的統一編號,或一眼看穿隨便亂編的假號碼(假發票、人頭公司常見)。</li>
        <li><strong>不能</strong>:檢查碼正確<strong>不代表真的有這家公司</strong> —— 只代表「符合 8 碼編碼規則」。要確認是否真實登記,請用
          <a :href="GOV_LOOKUP" target="_blank" rel="noopener" class="font-semibold text-brand-700 underline">經濟部商工登記公示資料查詢</a>。</li>
        <li>檢查碼採現行「總和被 5 整除」規則(財政部 2023 年起由被 10 整除放寬,既有合法統編皆相容);第 7 碼為 7 者有加 0/加 1 的特例。</li>
        <li>本工具<strong>不連網、不上傳、不儲存</strong>任何輸入。</li>
      </ul>
    </LegalNote>
  </div>
</template>
