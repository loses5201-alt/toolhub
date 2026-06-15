// 與後端 /api/chat 溝通(後端再代理到 Claude API + 網路搜尋)。
// 前端不碰金鑰。後端未設定時會回 503,介面顯示設定提示。
export interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
}

export async function checkBackend(): Promise<{ configured: boolean; model?: string }> {
  try {
    const res = await fetch('/api/health')
    if (!res.ok) return { configured: false }
    return await res.json()
  } catch {
    return { configured: false }
  }
}

export async function sendChat(messages: ChatMsg[]): Promise<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `伺服器錯誤(${res.status})`)
  }
  return data.text || '(沒有收到回覆)'
}
