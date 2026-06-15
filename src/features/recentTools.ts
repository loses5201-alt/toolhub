/*
  最近使用的工具(存 localStorage,純前端)。
  長輩友善:常用/剛用過的工具直接置頂,不必每次滑很久找。
  只記工具 id,不記任何使用內容(隱私)。
*/
import { ref } from 'vue'
import { toolMap } from '@/config/tools.config'

const KEY = 'toolhub.recentTools'
const MAX = 6

function load(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

// 響應式:多個元件共用同一份(首頁讀、ToolPage 寫)
export const recentIds = ref<string[]>(load())

/** 記錄一次工具使用,移到最前面,只保留存在於 config 的有效 id。 */
export function recordToolVisit(id: string) {
  if (!toolMap[id]) return
  const next = [id, ...recentIds.value.filter((x) => x !== id)]
    .filter((x) => toolMap[x])
    .slice(0, MAX)
  recentIds.value = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // localStorage 不可用(隱私模式等)時靜默忽略,不影響功能
  }
}
