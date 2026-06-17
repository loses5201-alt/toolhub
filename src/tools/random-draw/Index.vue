<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  parseNames,
  shuffle,
  drawWinners,
  makeGroupsByCount,
  makeGroupsBySize,
} from '@/features/randomDraw'

/*
  公平抽籤 / 分組 —— 尾牙抽獎抽中獎者、把人隨機分組、隨機排出場順序。
  用瀏覽器內建密碼學亂數(crypto.getRandomValues)+ 拒絕取樣,機率真正均等、不連網不作弊;
  線上轉盤/抽獎站可能暗中動手腳或滿是廣告。全程在你電腦執行,名單不上傳。
*/
type Mode = 'winners' | 'shuffle' | 'groupByCount' | 'groupBySize'
const mode = ref<Mode>('winners')

const namesText = ref('')
const winnerCount = ref(1)
const groupCount = ref(2)
const groupSize = ref(4)

const names = computed(() => parseNames(namesText.value))

// 結果:抽籤/洗牌為一維;分組為二維。按「開始」才產生,避免每次輸入就跳動。
const flatResult = ref<string[] | null>(null)
const groupResult = ref<string[][] | null>(null)

function run() {
  flatResult.value = null
  groupResult.value = null
  const list = names.value
  if (list.length === 0) return
  if (mode.value === 'winners') {
    flatResult.value = drawWinners(list, winnerCount.value)
  } else if (mode.value === 'shuffle') {
    flatResult.value = shuffle(list)
  } else if (mode.value === 'groupByCount') {
    groupResult.value = makeGroupsByCount(list, groupCount.value)
  } else {
    groupResult.value = makeGroupsBySize(list, groupSize.value)
  }
}

function copyFlat() {
  if (flatResult.value) navigator.clipboard?.writeText(flatResult.value.join('\n'))
}
function copyGroups() {
  if (!groupResult.value) return
  const text = groupResult.value
    .map((g, i) => `第 ${i + 1} 組(${g.length} 人)\n${g.join('\n')}`)
    .join('\n\n')
  navigator.clipboard?.writeText(text)
}

const modes: { key: Mode; label: string }[] = [
  { key: 'winners', label: '抽中獎者' },
  { key: 'shuffle', label: '隨機排序' },
  { key: 'groupByCount', label: '分成 N 組' },
  { key: 'groupBySize', label: '每組 N 人' },
]

const resultTitle = computed(() =>
  mode.value === 'winners' ? `🎉 中獎名單(${flatResult.value?.length ?? 0} 位)` : '🔀 抽籤結果順序',
)
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="m in modes"
          :key="m.key"
          class="rounded-xl border px-4 py-2 text-sm font-semibold transition"
          :class="mode === m.key
            ? 'border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-300'
            : 'border-line bg-white text-ink-600 hover:bg-stone-50'"
          @click="mode = m.key; flatResult = null; groupResult = null"
        >
          {{ m.label }}
        </button>
      </div>

      <div>
        <label class="field-label">參加名單(一行一個)</label>
        <textarea
          v-model="namesText"
          rows="8"
          placeholder="王小明&#10;李大華&#10;陳美麗&#10;…"
          class="field-input font-mono text-sm"
        />
        <p class="field-hint">目前 <strong>{{ names.length }}</strong> 人。全程在你的瀏覽器抽選,不會上傳、不會儲存。</p>
      </div>

      <!-- 參數 -->
      <div class="flex flex-wrap items-end gap-4">
        <div v-if="mode === 'winners'">
          <label class="field-label">抽出幾位中獎</label>
          <input v-model.number="winnerCount" type="number" min="1" class="field-input w-32" />
        </div>
        <div v-if="mode === 'groupByCount'">
          <label class="field-label">分成幾組</label>
          <input v-model.number="groupCount" type="number" min="1" class="field-input w-32" />
        </div>
        <div v-if="mode === 'groupBySize'">
          <label class="field-label">每組幾人</label>
          <input v-model.number="groupSize" type="number" min="1" class="field-input w-32" />
        </div>
        <button
          class="rounded-xl bg-brand-600 px-6 py-2.5 font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-40"
          :disabled="names.length === 0"
          @click="run"
        >
          🎲 開始抽
        </button>
      </div>
    </div>

    <!-- 抽籤 / 排序結果 -->
    <div v-if="flatResult" class="card p-6 space-y-3">
      <div class="flex items-center gap-3">
        <h3 class="text-lg font-bold text-ink-800">{{ resultTitle }}</h3>
        <button class="text-sm text-brand-700 underline hover:text-brand-800" @click="copyFlat">複製</button>
        <button class="ml-auto text-sm text-brand-700 underline hover:text-brand-800" @click="run">再抽一次</button>
      </div>
      <ol class="space-y-1.5">
        <li
          v-for="(name, i) in flatResult"
          :key="i"
          class="flex items-center gap-3 rounded-xl border border-line bg-stone-50/60 px-4 py-2.5"
        >
          <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">{{ i + 1 }}</span>
          <span class="font-medium text-ink-800 break-all">{{ name }}</span>
        </li>
      </ol>
    </div>

    <!-- 分組結果 -->
    <div v-if="groupResult" class="card p-6 space-y-3">
      <div class="flex items-center gap-3">
        <h3 class="text-lg font-bold text-ink-800">👥 分組結果(共 {{ groupResult.length }} 組)</h3>
        <button class="text-sm text-brand-700 underline hover:text-brand-800" @click="copyGroups">複製</button>
        <button class="ml-auto text-sm text-brand-700 underline hover:text-brand-800" @click="run">重新分組</button>
      </div>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="(g, i) in groupResult" :key="i" class="rounded-xl border border-line p-4">
          <div class="mb-2 text-sm font-semibold text-brand-700">第 {{ i + 1 }} 組 · {{ g.length }} 人</div>
          <ul class="space-y-1">
            <li v-for="(name, j) in g" :key="j" class="text-ink-800 break-all">{{ name }}</li>
            <li v-if="g.length === 0" class="text-sm text-ink-400">(無人)</li>
          </ul>
        </div>
      </div>
    </div>

    <LegalNote title="為什麼用這個抽,而不是線上轉盤?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>真公平</strong>:用瀏覽器內建的密碼學亂數(<code>crypto.getRandomValues</code>)加「拒絕取樣」消除取模偏差,每個人中獎機率真正均等。</li>
        <li><strong>不作弊、無廣告</strong>:線上抽獎轉盤可能暗中加權或滿是廣告;本工具邏輯單純、原始碼可檢視。</li>
        <li><strong>不上傳</strong>:參加名單全程留在你的電腦,不連網、不儲存。</li>
        <li>分組採「先洗牌再輪流發牌」,各組人數最多只差 1 人,分配本身也是隨機的。</li>
      </ul>
    </LegalNote>
  </div>
</template>

