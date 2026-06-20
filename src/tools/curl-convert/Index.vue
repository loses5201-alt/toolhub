<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseCurl, toFetch, toPython, type CurlRequest } from '@/features/curlConvert'

/*
  curl 指令轉換 —— 把從瀏覽器 DevTools「Copy as cURL」或文件複製來的 curl,
  拆成 method / 網址 / 標頭 / body,並轉成 JavaScript fetch 與 Python requests。
  全程在你的瀏覽器解析,指令(可能含 token)不連網、不上傳。
*/

const input = ref(
  `curl -X POST 'https://api.example.com/v1/login' \\
  -H 'Content-Type: application/json' \\
  -H 'Accept: application/json' \\
  -d '{"username":"alice","password":"s3cret"}'`,
)
const target = ref<'fetch' | 'python'>('fetch')

const parsed = computed<CurlRequest | null>(() => {
  if (!input.value.trim()) return null
  try {
    return parseCurl(input.value)
  } catch {
    return null
  }
})

const output = computed(() => {
  if (!parsed.value) return ''
  return target.value === 'fetch' ? toFetch(parsed.value) : toPython(parsed.value)
})

const copied = ref(false)
function copy() {
  if (!output.value) return
  navigator.clipboard?.writeText(output.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

const methodColor: Record<string, string> = {
  GET: 'bg-emerald-100 text-emerald-700',
  POST: 'bg-amber-100 text-amber-700',
  PUT: 'bg-blue-100 text-blue-700',
  PATCH: 'bg-violet-100 text-violet-700',
  DELETE: 'bg-rose-100 text-rose-700',
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-3">
      <label class="field-label" for="curl-in">貼上 curl 指令</label>
      <textarea
        id="curl-in"
        v-model="input"
        rows="7"
        class="field-input font-mono text-xs leading-relaxed"
        spellcheck="false"
        placeholder="curl 'https://...' -H '...' -d '...'"
      />
      <p class="field-hint">
        小技巧:在 Chrome/Edge DevTools 的 Network 分頁對任一請求按右鍵 →「Copy as cURL」即可貼來這裡。全程在你瀏覽器解析,不上傳。
      </p>
    </div>

    <div v-if="parsed && parsed.url" class="card p-4 space-y-3">
      <h2 class="text-sm font-semibold text-ink-700">解析結果</h2>
      <div class="flex flex-wrap items-center gap-2 text-sm">
        <span
          class="rounded px-2 py-0.5 text-xs font-bold"
          :class="methodColor[parsed.method] ?? 'bg-ink-100 text-ink-700'"
          >{{ parsed.method }}</span
        >
        <span class="break-all font-mono text-ink-700">{{ parsed.url }}</span>
      </div>
      <div v-if="parsed.headers.length" class="space-y-1">
        <div class="text-xs font-medium text-ink-500">標頭</div>
        <table class="w-full text-left text-xs">
          <tbody>
            <tr v-for="([k, v], i) in parsed.headers" :key="i" class="border-b border-ink-100">
              <td class="py-1 pr-3 font-mono font-medium text-ink-600">{{ k }}</td>
              <td class="py-1 break-all font-mono text-ink-700">{{ v }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="parsed.auth" class="text-xs text-ink-600">
        基本認證:<span class="font-mono">{{ parsed.auth.user }} : ••••</span>
      </div>
      <div v-if="parsed.body !== null" class="space-y-1">
        <div class="text-xs font-medium text-ink-500">Body({{ parsed.bodyType }})</div>
        <pre class="overflow-x-auto rounded bg-ink-50 p-2 text-xs text-ink-700">{{ parsed.body }}</pre>
      </div>
      <div v-if="parsed.forms.length" class="space-y-1">
        <div class="text-xs font-medium text-ink-500">表單欄位(multipart)</div>
        <table class="w-full text-left text-xs">
          <tbody>
            <tr v-for="([k, v], i) in parsed.forms" :key="i" class="border-b border-ink-100">
              <td class="py-1 pr-3 font-mono font-medium text-ink-600">{{ k }}</td>
              <td class="py-1 break-all font-mono text-ink-700">{{ v }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="parsed.warnings.length" class="rounded-lg border border-amber-200 bg-amber-50/60 p-2 text-xs text-amber-800">
        <div v-for="(w, i) in parsed.warnings" :key="i">⚠️ {{ w }}</div>
      </div>
    </div>

    <div v-if="parsed && parsed.url" class="card p-4 space-y-3">
      <div class="flex items-center gap-2">
        <div class="inline-flex rounded-lg border border-ink-200 p-0.5 text-sm">
          <button
            type="button"
            class="rounded-md px-3 py-1 transition"
            :class="target === 'fetch' ? 'bg-brand-600 text-white' : 'text-ink-600'"
            @click="target = 'fetch'"
          >
            JavaScript fetch
          </button>
          <button
            type="button"
            class="rounded-md px-3 py-1 transition"
            :class="target === 'python' ? 'bg-brand-600 text-white' : 'text-ink-600'"
            @click="target = 'python'"
          >
            Python requests
          </button>
        </div>
        <button class="ml-auto text-sm text-brand-700 underline hover:text-brand-800" @click="copy">
          {{ copied ? '已複製 ✓' : '複製' }}
        </button>
      </div>
      <pre class="overflow-x-auto rounded-lg bg-ink-900 p-4 text-xs leading-relaxed text-ink-50"><code>{{ output }}</code></pre>
    </div>

    <div v-else-if="input.trim()" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
      ⚠️ 看起來不是有效的 curl 指令,或解析不到網址。
    </div>

    <LegalNote title="這個工具能、不能做什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>能</strong>:把 curl 拆成 method / 網址 / 標頭 / body / 認證,並轉成 <strong>JavaScript fetch</strong> 與 <strong>Python requests</strong> 程式碼。</li>
        <li><strong>支援</strong>:<code>-X</code>、<code>-H</code>、<code>-d</code> / <code>--data-raw</code> 等、<code>-F</code> 表單、<code>-u</code> 基本認證、<code>-G</code>(data 併入查詢字串)、<code>-A</code> / <code>-e</code> / <code>-b</code>;能處理單/雙引號與反斜線續行。</li>
        <li><strong>不能</strong>:檔案上傳的實際內容(<code>@file</code> 只保留標記)、<code>--data-urlencode</code> 的自動編碼、cookie jar 等進階行為;未支援的旗標會提示並略過。</li>
        <li>curl 指令常含 <strong>API token / 密碼</strong>,本工具全程<strong>在你的瀏覽器</strong>解析,<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
