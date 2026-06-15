<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <!-- 頁首 -->
    <header class="sticky top-0 z-20 border-b border-line bg-paper/80 backdrop-blur-md">
      <div class="mx-auto flex max-w-5xl items-center justify-between px-5 py-3.5">
        <RouterLink to="/" class="flex items-center gap-2.5 group">
          <span class="text-2xl">🧰</span>
          <span class="text-xl font-black tracking-tight text-ink-900">
            Tool<span class="text-brand-600">Hub</span>
          </span>
        </RouterLink>
        <nav class="flex items-center gap-1 text-sm font-medium">
          <RouterLink
            to="/"
            class="rounded-lg px-3 py-2 text-ink-700 transition hover:bg-brand-50 hover:text-brand-700"
            active-class="!bg-brand-100 !text-brand-800"
          >
            工具總覽
          </RouterLink>
          <RouterLink
            to="/downloads"
            class="rounded-lg px-3 py-2 text-ink-700 transition hover:bg-brand-50 hover:text-brand-700"
            active-class="!bg-brand-100 !text-brand-800"
          >
            下載中心
          </RouterLink>
        </nav>
      </div>
    </header>

    <!-- 主內容 -->
    <main class="mx-auto w-full max-w-5xl flex-1 px-5 py-8">
      <RouterView v-slot="{ Component }">
        <Transition name="fade" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>

    <!-- 頁尾 -->
    <footer class="border-t border-line">
      <div class="mx-auto max-w-5xl px-5 py-6 text-center text-sm text-ink-500">
        <p>ToolHub · 給自己與家人朋友的實用工具站</p>
        <p class="mt-1 text-xs">
          所有計算都在你的瀏覽器完成,不會上傳任何資料。計算結果僅供參考,實際請以主管機關規定為準。
        </p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.fade-leave-to {
  opacity: 0;
}
</style>
