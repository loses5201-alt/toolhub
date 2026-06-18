<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  processLines,
  PRESETS,
  DEFAULT_OPTIONS,
  type LineToolsOptions,
  type QuoteStyle,
} from '@/features/lineTools'

/*
  清單加工 —— 把貼上的一欄資料(每行一筆,常從 Excel 複製)變成可直接貼用的清單:
  SQL IN 清單、逗號清單、JSON 字串陣列、Markdown/編號清單…
  全程在你的瀏覽器,不連網、不上傳(線上「逗號清單產生器」常滿廣告又要你貼上內部資料)。
*/
const SAMPLE = 'apple\nbanana\n\n  apple  \norange'

const input = ref(SAMPLE)
const opts = ref<LineToolsOptions>({ ...DEFAULT_OPTIONS })

const QUOTE_OPTS: { id: QuoteStyle; label: string }[] = [
  { id: 'none', label: '不加' },
  { id: 'single', label: "單引號 ' '" },
  { id: 'double', label: '雙引號 " "' },
  { id: 'backtick', label: '反引號 ` `' },
]
const JOINER_OPTS: { id: string; label: string }[] = [
  { id: '\n', label: '換行' },
  { id: ', ', label: '逗號+空白 ", "' },
  { id: ',', label: '逗號 ","' },
  { id: '; ', label: '分號 "; "' },
  { id: ' | ', label: '直線 " | "' },
]

const output = computed(() => processLines(input.value, opts.value))
const lineCount = computed(
  () => processLines(input.value, { ...opts.value, joiner: '\n', outerPrefix: '', outerSuffix: '' })
    .split('\n').filter((l) => l !== '').length,
)

function applyPreset(p: (typeof PRESETS)[number]) {
  opts.value = { ...DEFAULT_OPTIONS, ...p.options }
}

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
        <label class="field-label mb-0">貼上清單(每行一筆)</label>
        <button type="button" class="ml-auto text-xs text-ink-400 underline hover:text-ink-600" @click="input = SAMPLE">
          載入範例
        </button>
        <button type="button" class="text-xs text-ink-400 underline hover:text-ink-600" @click="input = ''">清空</button>
      </div>
      <textarea v-model="input" rows="6" class="field-input text-sm leading-relaxed font-mono" spellcheck="false"
        placeholder="從 Excel 或試算表複製一欄貼上,一行一筆…" />
      <p class="field-hint">
        常用於把一欄值變成 SQL <code>IN</code> 清單、程式陣列、逗號清單。全程在你的瀏覽器,<strong>不連網、不上傳</strong>。
      </p>
    </div>

    <!-- 快速範本 -->
    <div class="card p-5 space-y-2">
      <span class="text-sm font-semibold text-ink-700">快速套用</span>
      <div class="flex flex-wrap gap-2">
        <button v-for="p in PRESETS" :key="p.id" type="button"
          class="rounded-lg border border-ink-200 px-3 py-1.5 text-sm text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          @click="applyPreset(p)">
          {{ p.label }}
          <span class="ml-1 text-xs text-ink-400">{{ p.hint }}</span>
        </button>
      </div>
    </div>

    <!-- 細部選項 -->
    <div class="card p-5 space-y-4">
      <span class="text-sm font-semibold text-ink-700">細部設定</span>
      <div class="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-600">
        <label class="flex items-center gap-1.5">
          <input v-model="opts.trimEach" type="checkbox" class="accent-brand-600" /> 逐行去頭尾空白
        </label>
        <label class="flex items-center gap-1.5">
          <input v-model="opts.removeEmpty" type="checkbox" class="accent-brand-600" /> 刪除空白行
        </label>
        <label class="flex items-center gap-1.5">
          <input v-model="opts.dedupe" type="checkbox" class="accent-brand-600" /> 去除重複(保留首次)
        </label>
        <label class="flex items-center gap-1.5">
          <input v-model="opts.numbering" type="checkbox" class="accent-brand-600" /> 加編號
        </label>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-sm">
        <div>
          <label class="field-label">每行加引號</label>
          <select v-model="opts.quote" class="field-input">
            <option v-for="q in QUOTE_OPTS" :key="q.id" :value="q.id">{{ q.label }}</option>
          </select>
        </div>
        <div>
          <label class="field-label">行之間連接</label>
          <select v-model="opts.joiner" class="field-input">
            <option v-for="j in JOINER_OPTS" :key="j.id" :value="j.id">{{ j.label }}</option>
          </select>
        </div>
        <div v-if="opts.numbering">
          <label class="field-label">編號起始</label>
          <input v-model.number="opts.numberStart" type="number" class="field-input" />
        </div>
        <div>
          <label class="field-label">每行前綴</label>
          <input v-model="opts.prefix" type="text" class="field-input font-mono" placeholder="如 - " />
        </div>
        <div>
          <label class="field-label">每行後綴</label>
          <input v-model="opts.suffix" type="text" class="field-input font-mono" />
        </div>
        <div>
          <label class="field-label">整體外框(前 / 後)</label>
          <div class="flex gap-2">
            <input v-model="opts.outerPrefix" type="text" class="field-input font-mono" placeholder="(" />
            <input v-model="opts.outerSuffix" type="text" class="field-input font-mono" placeholder=")" />
          </div>
        </div>
      </div>
    </div>

    <!-- 結果 -->
    <div class="card p-5 space-y-3">
      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold text-ink-700">結果</span>
        <span class="text-xs text-ink-400">{{ lineCount }} 筆</span>
        <button type="button" class="btn-primary ml-auto" @click="copyOut">
          {{ copied ? '已複製 ✓' : '複製結果' }}
        </button>
      </div>
      <textarea :value="output" rows="6" readonly class="field-input text-sm leading-relaxed font-mono bg-ink-50"
        spellcheck="false" />
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>SQL IN 清單</strong>:把一欄 ID/帳號變成 <code>('a', 'b', 'c')</code>,直接貼進 <code>WHERE col IN (…)</code>;單引號內容自動逸出成 <code>''</code>(SQL 慣例)。</li>
        <li><strong>程式陣列 / 逗號清單</strong>:JSON 字串陣列 <code>["a","b"]</code>、逗號分隔字串,做設定檔或快速貼進程式。</li>
        <li><strong>排版</strong>:每行加前後綴、編號、Markdown <code>- </code> 清單;可去空白行、去重複。</li>
        <li>全程在你的瀏覽器處理,<strong>不連網、不上傳</strong> —— 內部名單/ID 不外流。與「名單比對/去重」、「表格清理工坊」互補,這支專做<strong>把一欄值串成可貼的清單</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
