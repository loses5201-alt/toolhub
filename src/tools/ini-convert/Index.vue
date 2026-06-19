<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { iniToJson, jsonToIni } from '@/features/ini'

/*
  INI / 設定檔 ↔ JSON 轉換 —— 把 INI 設定檔轉成 JSON,或把 JSON 物件倒成 INI。
  設定常含金鑰/密碼,全程在你瀏覽器處理,不上傳。
*/
type Mode = 'ini2json' | 'json2ini'
const mode = ref<Mode>('ini2json')
const input = ref('')

const iniSample = `; 應用設定
name=My App
[database]
host=localhost
port=5432
user=admin
[features]
dark_mode=true`
const jsonSample = `{
  "name": "My App",
  "database": {
    "host": "localhost",
    "port": "5432"
  }
}`

const result = computed(() => {
  if (!input.value.trim()) return { out: '', errors: [] as string[], error: '' }
  if (mode.value === 'ini2json') {
    const { json, errors } = iniToJson(input.value)
    return { out: json, errors, error: '' }
  }
  const { ini, error } = jsonToIni(input.value)
  return { out: error ? '' : ini, errors: [], error }
})

function useSample() {
  input.value = mode.value === 'ini2json' ? iniSample : jsonSample
}
function swap() {
  if (result.value.out && !result.value.error) {
    input.value = result.value.out
    mode.value = mode.value === 'ini2json' ? 'json2ini' : 'ini2json'
  } else {
    mode.value = mode.value === 'ini2json' ? 'json2ini' : 'ini2json'
    input.value = ''
  }
}

const copied = ref(false)
async function copyOut() {
  if (!result.value.out) return
  try {
    await navigator.clipboard.writeText(result.value.out)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    /* 可手動選取 */
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
      <div class="flex gap-2">
        <button
          class="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition"
          :class="mode === 'ini2json' ? 'bg-brand-600 text-white' : 'border border-line bg-white hover:border-brand-400'"
          @click="mode = 'ini2json'"
        >
          INI → JSON
        </button>
        <button
          class="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition"
          :class="mode === 'json2ini' ? 'bg-brand-600 text-white' : 'border border-line bg-white hover:border-brand-400'"
          @click="mode = 'json2ini'"
        >
          JSON → INI
        </button>
      </div>

      <div>
        <div class="flex items-center justify-between">
          <label class="field-label">{{ mode === 'ini2json' ? '貼上 INI 設定檔內容' : '貼上 JSON 物件' }}</label>
          <button class="text-xs text-brand-600 hover:underline" @click="useSample">填入範例</button>
        </div>
        <textarea
          v-model="input"
          rows="9"
          class="field-input font-mono text-xs"
          :placeholder="mode === 'ini2json' ? '[section] 然後 key=value' : '{ &quot;section&quot;: { &quot;key&quot;: &quot;value&quot; } }'"
        ></textarea>
        <p class="field-hint">設定常含金鑰/密碼,本工具全程在你瀏覽器處理,不會上傳。</p>
      </div>

      <p v-if="result.error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ result.error }}</p>
      <div v-if="result.errors.length" class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
        <p v-for="(e, i) in result.errors" :key="i">⚠️ {{ e }}</p>
      </div>

      <div v-if="result.out">
        <div class="flex items-center justify-between">
          <label class="field-label">{{ mode === 'ini2json' ? 'JSON' : 'INI' }}</label>
          <button class="rounded-md border border-line bg-white px-3 py-1 text-xs hover:border-brand-400" @click="copyOut">{{ copied ? '已複製 ✓' : '複製' }}</button>
        </div>
        <textarea :value="result.out" rows="10" readonly class="field-input font-mono text-xs"></textarea>
      </div>

      <button class="rounded-lg border border-line bg-white px-4 py-2 text-sm hover:border-brand-400" @click="swap">
        ⇄ 把結果拿去反向轉換
      </button>
    </div>

    <LegalNote title="使用說明與為什麼用這個">
      <ul class="list-disc space-y-1 pl-5">
        <li><strong>不上傳</strong>:INI 設定常含密碼、API 金鑰、連線字串,本工具全程在你瀏覽器處理,絕不送伺服器。</li>
        <li>把 <code>.ini</code> 轉成程式好讀的 JSON,或把 JSON 倒回 INI 設定檔。</li>
        <li>解析支援 <code>;</code> 與 <code>#</code> 註解、<code>[區段]</code>、<code>key=value</code>(也接受 <code>key: value</code>)、值前後引號去除、區段前的根層鍵。</li>
        <li>INI 僅支援一層區段;JSON 若有更深的巢狀或陣列會提示無法轉換。與「.env ↔ JSON」「JSON ↔ YAML」互補。</li>
      </ul>
    </LegalNote>
  </div>
</template>
