<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'

/*
  推薦好站 —— 人工策展的可信清單。延續下載中心模式:
  資料放 public/data/picks.json,執行時 fetch,容錯(載入/暫缺)。
  價值不在「列出網站」(google 都有),而在乾淨、無廣告、每個連結都指向
  官方網址,並偏重防詐/查證等「難找乾淨來源」的好站,給家人朋友一份信得過的口袋名單。
*/
interface Pick {
  id: string
  name: string
  category: string
  icon: string
  url: string
  tag: string
  note: string
}
interface Data {
  updated: string
  picks: Pick[]
}

const data = ref<Data | null>(null)
const status = ref<'loading' | 'ready' | 'error'>('loading')
const keyword = ref('')

onMounted(async () => {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/picks.json`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (!json || !Array.isArray(json.picks)) throw new Error('資料格式不符')
    data.value = json
    status.value = 'ready'
  } catch {
    data.value = null
    status.value = 'error'
  }
})

const filtered = computed(() => {
  const all = data.value?.picks ?? []
  const k = keyword.value.trim().toLowerCase()
  if (!k) return all
  return all.filter(
    (p) =>
      p.name.toLowerCase().includes(k) ||
      p.category.toLowerCase().includes(k) ||
      p.note.toLowerCase().includes(k),
  )
})

const grouped = computed(() => {
  const map = new Map<string, Pick[]>()
  for (const p of filtered.value) {
    if (!map.has(p.category)) map.set(p.category, [])
    map.get(p.category)!.push(p)
  }
  return Array.from(map.entries())
})

// 連結顯示用:取出主網域,讓使用者點之前先「認明網址」(防詐習慣)
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
</script>

<template>
  <div>
    <nav class="mb-4 flex items-center gap-1.5 text-sm text-ink-500">
      <RouterLink to="/" class="hover:text-brand-700">首頁</RouterLink>
      <span>›</span>
      <span class="text-ink-700">推薦好站</span>
    </nav>

    <header class="mb-6 flex items-start gap-4">
      <span class="text-4xl">⭐</span>
      <div>
        <h1 class="text-2xl font-black text-ink-900">推薦好站</h1>
        <p class="mt-1 text-ink-500">
          人工挑選、<strong>真的好用又免費</strong>的網站與服務,每個連結都指向官方網址。
          給家人朋友一份信得過的口袋名單。
        </p>
      </div>
    </header>

    <div class="mb-6 rounded-2xl border border-brand-200 bg-brand-50/60 p-5">
      <div class="flex items-center gap-2 font-semibold text-ink-900">
        <span>🤝</span><span>這份清單為什麼可以信?</span>
      </div>
      <ul class="mt-2 space-y-1 text-sm leading-relaxed text-ink-700">
        <li>· 一筆一筆人工挑過,只收<strong>正派、好用、免費(或有夠用的免費版)</strong>的服務。</li>
        <li>· 連結全部指向<strong>官方網址</strong>,不經過導購或來路不明的轉址,也沒有廣告。</li>
        <li>· 特別收錄<strong>防詐與查證</strong>的好站 —— 這類乾淨可信的來源最難找,卻最該分享給長輩。</li>
      </ul>
      <RouterLink
        to="/tools/link-check"
        class="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
      >
        🛡️ 點別人傳來的連結前,先用「可疑網址檢查器」查一下 →
      </RouterLink>
    </div>

    <!-- 載入中 -->
    <div v-if="status === 'loading'" class="card p-8 text-center text-ink-500">載入中…</div>

    <!-- 資料暫缺(容錯:不讓整頁壞掉) -->
    <div v-else-if="status === 'error'" class="card p-8 text-center">
      <div class="text-4xl">📡</div>
      <p class="mt-3 font-semibold text-ink-700">推薦清單暫時載入不到</p>
      <p class="mt-1 text-sm text-ink-500">可能是網路問題,請稍後重新整理。</p>
    </div>

    <template v-else>
      <!-- 搜尋 -->
      <div class="relative mb-6">
        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-ink-300" aria-hidden="true">🔍</span>
        <input
          v-model="keyword"
          type="text"
          placeholder="搜尋,例:翻譯、AI、查證、修圖…"
          aria-label="搜尋推薦網站"
          class="w-full rounded-2xl border border-line bg-white py-3 pl-12 pr-4 text-base shadow-sm outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
        />
      </div>

      <div v-if="!grouped.length" class="card p-8 text-center text-ink-500">
        找不到「{{ keyword }}」相關的網站,換個關鍵字試試。
      </div>

      <section v-for="[cat, items] in grouped" :key="cat" class="mt-8">
        <h2 class="mb-3 text-lg font-bold text-ink-900">{{ cat }}</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <a
            v-for="p in items"
            :key="p.id"
            :href="p.url"
            target="_blank"
            rel="noopener noreferrer"
            class="card group flex flex-col p-5 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
          >
            <div class="flex items-center gap-3">
              <span class="text-3xl">{{ p.icon }}</span>
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-ink-900 group-hover:text-brand-700">{{ p.name }}</span>
                  <span class="shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-700">{{ p.tag }}</span>
                </div>
                <div class="truncate text-xs text-ink-400">{{ hostOf(p.url) }}</div>
              </div>
            </div>
            <p class="mt-2 flex-1 text-sm leading-relaxed text-ink-500">{{ p.note }}</p>
            <span class="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
              前往官方網站 ↗
            </span>
          </a>
        </div>
      </section>

      <p class="mt-8 text-center text-xs text-ink-500">
        清單最後更新:{{ data?.updated }} · 連結皆指向官方網站 · 服務內容與收費以官方公告為準
      </p>
    </template>
  </div>
</template>
