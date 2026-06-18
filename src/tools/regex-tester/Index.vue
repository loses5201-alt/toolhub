<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { explainRegex, matchAll, type RegexToken, type RegexMatch } from '@/features/regexExplain'

/*
  正規表達式測試器 —— 即時標示比對結果 + 把 pattern 逐段拆成白話中文說明。
  全程在你的瀏覽器計算,不連網、不上傳(別把含內部資料的測試文字貼到陌生線上工具)。
*/
const pattern = ref('(?<year>\\d{4})-(\\d{2})-(\\d{2})')
const sample = ref('訂單日期:2026-06-18,出貨:2026-06-20。\n備註:無')

interface Flag {
  key: string
  label: string
  hint: string
}
const FLAGS: Flag[] = [
  { key: 'g', label: '全域 g', hint: '找出全部符合處(不只第一個)' },
  { key: 'i', label: '忽略大小寫 i', hint: 'A 與 a 視為相同' },
  { key: 'm', label: '多行 m', hint: '^ $ 對每一行的開頭/結尾生效' },
  { key: 's', label: '單行 s', hint: '讓 . 也能比對換行字元' },
  { key: 'u', label: 'Unicode u', hint: '正確處理跳脫與完整 Unicode' },
]
const flagState = ref<Record<string, boolean>>({ g: true, i: false, m: false, s: false, u: false })
const flags = computed(() =>
  FLAGS.filter((f) => flagState.value[f.key])
    .map((f) => f.key)
    .join(''),
)

const examples: { p: string; label: string }[] = [
  { p: '(?<year>\\d{4})-(\\d{2})-(\\d{2})', label: '日期 YYYY-MM-DD' },
  { p: '09\\d{2}-?\\d{3}-?\\d{3}', label: '台灣手機' },
  { p: '[\\w.+-]+@[\\w-]+\\.[\\w.-]+', label: 'Email' },
  { p: 'https?://[^\\s]+', label: '網址' },
  { p: '\\b\\d{1,3}(,\\d{3})+\\b', label: '含千分位數字' },
]

interface Result {
  ok: boolean
  error?: string
  tokens: RegexToken[]
  matches: RegexMatch[]
}

const result = computed<Result>(() => {
  const p = pattern.value
  if (!p) return { ok: false, error: '請輸入正規表達式', tokens: [], matches: [] }
  try {
    const tokens = explainRegex(p, flags.value)
    const matches = matchAll(p, flags.value, sample.value)
    return { ok: true, tokens, matches }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : '無法解析', tokens: [], matches: [] }
  }
})

// 依比對位置把測試文字切成「一般 / 命中」片段供標示
interface Seg {
  text: string
  hit: boolean
  n?: number
}
const segments = computed<Seg[]>(() => {
  if (!result.value.ok) return [{ text: sample.value, hit: false }]
  const ms = result.value.matches
  const text = sample.value
  if (!ms.length) return [{ text, hit: false }]
  const out: Seg[] = []
  let pos = 0
  ms.forEach((m, idx) => {
    if (m.index > pos) out.push({ text: text.slice(pos, m.index), hit: false })
    out.push({ text: m.text, hit: true, n: idx + 1 })
    pos = m.index + m.text.length
  })
  if (pos < text.length) out.push({ text: text.slice(pos), hit: false })
  return out
})

const kindClass: Record<string, string> = {
  anchor: 'bg-purple-100 text-purple-800 border-purple-200',
  class: 'bg-sky-100 text-sky-800 border-sky-200',
  quant: 'bg-amber-100 text-amber-800 border-amber-200',
  group: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  set: 'bg-sky-100 text-sky-800 border-sky-200',
  literal: 'bg-ink-100 text-ink-700 border-ink-200',
  escape: 'bg-rose-100 text-rose-800 border-rose-200',
  alt: 'bg-orange-100 text-orange-800 border-orange-200',
  backref: 'bg-emerald-100 text-emerald-800 border-emerald-200',
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">正規表達式 (pattern)</label>
        <div class="flex items-stretch gap-2">
          <span class="flex items-center font-mono text-lg text-ink-400">/</span>
          <input
            v-model="pattern"
            class="field-input font-mono text-lg"
            placeholder="例如 \d{4}-\d{2}-\d{2}"
            spellcheck="false"
            autocapitalize="off"
            autocorrect="off"
          />
          <span class="flex items-center font-mono text-lg text-ink-400">/{{ flags }}</span>
        </div>
        <p class="field-hint">不用自己加前後的斜線。全程在你瀏覽器計算,不上傳。</p>
      </div>

      <div>
        <div class="mb-1.5 text-xs font-semibold text-ink-400">旗標 (flags)</div>
        <div class="flex flex-wrap gap-2">
          <label
            v-for="f in FLAGS"
            :key="f.key"
            :title="f.hint"
            class="flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition"
            :class="
              flagState[f.key]
                ? 'border-brand-300 bg-brand-50 text-brand-700'
                : 'border-ink-200 text-ink-600 hover:bg-ink-50'
            "
          >
            <input v-model="flagState[f.key]" type="checkbox" class="accent-brand-600" />
            {{ f.label }}
          </label>
        </div>
      </div>

      <div>
        <div class="mb-1.5 text-xs font-semibold text-ink-400">常用範例</div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="ex in examples"
            :key="ex.p"
            type="button"
            class="rounded-lg border border-ink-200 px-3 py-1.5 text-sm text-ink-600 transition hover:bg-ink-50"
            @click="pattern = ex.p"
          >
            {{ ex.label }}
          </button>
        </div>
      </div>

      <div v-if="!result.ok" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
        ⚠️ 語法錯誤:{{ result.error }}
      </div>
    </div>

    <!-- 逐段白話說明 -->
    <div v-if="result.ok && result.tokens.length" class="card p-5">
      <div class="mb-3 text-sm font-semibold text-ink-700">白話拆解(這串符號在比對什麼)</div>
      <ol class="space-y-2">
        <li
          v-for="(t, i) in result.tokens"
          :key="i"
          class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-lg bg-ink-50 px-3 py-2"
        >
          <code
            class="rounded border px-1.5 py-0.5 font-mono text-sm"
            :class="kindClass[t.kind] || kindClass.literal"
            >{{ t.text }}</code
          >
          <span class="text-sm text-ink-700">{{ t.desc }}</span>
        </li>
      </ol>
    </div>

    <!-- 測試文字 + 比對標示 -->
    <div class="card p-5 space-y-3">
      <label class="field-label">測試文字</label>
      <textarea
        v-model="sample"
        rows="5"
        class="field-input font-mono text-sm"
        spellcheck="false"
        placeholder="貼上要測試比對的文字"
      ></textarea>

      <div>
        <div class="mb-1.5 flex items-center gap-2">
          <span class="text-sm font-semibold text-ink-700">比對結果</span>
          <span v-if="result.ok" class="text-xs text-ink-400">
            共 {{ result.matches.length }} 處{{ flagState.g ? '' : '(未開全域 g,只找第一處)' }}
          </span>
        </div>
        <div
          class="whitespace-pre-wrap break-words rounded-xl border border-ink-200 bg-white p-3 font-mono text-sm leading-7"
        >
          <template v-for="(s, i) in segments" :key="i">
            <mark
              v-if="s.hit"
              class="rounded bg-amber-200/80 px-0.5 text-ink-900"
              :title="`第 ${s.n} 處`"
              >{{ s.text }}</mark
            >
            <span v-else class="text-ink-500">{{ s.text }}</span>
          </template>
        </div>
      </div>

      <!-- 擷取群組 -->
      <div v-if="result.ok && result.matches.length" class="space-y-2">
        <div class="text-sm font-semibold text-ink-700">擷取的內容</div>
        <div
          v-for="(m, i) in result.matches"
          :key="i"
          class="rounded-lg border border-ink-100 bg-ink-50/60 p-3 text-sm"
        >
          <div class="text-ink-700">
            <span class="text-xs font-semibold text-ink-400">第 {{ i + 1 }} 處</span>
            <code class="ml-2 rounded bg-amber-100 px-1 text-ink-900">{{ m.text }}</code>
          </div>
          <ul v-if="m.groups.length" class="mt-1.5 space-y-0.5 pl-1">
            <li v-for="(g, gi) in m.groups" :key="gi" class="text-ink-600">
              群組 {{ gi + 1 }}:<code class="rounded bg-white px-1">{{ g || '(空)' }}</code>
            </li>
            <li v-for="(v, k) in m.named" :key="'n' + k" class="text-emerald-700">
              具名「{{ k }}」:<code class="rounded bg-white px-1">{{ v || '(空)' }}</code>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>寫程式、設驗證規則、清資料時,確認手上那串正規表達式<strong>到底在比對什麼</strong>、有沒有寫錯。</li>
        <li>除了即時標示命中處,還把 pattern <strong>逐段翻成白話中文</strong>,看不懂符號也能讀懂。</li>
        <li>支援擷取群組與<strong>具名群組</strong> <code>(?&lt;name&gt;…)</code>,直接列出抓到的內容。</li>
        <li>使用瀏覽器內建的 JavaScript 正規表達式引擎;其他語言(Python、PCRE 等)語法略有差異,結果僅供參考。</li>
        <li>本工具<strong>不連網、不上傳</strong>;測試文字若含內部資料,也只留在你的裝置上。</li>
      </ul>
    </LegalNote>
  </div>
</template>
