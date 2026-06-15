<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { stepFont, canDecrease, canIncrease } from '@/features/fontScale'
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
        <div class="flex items-center gap-2 sm:gap-3">
          <!-- 字級切換(長輩友善) -->
          <div class="flex items-center rounded-lg border border-line bg-white" role="group" aria-label="調整字級">
            <button
              class="px-2.5 py-1.5 text-sm text-ink-600 transition hover:text-brand-700 disabled:opacity-30"
              :disabled="!canDecrease()"
              aria-label="縮小字級"
              @click="stepFont(-1)"
            >
              A−
            </button>
            <span class="border-x border-line px-2 py-1.5 text-xs text-ink-400 select-none">字</span>
            <button
              class="px-2.5 py-1.5 text-base font-semibold text-ink-700 transition hover:text-brand-700 disabled:opacity-30"
              :disabled="!canIncrease()"
              aria-label="放大字級"
              @click="stepFont(1)"
            >
              A+
            </button>
          </div>
          <nav class="flex items-center gap-1 text-sm font-medium">
            <RouterLink
              to="/"
              class="rounded-lg px-2.5 sm:px-3 py-2 text-ink-700 transition hover:bg-brand-50 hover:text-brand-700"
              active-class="!bg-brand-100 !text-brand-800"
            >
              工具
            </RouterLink>
            <RouterLink
              to="/downloads"
              class="rounded-lg px-2.5 sm:px-3 py-2 text-ink-700 transition hover:bg-brand-50 hover:text-brand-700"
              active-class="!bg-brand-100 !text-brand-800"
            >
              下載
            </RouterLink>
          </nav>
        </div>
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
