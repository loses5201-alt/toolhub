<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { RouterLink } from 'vue-router'
import { toolMap } from '@/config/tools.config'
import { categoryMap } from '@/config/categories'

// 工具外框:統一的麵包屑 + 標題,內容由 tools.config 的 loader 動態載入
const props = defineProps<{ toolId: string }>()

const tool = computed(() => toolMap[props.toolId])
const category = computed(() =>
  tool.value ? categoryMap[tool.value.category] : undefined,
)

const ToolComponent = computed(() =>
  tool.value ? defineAsyncComponent(tool.value.loader) : undefined,
)
</script>

<template>
  <div v-if="tool">
    <!-- 麵包屑 -->
    <nav class="mb-4 flex items-center gap-1.5 text-sm text-ink-500">
      <RouterLink to="/" class="hover:text-brand-700">首頁</RouterLink>
      <span>›</span>
      <span v-if="category">{{ category.icon }} {{ category.name }}</span>
      <span>›</span>
      <span class="text-ink-700">{{ tool.name }}</span>
    </nav>

    <!-- 標題 -->
    <header class="mb-6 flex items-start gap-4">
      <span class="text-4xl">{{ tool.icon }}</span>
      <div>
        <h1 class="text-2xl font-black text-ink-900">{{ tool.name }}</h1>
        <p class="mt-1 text-ink-500">{{ tool.description }}</p>
      </div>
    </header>

    <component :is="ToolComponent" />
  </div>

  <div v-else class="card p-8 text-center text-ink-500">
    找不到這個工具。<RouterLink to="/" class="text-brand-600 underline">回首頁</RouterLink>
  </div>
</template>
