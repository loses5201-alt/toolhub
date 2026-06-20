<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseRobots, isAllowed } from '@/features/robots'

/*
  robots.txt 測試器 —— 貼上 robots.txt,輸入網址與爬蟲 UA,判斷能否被抓取。
  依 Google 規範(最長匹配勝、同長 Allow 勝、* / $ 萬用字元)。全程在你瀏覽器,不上傳。
*/

const robotsText = ref(
  ['User-agent: *', 'Disallow: /admin/', 'Disallow: /*.json$', 'Allow: /admin/public', '', 'Sitemap: https://example.com/sitemap.xml'].join('\n'),
)
const url = ref('/admin/public/info')
const ua = ref('Googlebot')

const parsed = computed(() => parseRobots(robotsText.value))
const verdict = computed(() => isAllowed(parsed.value, ua.value, url.value))
</script>

<template>
  <div class="space-y-6">
    <div class="card p-5">
      <label class="block text-sm">
        <span class="text-ink-500">貼上 robots.txt 內容</span>
        <textarea v-model="robotsText" rows="10" class="rb-input font-mono" spellcheck="false" />
      </label>
    </div>

    <div class="card p-5 grid gap-4 sm:grid-cols-2">
      <label class="block text-sm">
        <span class="text-ink-500">要測試的網址 / 路徑</span>
        <input v-model="url" class="rb-line font-mono" spellcheck="false" placeholder="/path 或 https://site/path" />
      </label>
      <label class="block text-sm">
        <span class="text-ink-500">爬蟲 User-agent</span>
        <input v-model="ua" class="rb-line font-mono" spellcheck="false" placeholder="Googlebot" />
      </label>
    </div>

    <!-- 判定 -->
    <div
      class="card p-5 flex items-center gap-4"
      :class="verdict.allowed ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50'"
    >
      <span class="text-3xl">{{ verdict.allowed ? '✅' : '🚫' }}</span>
      <div>
        <div class="text-lg font-bold" :class="verdict.allowed ? 'text-emerald-700' : 'text-rose-700'">
          {{ verdict.allowed ? '允許抓取' : '禁止抓取' }}
        </div>
        <div class="text-sm text-ink-600">{{ verdict.reason }}</div>
        <div class="mt-1 text-xs text-ink-400">
          比對路徑:<span class="font-mono">{{ verdict.path }}</span>
          <template v-if="verdict.matchedAgents.length">
            · 套用群組 User-agent:<span class="font-mono">{{ verdict.matchedAgents.join(', ') }}</span>
          </template>
        </div>
      </div>
    </div>

    <!-- 解析結果 -->
    <div v-if="parsed.groups.length" class="card p-5 space-y-3">
      <h3 class="text-sm font-semibold text-ink-700">解析出的群組({{ parsed.groups.length }})</h3>
      <div v-for="(g, gi) in parsed.groups" :key="gi" class="rounded-lg border border-ink-100 p-3">
        <div class="text-sm font-medium text-ink-700">
          User-agent: <span class="font-mono">{{ g.agents.join(', ') || '(無)' }}</span>
          <span v-if="g.crawlDelay != null" class="ml-2 text-xs text-ink-400">Crawl-delay: {{ g.crawlDelay }}</span>
        </div>
        <ul class="mt-1.5 space-y-0.5 text-sm font-mono">
          <li v-for="(r, ri) in g.rules" :key="ri" :class="r.type === 'allow' ? 'text-emerald-700' : 'text-rose-700'">
            {{ r.type === 'allow' ? 'Allow' : 'Disallow' }}: {{ r.path || '(空 = 不限制)' }}
          </li>
        </ul>
        <p v-if="!g.rules.length" class="mt-1 text-xs text-ink-400">(此群組無規則)</p>
      </div>
    </div>

    <div v-if="parsed.sitemaps.length" class="card p-5 space-y-1.5">
      <h3 class="text-sm font-semibold text-ink-700">Sitemap</h3>
      <ul class="space-y-0.5 text-sm">
        <li v-for="(s, i) in parsed.sitemaps" :key="i" class="font-mono text-brand-600 break-all">{{ s }}</li>
      </ul>
    </div>

    <LegalNote>
      robots.txt 是放在網站根目錄、告訴搜尋引擎爬蟲哪些路徑可抓、哪些別抓的檔案。
      本工具依 <strong>Google 的比對規則</strong>判定:在符合該 User-agent 的群組裡,以
      <strong>最長(最具體)的規則</strong>勝出,同長度時 <code>Allow</code> 勝 <code>Disallow</code>;
      <code>*</code> 代表任意字元、<code>$</code> 代表結尾。
      注意各家爬蟲實作略有差異,且 robots.txt 只是「禮貌性」約定、不具強制力,
      不能用來保護機密(惡意爬蟲可無視)。全程在你的瀏覽器判讀,不連網、不上傳。
    </LegalNote>
  </div>
</template>

<style scoped>
.rb-input,
.rb-line {
  width: 100%;
  margin-top: 0.25rem;
  border: 1px solid var(--color-ink-200, #e2e8f0);
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  font-size: 0.8125rem;
  line-height: 1.55;
}
.rb-input {
  resize: vertical;
}
</style>
