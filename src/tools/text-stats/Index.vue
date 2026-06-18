<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { analyzeText, formatDuration } from '@/features/textStats'

/*
  文字統計 —— 貼上文章,正確算出中文字數、英文單字、字元、行數、段落、句數、
  UTF-8 位元組、預估閱讀/朗讀時間,並可設定字數上限即時倒數。
  針對中文(CJK)逐字計數,不像多數線上工具用空白切詞而把中文算錯。
  全程在你的瀏覽器,不連網、不上傳 —— 敏感草稿(自傳、合約、書審)安心貼。
*/
const SAMPLE =
  '推甄自傳範例:我從小對程式設計充滿熱情,high school 時自學 Python,完成 3 個小專案。\n\n大學期間參與系上活動,擔任幹部,培養團隊合作與溝通能力。希望貴系能給我學習的機會!'

const input = ref(SAMPLE)
const stats = computed(() => analyzeText(input.value))

// 字數限制檢查:可選對哪種「字數」設上限(總字數 / 中文字 / 含空白字元 / 不含空白)
type LimitBasis = 'totalWords' | 'cjkChars' | 'chars' | 'charsNoSpaces'
const LIMIT_BASES: { id: LimitBasis; label: string }[] = [
  { id: 'totalWords', label: '總字數(中文字+英文詞)' },
  { id: 'cjkChars', label: '中文字數' },
  { id: 'chars', label: '字元數(含空白)' },
  { id: 'charsNoSpaces', label: '字元數(不含空白)' },
]
const limitBasis = ref<LimitBasis>('totalWords')
const limit = ref<number | null>(null)

const current = computed(() => stats.value[limitBasis.value])
const remaining = computed(() =>
  limit.value === null ? null : limit.value - current.value,
)
const overLimit = computed(() => remaining.value !== null && remaining.value < 0)

const copied = ref(false)
function copySummary() {
  const s = stats.value
  const text =
    `字數統計\n` +
    `總字數(中+英):${s.totalWords}\n` +
    `中文字數:${s.cjkChars}\n` +
    `英文單字:${s.latinWords}\n` +
    `字元(含空白):${s.chars}\n` +
    `字元(不含空白):${s.charsNoSpaces}\n` +
    `數字串:${s.numbers}　標點:${s.punctuation}\n` +
    `行數:${s.lines}　非空行:${s.nonEmptyLines}　段落:${s.paragraphs}　句數:${s.sentences}\n` +
    `UTF-8 位元組:${s.bytes}\n` +
    `預估閱讀:${formatDuration(s.readingSeconds)}　朗讀:${formatDuration(s.speakingSeconds)}`
  navigator.clipboard?.writeText(text)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

// 主要統計卡(大字顯示)
const mainCards = computed(() => [
  { v: stats.value.totalWords, label: '總字數(中+英)' },
  { v: stats.value.cjkChars, label: '中文字數' },
  { v: stats.value.latinWords, label: '英文單字' },
  { v: stats.value.chars, label: '字元(含空白)' },
])
// 次要統計(小字一排)
const subStats = computed(() => [
  { v: stats.value.charsNoSpaces, label: '字元(不含空白)' },
  { v: stats.value.numbers, label: '數字串' },
  { v: stats.value.punctuation, label: '標點' },
  { v: stats.value.lines, label: '行數' },
  { v: stats.value.nonEmptyLines, label: '非空行' },
  { v: stats.value.paragraphs, label: '段落' },
  { v: stats.value.sentences, label: '句數' },
  { v: stats.value.bytes, label: 'UTF-8 位元組' },
])
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-3">
      <div class="flex items-center gap-3">
        <label class="field-label mb-0">貼上文章</label>
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
        rows="8"
        class="field-input text-sm leading-relaxed"
        spellcheck="false"
        placeholder="把作文、自傳、報告、貼文貼進來,即時統計字數…"
      />
      <p class="field-hint">
        針對<strong>中文逐字計數</strong>(不像多數線上工具用空白切詞而算錯)。全程在你的瀏覽器,<strong>不連網、不上傳</strong> —— 自傳、合約、書審資料安心貼。
      </p>
    </div>

    <!-- 主要統計 -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
      <div v-for="c in mainCards" :key="c.label" class="card p-3">
        <div class="text-2xl font-bold text-ink-800 tabular-nums">{{ c.v.toLocaleString() }}</div>
        <div class="text-xs text-ink-400">{{ c.label }}</div>
      </div>
    </div>

    <!-- 次要統計 -->
    <div class="card p-4">
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 text-sm">
        <div v-for="s in subStats" :key="s.label" class="flex items-baseline justify-between gap-2">
          <span class="text-ink-500">{{ s.label }}</span>
          <span class="font-semibold text-ink-800 tabular-nums">{{ s.v.toLocaleString() }}</span>
        </div>
      </div>
      <div class="mt-3 border-t border-ink-100 pt-3 text-sm text-ink-500">
        預估閱讀(默讀)約 <strong class="text-ink-700">{{ formatDuration(stats.readingSeconds) }}</strong>,
        朗讀(唸出聲)約 <strong class="text-ink-700">{{ formatDuration(stats.speakingSeconds) }}</strong>。
      </div>
    </div>

    <!-- 字數限制檢查 -->
    <div class="card p-5 space-y-3">
      <span class="text-sm font-semibold text-ink-700">字數限制檢查</span>
      <p class="text-xs text-ink-400">
        書審、作文、社群常有字數上限。設定上限後即時倒數,超過會提醒。
      </p>
      <div class="flex flex-wrap items-end gap-3">
        <div>
          <label class="field-label">計算依據</label>
          <select v-model="limitBasis" class="field-input w-auto">
            <option v-for="b in LIMIT_BASES" :key="b.id" :value="b.id">{{ b.label }}</option>
          </select>
        </div>
        <div>
          <label class="field-label">字數上限</label>
          <input
            v-model.number="limit"
            type="number"
            min="0"
            placeholder="例:800"
            class="field-input w-32"
          />
        </div>
      </div>
      <div
        v-if="limit !== null"
        class="rounded-xl border p-4 text-sm"
        :class="
          overLimit
            ? 'border-red-200 bg-red-50/70 text-red-700'
            : 'border-emerald-200 bg-emerald-50/70 text-emerald-700'
        "
      >
        目前 <strong>{{ current.toLocaleString() }}</strong> / 上限
        <strong>{{ limit.toLocaleString() }}</strong> —
        <template v-if="overLimit">⚠️ 超過 {{ (-remaining!).toLocaleString() }} 字,請刪減。</template>
        <template v-else>✅ 還可以寫 {{ remaining!.toLocaleString() }} 字。</template>
      </div>
    </div>

    <button type="button" class="btn-primary" @click="copySummary">
      {{ copied ? '已複製 ✓' : '複製統計結果' }}
    </button>

    <LegalNote title="計數說明(怎麼算的)">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>中文字數</strong>:逐個漢字計算(Unicode 漢字),不靠空白切詞 —— 這正是多數英文邏輯的線上工具把中文算錯(算成 0 或全部黏成一詞)的地方。</li>
        <li><strong>英文單字</strong>:以字母組成的詞為單位,<code>don't</code>、<code>well-known</code> 各算 1 個。</li>
        <li><strong>總字數</strong> = 中文字數 + 英文單字數,這是台灣作文/書審資料最常見的計法;若你的規定是「字元數」,請改看「字元(含/不含空白)」。</li>
        <li><strong>句數/段落數</strong>為估算:句數以句末標點(。!?…)切、段落以空白行分隔,長句或特殊格式可能略有出入,僅供參考。</li>
        <li><strong>UTF-8 位元組</strong>:中文字通常 3 bytes、英數 1 byte,某些有位元組長度限制的欄位(資料庫、表單)用得到。</li>
        <li>全程在你的瀏覽器計算,<strong>不連網、不上傳</strong>。與「文字清理工坊」(去空白/去重)、「隱形字元檢視器」(逐字檢測)互補。</li>
      </ul>
    </LegalNote>
  </div>
</template>
