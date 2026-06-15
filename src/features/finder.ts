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

export function findTools(query: string): Match[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const terms = q.split(/\s+/).filter(Boolean)

  return tools
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
