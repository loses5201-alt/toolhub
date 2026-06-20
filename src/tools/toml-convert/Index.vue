<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { tomlToJson, jsonToToml } from '@/features/toml'

/*
  TOML ↔ JSON 轉換 —— 把 Cargo.toml / pyproject.toml / netlify.toml 等設定檔轉成 JSON,
  或把 JSON 倒回 TOML。設定常含金鑰/密碼,全程在你瀏覽器處理,不上傳。
*/
type Mode = 'toml2json' | 'json2toml'
const mode = ref<Mode>('toml2json')
const input = ref('')

const tomlSample = `# 應用設定
name = "My App"
version = "1.2.0"

[server]
host = "localhost"
port = 8080
tags = ["web", "api"]

[database]
url = "postgres://localhost/db"
pool = { min = 2, max = 10 }

[[admins]]
name = "Alice"

[[admins]]
name = "Bob"`
const jsonSample = `{
  "name": "My App",
  "server": {
    "host": "localhost",
    "port": 8080
  },
  "admins": [
    { "name": "Alice" },
    { "name": "Bob" }
  ]
}`

const result = computed(() => {
  if (!input.value.trim()) return { out: '', error: '' }
  if (mode.value === 'toml2json') {
    const { json, error } = tomlToJson(input.value)
    return { out: error ? '' : json, error }
  }
  const { toml, error } = jsonToToml(input.value)
  return { out: error ? '' : toml, error }
})

function useSample() {
  input.value = mode.value === 'toml2json' ? tomlSample : jsonSample
}
function swap() {
  if (result.value.out && !result.value.error) {
    input.value = result.value.out
    mode.value = mode.value === 'toml2json' ? 'json2toml' : 'toml2json'
  } else {
    mode.value = mode.value === 'toml2json' ? 'json2toml' : 'toml2json'
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
          :class="mode === 'toml2json' ? 'bg-brand-600 text-white' : 'border border-line bg-white hover:border-brand-400'"
          @click="mode = 'toml2json'"
        >
          TOML → JSON
        </button>
        <button
          class="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition"
          :class="mode === 'json2toml' ? 'bg-brand-600 text-white' : 'border border-line bg-white hover:border-brand-400'"
          @click="mode = 'json2toml'"
        >
          JSON → TOML
        </button>
      </div>

      <div>
        <div class="flex items-center justify-between">
          <label class="field-label">{{ mode === 'toml2json' ? '貼上 TOML 設定檔內容' : '貼上 JSON 物件' }}</label>
          <button class="text-xs text-brand-600 hover:underline" @click="useSample">填入範例</button>
        </div>
        <textarea
          v-model="input"
          rows="11"
          class="field-input font-mono text-xs"
          :placeholder="mode === 'toml2json' ? 'key = &quot;value&quot; 然後 [table]' : '{ &quot;table&quot;: { &quot;key&quot;: &quot;value&quot; } }'"
        ></textarea>
        <p class="field-hint">TOML 設定常含 API 金鑰、連線字串,本工具全程在你瀏覽器處理,不會上傳。</p>
      </div>

      <p v-if="result.error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ result.error }}</p>

      <div v-if="result.out">
        <div class="flex items-center justify-between">
          <label class="field-label">{{ mode === 'toml2json' ? 'JSON' : 'TOML' }}</label>
          <button class="rounded-md border border-line bg-white px-3 py-1 text-xs hover:border-brand-400" @click="copyOut">{{ copied ? '已複製 ✓' : '複製' }}</button>
        </div>
        <textarea :value="result.out" rows="12" readonly class="field-input font-mono text-xs"></textarea>
      </div>

      <button class="rounded-lg border border-line bg-white px-4 py-2 text-sm hover:border-brand-400" @click="swap">
        ⇄ 把結果拿去反向轉換
      </button>
    </div>

    <LegalNote title="使用說明與為什麼用這個">
      <ul class="list-disc space-y-1 pl-5">
        <li><strong>不上傳</strong>:TOML 設定(<code>Cargo.toml</code>、<code>pyproject.toml</code>、<code>netlify.toml</code>、<code>config.toml</code>)常含 API 金鑰、連線字串,本工具全程在你瀏覽器處理,絕不送伺服器。</li>
        <li>把 <code>.toml</code> 轉成程式好讀的 JSON,或把 JSON 倒回 TOML 設定檔。</li>
        <li>支援 <code>#</code> 註解、<code>[table]</code> 與 <code>[a.b.c]</code> 巢狀表、<code>[[陣列表]]</code>、點分鍵 <code>a.b = 1</code>、inline table <code>{ x = 1 }</code>、跨行陣列,以及基本/字面/多行字串、整數(含 <code>0x</code>/<code>0o</code>/<code>0b</code>/底線)、浮點、布林、日期時間(保留為字串)。</li>
        <li>與「INI ↔ JSON」「.env ↔ JSON」「JSON ↔ YAML」互補,湊齊常見設定檔格式互轉。</li>
      </ul>
    </LegalNote>
  </div>
</template>
