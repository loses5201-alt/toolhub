<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { generateMeta, parseMeta, metaWarnings, EMPTY_FIELDS, type OgFields } from '@/features/ogMeta'

/*
  Open Graph / SEO meta 標籤產生器 —— 填欄位產生標籤 + 社群預覽,或貼 HTML 反解析。
  全程在你的瀏覽器處理,不上傳。
*/

const fields = reactive<OgFields>({
  ...EMPTY_FIELDS,
  title: 'ToolHub — 台灣在地實用工具站',
  description: '資遣費、特休、加班費試算與防詐騙工具,全程在你瀏覽器處理,不上傳、無廣告。',
  url: 'https://example.com/',
  image: 'https://example.com/og-image.png',
  siteName: 'ToolHub',
  type: 'website',
})

const output = computed(() => generateMeta(fields))
const warnings = computed(() => metaWarnings(fields))
const copied = ref(false)

const host = computed(() => {
  const m = /^https?:\/\/([^/?#]+)/i.exec(fields.url)
  return m ? m[1] : fields.url
})

// 反解析
const importHtml = ref('')
const showImport = ref(false)
function doImport() {
  const f = parseMeta(importHtml.value)
  for (const k of Object.keys(EMPTY_FIELDS) as (keyof OgFields)[]) {
    if (f[k]) fields[k] = f[k]
  }
  showImport.value = false
}

async function copy() {
  try {
    await navigator.clipboard.writeText(output.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    /* 剪貼簿不可用 */
  }
}

const imageOk = ref(true)
watch(() => fields.image, () => (imageOk.value = true))
</script>

<template>
  <div class="space-y-6">
    <!-- 反解析入口 -->
    <div class="card p-4">
      <button type="button" class="text-sm text-brand-600 hover:underline" @click="showImport = !showImport">
        {{ showImport ? '收起' : '從現有 HTML 反向匯入 ▾' }}
      </button>
      <div v-if="showImport" class="mt-3 space-y-2">
        <textarea v-model="importHtml" rows="4" class="og-input font-mono" spellcheck="false" placeholder="貼上含 <meta> 的 HTML <head> 內容…" />
        <button type="button" class="rounded-lg bg-brand-600 px-3 py-1.5 text-sm text-white hover:bg-brand-700" @click="doImport">
          解析並填入欄位
        </button>
      </div>
    </div>

    <!-- 欄位 -->
    <div class="card p-5 grid gap-4 sm:grid-cols-2">
      <label class="block text-sm sm:col-span-2">
        <span class="text-ink-500">標題 title / og:title</span>
        <input v-model="fields.title" class="og-line" />
      </label>
      <label class="block text-sm sm:col-span-2">
        <span class="text-ink-500">描述 description</span>
        <textarea v-model="fields.description" rows="2" class="og-input" />
      </label>
      <label class="block text-sm">
        <span class="text-ink-500">網址 og:url</span>
        <input v-model="fields.url" class="og-line font-mono" />
      </label>
      <label class="block text-sm">
        <span class="text-ink-500">預覽圖 og:image</span>
        <input v-model="fields.image" class="og-line font-mono" />
      </label>
      <label class="block text-sm">
        <span class="text-ink-500">站名 og:site_name</span>
        <input v-model="fields.siteName" class="og-line" />
      </label>
      <label class="block text-sm">
        <span class="text-ink-500">類型 og:type</span>
        <input v-model="fields.type" class="og-line font-mono" list="og-types" />
        <datalist id="og-types"><option value="website" /><option value="article" /><option value="product" /><option value="profile" /></datalist>
      </label>
      <label class="block text-sm sm:col-span-2">
        <span class="text-ink-500">Twitter 卡片類型 twitter:card</span>
        <select v-model="fields.twitterCard" class="og-line">
          <option value="summary_large_image">summary_large_image(大圖)</option>
          <option value="summary">summary(小圖)</option>
        </select>
      </label>
    </div>

    <!-- 社群預覽 -->
    <div class="card p-5 space-y-2">
      <h3 class="text-sm font-semibold text-ink-700">分享預覽(示意)</h3>
      <div class="max-w-md overflow-hidden rounded-xl border border-ink-200">
        <div class="aspect-[1.91/1] bg-ink-100 flex items-center justify-center overflow-hidden">
          <img v-if="fields.image && imageOk" :src="fields.image" alt="og preview" class="h-full w-full object-cover" @error="imageOk = false" />
          <span v-else class="text-xs text-ink-400">{{ fields.image ? '圖片無法載入' : '無預覽圖' }}</span>
        </div>
        <div class="p-3 bg-white">
          <div class="text-xs uppercase text-ink-400">{{ host || 'example.com' }}</div>
          <div class="font-semibold text-ink-800 line-clamp-2">{{ fields.title || '(無標題)' }}</div>
          <div class="text-sm text-ink-500 line-clamp-2">{{ fields.description }}</div>
        </div>
      </div>
    </div>

    <!-- 警告 -->
    <div v-if="warnings.length" class="card p-5 space-y-1.5">
      <h3 class="text-sm font-semibold text-amber-700">建議</h3>
      <ul class="space-y-1 text-sm text-amber-700">
        <li v-for="(w, i) in warnings" :key="i">⚠️ {{ w }}</li>
      </ul>
    </div>

    <!-- 輸出 -->
    <div class="card p-5 space-y-2">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-ink-700">產生的 meta 標籤(貼進 &lt;head&gt;)</h3>
        <button type="button" class="rounded-lg border border-ink-200 px-3 py-1 text-sm text-ink-600 hover:bg-ink-50" @click="copy">
          {{ copied ? '已複製 ✓' : '複製' }}
        </button>
      </div>
      <pre class="og-out"><code>{{ output }}</code></pre>
    </div>

    <LegalNote>
      <strong>Open Graph</strong>(og:)是 Facebook、LINE、Slack、Discord 等在貼連結時顯示
      標題、描述、預覽大圖所讀的標準標籤;<strong>Twitter Card</strong>(twitter:)是 X 用的。
      把產生的標籤貼進網頁的 <code>&lt;head&gt;</code> 即可。預覽僅為示意,各平台實際呈現略有差異,
      且平台會「快取」舊資料(可用各家官方偵錯工具強制重抓)。og:image 請用完整絕對網址、建議
      1200×630。全程在你的瀏覽器處理,不連網、不上傳。
    </LegalNote>
  </div>
</template>

<style scoped>
.og-input,
.og-line {
  width: 100%;
  margin-top: 0.25rem;
  border: 1px solid var(--color-ink-200, #e2e8f0);
  border-radius: 0.5rem;
  padding: 0.45rem 0.625rem;
  font-size: 0.875rem;
  line-height: 1.5;
}
.og-input {
  resize: vertical;
}
.og-out {
  overflow-x: auto;
  border-radius: 0.5rem;
  background: var(--color-ink-50, #f8fafc);
  padding: 0.75rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.8125rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
