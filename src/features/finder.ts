import { tools, type ToolDef } from '@/config/tools.config'
import { rankTools } from './finderRank'

/*
  關鍵字導引 / 搜尋的比對引擎(第一版,免 LLM)。
  讀的就是 tools.config 的 keywords —— 單一事實來源。
  排序邏輯抽到 finderRank.ts(純函式可測);這裡只負責注入完整工具清單。
  未來要升級成語意理解,只換 finderRank 的內部實作,資料不動。
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

/*
  推薦好站同樣是「頁面」而非工具元件。使用者打「推薦網站」「免費 AI」「查證謠言」
  等可導向 /picks。Home.vue 特別處理 id === 'picks-center' 的路由。
*/
const picksCenter: ToolDef = {
  id: 'picks-center',
  name: '推薦好站',
  category: 'picks',
  description: '人工挑選、好用又免費的網站:AI 助手、翻譯學習、修圖設計、防詐查證,連結皆指向官方。',
  keywords: [
    '推薦', '好站', '網站', '免費', '好用', 'ai', '人工智慧', '聊天機器人', 'chatgpt',
    'claude', 'gemini', '翻譯', 'deepl', '修圖', '設計', 'canva', '圖庫', '查證', '闢謠',
    '事實查核', '謠言', '假消息', '辭典', '學習', '可汗', '維基百科', '氣象', '地圖',
  ],
  icon: '⭐',
  loader: () => Promise.reject(new Error('picks-center 是頁面,不應被載入為元件')),
}

export function findTools(query: string): Match[] {
  return rankTools(query, [...tools, downloadCenter, picksCenter])
}
