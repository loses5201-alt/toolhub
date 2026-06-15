import { tools, type ToolDef } from '@/config/tools.config'

/*
  關鍵字導引 / 搜尋的比對引擎(第一版,免 LLM)。
  讀的就是 tools.config 的 keywords —— 單一事實來源。
  未來要升級成語意理解,只換這個檔的內部實作,資料不動。
*/
export interface Match {
  tool: ToolDef
  score: number
}

/*
  下載中心是一個「頁面」而非工具元件,但使用者常打「LINE 下載」「安裝 chrome」
  來找它。這裡放一筆虛擬可搜尋項目(含常見軟體名),命中就導向 /downloads。
  Home.vue 已特別處理 id === 'download-center' 的路由。
*/
const downloadCenter: ToolDef = {
  id: 'download-center',
  name: '防詐騙下載中心',
  category: 'download',
  description: '常用軟體的官方下載連結,無廣告、保證來源,長輩裝軟體最安心。',
  keywords: [
    '下載', '安裝', '官方', '官網', '軟體', '免費', '正版', 'app', '應用程式',
    'line', 'zoom', 'teams', 'chrome', 'edge', 'firefox', 'discord', 'telegram',
    'whatsapp', 'signal', 'vlc', 'potplayer', 'spotify', 'obs', '解壓縮', '7zip',
    'winrar', 'teamviewer', 'anydesk', 'dropbox', 'pdf', 'acrobat', '報稅', '自然人憑證',
  ],
  icon: '🛡️',
  loader: () => Promise.reject(new Error('download-center 是頁面,不應被載入為元件')),
}

export function findTools(query: string): Match[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const terms = q.split(/\s+/).filter(Boolean)

  return [...tools, downloadCenter]
    .map((tool) => {
      let score = 0
      const name = tool.name.toLowerCase()
      const desc = tool.description.toLowerCase()
      const kws = tool.keywords.map((k) => k.toLowerCase())

      // 整句直接命中某個關鍵字(或反之):最強訊號
      for (const k of kws) {
        if (q.includes(k) || k.includes(q)) score += 5
      }
      // 逐詞比對
      for (const t of terms) {
        if (name.includes(t)) score += 4
        else if (kws.some((k) => k.includes(t))) score += 2
        else if (desc.includes(t)) score += 1
      }
      return { tool, score }
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
}
