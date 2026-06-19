<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  parseDotenv,
  stringifyDotenv,
  stringifyShell,
  pairsToJson,
  jsonToPairs,
} from '@/features/dotenv'

/*
  .env ↔ JSON / shell 轉換 —— 把 .env 設定檔轉成 JSON 物件或 shell export,反之亦然。
  純前端處理,設定常含金鑰/密碼,絕不上傳。
*/
type Mode = 'env2json' | 'json2env'
const mode = ref<Mode>('env2json')
const input = ref('')

const envSample = `# 範例
export PORT=3000
DB_HOST=localhost
DB_PASS="p@ss word"
DEBUG=true # 行內註解`
const jsonSample = `{
  "PORT": "3000",
  "DB_HOST": "localhost",
  "DEBUG": true
}`

const result = computed(() => {
  const text = input.value
  if (!text.trim()) return { json: '', env: '', shell: '', errors: [] as string[], error: '' }
  if (mode.value === 'env2json') {
    const { pairs, errors } = parseDotenv(text)
    return {
      json: pairsToJson(pairs),
      env: '',
      shell: stringifyShell(pairs),
      errors: errors.map((e) => e.message),
      error: '',
    }
  } else {
    const { pairs, error } = jsonToPairs(text)
    return {
      json: '',
      env: error ? '' : stringifyDotenv(pairs),
      shell: error ? '' : stringifyShell(pairs),
      errors: [],
      error,
    }
  }
})

function useSample() {
  input.value = mode.value === 'env2json' ? envSample : jsonSample
}
function swap() {
  // 把目前輸出當成另一向的輸入
  if (mode.value === 'env2json' && result.value.json) {
    input.value = result.value.json
    mode.value = 'json2env'
  } else if (mode.value === 'json2env' && result.value.env) {
    input.value = result.value.env
    mode.value = 'env2json'
  } else {
    mode.value = mode.value === 'env2json' ? 'json2env' : 'env2json'
    input.value = ''
  }
}

const copiedKey = ref('')
async function copy(text: string, key: string) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    copiedKey.value = key
    setTimeout(() => (copiedKey.value = ''), 1500)
  } catch {
    /* 可手動選取 */
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
      <div class="flex flex-wrap items-center gap-2">
        <button
          class="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition"
          :class="mode === 'env2json' ? 'bg-brand-600 text-white' : 'border border-line bg-white hover:border-brand-400'"
          @click="mode = 'env2json'"
        >
          .env → JSON
        </button>
        <button
          class="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition"
          :class="mode === 'json2env' ? 'bg-brand-600 text-white' : 'border border-line bg-white hover:border-brand-400'"
          @click="mode = 'json2env'"
        >
          JSON → .env
        </button>
      </div>

      <div>
        <div class="flex items-center justify-between">
          <label class="field-label">{{ mode === 'env2json' ? '貼上 .env 內容' : '貼上 JSON 物件' }}</label>
          <button class="text-xs text-brand-600 hover:underline" @click="useSample">填入範例</button>
        </div>
        <textarea
          v-model="input"
          rows="8"
          class="field-input font-mono text-xs"
          :placeholder="mode === 'env2json' ? 'KEY=value' : '{ &quot;KEY&quot;: &quot;value&quot; }'"
        ></textarea>
        <p class="field-hint">設定常含金鑰/密碼,本工具全程在你瀏覽器處理,不會上傳。</p>
      </div>

      <p v-if="result.error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ result.error }}</p>
      <div v-if="result.errors.length" class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
        <p v-for="(e, i) in result.errors" :key="i">⚠️ {{ e }}</p>
      </div>

      <!-- env → json 輸出 -->
      <template v-if="mode === 'env2json' && result.json">
        <div>
          <div class="flex items-center justify-between">
            <label class="field-label">JSON</label>
            <button class="rounded-md border border-line bg-white px-3 py-1 text-xs hover:border-brand-400" @click="copy(result.json, 'json')">{{ copiedKey === 'json' ? '已複製 ✓' : '複製' }}</button>
          </div>
          <textarea :value="result.json" rows="8" readonly class="field-input font-mono text-xs"></textarea>
        </div>
        <div>
          <div class="flex items-center justify-between">
            <label class="field-label">shell export(貼進終端機 / CI 腳本)</label>
            <button class="rounded-md border border-line bg-white px-3 py-1 text-xs hover:border-brand-400" @click="copy(result.shell, 'sh')">{{ copiedKey === 'sh' ? '已複製 ✓' : '複製' }}</button>
          </div>
          <textarea :value="result.shell" rows="5" readonly class="field-input font-mono text-xs"></textarea>
        </div>
      </template>

      <!-- json → env 輸出 -->
      <template v-if="mode === 'json2env' && result.env">
        <div>
          <div class="flex items-center justify-between">
            <label class="field-label">.env</label>
            <button class="rounded-md border border-line bg-white px-3 py-1 text-xs hover:border-brand-400" @click="copy(result.env, 'env')">{{ copiedKey === 'env' ? '已複製 ✓' : '複製' }}</button>
          </div>
          <textarea :value="result.env" rows="8" readonly class="field-input font-mono text-xs"></textarea>
        </div>
        <div>
          <div class="flex items-center justify-between">
            <label class="field-label">shell export</label>
            <button class="rounded-md border border-line bg-white px-3 py-1 text-xs hover:border-brand-400" @click="copy(result.shell, 'sh2')">{{ copiedKey === 'sh2' ? '已複製 ✓' : '複製' }}</button>
          </div>
          <textarea :value="result.shell" rows="5" readonly class="field-input font-mono text-xs"></textarea>
        </div>
      </template>

      <button class="rounded-lg border border-line bg-white px-4 py-2 text-sm hover:border-brand-400" @click="swap">
        ⇄ 把結果拿去反向轉換
      </button>
    </div>

    <LegalNote title="使用說明與為什麼用這個">
      <ul class="list-disc space-y-1 pl-5">
        <li><strong>不上傳</strong>:.env 常含 API 金鑰、資料庫密碼,本工具全程在你瀏覽器處理,絕不送伺服器。</li>
        <li>把 <code>.env</code> 轉成 JSON 放進設定、或轉成 <code>export</code> 貼進終端機 / CI;也能把 JSON 物件倒回 <code>.env</code>。</li>
        <li>解析支援 <code>#</code> 註解、空白行、<code>export</code> 前綴、單/雙引號與 <code>\n \t</code> 跳脫;無引號值會自動去掉行內 <code>#</code> 註解。</li>
        <li>序列化時,值含空白/<code>#</code>/換行才會自動加引號並跳脫,確保貼回去仍正確。</li>
      </ul>
    </LegalNote>
  </div>
</template>
