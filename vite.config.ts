import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

// Vite 設定:Vue + Tailwind v4 + PWA(可加到主畫面、離線可用)
// 部署到 GitHub Pages 專案頁(user.github.io/toolhub)時 base 用 /toolhub/;
// 若改部署到根網域或 Netlify,把 base 改成 '/' 即可。
export default defineConfig(() => ({
  // Docker 全端在根路徑 `/` 提供;GitHub Pages 由 deploy.yml 設 VITE_BASE=/toolhub/
  base: process.env.VITE_BASE ?? '/',
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
        // App 殼預快取(離線可開);資料 JSON 不預快取,改用 NetworkFirst 確保更新
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // 不把肥大的 PDF / Excel 函式庫(pdf-lib/pdfjs、SheetJS ≈ 1.3MB)塞進預快取,
        // 避免拖慢所有人的 PWA 安裝;改由下方 runtime 快取在實際用到時才存。
        globIgnores: ['**/pdf-vendor*.js', '**/sheet-vendor*.js', '**/exif-vendor*.js'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith('.json'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'toolhub-data',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            // 大型 JS/worker chunk(PDF 工坊):用過一次後離線也能再用
            urlPattern: ({ url }) => /\/assets\/.*\.(js|mjs)$/.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'toolhub-chunks',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // 把肥大的 PDF 函式庫拆成可辨識的固定檔名,方便 PWA 不預快取它
        manualChunks(id: string) {
          if (id.includes('node_modules/pdf-lib') || id.includes('node_modules/pdfjs-dist')) {
            return 'pdf-vendor'
          }
          // SheetJS(Excel 讀寫)同樣肥大,拆獨立 chunk + 不預快取
          if (id.includes('node_modules/xlsx')) {
            return 'sheet-vendor'
          }
          // exifr(EXIF 解析)~76KB,拆獨立 chunk + 不預快取(用到才載)
          if (id.includes('node_modules/exifr')) {
            return 'exif-vendor'
          }
        },
      },
    },
  },
}))
