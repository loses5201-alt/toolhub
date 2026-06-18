<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { compareJSON, preview, type ChangeKind } from '@/features/jsonDiff'

/*
  JSON 結構比對 —— 貼上兩份 JSON,列出新增/刪除/變更的欄位與路徑(鍵不分順序、陣列依索引)。
  全程在你的瀏覽器,可能含密鑰的資料不上傳。
*/
const left = ref('{\n  "name": "小明",\n  "age": 30,\n  "tags": ["a", "b"],\n  "vip": false\n}')
const right = ref('{\n  "name": "小明",\n  "age": 31,\n  "tags": ["a", "c"],\n  "city": "台北"\n}')

const result = computed(() => compareJSON(left.value, right.value))

const kindMeta: Record<ChangeKind, { label: string; cls: string; dot: string }> = {
  added: { label: '新增', cls: 'border-emerald-200 bg-emerald-50/60', dot: 'bg-emerald-500' },
  removed: { label: '刪除', cls: 'border-rose-200 bg-rose-50/60', dot: 'bg-rose-500' },
  changed: { label: '變更', cls: 'border-amber-200 bg-amber-50/60', dot: 'bg-amber-500' },
}

function fmt(v: unknown): string {
  return preview(v, 120)
}
</script>

<template>
  <div class="space-y-6">
    <div class="grid gap-4 md:grid-cols-2">
      <div class="card p-4">
        <label class="field-label">舊版 / 左 JSON</label>
        <textarea v-model="left" rows="12" class="field-input font-mono text-xs leading-relaxed" spellcheck="false" />
        <p v-if="!result.ok && result.errorSide === 'left'" class="mt-1 text-sm text-rose-600">⚠️ 解析失敗:{{ result.error }}</p>
      </div>
      <div class="card p-4">
        <label class="field-label">新版 / 右 JSON</label>
        <textarea v-model="right" rows="12" class="field-input font-mono text-xs leading-relaxed" spellcheck="false" />
        <p v-if="!result.ok && result.errorSide === 'right'" class="mt-1 text-sm text-rose-600">⚠️ 解析失敗:{{ result.error }}</p>
      </div>
    </div>

    <div v-if="result.ok" class="space-y-3">
      <div class="card p-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <span class="font-semibold text-ink-700">比對結果</span>
        <span class="text-emerald-600">新增 {{ result.summary!.added }}</span>
        <span class="text-rose-600">刪除 {{ result.summary!.removed }}</span>
        <span class="text-amber-600">變更 {{ result.summary!.changed }}</span>
        <span v-if="!result.changes!.length" class="ml-auto text-ink-500">兩份內容在語意上完全相同(忽略排版與鍵順序)✓</span>
      </div>

      <div
        v-for="(c, i) in result.changes"
        :key="i"
        class="rounded-xl border p-3"
        :class="kindMeta[c.kind].cls"
      >
        <div class="flex items-center gap-2">
          <span class="inline-block h-2 w-2 rounded-full" :class="kindMeta[c.kind].dot" />
          <span class="text-xs font-semibold text-ink-500">{{ kindMeta[c.kind].label }}</span>
          <code class="text-sm font-semibold text-ink-800">{{ c.path }}</code>
        </div>
        <div class="mt-1.5 space-y-0.5 text-xs font-mono">
          <div v-if="c.kind !== 'added'" class="text-rose-700">
            <span class="select-none text-rose-400">− </span>{{ fmt(c.before) }}
          </div>
          <div v-if="c.kind !== 'removed'" class="text-emerald-700">
            <span class="select-none text-emerald-400">+ </span>{{ fmt(c.after) }}
          </div>
        </div>
      </div>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>比對兩次 <strong>API 回應</strong>、兩個版本的設定檔/JSON,一眼看出哪個欄位被新增、刪除或改值。</li>
        <li>做的是「<strong>語意層級</strong>」比對:物件鍵<strong>不分順序</strong>、排版差異會被忽略 —— 不像逐行 diff 容易被格式干擾。</li>
        <li>陣列依<strong>索引位置</strong>比對(第 0 個對第 0 個);變更會標出完整路徑,例如 <code>user.tags[1]</code>。</li>
        <li>本工具<strong>不連網、不上傳</strong>,可能含密鑰或個資的 JSON 只留在你的瀏覽器。</li>
      </ul>
    </LegalNote>
  </div>
</template>
