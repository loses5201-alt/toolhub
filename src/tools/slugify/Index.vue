<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { slugify, DEFAULT_OPTIONS, type SlugOptions } from '@/features/slugify'

/*
  網址代稱 / Slug 產生器 —— 把文章標題/任意文字洗成適合放網址的 slug。
  支援多行批次(每行一筆)。全程在你的瀏覽器,不連網、不上傳。
*/
const SAMPLE = 'Café & 餐廳:Best in 2024!\nHello, World!\n第一篇:我的旅程'

const input = ref(SAMPLE)
const opts = ref<SlugOptions>({ ...DEFAULT_OPTIONS })

const output = computed(() =>
  input.value
    .split('\n')
    .map((line) => (line.trim() === '' ? '' : slugify(line, opts.value)))
    .join('\n'),
)

const copied = ref(false)
function copyOut() {
  navigator.clipboard?.writeText(output.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-3">
      <div class="flex items-center gap-3">
        <label class="field-label mb-0">輸入標題 / 文字(可多行批次)</label>
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
        class="field-input text-sm leading-relaxed"
        spellcheck="false"
        placeholder="貼上文章標題,每行一筆…"
      />
      <p class="field-hint">
        會去除重音符號(café→cafe)、把標點/空白轉成分隔符、收斂並去頭尾。適合做部落格/CMS 文章網址、錨點 id。
        全程在你的瀏覽器,<strong>不連網、不上傳</strong>。
      </p>
    </div>

    <!-- 選項 -->
    <div class="card p-5 space-y-4">
      <span class="text-sm font-semibold text-ink-700">設定</span>
      <div class="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-600">
        <label class="flex items-center gap-1.5">
          <input v-model="opts.lowercase" type="checkbox" class="accent-brand-600" /> 轉成小寫
        </label>
        <label class="flex items-center gap-1.5">
          <input v-model="opts.keepUnicode" type="checkbox" class="accent-brand-600" />
          保留中文/其他文字(否則只留英數)
        </label>
      </div>
      <div class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <label class="field-label">分隔符</label>
          <select v-model="opts.separator" class="field-input">
            <option value="-">連字號 -</option>
            <option value="_">底線 _</option>
          </select>
        </div>
        <div>
          <label class="field-label">長度上限(0 = 不限)</label>
          <input v-model.number="opts.maxLength" type="number" min="0" class="field-input" />
        </div>
      </div>
    </div>

    <!-- 輸出 -->
    <div class="card p-5 space-y-3">
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-ink-700">Slug 結果</span>
        <button
          type="button"
          class="ml-auto rounded-lg border border-ink-200 px-3 py-1 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          @click="copyOut"
        >
          {{ copied ? '已複製' : '複製' }}
        </button>
      </div>
      <pre class="whitespace-pre-wrap break-all font-mono text-sm text-ink-800 leading-relaxed">{{ output || '—' }}</pre>
    </div>

    <LegalNote>
      重音/變音符號採 Unicode 正規化(NFD)後去除,僅對拉丁字母有效。保留中文時,中文字本身在網址列會被瀏覽器
      自動編碼成 <code>%XX</code>,屬正常現象。slug 結果僅供參考,套用前請自行確認符合你的 CMS/路由規則。
    </LegalNote>
  </div>
</template>
