<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { applyPatch, diffPatch, type JsonValue, type PatchOp } from '@/features/jsonPatch'

/*
  JSON Patch(RFC 6902)工具 —— 套用模式:文件 + patch → 結果;比較模式:兩份 JSON → patch。
  全程在你的瀏覽器計算,不上傳。
*/

const mode = ref<'apply' | 'diff'>('apply')

// 套用模式
const docText = ref('{\n  "name": "Toolhub",\n  "tags": ["tw", "tools"]\n}')
const patchText = ref('[\n  { "op": "replace", "path": "/name", "value": "ToolHub" },\n  { "op": "add", "path": "/tags/-", "value": "free" }\n]')

// 比較模式
const aText = ref('{\n  "name": "old",\n  "count": 1\n}')
const bText = ref('{\n  "name": "new",\n  "count": 1,\n  "extra": true\n}')

const copied = ref(false)

function tryParse(s: string): { ok: boolean; value?: JsonValue; error?: string } {
  try {
    return { ok: true, value: JSON.parse(s) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

const applyResult = computed(() => {
  if (mode.value !== 'apply') return null
  const d = tryParse(docText.value)
  if (!d.ok) return { ok: false, error: 'JSON 文件解析錯誤:' + d.error }
  const p = tryParse(patchText.value)
  if (!p.ok) return { ok: false, error: 'Patch 解析錯誤:' + p.error }
  return applyPatch(d.value as JsonValue, p.value as unknown as PatchOp[])
})

const diffResult = computed(() => {
  if (mode.value !== 'diff') return null
  const a = tryParse(aText.value)
  if (!a.ok) return { ok: false, error: '左側 JSON 解析錯誤:' + a.error }
  const b = tryParse(bText.value)
  if (!b.ok) return { ok: false, error: '右側 JSON 解析錯誤:' + b.error }
  try {
    return { ok: true, patch: diffPatch(a.value as JsonValue, b.value as JsonValue) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
})

const outputText = computed(() => {
  if (mode.value === 'apply') {
    return applyResult.value?.ok ? JSON.stringify(applyResult.value.result, null, 2) : ''
  }
  return diffResult.value?.ok ? JSON.stringify(diffResult.value.patch, null, 2) : ''
})

async function copy() {
  try {
    await navigator.clipboard.writeText(outputText.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    /* 剪貼簿不可用 */
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 flex flex-wrap gap-2">
      <button type="button" class="rounded-lg border px-3 py-1.5 text-sm" :class="mode === 'apply' ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600 hover:bg-ink-50'" @click="mode = 'apply'">
        套用 Patch
      </button>
      <button type="button" class="rounded-lg border px-3 py-1.5 text-sm" :class="mode === 'diff' ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600 hover:bg-ink-50'" @click="mode = 'diff'">
        比較產生 Patch
      </button>
    </div>

    <!-- 套用模式 -->
    <template v-if="mode === 'apply'">
      <div class="grid gap-4 lg:grid-cols-2">
        <label class="card p-4 block text-sm">
          <span class="text-ink-500">原始 JSON 文件</span>
          <textarea v-model="docText" rows="12" class="jp-area font-mono" spellcheck="false" />
        </label>
        <label class="card p-4 block text-sm">
          <span class="text-ink-500">JSON Patch(操作陣列)</span>
          <textarea v-model="patchText" rows="12" class="jp-area font-mono" spellcheck="false" />
        </label>
      </div>
      <p v-if="applyResult && !applyResult.ok" class="card p-4 text-sm text-rose-700 bg-rose-50 border border-rose-200">⚠️ {{ applyResult.error }}</p>
    </template>

    <!-- 比較模式 -->
    <template v-else>
      <div class="grid gap-4 lg:grid-cols-2">
        <label class="card p-4 block text-sm">
          <span class="text-ink-500">JSON A(原始)</span>
          <textarea v-model="aText" rows="12" class="jp-area font-mono" spellcheck="false" />
        </label>
        <label class="card p-4 block text-sm">
          <span class="text-ink-500">JSON B(目標)</span>
          <textarea v-model="bText" rows="12" class="jp-area font-mono" spellcheck="false" />
        </label>
      </div>
      <p v-if="diffResult && !diffResult.ok" class="card p-4 text-sm text-rose-700 bg-rose-50 border border-rose-200">⚠️ {{ diffResult.error }}</p>
    </template>

    <!-- 輸出 -->
    <div v-if="outputText" class="card p-5 space-y-2">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-ink-700">{{ mode === 'apply' ? '套用後的結果' : '產生的 Patch' }}</h3>
        <button type="button" class="rounded-lg border border-ink-200 px-3 py-1 text-sm text-ink-600 hover:bg-ink-50" @click="copy">
          {{ copied ? '已複製 ✓' : '複製' }}
        </button>
      </div>
      <pre class="jp-out"><code>{{ outputText }}</code></pre>
    </div>

    <LegalNote>
      <strong>JSON Patch(RFC 6902)</strong>是用一連串操作(<code>add / remove / replace / move / copy / test</code>)
      描述「如何把一份 JSON 改成另一份」的標準格式,常用於 API 局部更新(HTTP PATCH)與設定版本控管。
      路徑採 <strong>JSON Pointer(RFC 6901)</strong>,如 <code>/foo/0/bar</code>(<code>~1</code> 代表 <code>/</code>、
      <code>~0</code> 代表 <code>~</code>,陣列尾端用 <code>-</code>)。
      比較模式採物件遞迴比對;<strong>陣列或型別不同時會整段 replace</strong>(求正確,非最短)。
      全程在你的瀏覽器計算,不連網、不上傳。
    </LegalNote>
  </div>
</template>

<style scoped>
.jp-area {
  width: 100%;
  margin-top: 0.25rem;
  border: 1px solid var(--color-ink-200, #e2e8f0);
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  font-size: 0.8125rem;
  line-height: 1.55;
  resize: vertical;
}
.jp-out {
  overflow-x: auto;
  border-radius: 0.5rem;
  background: var(--color-ink-50, #f8fafc);
  padding: 0.75rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.8125rem;
  line-height: 1.55;
  white-space: pre;
}
</style>
