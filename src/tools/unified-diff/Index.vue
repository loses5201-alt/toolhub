<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { unifiedDiff } from '@/features/unifiedDiff'

/*
  Unified diff(.patch)產生器 —— 把兩段文字比對,輸出標準 unified diff,
  可存成 .patch、貼進 PR、或用 patch / git apply 套用。
  與「文字比對」互補(那支視覺對照,這支產出可套用的 patch)。
  全程在你的瀏覽器計算,不上傳。
*/

const oldText = ref('function greet(name) {\n  console.log("Hi " + name)\n}\n')
const newText = ref('function greet(name) {\n  console.log(`Hello, ${name}!`)\n}\n')
const oldName = ref('original')
const newName = ref('modified')
const context = ref(3)
const ignoreCase = ref(false)
const ignoreTrailingSpace = ref(false)
const copied = ref(false)

const result = computed(() =>
  unifiedDiff(oldText.value, newText.value, {
    oldName: oldName.value.trim() || 'original',
    newName: newName.value.trim() || 'modified',
    context: context.value,
    ignoreCase: ignoreCase.value,
    ignoreTrailingSpace: ignoreTrailingSpace.value,
  }),
)

const patchLines = computed(() => result.value.patch.split('\n'))

function lineClass(l: string): string {
  if (l.startsWith('@@')) return 'text-violet-600 bg-violet-50'
  if (l.startsWith('+++') || l.startsWith('---')) return 'text-ink-500 font-semibold'
  if (l.startsWith('+')) return 'text-emerald-700 bg-emerald-50'
  if (l.startsWith('-')) return 'text-rose-700 bg-rose-50'
  return 'text-ink-600'
}

async function copy() {
  try {
    await navigator.clipboard.writeText(result.value.patch)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    /* 忽略:剪貼簿不可用 */
  }
}

function download() {
  const blob = new Blob([result.value.patch], { type: 'text/x-patch;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'changes.patch'
  a.click()
  URL.revokeObjectURL(url)
}

function swap() {
  ;[oldText.value, newText.value] = [newText.value, oldText.value]
  ;[oldName.value, newName.value] = [newName.value, oldName.value]
}
</script>

<template>
  <div class="space-y-6">
    <!-- 兩段輸入 -->
    <div class="grid gap-4 lg:grid-cols-2">
      <div class="card p-4 space-y-2">
        <input v-model="oldName" class="ud-name" placeholder="原始檔名(選填)" spellcheck="false" />
        <textarea
          v-model="oldText"
          rows="10"
          class="ud-area font-mono"
          spellcheck="false"
          placeholder="貼上原始文字"
        />
      </div>
      <div class="card p-4 space-y-2">
        <input v-model="newName" class="ud-name" placeholder="修改後檔名(選填)" spellcheck="false" />
        <textarea
          v-model="newText"
          rows="10"
          class="ud-area font-mono"
          spellcheck="false"
          placeholder="貼上修改後文字"
        />
      </div>
    </div>

    <!-- 選項 -->
    <div class="card p-4 flex flex-wrap items-center gap-4 text-sm">
      <label class="flex items-center gap-1.5">
        <span class="text-ink-500">上下文行數</span>
        <input v-model.number="context" type="number" min="0" max="20" class="w-16 rounded border border-ink-200 px-2 py-1" />
      </label>
      <label class="flex items-center gap-1.5">
        <input v-model="ignoreCase" type="checkbox" class="accent-brand-600" />
        <span class="text-ink-600">忽略大小寫</span>
      </label>
      <label class="flex items-center gap-1.5">
        <input v-model="ignoreTrailingSpace" type="checkbox" class="accent-brand-600" />
        <span class="text-ink-600">忽略行尾空白</span>
      </label>
      <button type="button" class="ml-auto text-brand-600 hover:underline" @click="swap">⇄ 對調兩邊</button>
    </div>

    <!-- 結果 -->
    <div class="card p-5 space-y-3">
      <div class="flex flex-wrap items-center gap-3">
        <h3 class="text-sm font-semibold text-ink-700">Unified diff</h3>
        <span v-if="!result.identical" class="text-xs text-ink-500">
          {{ result.hunks }} 個區塊 ·
          <span class="text-emerald-600">+{{ result.added }}</span>
          <span class="text-rose-600 ml-1">−{{ result.removed }}</span>
        </span>
        <div v-if="!result.identical" class="ml-auto flex gap-2">
          <button type="button" class="rounded-lg border border-ink-200 px-3 py-1 text-sm text-ink-600 hover:bg-ink-50" @click="copy">
            {{ copied ? '已複製 ✓' : '複製' }}
          </button>
          <button type="button" class="rounded-lg border border-ink-200 px-3 py-1 text-sm text-ink-600 hover:bg-ink-50" @click="download">
            下載 .patch
          </button>
        </div>
      </div>

      <p v-if="result.identical" class="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        ✓ 兩段文字相同(在目前的比對設定下),沒有差異。
      </p>
      <pre v-else class="ud-patch"><code><span v-for="(l, i) in patchLines" :key="i" class="block px-2 -mx-2" :class="lineClass(l)">{{ l || ' ' }}</span></code></pre>
    </div>

    <LegalNote>
      Unified diff(統一差異)是 Git、<code>diff -u</code>、程式碼審查最通用的差異格式:
      <code>---/+++</code> 標示新舊檔名,<code>@@ -舊起點,行數 +新起點,行數 @@</code> 標示每個變更區塊,
      行首 <code>-</code> 為刪除、<code>+</code> 為新增、空白為未變的上下文。
      產出的 <code>.patch</code> 可用 <code>git apply</code> 或 <code>patch -p1</code> 套用回去。
      與「文字比對」工具互補(那支做視覺逐行對照,這支產出可機器套用的 patch)。
      全程在你的瀏覽器計算,不連網、不上傳。
    </LegalNote>
  </div>
</template>

<style scoped>
.ud-name {
  width: 100%;
  border: 1px solid var(--color-ink-200, #e2e8f0);
  border-radius: 0.375rem;
  padding: 0.3rem 0.5rem;
  font-size: 0.8125rem;
  font-family: ui-monospace, monospace;
}
.ud-area {
  width: 100%;
  border: 1px solid var(--color-ink-200, #e2e8f0);
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  font-size: 0.8125rem;
  line-height: 1.55;
  resize: vertical;
}
.ud-patch {
  overflow-x: auto;
  border-radius: 0.5rem;
  background: var(--color-ink-50, #f8fafc);
  padding: 0.75rem 0.5rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.8125rem;
  line-height: 1.5;
  white-space: pre;
}
</style>
