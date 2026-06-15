<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import { categories } from '@/config/categories'
import { toolsByCategory, toolMap } from '@/config/tools.config'
import { findTools } from '@/features/finder'
import { recentIds } from '@/features/recentTools'

// 關鍵字導引:打白話 → 推薦工具
const query = ref('')
const matches = computed(() => findTools(query.value))
const suggestions = ['資遣費', '特休還有幾天', 'LINE 下載', '加班費', '民國幾年']

// 最近使用的工具(置頂,長輩友善);至少 2 個才顯示,避免只剩 1 個時佔版面
const recentTools = computed(() =>
  recentIds.value.map((id) => toolMap[id]).filter((t) => t != null),
)
</script>

<template>
  <div>
    <!-- Hero + 關鍵字導引 -->
    <section class="text-center py-6 sm:py-10">
      <h1 class="text-3xl sm:text-4xl font-black tracking-tight text-ink-900">
        需要什麼,<span class="text-brand-600">直接說</span>
      </h1>
      <p class="mt-3 text-lg text-ink-500 max-w-xl mx-auto">
        台灣在地的實用計算工具,乾淨、不上傳、好用。給自己,也給家人朋友。
      </p>

      <div class="mt-6 max-w-xl mx-auto">
        <div class="relative">
          <span class="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-ink-300">🔍</span>
          <input
            v-model="query"
            type="text"
            placeholder="試試:我想算特休、被資遣可以拿多少、LINE 在哪下載…"
            class="w-full rounded-2xl border border-line bg-white py-4 pl-12 pr-4 text-lg shadow-sm outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
          />
        </div>

        <!-- 範例提示 -->
        <div v-if="!query" class="mt-3 flex flex-wrap justify-center gap-2">
          <button
            v-for="s in suggestions"
            :key="s"
            class="rounded-full border border-line bg-white px-3 py-1.5 text-sm text-ink-700 transition hover:border-brand-300 hover:text-brand-700"
            @click="query = s"
          >
            {{ s }}
          </button>
        </div>

        <!-- 導引結果 -->
        <div v-else class="mt-3 text-left">
          <template v-if="matches.length">
            <p class="px-1 pb-2 text-sm text-ink-500">
              我猜你想找這個 👇
            </p>
            <div class="space-y-2">
              <RouterLink
                v-for="m in matches.slice(0, 4)"
                :key="m.tool.id"
                :to="m.tool.id === 'download-center' ? '/downloads' : `/tools/${m.tool.id}`"
                class="card flex items-center gap-4 p-4 transition hover:border-brand-300 hover:shadow-md"
              >
                <span class="text-2xl">{{ m.tool.icon }}</span>
                <div class="min-w-0">
                  <div class="font-semibold text-ink-900">{{ m.tool.name }}</div>
                  <div class="truncate text-sm text-ink-500">{{ m.tool.description }}</div>
                </div>
                <span class="ml-auto text-brand-600">→</span>
              </RouterLink>
            </div>
          </template>
          <div v-else class="card p-5 text-center text-ink-500">
            找不到對應的工具 😅 換個說法,或看看下面的分類。
          </div>
        </div>
      </div>
    </section>

    <!-- 最近使用(置頂,長輩友善) -->
    <section v-if="!query && recentTools.length >= 2" class="mt-8">
      <h2 class="mb-4 text-xl font-bold text-ink-900">
        <span class="mr-1">🕘</span>最近使用
      </h2>
      <div class="flex flex-wrap gap-2.5">
        <RouterLink
          v-for="tool in recentTools"
          :key="tool.id"
          :to="`/tools/${tool.id}`"
          class="flex items-center gap-2 rounded-2xl border border-line bg-white px-4 py-2.5 text-base font-medium text-ink-800 shadow-sm transition hover:border-brand-300 hover:text-brand-700"
        >
          <span class="text-xl">{{ tool.icon }}</span>{{ tool.name }}
        </RouterLink>
      </div>
    </section>

    <!-- 分類 + 工具卡片 -->
    <section
      v-for="cat in categories"
      :key="cat.id"
      class="mt-10"
    >
      <div class="mb-4 flex flex-col sm:flex-row sm:items-baseline sm:gap-3">
        <h2 class="text-xl font-bold text-ink-900 whitespace-nowrap">
          <span class="mr-1">{{ cat.icon }}</span>{{ cat.name }}
        </h2>
        <p class="text-sm text-ink-500">{{ cat.description }}</p>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <RouterLink
          v-for="tool in toolsByCategory(cat.id)"
          :key="tool.id"
          :to="`/tools/${tool.id}`"
          class="card group p-5 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
        >
          <div class="text-3xl">{{ tool.icon }}</div>
          <div class="mt-3 font-bold text-ink-900 group-hover:text-brand-700">
            {{ tool.name }}
          </div>
          <div class="mt-1 text-sm leading-relaxed text-ink-500">
            {{ tool.description }}
          </div>
        </RouterLink>
      </div>
    </section>

    <!-- 下載中心入口 -->
    <section class="mt-12">
      <RouterLink
        to="/downloads"
        class="card flex flex-col sm:flex-row items-start sm:items-center gap-4 p-6 transition hover:border-brand-300 hover:shadow-md"
      >
        <div class="text-4xl">🛡️</div>
        <div class="flex-1">
          <div class="text-lg font-bold text-ink-900">防詐騙下載中心</div>
          <div class="mt-1 text-sm text-ink-500">
            常用軟體的官方下載連結,無廣告、保證來源、附版本資訊。
            給家裡長輩裝軟體時,從這裡點最安心,不怕點到假網站。
          </div>
        </div>
        <span class="btn-primary">前往看看</span>
      </RouterLink>
    </section>
  </div>
</template>
