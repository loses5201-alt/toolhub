<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import { formatGraphql, minifyGraphql } from '@/features/graphqlFormat'

/*
  GraphQL 格式化 / 壓縮 —— 把雜亂的 query / mutation / SDL 排整齊(2 空白縮排),
  或壓成一行。支援片段、變數、指令、SDL(type / enum / input / union / 等)。
  全程在你的瀏覽器解析,GraphQL 查詢常含後端結構與變數,不上傳、無廣告。
*/

const SAMPLE = `query Hero($episode:Episode,$withFriends:Boolean!){
hero(episode:$episode){name ...HeroFields friends @include(if:$withFriends){name}}}
fragment HeroFields on Character{id appearsIn}`

const input = ref('')
const mode = ref<'pretty' | 'minify'>('pretty')

const result = computed<{ ok: boolean; output: string; error: string }>(() => {
  if (!input.value.trim()) return { ok: true, output: '', error: '' }
  try {
    const output = mode.value === 'pretty' ? formatGraphql(input.value) : minifyGraphql(input.value)
    return { ok: true, output, error: '' }
  } catch (e) {
    return { ok: false, output: '', error: (e as Error).message }
  }
})

const stats = computed(() => {
  const inLen = new TextEncoder().encode(input.value).length
  const outLen = new TextEncoder().encode(result.value.output).length
  return { inLen, outLen }
})

const copied = ref(false)
function copyOut() {
  if (!result.value.output) return
  navigator.clipboard?.writeText(result.value.output)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

function download() {
  if (!result.value.output) return
  const blob = new Blob([result.value.output], { type: 'application/graphql' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = mode.value === 'minify' ? 'query.min.graphql' : 'query.graphql'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div class="flex flex-wrap items-center gap-3">
        <div class="inline-flex rounded-lg border border-ink-200 p-0.5 text-sm">
          <button
            type="button"
            class="rounded-md px-3 py-1 transition"
            :class="mode === 'pretty' ? 'bg-brand-600 text-white' : 'text-ink-600 hover:bg-ink-50'"
            @click="mode = 'pretty'"
          >
            美化
          </button>
          <button
            type="button"
            class="rounded-md px-3 py-1 transition"
            :class="mode === 'minify' ? 'bg-brand-600 text-white' : 'text-ink-600 hover:bg-ink-50'"
            @click="mode = 'minify'"
          >
            壓縮
          </button>
        </div>
        <button type="button" class="text-sm text-brand-700 underline hover:text-brand-800" @click="input = SAMPLE">
          載入範例
        </button>
        <button
          v-if="input"
          type="button"
          class="text-sm text-ink-500 underline hover:text-ink-700"
          @click="input = ''"
        >
          清空
        </button>
      </div>

      <div>
        <label class="field-label" for="gql-in">貼上 GraphQL(query / mutation / subscription / fragment / SDL)</label>
        <textarea
          id="gql-in"
          v-model="input"
          rows="9"
          class="field-input font-mono text-xs"
          spellcheck="false"
          placeholder="query { user(id: 4) { name email } }"
        />
      </div>

      <p v-if="!result.ok" class="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-sm text-rose-700">
        ⚠️ 無法解析:{{ result.error }}
      </p>
    </div>

    <div v-if="result.ok && result.output" class="card p-4 space-y-3">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span class="font-semibold text-ink-700">{{ mode === 'pretty' ? '美化結果' : '壓縮結果' }}</span>
        <span class="text-xs text-ink-400">{{ stats.inLen }} → {{ stats.outLen }} bytes</span>
        <button class="ml-auto text-sm text-brand-700 underline hover:text-brand-800" @click="copyOut">
          {{ copied ? '已複製 ✓' : '複製' }}
        </button>
        <button class="btn-primary px-3 py-1 text-sm" @click="download">下載 .graphql</button>
      </div>
      <textarea
        :value="result.output"
        rows="12"
        readonly
        class="field-input font-mono text-xs"
        spellcheck="false"
      />
    </div>

    <div class="text-sm text-ink-500">
      需要把 API 回應的 JSON 排整齊?用
      <RouterLink to="/tools/json-repair" class="font-semibold text-brand-700 underline hover:text-brand-800">JSON 修復 / 美化</RouterLink>
      。要把 GraphQL 變數的 JSON 轉成型別?試試
      <RouterLink to="/tools/json-to-ts" class="font-semibold text-brand-700 underline hover:text-brand-800">JSON 轉 TypeScript</RouterLink>
      。
    </div>

    <LegalNote title="這個工具能、不能做什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>能</strong>:把 GraphQL 文件解析後重新排版 —— 支援 <code>query</code>/<code>mutation</code>/<code>subscription</code>、匿名簡寫、變數定義與預設值、引數、別名、指令、片段(<code>...Frag</code>)、行內片段(<code>... on Type</code>);以及 SDL 的 <code>type</code>/<code>interface</code>/<code>enum</code>/<code>input</code>/<code>union</code>/<code>scalar</code>/<code>schema</code>/<code>directive</code>。</li>
        <li><strong>美化</strong>用 2 空白縮排;<strong>壓縮</strong>去除多餘空白與換行,方便嵌進程式或縮短傳輸。</li>
        <li><strong>注意</strong>:依 GraphQL 慣例,<code>#</code> 註解不會保留;區塊字串 <code>"""…"""</code> 會統一輸出為雙引號字串。這是「格式整理」而非語法檢查,不會比對 schema 是否存在某欄位。</li>
        <li>全程<strong>在你的瀏覽器</strong>解析,內容<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
