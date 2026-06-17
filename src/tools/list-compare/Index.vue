<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { dedupe, compare, defaultOptions, type NormalizeOptions } from '@/features/listCompare'

/*
  名單比對 / 去重 —— 對帳、整理名單時最常見的兩件事:
    1) 去重:一份名單裡哪些重複了、各幾次,留下乾淨的一份。
    2) 比對:兩份名單的交集(都有)、只在 A、只在 B、聯集 —— 例如找出「誰還沒繳費」。
  全程在你的瀏覽器計算,不上傳含個資的名單;線上同類工具常要把名單貼到別人伺服器。
*/
const mode = ref<'dedupe' | 'compare'>('dedupe')

const opts = ref<NormalizeOptions>({ ...defaultOptions })

const inputA = ref('')
const inputB = ref('')

const dedupeResult = computed(() =>
  inputA.value.trim() ? dedupe(inputA.value, opts.value) : null,
)
const compareResult = computed(() =>
  inputA.value.trim() || inputB.value.trim() ? compare(inputA.value, inputB.value, opts.value) : null,
)

function copy(lines: string[]) {
  navigator.clipboard?.writeText(lines.join('\n'))
}

function download(lines: string[], name: string) {
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

const toggles: { key: keyof NormalizeOptions; label: string }[] = [
  { key: 'trim', label: '去頭尾空白' },
  { key: 'ignoreCase', label: '不分大小寫' },
  { key: 'ignoreWidth', label: '全形=半形' },
  { key: 'collapseSpace', label: '縮多餘空白' },
]
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div class="flex gap-2">
        <button
          class="rounded-xl border px-4 py-2 text-sm font-semibold transition"
          :class="mode === 'dedupe'
            ? 'border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-300'
            : 'border-line bg-white text-ink-600 hover:bg-stone-50'"
          @click="mode = 'dedupe'"
        >
          一份名單去重
        </button>
        <button
          class="rounded-xl border px-4 py-2 text-sm font-semibold transition"
          :class="mode === 'compare'
            ? 'border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-300'
            : 'border-line bg-white text-ink-600 hover:bg-stone-50'"
          @click="mode = 'compare'"
        >
          比對兩份名單
        </button>
      </div>

      <!-- 比對選項 -->
      <div class="flex flex-wrap gap-2">
        <label
          v-for="t in toggles"
          :key="t.key"
          class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition"
          :class="opts[t.key] ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-600 hover:bg-stone-50'"
        >
          <input v-model="opts[t.key]" type="checkbox" class="accent-brand-600" />
          {{ t.label }}
        </label>
      </div>

      <!-- 輸入 -->
      <div class="grid gap-4" :class="mode === 'compare' ? 'sm:grid-cols-2' : ''">
        <div>
          <label class="field-label">{{ mode === 'compare' ? '名單 A' : '貼上名單(一行一筆)' }}</label>
          <textarea
            v-model="inputA"
            rows="8"
            placeholder="一行一筆,例如 email、姓名、訂單編號…"
            class="field-input font-mono text-sm"
          />
        </div>
        <div v-if="mode === 'compare'">
          <label class="field-label">名單 B</label>
          <textarea
            v-model="inputB"
            rows="8"
            placeholder="一行一筆"
            class="field-input font-mono text-sm"
          />
        </div>
      </div>
      <p class="field-hint">全程在你的瀏覽器計算,不會上傳、不會儲存。空白行會自動略過。</p>
    </div>

    <!-- 去重結果 -->
    <div v-if="mode === 'dedupe' && dedupeResult" class="card p-6 space-y-4">
      <div class="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <span class="text-ink-600">原始 <strong>{{ dedupeResult.total }}</strong> 筆</span>
        <span class="text-emerald-700">不重複 <strong>{{ dedupeResult.uniqueCount }}</strong></span>
        <span v-if="dedupeResult.removed" class="text-amber-700">移除重複 <strong>{{ dedupeResult.removed }}</strong></span>
      </div>

      <div>
        <div class="mb-2 flex items-center gap-3">
          <h3 class="font-semibold text-ink-800">去重後名單({{ dedupeResult.uniqueCount }})</h3>
          <button class="text-sm text-brand-700 underline hover:text-brand-800" @click="copy(dedupeResult.unique)">複製</button>
          <button class="text-sm text-brand-700 underline hover:text-brand-800" @click="download(dedupeResult.unique, '去重名單.txt')">下載</button>
        </div>
        <textarea
          :value="dedupeResult.unique.join('\n')"
          rows="8"
          readonly
          class="field-input font-mono text-sm"
        />
      </div>

      <div v-if="dedupeResult.duplicates.length">
        <h3 class="mb-2 font-semibold text-ink-800">重複的項目({{ dedupeResult.duplicateGroups }} 種)</h3>
        <div class="overflow-hidden rounded-xl border border-line">
          <table class="w-full text-sm">
            <thead class="bg-stone-50 text-ink-500">
              <tr>
                <th class="px-3 py-2 text-left font-medium">項目</th>
                <th class="px-3 py-2 text-right font-medium">出現次數</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in dedupeResult.duplicates" :key="i" class="border-t border-line/70">
                <td class="px-3 py-2 font-mono break-all">{{ r.value }}</td>
                <td class="px-3 py-2 text-right font-semibold text-amber-700">{{ r.count }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <p v-else class="text-sm text-emerald-700">🎉 沒有任何重複,這份名單很乾淨。</p>
    </div>

    <!-- 比對結果 -->
    <div v-if="mode === 'compare' && compareResult" class="card p-6 space-y-4">
      <div class="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <span class="text-ink-600">A 不重複 <strong>{{ compareResult.countA }}</strong></span>
        <span class="text-ink-600">B 不重複 <strong>{{ compareResult.countB }}</strong></span>
        <span class="text-emerald-700">交集 <strong>{{ compareResult.both.length }}</strong></span>
        <span class="text-sky-700">只在 A <strong>{{ compareResult.onlyA.length }}</strong></span>
        <span class="text-violet-700">只在 B <strong>{{ compareResult.onlyB.length }}</strong></span>
      </div>

      <div class="grid gap-4 sm:grid-cols-3">
        <div
          v-for="block in [
            { title: '交集(兩份都有)', tone: 'emerald', list: compareResult.both, file: '交集.txt' },
            { title: '只在 A', tone: 'sky', list: compareResult.onlyA, file: '只在A.txt' },
            { title: '只在 B', tone: 'violet', list: compareResult.onlyB, file: '只在B.txt' },
          ]"
          :key="block.title"
        >
          <div class="mb-1.5 flex items-center gap-2">
            <h3 class="text-sm font-semibold text-ink-800">{{ block.title }}({{ block.list.length }})</h3>
            <button v-if="block.list.length" class="text-xs text-brand-700 underline" @click="copy(block.list)">複製</button>
            <button v-if="block.list.length" class="text-xs text-brand-700 underline" @click="download(block.list, block.file)">下載</button>
          </div>
          <textarea
            :value="block.list.join('\n')"
            rows="8"
            readonly
            class="field-input font-mono text-xs"
            :placeholder="'(無)'"
          />
        </div>
      </div>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>去重</strong>:整理會員、email、訂單名單時,找出並移除重複,留下乾淨的一份。</li>
        <li><strong>比對</strong>:兩份名單算交集 / 差集 —— 例如「全體名單」減「已繳費名單」就是「還沒繳的人」;新舊清單比對找出異動。</li>
        <li>比對選項可忽略大小寫、全形半形差異、頭尾或多餘空白,避免「看起來一樣卻被當不同」。</li>
        <li>輸出一律保留<strong>第一次出現的原始樣子</strong>,不會把你的資料改掉。</li>
        <li>本工具<strong>不連網、不上傳、不儲存</strong>任何輸入,名單留在你自己的電腦裡。</li>
      </ul>
    </LegalNote>
  </div>
</template>
