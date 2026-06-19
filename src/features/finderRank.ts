/*
  關鍵字導引 / 搜尋的純比對引擎 —— 無 Vue/config 相依,可在 Node 直接測。
  finder.ts 注入完整工具清單(含下載中心、推薦好站虛擬項)後呼叫此處,讓排序邏輯獨立可測。
  分數設計:整句命中關鍵字最強(+5),其後逐詞 名稱(+4) > 關鍵字(+2) > 說明(+1)。
*/
export interface RankItem {
  name: string
  description: string
  keywords: string[]
}
export interface RankedMatch<T> {
  tool: T
  score: number
}

export function rankTools<T extends RankItem>(query: string, list: T[]): RankedMatch<T>[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const terms = q.split(/\s+/).filter(Boolean)

  return list
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
