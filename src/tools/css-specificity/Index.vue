<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { rankSelectors } from '@/features/specificity'

/*
  CSS 選擇器優先級計算與比較器 —— 貼上一或多個選擇器(每行一個或逗號分隔),
  算出每個的 (a, b, c) 優先級並依高到低排名,看清「為什麼這條 CSS 沒套用」。
  全程在你的瀏覽器解析計算,不連網、不上傳。
*/

const input = ref('#nav ul.menu > li.item a:hover\n.menu a\na:hover\n.btn.btn-primary\ndiv')

const ranked = computed(() => rankSelectors(input.value))
const maxLabel = computed(() => (ranked.value.length ? ranked.value[0].label : ''))

const EXAMPLES = [
  { label: '常見三種', v: '#header\n.nav .link\na' },
  { label: ':is / :where', v: '.card :is(.title, #main)\n.card :where(.title, #main)' },
  { label: '虛擬元素/類別', v: 'p::before\np:hover\np:first-line' },
  { label: '屬性與 :not', v: 'input[type="text"]\ndiv:not(.skip)\n#form input' },
]
function loadExample(v: string) {
  input.value = v
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-5 space-y-3">
      <label class="block text-sm">
        <span class="text-ink-500">輸入選擇器(每行一個,或用逗號分隔)</span>
        <textarea
          v-model="input"
          rows="5"
          class="cs-input font-mono"
          placeholder="#nav .item a:hover&#10;.item a&#10;a"
        />
      </label>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="ex in EXAMPLES"
          :key="ex.label"
          type="button"
          class="rounded-lg border border-ink-200 px-3 py-1.5 text-sm text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          @click="loadExample(ex.v)"
        >
          {{ ex.label }}
        </button>
      </div>
    </div>

    <div v-if="ranked.length" class="card p-5 space-y-3">
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-ink-700">優先級排名(高 → 低)</span>
        <span class="ml-auto text-xs text-ink-400">a = ID · b = class/屬性/虛擬類別 · c = 型別/虛擬元素</span>
      </div>
      <ul class="space-y-2">
        <li
          v-for="(r, i) in ranked"
          :key="i"
          class="flex flex-wrap items-center gap-3 rounded-lg border px-4 py-2.5"
          :class="r.rank === 1 ? 'border-brand-300 bg-brand-50' : 'border-ink-100'"
        >
          <span
            class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
            :class="r.rank === 1 ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-600'"
          >{{ r.rank }}</span>
          <code class="font-mono text-sm text-ink-800 break-all">{{ r.selector }}</code>
          <span class="ml-auto flex items-center gap-1 font-mono text-sm">
            <span class="rounded bg-rose-100 px-1.5 py-0.5 text-rose-700" title="ID 數">{{ r.spec.a }}</span>
            <span class="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700" title="class/屬性/虛擬類別 數">{{ r.spec.b }}</span>
            <span class="rounded bg-sky-100 px-1.5 py-0.5 text-sky-700" title="型別/虛擬元素 數">{{ r.spec.c }}</span>
          </span>
        </li>
      </ul>
      <p class="text-xs text-ink-500">
        最高優先級為 <code>{{ maxLabel }}</code>。優先級相同時,寫在 CSS 後面的規則勝出(後者覆蓋前者)。
        行內 style 與 <code>!important</code> 優先級更高,不在此比較範圍。
      </p>
    </div>

    <LegalNote>
      優先級依 (a, b, c) 由左而右比較大小:先比 ID 數,再比 class/屬性/虛擬類別數,最後比型別/虛擬元素數。
      通用選擇器 <code>*</code> 與組合子(<code>&gt;</code> <code>+</code> <code>~</code> 空白)不計分;
      <code>:where()</code> 永遠為 0;<code>:is()</code> / <code>:not()</code> / <code>:has()</code>
      取其引數中最高優先級的那一個。全程在你的瀏覽器解析計算,不連網、不上傳。
    </LegalNote>
  </div>
</template>

<style scoped>
.cs-input {
  width: 100%;
  margin-top: 0.25rem;
  border: 1px solid var(--color-ink-200, #e2e8f0);
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  font-size: 0.875rem;
  line-height: 1.6;
  resize: vertical;
}
</style>
