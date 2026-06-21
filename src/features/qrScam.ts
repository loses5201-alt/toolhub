/*
  QR 詐騙(quishing)安全檢查引擎 —— 純函式、無 DOM,可在 Node 測試。
  把掃到的 QR 內容判讀成類型(網址 / Wi-Fi / 付款 / 電話 / 簡訊 / 聯絡人 / 純文字),
  針對「掃 QR 被導去釣魚網站、連惡意 Wi-Fi、轉加密貨幣、發小額付費簡訊」等手法給警示與建議。
  網址部分直接複用 linkcheck 的 analyzeUrl(已有完整啟發式與回歸測試)。
*/
import { analyzeUrl, type Analysis } from './linkcheck'

export type QrKind = 'url' | 'wifi' | 'tel' | 'sms' | 'email' | 'geo' | 'contact' | 'crypto' | 'text'
export type QrLevel = 'danger' | 'warn' | 'safe' | 'info'

export interface QrFinding {
  level: 'danger' | 'warn' | 'ok' | 'info'
  text: string
}

export interface QrAnalysis {
  kind: QrKind
  level: QrLevel
  title: string
  detail: Record<string, string>
  url?: string
  urlAnalysis?: Analysis
  findings: QrFinding[]
  advice: string[]
}

// 解析 WIFI: / MECARD: 這類「鍵:值;」結構(簡易,不處理深層跳脫)
function parseKeyed(body: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of body.split(';')) {
    const idx = part.indexOf(':')
    if (idx > 0) out[part.slice(0, idx).toUpperCase()] = part.slice(idx + 1)
  }
  return out
}

function fromUrlLevel(a: Analysis): QrLevel {
  return a.level
}

const QUISHING = '這是 QR 詐騙(quishing)常見手法:詐騙集團把假冒的 QR 貼在停車繳費單、罰單、菜單、海報上,掃了就導去釣魚網站。'

export function analyzeQrContent(text: string): QrAnalysis {
  const raw = (text || '').trim()
  if (!raw) {
    return {
      kind: 'text',
      level: 'info',
      title: '空內容',
      detail: {},
      findings: [{ level: 'info', text: 'QR 沒有可讀內容。' }],
      advice: ['請確認圖片清晰、為完整的 QR code。'],
    }
  }
  const lower = raw.toLowerCase()

  // Wi-Fi
  if (lower.startsWith('wifi:')) {
    const f = parseKeyed(raw.slice(5))
    const enc = (f.T || 'nopass').toUpperCase()
    return {
      kind: 'wifi',
      level: 'warn',
      title: 'Wi-Fi 連線設定',
      detail: { '網路名稱 (SSID)': f.S || '(未提供)', 加密: enc === 'NOPASS' ? '無密碼(開放網路)' : enc, 密碼: f.P ? '(含密碼)' : '(無)' },
      findings: [
        { level: 'warn', text: '掃 QR 自動連 Wi-Fi:連到陌生網路時,你的連線可能被監看或被導到假網站。' },
        enc === 'NOPASS'
          ? { level: 'warn', text: '這是「無密碼」的開放網路,風險較高。' }
          : { level: 'ok', text: `使用 ${enc} 加密。` },
      ],
      advice: [
        '只連你信任的場所提供的 Wi-Fi;公共場所的 QR 可能被貼上假的。',
        '連上後若跳出要你輸入帳密、安裝「設定描述檔/憑證」的頁面,立刻停止。',
      ],
    }
  }

  // 加密貨幣付款
  if (/^(bitcoin|ethereum|litecoin|bitcoincash|dogecoin|tron|ripple):/i.test(raw)) {
    const addr = raw.split(/[:?]/)[1] || ''
    return {
      kind: 'crypto',
      level: 'danger',
      title: '加密貨幣付款',
      detail: { 幣別: lower.split(':')[0], 收款地址: addr || '(未提供)' },
      findings: [
        { level: 'danger', text: '這是要你把加密貨幣轉到某個錢包地址。加密貨幣交易「無法取消、無法退款」。' },
        { level: 'danger', text: '任何人要你掃 QR 轉加密貨幣(投資、解凍、保證金、客服退款),幾乎都是詐騙。' },
      ],
      advice: ['不要轉。沒有合法單位會用掃 QR 轉加密貨幣的方式收款。', '若已轉出,保留畫面證據並儘速報警 165。'],
    }
  }

  // 電話
  if (lower.startsWith('tel:')) {
    const num = raw.slice(4)
    return {
      kind: 'tel',
      level: 'warn',
      title: '撥打電話',
      detail: { 號碼: num },
      findings: [{ level: 'warn', text: '掃 QR 會帶你撥打這支電話,可能是高費率或假冒客服號碼。' }],
      advice: ['撥打前先確認號碼是否為官方公告的客服電話。', '對方若自稱客服要你「操作 ATM / 提供驗證碼」,是詐騙。'],
    }
  }

  // 簡訊
  if (lower.startsWith('smsto:') || lower.startsWith('sms:')) {
    const body = raw.slice(raw.indexOf(':') + 1)
    const [num, msg] = body.split(/[:?]/)
    return {
      kind: 'sms',
      level: 'warn',
      title: '預填簡訊',
      detail: { 號碼: num || '(未提供)', 內容: msg || '(無)' },
      findings: [{ level: 'warn', text: '掃 QR 會幫你預先填好一則簡訊。詐騙常藉此向特定號碼發送,觸發小額付費或訂閱。' }],
      advice: ['送出前看清楚收訊號碼與內容,不確定就不要送。'],
    }
  }

  // Email
  if (lower.startsWith('mailto:') || lower.startsWith('matmsg:')) {
    const to = lower.startsWith('mailto:') ? raw.slice(7).split('?')[0] : (parseKeyed(raw.slice(7)).TO || '')
    return {
      kind: 'email',
      level: 'info',
      title: '寄送 Email',
      detail: { 收件者: to || '(未提供)' },
      findings: [{ level: 'info', text: '掃 QR 會開啟郵件草稿。' }],
      advice: ['留意是否被預填了奇怪的收件者或內容。'],
    }
  }

  // 地理座標
  if (lower.startsWith('geo:')) {
    return {
      kind: 'geo',
      level: 'info',
      title: '地理座標',
      detail: { 座標: raw.slice(4) },
      findings: [{ level: 'info', text: '掃 QR 會在地圖開啟這個位置。' }],
      advice: [],
    }
  }

  // 聯絡人
  if (lower.startsWith('begin:vcard') || lower.startsWith('mecard:')) {
    const name = (raw.match(/(?:^|\n)(?:FN|N):([^\n;]+)/i) || raw.match(/MECARD:.*?N:([^;]+)/i) || [])[1] || ''
    const tel = (raw.match(/TEL[^:]*:([^\n;]+)/i) || [])[1] || ''
    return {
      kind: 'contact',
      level: 'info',
      title: '聯絡人(名片)',
      detail: { 姓名: name || '(未提供)', 電話: tel || '(未提供)' },
      findings: [{ level: 'info', text: '掃 QR 會新增一筆聯絡人。' }],
      advice: ['確認來源可信再加入通訊錄。'],
    }
  }

  // 網址(含危險協定,交給 analyzeUrl 判讀)
  if (/^(https?|ftp|javascript|data|file):/i.test(raw)) {
    const a = analyzeUrl(raw)
    const findings: QrFinding[] = [...a.findings]
    if (a.level === 'danger') findings.unshift({ level: 'danger', text: QUISHING })
    return {
      kind: 'url',
      level: fromUrlLevel(a),
      title: '網址連結',
      detail: { 網域: a.host || '(無法解析)' },
      url: raw,
      urlAnalysis: a,
      findings,
      advice: scamUrlAdvice(a.level),
    }
  }

  // 純文字:看是否內含網址
  const m = raw.match(/https?:\/\/[^\s]+/i)
  if (m) {
    const a = analyzeUrl(m[0])
    return {
      kind: 'text',
      level: fromUrlLevel(a),
      title: '文字(內含網址)',
      detail: { 內含網址: m[0], 網域: a.host || '(無法解析)' },
      url: m[0],
      urlAnalysis: a,
      findings: [{ level: a.level === 'safe' ? 'ok' : a.level, text: '純文字內容中夾帶了一個網址,已一併檢查。' }, ...a.findings],
      advice: scamUrlAdvice(a.level),
    }
  }

  return {
    kind: 'text',
    level: 'info',
    title: '純文字',
    detail: { 內容: raw.length > 120 ? raw.slice(0, 120) + '…' : raw },
    findings: [{ level: 'info', text: '這是純文字,沒有可執行的連結或動作。' }],
    advice: ['留意文字是否誘導你加 LINE、回撥電話或提供個資。'],
  }
}

function scamUrlAdvice(level: QrLevel): string[] {
  if (level === 'danger')
    return [
      '不要點開、不要在該頁面輸入任何帳號密碼或個資。',
      QUISHING,
      '需要辦事就自己打開官方 App 或手動輸入官網,不要靠掃來的 QR。',
    ]
  if (level === 'warn') return ['先確認網域是否為官方;短網址、免費平台網址要特別小心。', '不確定就不要在該頁面登入或付款。']
  return ['網域看起來正常,但仍請確認是你預期要前往的網站再操作。']
}
