// 工具分類定義 —— 與 tools.config 的 category 欄位對應
export interface Category {
  id: string
  name: string
  description: string
  icon: string
}

export const categories: Category[] = [
  {
    id: 'labor',
    name: '勞動權益',
    description: '依台灣勞基法/勞退條例試算,離職、加班、特休一次算清楚',
    icon: '⚖️',
  },
  {
    id: 'health-tax',
    name: '稅務與健保',
    description: '二代健保、稅務相關的在地計算',
    icon: '🏥',
  },
  {
    id: 'finance',
    name: '財務試算',
    description: '貸款、利息、退休金相關試算',
    icon: '💰',
  },
  {
    id: 'life',
    name: '生活實用',
    description: '發票對獎等日常會用到的小工具',
    icon: '🧾',
  },
  {
    id: 'datetime',
    name: '日期換算',
    description: '民國、西元、日本年號互換',
    icon: '📅',
  },
]

export const categoryMap: Record<string, Category> = Object.fromEntries(
  categories.map((c) => [c.id, c]),
)
