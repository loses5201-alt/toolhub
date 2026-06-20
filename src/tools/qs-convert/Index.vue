<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { queryToJson, jsonToQuery, type ArrayFormat } from '@/features/qsConvert'

/*
  JSON ↔ 查詢字串轉換 —— 支援巢狀物件與陣列的方括號表示法。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

type Dir = 'qs2json' | 'json2qs'
const dir = ref<Dir>('qs2json')
const arrayFormat = ref<ArrayFormat>('brackets')

const qsInput = ref('user[name]=Amy&user[tags][]=a&user[tags][]=b&page=2')
const jsonInput = ref('{\n  "user": { "name": "Amy", "tags": ["a", "b"] },\n  "page": "2"\n}')

const output = computed(() => {
  try {
    if (dir.value === 'qs2json') {
      return { ok: true, text: JSON.stringify(queryToJson(qsInput.value), null, 2) }
    }
    const obj = JSON.parse(jsonInput.value)
    return { ok: true, text: jsonToQuery(obj, arrayFormat.value) }
  } catch (e) {
    return { ok: false, text: `輸入無法解析:${(e as Error).message}` }
  }
})

const copied = ref(false)
async function copy() {
  try {
    await navigator.clipboard.writeText(output.value.text)
    copied.value = true
    setTimeout(() => (copied.value = false), 1200)
  } catch {
    /* ignore */
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-5 space-y-3">
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-lg px-3 py-1.5 text-sm border"
          :class="dir === 'qs2json' ? 'bg-brand-500 text-white border-brand-500' : 'border-ink-200 text-ink-600 hover:bg-ink-50'"
          @click="dir = 'qs2json'"
        >
          查詢字串 → JSON
        </button>
        <button
          type="button"
          class="rounded-lg px-3 py-1.5 text-sm border"
          :class="dir === 'json2qs' ? 'bg-brand-500 text-white border-brand-500' : 'border-ink-200 text-ink-600 hover:bg-ink-50'"
          @click="dir = 'json2qs'"
        >
          JSON → 查詢字串
        </button>
      </div>

      <label v-if="dir === 'qs2json'" class="block text-sm">
        <span class="text-ink-500">貼上查詢字串(可含開頭的 ?)</span>
        <textarea v-model="qsInput" rows="4" class="qs-area font-mono" placeholder="a=1&b[c]=2&d[]=3"></textarea>
      </label>
      <template v-else>
        <label class="block text-sm">
          <span class="text-ink-500">貼上 JSON 物件</span>
          <textarea v-model="jsonInput" rows="8" class="qs-area font-mono"></textarea>
        </label>
        <label class="text-sm">
          <span class="text-ink-500">陣列輸出格式</span>
          <select v-model="arrayFormat" class="qs-area font-mono">
            <option value="brackets">a[]=1&a[]=2(brackets)</option>
            <option value="indices">a[0]=1&a[1]=2(indices)</option>
            <option value="repeat">a=1&a=2(repeat)</option>
            <option value="comma">a=1,2(comma)</option>
          </select>
        </label>
      </template>
    </div>

    <div class="card p-5 space-y-2">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold text-ink-700">結果</h2>
        <button
          type="button"
          class="rounded-lg border border-ink-200 px-3 py-1 text-xs text-ink-600 hover:bg-ink-50"
          @click="copy"
        >
          {{ copied ? '已複製' : '複製' }}
        </button>
      </div>
      <pre class="qs-out font-mono" :class="{ 'text-rose-600': !output.ok }">{{ output.text }}</pre>
    </div>

    <LegalNote>
      支援巢狀的<strong>方括號表示法</strong>:<code>a[b]=1</code> → <code>{"a":{"b":"1"}}</code>、
      <code>a[]=1&a[]=2</code> → 陣列、<code>a[0]=x</code> → 指定索引、重複裸鍵 <code>a=1&a=2</code> 也會合併成陣列。
      解析出的值<strong>一律為字串</strong>(查詢字串沒有型別概念);序列化時數字/布林會轉成文字、null 變成空值。
      鍵與值會做 URL 編碼/解碼(<code>+</code> 視為空格)。與 url-parse(編輯單一網址的扁平參數)互補。
      純前端計算,<strong>不上傳任何資料</strong>。
    </LegalNote>
  </div>
</template>

<style scoped>
.qs-area {
  width: 100%;
  margin-top: 0.25rem;
  border: 1px solid var(--color-ink-200, #e2e8f0);
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  font-size: 0.9rem;
}
.qs-out {
  white-space: pre-wrap;
  word-break: break-all;
  background: var(--color-ink-50, #f8fafc);
  border-radius: 0.5rem;
  padding: 0.75rem;
  font-size: 0.9rem;
  min-height: 3rem;
}
</style>
