import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { tools } from '@/config/tools.config'

/*
  路由由 tools.config 動態產生 —— 新增工具不必改這裡。
  用 hash history 讓 GitHub Pages / 靜態空間直接可用,免伺服器 rewrite 設定。
*/
const toolRoutes: RouteRecordRaw[] = tools.map((tool) => ({
  path: `/tools/${tool.id}`,
  name: tool.id,
  component: () => import('@/views/ToolPage.vue'),
  props: { toolId: tool.id },
}))

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: () => import('@/views/Home.vue') },
  { path: '/downloads', name: 'downloads', component: () => import('@/views/Downloads.vue') },
  ...toolRoutes,
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})
