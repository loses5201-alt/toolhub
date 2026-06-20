<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import { formatSql, minifySql, type KeywordCase } from '@/features/sqlFormat'

/*
  SQL 格式化 / 美化 —— 把擠成一行或排版凌亂的 SQL 整理成可讀格式,或反向壓成單行。
  全程在你的瀏覽器處理:查詢裡常含資料表/欄位名、甚至參數值,不該貼到陌生線上工具,
  這支不連網、不上傳。
*/

const input = ref(
  "select u.id, u.name, count(o.id) as orders from users u left join orders o on o.user_id=u.id where u.active=1 and u.created_at between '2024-01-01' and '2024-12-31' group by u.id, u.name having count(o.id)>3 order by orders desc limit 20;",
)
const keywordCase = ref<KeywordCase>('upper')
const indent = ref(2)
const mode = ref<'pretty' | 'minify'>('pretty')

const result = computed(() => {
  const opts = { keywordCase: keywordCase.value, indent: indent.value }
  return mode.value === 'minify' ? minifySql(input.value, opts) : formatSql(input.value, opts)
})

const copied = ref(false)
function copy() {
  if (!result.value.ok || !result.value.output) return
  navigator.clipboard?.writeText(result.value.output)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">貼上 SQL</label>
        <textarea
          v-model="input"
          rows="8"
          class="field-input font-mono text-xs leading-relaxed"
          spellcheck="false"
          placeholder="select * from users where id = 1"
        />
        <p class="field-hint">支援字串、識別字(" " / ` `)與註解,格式化絕不改動字面內容。全程在你的瀏覽器處理,不上傳。</p>
      </div>

      <div class="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
        <div class="flex items-center gap-2">
          <span class="text-ink-600">模式</span>
          <div class="inline-flex overflow-hidden rounded-lg border border-ink-200">
            <button
              class="px-3 py-1"
              :class="mode === 'pretty' ? 'bg-brand-600 text-white' : 'bg-white text-ink-600'"
              @click="mode = 'pretty'"
            >
              美化
            </button>
            <button
              class="px-3 py-1"
              :class="mode === 'minify' ? 'bg-brand-600 text-white' : 'bg-white text-ink-600'"
              @click="mode = 'minify'"
            >
              壓成單行
            </button>
          </div>
        </div>

        <label class="flex items-center gap-2">
          <span class="text-ink-600">關鍵字</span>
          <select v-model="keywordCase" class="field-input !w-auto !py-1">
            <option value="upper">大寫 SELECT</option>
            <option value="lower">小寫 select</option>
            <option value="preserve">保留原樣</option>
          </select>
        </label>

        <label v-if="mode === 'pretty'" class="flex items-center gap-2">
          <span class="text-ink-600">縮排</span>
          <select v-model.number="indent" class="field-input !w-auto !py-1">
            <option :value="2">2 空格</option>
            <option :value="4">4 空格</option>
          </select>
        </label>
      </div>
    </div>

    <div v-if="!result.ok" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
      ⚠️ 無法格式化:{{ result.error }}
    </div>

    <div v-else-if="result.output" class="card p-4 space-y-2">
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-emerald-700">✓ {{ mode === 'minify' ? '已壓成單行' : '已格式化' }}</span>
        <button class="ml-auto text-sm text-brand-700 underline hover:text-brand-800" @click="copy">
          {{ copied ? '已複製 ✓' : '複製' }}
        </button>
      </div>
      <pre class="overflow-x-auto rounded-lg bg-ink-900 p-4 text-xs leading-relaxed text-ink-50"><code>{{ result.output }}</code></pre>
    </div>

    <div class="text-sm text-ink-500">
      要把 Excel/CSV 一鍵轉成
      <RouterLink to="/tools/sql-insert" class="font-semibold text-brand-700 underline hover:text-brand-800">INSERT 語法</RouterLink>?
      或解讀
      <RouterLink to="/tools/cron-explain" class="font-semibold text-brand-700 underline hover:text-brand-800">Cron 排程</RouterLink>?
    </div>

    <LegalNote title="這個工具能、不能做什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>能</strong>:把單行/凌亂的 SQL 排成主要子句各自換行、欄位與條件縮排的可讀格式,或反向<strong>壓成單行</strong>。</li>
        <li><strong>能</strong>:統一關鍵字大小寫(大寫/小寫/保留),正確處理<strong>子查詢</strong>、JOIN、<code>GROUP BY</code> / <code>ORDER BY</code>、<code>CREATE TABLE</code> 欄位定義與 <code>BETWEEN ... AND</code>。</li>
        <li><strong>不改動內容</strong>:字串、引號識別字、數字與註解原樣保留 —— 字串裡的 <code>select</code> 不會被當成關鍵字。</li>
        <li><strong>不能</strong>:它是排版器、不解析語義,也不會驗證 SQL 是否正確;少數冷門語法排版可能略有出入。壓成單行時會移除註解。</li>
        <li>全程<strong>在你的瀏覽器</strong>處理,含資料表/欄位名與參數值的查詢<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
