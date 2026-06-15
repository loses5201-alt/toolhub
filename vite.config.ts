import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

// Vite 設定:Vue + Tailwind v4 + PWA(可加到主畫面、離線可用)
// 部署到 GitHub Pages 專案頁(user.github.io/toolhub)時 base 用 /toolhub/;
// 若改部署到根網域或 Netlify,把 base 改成 '/' 即可。
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/toolhub/' : '/',
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'ToolHub 實用工具站',
        short_name: 'ToolHub',
        description: '台灣在地實用計算工具與防詐騙下載中心。乾淨、不上傳、好用。',
        theme_color: '#137c66',
        background_color: '#faf8f3',
        display: 'standalone',
        lang: 'zh-Hant',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
}))
