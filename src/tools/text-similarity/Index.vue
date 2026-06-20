<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { compare } from '@/features/textSimilarity'

/*
  文字相似度比對 —— 算兩段文字有多像:編輯距離、相似度百分比、以詞為單位的 Jaccard/Dice 與共同詞。
  全程在你的瀏覽器計算,不連網、不上傳。
*/
const a = ref('臺北市信義區市府路45號')
const b = ref('台北市信義區市府路 45 號')

const r = computed(() => (a.value || b.value ? compare(a.value, b.value) : null))
const pct = (x: number) => (x * 100).toFixed(1) + '%'

function level(ratio: number): { label: string; cls: string } {
  if (ratio >= 0.9) return { label: '幾乎相同', cls: 'text-emerald-700' }
  if (ratio >= 0.7) return { label: '高度相似', cls: 'text-brand-700' }
  if (ratio >= 0.4) return { label: '部分相似', cls: 'text-amber-700' }
  return { label: '差異大', cls: 'text-ink-500' }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div class="grid gap-4 md:grid-cols-2">
        <div>
          <label class="field-label">文字 A</label>
          <textarea v-model="a" rows="5" class="field-input" spellcheck="false"></textarea>
        </div>
        <div>
          <label class="field-label">文字 B</label>
          <textarea v-model="b" rows="5" class="field-input" spellcheck="false"></textarea>
        </div>
      </div>
      <p class="field-hint">比對兩段文字的相似程度;適合判斷是否同一筆資料、找近似重複、看改寫幅度。全程在瀏覽器計算,不上傳。</p>
    </div>

    <div v-if="r" class="card p-6 space-y-5">
      <div class="text-center">
        <div class="text-xs font-semibold text-ink-400">字元級相似度</div>
        <div class="mt-1 text-4xl font-bold text-ink-800">{{ pct(r.ratio) }}</div>
        <div class="mt-1 text-sm font-semibold" :class="level(r.ratio).cls">{{ level(r.ratio).label }}</div>
      </div>

      <div class="grid grid-cols-3 gap-3 text-center">
        <div class="rounded-xl bg-ink-50 p-3">
          <div class="text-xs text-ink-400">編輯距離</div>
          <div class="mt-0.5 text-xl font-semibold text-ink-800">{{ r.distance }}</div>
          <div class="text-xs text-ink-400">改幾步</div>
        </div>
        <div class="rounded-xl bg-ink-50 p-3">
          <div class="text-xs text-ink-400">Jaccard(詞)</div>
          <div class="mt-0.5 text-xl font-semibold text-ink-800">{{ pct(r.jaccardWords) }}</div>
          <div class="text-xs text-ink-400">交集/聯集</div>
        </div>
        <div class="rounded-xl bg-ink-50 p-3">
          <div class="text-xs text-ink-400">Dice(詞)</div>
          <div class="mt-0.5 text-xl font-semibold text-ink-800">{{ pct(r.diceWords) }}</div>
          <div class="text-xs text-ink-400">2×交集/總和</div>
        </div>
      </div>

      <div class="grid gap-3 md:grid-cols-3 text-sm">
        <div>
          <div class="mb-1 text-xs font-semibold text-emerald-700">共同詞 ({{ r.commonWords.length }})</div>
          <div class="flex flex-wrap gap-1">
            <span v-for="w in r.commonWords" :key="'c' + w" class="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-800">{{ w }}</span>
            <span v-if="!r.commonWords.length" class="text-ink-400">(無)</span>
          </div>
        </div>
        <div>
          <div class="mb-1 text-xs font-semibold text-ink-500">只在 A ({{ r.onlyA.length }})</div>
          <div class="flex flex-wrap gap-1">
            <span v-for="w in r.onlyA" :key="'a' + w" class="rounded bg-ink-100 px-1.5 py-0.5 text-ink-700">{{ w }}</span>
            <span v-if="!r.onlyA.length" class="text-ink-400">(無)</span>
          </div>
        </div>
        <div>
          <div class="mb-1 text-xs font-semibold text-ink-500">只在 B ({{ r.onlyB.length }})</div>
          <div class="flex flex-wrap gap-1">
            <span v-for="w in r.onlyB" :key="'b' + w" class="rounded bg-ink-100 px-1.5 py-0.5 text-ink-700">{{ w }}</span>
            <span v-if="!r.onlyB.length" class="text-ink-400">(無)</span>
          </div>
        </div>
      </div>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>編輯距離</strong>:把 A 改成 B 最少要「增 / 刪 / 改一個字」幾次,數字越小越像。</li>
        <li><strong>字元級相似度</strong>由編輯距離換算;<strong>Jaccard / Dice</strong> 則以「詞」為單位看兩段用詞重疊多少。</li>
        <li>適合:判斷兩筆地址 / 姓名是否同一個(台 vs 臺、半形空白)、找標題近似重複、看文章改寫幅度、清名單時設相似度門檻。</li>
        <li>純中文沒有空白時,詞集會退化為逐字比對。本工具<strong>不連網、不上傳</strong>,與「名單比對 / 去重」「文字差異比對」互補。</li>
      </ul>
    </LegalNote>
  </div>
</template>
