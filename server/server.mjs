// ToolHub 後端 —— 同時做兩件事:
//  1. 提供前端靜態檔(../dist),含 SPA fallback
//  2. /api/chat 代理到 Claude API(金鑰只在後端 env,前端永遠看不到)
//     並開啟 web_search 工具 → 助手能讀網路即時資訊,這是「只有我這能做」的核心。
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../dist', import.meta.url))
const PORT = Number(process.env.PORT) || 8080
const API_KEY = process.env.ANTHROPIC_API_KEY || ''
const MODEL = process.env.MODEL || 'claude-opus-4-8'

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2',
}

const SYSTEM = `你是 ToolHub 助手,服務台灣使用者。你的價值是「幫使用者把事真正辦成」——
理解他們的真實意圖、必要時用 web_search 查最新且在地的資訊、跨來源彙整,給出具體、可執行、客製化的結果,
而不是泛泛而談。回答用繁體中文、條理清楚、直接給重點與步驟。
遇到需要即時或在地資訊(價格、推薦、活動、版本、新聞、哪個 app/遊戲好)時,主動搜尋再回答,並附上來源。
誠實:不確定就說不確定;涉及法律、醫療、金錢的重大決定提醒使用者向專業/官方查證。`

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers })
  res.end(typeof body === 'string' ? body : JSON.stringify(body))
}

async function callClaude(messages) {
  // server-side 工具(web_search)會自動執行;若回 pause_turn 就續傳。
  let convo = messages
  for (let i = 0; i < 5; i++) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM,
        messages: convo,
        tools: [{ type: 'web_search_20260209', name: 'web_search' }],
      }),
    })
    if (!r.ok) {
      const errText = await r.text()
      throw new Error(`Claude API ${r.status}: ${errText.slice(0, 300)}`)
    }
    const data = await r.json()
    if (data.stop_reason === 'pause_turn') {
      convo = [...convo, { role: 'assistant', content: data.content }]
      continue
    }
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim()
    return { text, model: data.model }
  }
  return { text: '(搜尋步驟過多,請換個說法再試一次)', model: MODEL }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (c) => {
      raw += c
      if (raw.length > 1_000_000) reject(new Error('too large'))
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'))
      } catch {
        reject(new Error('invalid json'))
      }
    })
  })
}

async function serveStatic(req, res) {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0])
  let filePath = normalize(join(ROOT, urlPath))
  if (!filePath.startsWith(ROOT)) return send(res, 403, { error: 'forbidden' })
  try {
    const s = await stat(filePath)
    if (s.isDirectory()) filePath = join(filePath, 'index.html')
    const buf = await readFile(filePath)
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' })
    res.end(buf)
  } catch {
    // SPA fallback
    try {
      const buf = await readFile(join(ROOT, 'index.html'))
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(buf)
    } catch {
      send(res, 404, { error: 'not found' })
    }
  }
}

const server = createServer(async (req, res) => {
  if (req.url === '/api/health') return send(res, 200, { ok: true, configured: !!API_KEY, model: MODEL })

  if (req.url === '/api/chat' && req.method === 'POST') {
    if (!API_KEY) return send(res, 503, { error: '後端尚未設定 ANTHROPIC_API_KEY' })
    try {
      const body = await readJsonBody(req)
      const messages = Array.isArray(body.messages) ? body.messages : []
      if (!messages.length) return send(res, 400, { error: 'messages 不可為空' })
      const out = await callClaude(messages)
      return send(res, 200, out)
    } catch (e) {
      return send(res, 500, { error: String(e?.message || e) })
    }
  }

  return serveStatic(req, res)
})

server.listen(PORT, () => {
  console.log(`ToolHub 後端啟動於 :${PORT}  (AI ${API_KEY ? '已設定' : '未設定金鑰'}, model=${MODEL})`)
})
