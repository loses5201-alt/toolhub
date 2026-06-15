import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { tools, toolMap } from '@/config/tools.config'
import { setMeta } from '@/utils/meta'

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
  { path: '/assist', name: 'assist', component: () => import('@/views/Assist.vue') },
  { path: '/downloads', name: 'downloads', component: () => import('@/views/Downloads.vue') },
  { path: '/picks', name: 'picks', component: () => import('@/views/Picks.vue') },
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

// 依路由動態設定標題與描述(SEO / 分享預覽 / 書籤辨識)
router.afterEach((to) => {
  const tool = typeof to.name === 'string' ? toolMap[to.name] : undefined
  if (tool) {
    setMeta(tool.name, tool.description)
  } else if (to.name === 'downloads') {
    setMeta('防詐騙下載中心', '常用軟體的官方下載連結,保證官方來源、無廣告、附校驗碼,長輩也安心。')
  } else if (to.name === 'picks') {
    setMeta('推薦好站', '人工挑選、真的好用又免費的網站與服務,連結皆指向官方網址,含防詐查證好站。')
  } else if (to.name === 'home') {
    setMeta('所有工具', '台灣在地實用工具與防詐騙工具一覽。')
  } else {
    setMeta()
  }
})
