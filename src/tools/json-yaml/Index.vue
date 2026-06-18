<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import type { ConvertResult } from '@/features/jsonYaml'

/*
  JSON ↔ YAML 互轉 —— k8s / docker-compose / GitHub Actions 等設定檔常含密鑰,
  線上轉換器要你上傳;本工具全程在瀏覽器轉換,內容不上傳。
  轉換邏輯在 src/features/jsonYaml.ts(薄包裝 js-yaml,可測);js-yaml 動態 import。
*/
type Dir = 'json2yaml' | 'yaml2json'

const dir = ref<Dir>('json2yaml')
const input = ref('')
const output = ref('')
const error = ref('')
const indent = ref(2)
const busy = ref(false)
const copied = ref(false)

const fromLabel = computed(() => (dir.value === 'json2yaml' ? 'JSON' : 'YAML'))
const toLabel = computed(() => (dir.value === 'json2yaml' ? 'YAML' : 'JSON'))

async function convert() {
  error.value = ''
  output.value = ''
  copied.value = false
  if (!input.value.trim()) {
    error.value = `請先貼上 ${fromLabel.value} 內容。`
    return
  }
  busy.value = true
  try {
    const { jsonToYaml, yamlToJson } = await import('@/features/jsonYaml')
    const r: ConvertResult =
      dir.value === 'json2yaml'
        ? jsonToYaml(input.value, indent.value)
        : yamlToJson(input.value, indent.value)
    if (r.ok) output.value = r.output
    else error.value = r.error
  } catch (e) {
    error.value = '轉換失敗:' + (e as Error).message
  } finally {
    busy.value = false
  }
}

function setDir(d: Dir) {
  if (dir.value === d) return
  dir.value = d
  output.value = ''
  error.value = ''
  copied.value = false
}

// 把目前的結果搬到輸入框、方向對調,方便接著反向驗證
function useOutputAsInput() {
  if (!output.value) return
  input.value = output.value
  setDir(dir.value === 'json2yaml' ? 'yaml2json' : 'json2yaml')
  output.value = ''
}

async function copyOut() {
  if (!output.value) return
  try {
    await navigator.clipboard.writeText(output.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    error.value = '複製失敗,請手動選取。'
  }
}

function download() {
  if (!output.value) return
  const isYaml = dir.value === 'json2yaml'
  const blob = new Blob([output.value], {
    type: isYaml ? 'text/yaml' : 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = isYaml ? 'output.yaml' : 'output.json'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function fillSample() {
  input.value =
    dir.value === 'json2yaml'
      ? '{\n  "name": "toolhub",\n  "port": 8080,\n  "features": ["a", "b"]\n}'
      : 'name: toolhub\nport: 8080\nfeatures:\n  - a\n  - b'
  output.value = ''
  error.value = ''
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
      <div>
        <span class="field-label">轉換方向</span>
        <div class="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            class="rounded-xl border px-3 py-2 text-sm font-medium transition"
            :class="
              dir === 'json2yaml'
                ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-300 text-ink-800'
                : 'border-line bg-white text-ink-600 hover:border-brand-300'
            "
            @click="setDir('json2yaml')"
          >
            JSON → YAML
          </button>
          <button
            type="button"
            class="rounded-xl border px-3 py-2 text-sm font-medium transition"
            :class="
              dir === 'yaml2json'
                ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-300 text-ink-800'
                : 'border-line bg-white text-ink-600 hover:border-brand-300'
            "
            @click="setDir('yaml2json')"
          >
            YAML → JSON
          </button>
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between gap-2">
          <label class="field-label !mb-0">貼上 {{ fromLabel }}</label>
          <button class="text-xs text-brand-600 underline hover:text-brand-700" @click="fillSample">
            填入範例
          </button>
        </div>
        <textarea
          v-model="input"
          rows="9"
          spellcheck="false"
          class="field-input mt-1 font-mono text-sm"
          :placeholder="dir === 'json2yaml' ? '{ &quot;key&quot;: &quot;value&quot; }' : 'key: value'"
        ></textarea>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <label class="flex items-center gap-2 text-sm text-ink-600">
          縮排
          <select v-model.number="indent" class="rounded-lg border border-line px-2 py-1 text-sm">
            <option :value="2">2 空格</option>
            <option :value="4">4 空格</option>
            <option v-if="dir === 'yaml2json'" :value="0">壓成一行</option>
          </select>
        </label>
        <button class="btn-primary !py-2 text-sm" :disabled="busy" @click="convert">
          {{ busy ? '轉換中…' : `轉成 ${toLabel}` }}
        </button>
      </div>

      <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 whitespace-pre-wrap">
        {{ error }}
      </p>

      <div v-if="output">
        <div class="flex items-center justify-between gap-2">
          <label class="field-label !mb-0">{{ toLabel }} 結果</label>
          <div class="flex items-center gap-3 text-xs">
            <button class="text-brand-600 underline hover:text-brand-700" @click="copyOut">
              {{ copied ? '已複製 ✓' : '複製' }}
            </button>
            <button class="text-brand-600 underline hover:text-brand-700" @click="download">下載</button>
            <button class="text-ink-500 underline hover:text-ink-700" @click="useOutputAsInput">
              拿結果反向驗證
            </button>
          </div>
        </div>
        <pre class="mt-1 max-h-96 overflow-auto rounded-xl border border-line bg-ink-50 p-3 text-sm font-mono whitespace-pre-wrap break-words text-ink-800">{{ output }}</pre>
      </div>
    </div>

    <LegalNote title="為什麼用這個,而不是線上轉換器?">
      <ul class="list-disc pl-5 space-y-1">
        <li>
          <strong>不上傳</strong>:k8s、docker-compose、GitHub Actions、應用程式設定常含
          API 金鑰、密碼、內部網址,貼到線上轉換器等於把機密送上陌生伺服器;這支全程在你瀏覽器轉換。
        </li>
        <li>解析/序列化採用成熟的 js-yaml 函式庫,避免自刻解析器把設定轉錯。</li>
        <li>「拿結果反向驗證」可把結果搬回輸入、自動對調方向,確認來回一致沒跑掉。</li>
        <li>
          注意:YAML 的註解、自訂標籤(<code>!Ref</code> 等)、錨點別名在轉成 JSON 時會被展開或捨棄,
          這是格式本質差異;轉換結果僅供參考,套用前請自行檢查。
        </li>
      </ul>
    </LegalNote>
  </div>
</template>
