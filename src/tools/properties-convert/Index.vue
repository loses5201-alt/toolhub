<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { propertiesToJson, jsonToProperties } from '@/features/properties'

/*
  Java .properties ↔ JSON 轉換 —— 把 .properties 設定/語系檔轉成 JSON,或倒回 .properties。
  正確處理 \uXXXX、=/:/空白 分隔、反斜線續行、跳脫等 Java 規則。
  設定常含金鑰/密碼,全程在你瀏覽器處理,不上傳。
*/
type Mode = 'prop2json' | 'json2prop'
const mode = ref<Mode>('prop2json')
const input = ref('')

const propSample = `# 應用設定(Java .properties)
app.name = ToolHub
app.url = http\\://localhost\\:8080/api
greeting = \\u4f60\\u597d\\uff0cworld
note = 第一行接\\
第二行`
const jsonSample = `{
  "app.name": "ToolHub",
  "app.url": "http://localhost:8080/api",
  "greeting": "你好,world"
}`

const result = computed(() => {
  if (!input.value.trim()) return { out: '', error: '' }
  const r = mode.value === 'prop2json' ? propertiesToJson(input.value) : jsonToProperties(input.value)
  return r.ok ? { out: r.text ?? '', error: '' } : { out: '', error: r.error ?? '轉換失敗' }
})

function useSample() {
  input.value = mode.value === 'prop2json' ? propSample : jsonSample
}
function swap() {
  if (result.value.out && !result.value.error) {
    input.value = result.value.out
    mode.value = mode.value === 'prop2json' ? 'json2prop' : 'prop2json'
  } else {
    mode.value = mode.value === 'prop2json' ? 'json2prop' : 'prop2json'
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
          :class="mode === 'prop2json' ? 'bg-brand-600 text-white' : 'border border-line bg-white hover:border-brand-400'"
          @click="mode = 'prop2json'"
        >
          .properties → JSON
        </button>
        <button
          class="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition"
          :class="mode === 'json2prop' ? 'bg-brand-600 text-white' : 'border border-line bg-white hover:border-brand-400'"
          @click="mode = 'json2prop'"
        >
          JSON → .properties
        </button>
      </div>

      <div>
        <div class="flex items-center justify-between">
          <label class="field-label">{{ mode === 'prop2json' ? '貼上 .properties 內容' : '貼上 JSON 物件' }}</label>
          <button class="text-xs text-brand-600 hover:underline" @click="useSample">填入範例</button>
        </div>
        <textarea
          v-model="input"
          rows="9"
          class="field-input font-mono text-xs"
          :placeholder="mode === 'prop2json' ? 'key = value(也接受 key:value 或 key value)' : '{ &quot;key&quot;: &quot;value&quot; }'"
        ></textarea>
        <p class="field-hint">語系檔/設定檔常含金鑰、密碼,本工具全程在你瀏覽器處理,不會上傳。</p>
      </div>

      <p v-if="result.error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ result.error }}</p>

      <div v-if="result.out">
        <div class="flex items-center justify-between">
          <label class="field-label">{{ mode === 'prop2json' ? 'JSON' : '.properties' }}</label>
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
        <li><strong>不上傳</strong>:Java / Spring / Android 的 <code>.properties</code> 常放密碼、API 金鑰、連線字串與語系文字,本工具全程在你瀏覽器處理,絕不送伺服器。</li>
        <li>正確套用 Java 規則:<code>=</code> / <code>:</code> / 空白皆可當分隔符、<code>#</code> 與 <code>!</code> 註解、行尾反斜線<strong>續行</strong>、<code>\uXXXX</code> 萬國碼與 <code>\t \n \\</code> 等跳脫。</li>
        <li>轉成 JSON 時把鍵當作<strong>扁平字串</strong>(點號 <code>a.b.c</code> 是鍵名的一部分,不展開成巢狀),來回轉換語意一致。</li>
        <li>倒回 <code>.properties</code> 時自動跳脫鍵中的空白與 <code>= : # !</code>、值中的換行,直接可用。與「INI ↔ JSON」「.env ↔ JSON」「TOML ↔ JSON」互補。</li>
      </ul>
    </LegalNote>
  </div>
</template>
