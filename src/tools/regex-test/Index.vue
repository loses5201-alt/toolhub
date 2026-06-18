<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  runRegex,
  explainPattern,
  applyReplace,
  LIBRARY,
  type LibraryItem,
} from '@/features/regexTest'

/*
  正規表達式測試 —— 即時比對、標出符合處與捕獲群組,用白話中文解釋 pattern,
  附台灣在地常用樣式庫(手機/身分證/統編/車牌)。全程在你瀏覽器,不連網、不上傳。
*/
const pattern = ref('09\\d{2}[-\\s]?\\d{3}[-\\s]?\\d{3}')
const text = ref('我的手機 0912-345-678,公司 0987654321,客服 0900 000 000。')

// 旗標(g 一律隱含啟用以列出全部)
const fIgnore = ref(false)
const fMulti = ref(false)
const fDotAll = ref(false)
const fUnicode = ref(false)
const flags = computed(
  () =>
    'g' +
    (fIgnore.value ? 'i' : '') +
    (fMulti.value ? 'm' : '') +
    (fDotAll.value ? 's' : '') +
    (fUnicode.value ? 'u' : ''),
)

const result = computed(() => runRegex(pattern.value, flags.value, text.value))
const tokens = computed(() => (pattern.value ? explainPattern(pattern.value) : []))

// 把原文切成「一般 / 命中」交錯片段,供高亮顯示
interface Seg {
  text: string
  hit: boolean
  idx: number
}
const segments = computed<Seg[]>(() => {
  const segs: Seg[] = []
  const ms = result.value.matches
  let cursor = 0
  ms.forEach((m, idx) => {
    if (m.index > cursor) segs.push({ text: text.value.slice(cursor, m.index), hit: false, idx: -1 })
    // 長度 0 的命中(例如 ^、\b)用記號表示,避免看不到
    const seg = text.value.slice(m.index, m.index + m.length)
    segs.push({ text: seg.length ? seg : '∅', hit: true, idx })
    cursor = m.index + m.length
  })
  if (cursor < text.value.length) segs.push({ text: text.value.slice(cursor), hit: false, idx: -1 })
  return segs
})

// 取代
const showReplace = ref(false)
const replacement = ref('$1')
const replaced = computed(() =>
  applyReplace(pattern.value, flags.value, text.value, replacement.value),
)

function loadLibrary(item: LibraryItem) {
  pattern.value = item.pattern
  text.value = item.sample
  fIgnore.value = item.flags.includes('i')
  fMulti.value = item.flags.includes('m')
  fDotAll.value = item.flags.includes('s')
  fUnicode.value = item.flags.includes('u')
}

const copied = ref(false)
function copyReplaced() {
  navigator.clipboard?.writeText(replaced.value.result)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="space-y-6">
    <!-- 輸入 pattern + flags -->
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">正規表達式(pattern)</label>
        <div class="flex items-center gap-2 font-mono">
          <span class="text-lg text-ink-400">/</span>
          <input
            v-model="pattern"
            class="field-input text-sm"
            spellcheck="false"
            autocapitalize="off"
            placeholder="輸入 regex,例如 \d{4}-\d{2}-\d{2}"
          />
          <span class="text-lg text-ink-400">/{{ flags }}</span>
        </div>
        <p v-if="!result.ok" class="mt-2 text-sm font-medium text-red-600">
          ⚠️ 語法錯誤:{{ result.error }}
        </p>
      </div>

      <div class="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-600">
        <label class="flex items-center gap-1.5">
          <input v-model="fIgnore" type="checkbox" class="accent-brand-600" /><code>i</code> 不分大小寫
        </label>
        <label class="flex items-center gap-1.5">
          <input v-model="fMulti" type="checkbox" class="accent-brand-600" /><code>m</code> 多行(^$ 對每行)
        </label>
        <label class="flex items-center gap-1.5">
          <input v-model="fDotAll" type="checkbox" class="accent-brand-600" /><code>s</code> 點號含換行
        </label>
        <label class="flex items-center gap-1.5">
          <input v-model="fUnicode" type="checkbox" class="accent-brand-600" /><code>u</code> Unicode
        </label>
        <span class="text-xs text-ink-400">(g 旗標一律啟用以列出全部命中)</span>
      </div>
    </div>

    <!-- 測試文字 + 高亮 -->
    <div class="card p-6 space-y-3">
      <label class="field-label">測試文字</label>
      <textarea v-model="text" rows="4" class="field-input text-sm leading-relaxed" spellcheck="false" />
      <div>
        <div class="mb-1.5 flex items-center gap-2">
          <span class="text-sm font-semibold text-ink-700">比對結果</span>
          <span
            class="rounded-full px-2 py-0.5 text-xs font-medium"
            :class="result.matches.length ? 'bg-emerald-100 text-emerald-700' : 'bg-ink-100 text-ink-500'"
          >
            {{ result.matches.length }} 處命中
          </span>
        </div>
        <div
          class="min-h-[3rem] whitespace-pre-wrap break-words rounded-xl border border-ink-200 bg-ink-50 p-3 text-sm leading-relaxed"
        >
          <template v-for="(s, k) in segments" :key="k">
            <mark
              v-if="s.hit"
              class="rounded bg-amber-200 px-0.5 text-ink-900"
              :title="`第 ${s.idx + 1} 處命中`"
              >{{ s.text }}</mark
            >
            <span v-else>{{ s.text }}</span>
          </template>
          <span v-if="!text" class="text-ink-300">(在上方輸入要比對的文字)</span>
        </div>
      </div>
    </div>

    <!-- 命中明細(含捕獲群組) -->
    <div v-if="result.matches.length" class="card p-5 space-y-3">
      <span class="text-sm font-semibold text-ink-700">命中明細</span>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs text-ink-400">
              <th class="py-1.5 pr-3 font-medium">#</th>
              <th class="py-1.5 pr-3 font-medium">位置</th>
              <th class="py-1.5 pr-3 font-medium">符合內容</th>
              <th class="py-1.5 font-medium">捕獲群組</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(m, idx) in result.matches"
              :key="idx"
              class="border-t border-ink-100 align-top"
            >
              <td class="py-1.5 pr-3 text-xs text-ink-400">{{ idx + 1 }}</td>
              <td class="py-1.5 pr-3 font-mono text-xs text-ink-500">{{ m.index }}</td>
              <td class="py-1.5 pr-3 font-mono text-xs text-ink-800 break-all">
                {{ m.match || '(空字串)' }}
              </td>
              <td class="py-1.5 text-xs text-ink-600">
                <span v-if="!m.groups.length" class="text-ink-300">—</span>
                <span
                  v-for="g in m.groups"
                  :key="g.name"
                  class="mr-2 inline-block whitespace-nowrap"
                >
                  <span class="text-ink-400">{{ g.name }}:</span>
                  <span class="font-mono">{{ g.value ?? '(未捕獲)' }}</span>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 白話解釋 -->
    <div v-if="tokens.length" class="card p-5 space-y-2">
      <span class="text-sm font-semibold text-ink-700">白話解釋</span>
      <ul class="space-y-1 text-sm">
        <li
          v-for="(t, k) in tokens"
          :key="k"
          class="flex gap-3"
          :style="{ paddingLeft: t.depth * 16 + 'px' }"
        >
          <code class="shrink-0 rounded bg-brand-50 px-1.5 py-0.5 font-mono text-brand-700">{{
            t.text
          }}</code>
          <span class="text-ink-600">{{ t.explain }}</span>
        </li>
      </ul>
    </div>

    <!-- 取代 -->
    <div class="card p-5 space-y-3">
      <label class="flex items-center gap-1.5 text-sm font-semibold text-ink-700">
        <input v-model="showReplace" type="checkbox" class="accent-brand-600" />
        啟用「取代」(把命中處換成…)
      </label>
      <template v-if="showReplace">
        <div>
          <label class="field-label">替換字串(可用 <code>$1</code>、<code>$&lt;名稱&gt;</code> 帶入群組)</label>
          <input v-model="replacement" class="field-input font-mono text-sm" spellcheck="false" />
        </div>
        <textarea
          :value="replaced.result"
          rows="3"
          readonly
          class="field-input bg-ink-50 text-sm leading-relaxed"
          spellcheck="false"
        />
        <button type="button" class="btn-primary" @click="copyReplaced">
          {{ copied ? '已複製 ✓' : '複製取代結果' }}
        </button>
      </template>
    </div>

    <!-- 樣式庫 -->
    <div class="card p-5 space-y-3">
      <span class="text-sm font-semibold text-ink-700">常用樣式庫(點一下帶入)</span>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="item in LIBRARY"
          :key="item.name"
          type="button"
          class="rounded-lg border border-ink-200 px-3 py-1.5 text-sm text-ink-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
          :title="item.desc"
          @click="loadLibrary(item)"
        >
          {{ item.name }}
        </button>
      </div>
    </div>

    <LegalNote title="關於正規表達式測試">
      <ul class="list-disc pl-5 space-y-1">
        <li>用瀏覽器內建的 JavaScript <code>RegExp</code> 即時比對,語法與 JS/Node 一致;不同語言(Python、PHP)細節略有差異。</li>
        <li><strong>白話解釋</strong>會把 pattern 一段段拆開講中文 —— 國外網站(regex101 等)多半只有英文。</li>
        <li><strong>樣式庫</strong>收錄台灣在地常見格式(手機、身分證、統編、車牌);這些只檢查<strong>格式</strong>,不做檢查碼驗證(要驗證請用「身分證字號檢核」「統一編號檢核」)。</li>
        <li>全程在你的瀏覽器執行,<strong>不連網、不上傳</strong>,含個資的測試文字不會外流。</li>
      </ul>
    </LegalNote>
  </div>
</template>
