<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'

interface Software {
  id: string
  name: string
  category: string
  icon: string
  official: string
  download: string
  version?: string
  note: string
}
interface Data {
  updated: string
  software: Software[]
}

const data = ref<Data | null>(null)
const status = ref<'loading' | 'ready' | 'error'>('loading')
const keyword = ref('')

onMounted(async () => {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/software.json`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (!json || !Array.isArray(json.software)) throw new Error('資料格式不符')
    data.value = json
    status.value = 'ready'
  } catch {
    data.value = null
    status.value = 'error'
  }
})

const filtered = computed(() => {
  const all = data.value?.software ?? []
  const k = keyword.value.trim().toLowerCase()
  if (!k) return all
  return all.filter(
    (s) =>
      s.name.toLowerCase().includes(k) ||
      s.category.toLowerCase().includes(k) ||
      s.note.toLowerCase().includes(k),
  )
})

const grouped = computed(() => {
  const map = new Map<string, Software[]>()
  for (const s of filtered.value) {
    if (!map.has(s.category)) map.set(s.category, [])
    map.get(s.category)!.push(s)
  }
  return Array.from(map.entries())
})
</script>

<template>
  <div>
    <nav class="mb-4 flex items-center gap-1.5 text-sm text-ink-500">
      <RouterLink to="/" class="hover:text-brand-700">首頁</RouterLink>
      <span>›</span>
      <span class="text-ink-700">下載中心</span>
    </nav>

    <header class="mb-6 flex items-start gap-4">
      <span class="text-4xl">🛡️</span>
      <div>
        <h1 class="text-2xl font-black text-ink-900">防詐騙下載中心</h1>
        <p class="mt-1 text-ink-500">
          常用軟體的<strong>官方</strong>下載連結,無廣告、保證來源。給長輩裝軟體時從這裡點最安心。
        </p>
      </div>
    </header>

    <div class="mb-6 rounded-2xl border border-accent/30 bg-accent/5 p-5">
      <div class="flex items-center gap-2 font-semibold text-ink-900">
        <span>⚠️</span><span>為什麼要從這裡下載?</span>
      </div>
      <p class="mt-2 text-sm leading-relaxed text-ink-700">
        在搜尋引擎打「LINE 下載」「Zoom 下載」,第一頁常出現假下載站、廣告農場、夾帶惡意程式的釣魚連結,長輩一裝就中招。這裡每個連結都指向軟體的官方網站,認明網域就能避開大多數陷阱。
      </p>
      <RouterLink
        to="/tools/link-check"
        class="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
      >
        🛡️ 收到可疑連結?用「可疑網址檢查器」先查一下 →
      </RouterLink>
    </div>

    <!-- 載入中 -->
    <div v-if="status === 'loading'" class="card p-8 text-center text-ink-500">載入中…</div>

    <!-- 資料暫缺(容錯:不讓整頁壞掉,並提醒安全要點) -->
    <div v-else-if="status === 'error'" class="card p-8 text-center">
      <div class="text-4xl">📡</div>
      <p class="mt-3 font-semibold text-ink-700">下載清單暫時載入不到</p>
      <p class="mt-1 text-sm text-ink-500">
        可能是網路問題,請稍後重新整理。在此期間,請務必只從各軟體的<strong>官方網站</strong>下載,
        不要點搜尋結果的廣告或來路不明的下載站。
      </p>
    </div>

    <template v-else>
      <!-- 搜尋(項目多,方便長輩快速找到) -->
      <div class="relative mb-6">
        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-ink-300" aria-hidden="true">🔍</span>
        <input
          v-model="keyword"
          type="text"
          placeholder="搜尋軟體名稱,例:LINE、瀏覽器、解壓縮…"
          aria-label="搜尋軟體"
          class="w-full rounded-2xl border border-line bg-white py-3 pl-12 pr-4 text-base shadow-sm outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
        />
      </div>

      <div v-if="!grouped.length" class="card p-8 text-center text-ink-500">
        找不到「{{ keyword }}」相關的軟體,換個關鍵字試試。
      </div>

      <section v-for="[cat, items] in grouped" :key="cat" class="mt-8">
        <h2 class="mb-3 text-lg font-bold text-ink-900">{{ cat }}</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <div v-for="s in items" :key="s.id" class="card p-5">
            <div class="flex items-center gap-3">
              <span class="text-3xl">{{ s.icon }}</span>
              <div>
                <div class="font-bold text-ink-900">{{ s.name }}</div>
                <div v-if="s.version" class="text-xs text-brand-700">最新版本 {{ s.version }}</div>
              </div>
            </div>
            <p class="mt-2 text-sm text-ink-500">{{ s.note }}</p>
            <div class="mt-4 flex items-center gap-2">
              <a :href="s.download" target="_blank" rel="noopener noreferrer" class="btn-primary text-base !py-2.5">
                前往官方下載 ↗
              </a>
              <a :href="s.official" target="_blank" rel="noopener noreferrer" class="text-sm text-ink-500 underline hover:text-brand-700">
                官網
              </a>
            </div>
          </div>
        </div>
      </section>

      <p class="mt-8 text-center text-xs text-ink-500">
        清單最後更新:{{ data?.updated }} · 連結皆指向各軟體官方網站
      </p>
    </template>
  </div>
</template>
