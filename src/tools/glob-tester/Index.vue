<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { testPaths, globToRegExp } from '@/features/globMatch'

/*
  Glob 比對測試器 —— 左邊填 glob 樣式(每行一個),右邊填要測的路徑,
  即時顯示每個路徑符合哪些樣式,並列出第一個樣式編譯出的正規表達式。
  驗證 tsconfig include/exclude、CI path filter、.gitignore/.dockerignore 樣式用。
  全程在你的瀏覽器解析,不連網、不上傳。
*/

const patterns = ref('**/*.js\nsrc/**\n*.{json,md}')
const paths = ref('index.js\nsrc/app/main.js\nsrc/styles.css\npackage.json\nREADME.md\nlib/util.ts')
const nocase = ref(false)

const results = computed(() => testPaths(patterns.value, paths.value, { nocase: nocase.value }))
const matchedCount = computed(() => results.value.filter((r) => r.matched).length)

// 第一條樣式的正規表達式預覽
const firstPattern = computed(() => patterns.value.split(/\r?\n/).map((l) => l.trim()).find((l) => l && !l.startsWith('#')) || '')
const firstRegex = computed(() => {
  if (!firstPattern.value) return ''
  try {
    return globToRegExp(firstPattern.value, { nocase: nocase.value }).toString()
  } catch {
    return '(無法編譯)'
  }
})
</script>

<template>
  <div class="space-y-6">
    <div class="grid gap-4 sm:grid-cols-2">
      <label class="block text-sm">
        <span class="text-ink-500">Glob 樣式(每行一個,# 為註解)</span>
        <textarea v-model="patterns" rows="7" class="gl-input font-mono" />
      </label>
      <label class="block text-sm">
        <span class="text-ink-500">要測試的路徑(每行一個)</span>
        <textarea v-model="paths" rows="7" class="gl-input font-mono" />
      </label>
    </div>

    <div class="card p-4 flex flex-wrap items-center gap-4">
      <label class="flex items-center gap-2 text-sm text-ink-600">
        <input v-model="nocase" type="checkbox" class="accent-brand-600" /> 不分大小寫
      </label>
      <span class="ml-auto text-sm text-ink-500">{{ matchedCount }} / {{ results.length }} 個路徑符合</span>
    </div>

    <div v-if="firstPattern" class="card p-4 text-sm space-y-1">
      <span class="text-ink-500">「{{ firstPattern }}」編譯為正規表達式</span>
      <pre class="whitespace-pre-wrap break-all font-mono text-xs text-ink-700">{{ firstRegex }}</pre>
    </div>

    <div v-if="results.length" class="card p-5 space-y-2">
      <span class="text-sm font-semibold text-ink-700">比對結果</span>
      <ul class="divide-y divide-ink-100">
        <li v-for="(r, i) in results" :key="i" class="flex flex-wrap items-center gap-3 py-2.5">
          <span
            class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs"
            :class="r.matched ? 'bg-emerald-100 text-emerald-700' : 'bg-ink-100 text-ink-400'"
          >{{ r.matched ? '✓' : '·' }}</span>
          <code class="font-mono text-sm" :class="r.matched ? 'text-ink-800' : 'text-ink-400'">{{ r.path }}</code>
          <span v-if="r.matchedBy.length" class="ml-auto flex flex-wrap gap-1">
            <code
              v-for="(p, j) in r.matchedBy"
              :key="j"
              class="rounded bg-brand-50 px-1.5 py-0.5 text-xs text-brand-700"
            >{{ p }}</code>
          </span>
          <span v-else class="ml-auto text-xs text-ink-300">無符合</span>
        </li>
      </ul>
    </div>

    <LegalNote>
      語意採 minimatch 常見子集:<code>*</code> 比對單一路徑段(不跨 <code>/</code>);<code>**</code>
      在路徑段邊界時可跨多層目錄;<code>?</code> 單一字元;<code>[abc]</code> 字元集(支援 <code>a-z</code>
      範圍與開頭 <code>!</code> 取反);<code>{a,b}</code> 擇一(可巢狀)。此為樣式比對,不含 .gitignore 的
      「後者覆蓋前者」與否定規則優先序,實際請以你的工具為準。全程在你的瀏覽器解析,不連網、不上傳。
    </LegalNote>
  </div>
</template>

<style scoped>
.gl-input {
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
