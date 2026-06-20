/*
  網購 / 交易詐騙風險評估引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  以一組加權問題(部分為「一中就極高風險」的關鍵題)評估一筆網路交易 / 賣家的詐騙風險,
  算出風險等級與命中的警訊清單,並給對應建議。
  目的是「提高警覺」的參考,不是保證;全程在你的瀏覽器計算,不連網、不上傳。
*/

export interface RiskQuestion {
  id: string
  text: string
  weight: number // 一般權重(命中加分)
  critical?: boolean // 關鍵題:只要命中,風險即拉到最高
  advice: string // 命中時給的提醒
}

export interface RiskHit {
  id: string
  text: string
  advice: string
  critical: boolean
}

export type RiskLevel = '無明顯風險' | '低風險' | '中風險' | '高風險' | '極高風險'

export interface RiskResult {
  score: number
  maxScore: number
  percent: number // 0–100
  level: RiskLevel
  hasCritical: boolean
  hits: RiskHit[]
}

export const QUESTIONS: RiskQuestion[] = [
  {
    id: 'atm',
    text: '對方要你「操作 ATM / 解除分期付款 / 升級會員」或唸數字到提款機',
    weight: 5,
    critical: true,
    advice: '這是經典詐騙劇本——銀行、客服、賣場都不會請你操作 ATM。請立刻停止並撥打 165 反詐騙專線。',
  },
  {
    id: 'otp',
    text: '對方索取簡訊驗證碼(OTP)、信用卡背面三碼、網銀密碼或要求安裝遠端操控 App',
    weight: 5,
    critical: true,
    advice: '驗證碼與卡片三碼等於你的錢包鑰匙,任何人索取都是詐騙。切勿提供、勿安裝來路不明 App。',
  },
  {
    id: 'price',
    text: '價格明顯低於市場行情(便宜到不太合理)',
    weight: 3,
    advice: '超低價是最常見的誘餌。先比對官方或大型平台售價,過於便宜要高度警覺。',
  },
  {
    id: 'offplatform',
    text: '要求跳出平台、改用 LINE / 私訊 / 私下匯款交易',
    weight: 3,
    advice: '離開平台就失去交易保障與退款機制。堅持在原平台、用平台金流付款。',
  },
  {
    id: 'prepay',
    text: '要求先付全額或高額訂金才出貨,且只收銀行轉帳 / 匯款',
    weight: 3,
    advice: '優先選貨到付款或平台代收付。只收私人帳戶轉帳風險極高。',
  },
  {
    id: 'urgent',
    text: '一直催促「限時、今天不買就沒了、名額快滿」',
    weight: 2,
    advice: '製造急迫感是讓你來不及查證的手法。真正的好交易不怕你多想幾天。',
  },
  {
    id: 'noinfo',
    text: '賣家沒有統一編號 / 實體店面 / 客服電話,或公司資訊查不到',
    weight: 2,
    advice: '可到經濟部「商工登記公示資料查詢」核對公司是否真實存在。',
  },
  {
    id: 'newaccount',
    text: '賣家帳號是新註冊、評價很少或評價看起來像灌水',
    weight: 2,
    advice: '查看評價的時間分布與內容是否具體;短時間大量好評常是假的。',
  },
  {
    id: 'adlink',
    text: '是從社群廣告 / 來路不明簡訊或連結點進去的',
    weight: 2,
    advice: '假冒知名品牌的廣告很多。直接從官方網站或官方 App 進入,別點廣告連結。',
  },
  {
    id: 'weirdlink',
    text: '付款頁網址怪異、不是官方網域,或沒有上鎖(HTTPS)',
    weight: 3,
    advice: '仔細看網域拼字,可搭配本站「可疑網址檢查器」。沒有 https 的付款頁勿輸入卡號。',
  },
  {
    id: 'delay',
    text: '已付款後對方開始拖延出貨、找藉口或已讀不回',
    weight: 3,
    advice: '保留所有對話與匯款紀錄,儘快向平台申訴並撥打 165;若涉及匯款可聯絡銀行嘗試圈存。',
  },
  {
    id: 'overpay',
    text: '對方「不小心多付 / 多匯」要你退回差額,或寄來不明包裹要你代付',
    weight: 4,
    critical: true,
    advice: '這是退款 / 代收詐騙。原路退回、勿主動匯款給對方,先向平台或銀行查證。',
  },
]

const MAX_SCORE = QUESTIONS.reduce((s, q) => s + q.weight, 0)

/** 依勾選(answers[id] = true 代表「是」)評估風險。 */
export function assess(answers: Record<string, boolean>): RiskResult {
  let score = 0
  let hasCritical = false
  const hits: RiskHit[] = []
  for (const q of QUESTIONS) {
    if (answers[q.id]) {
      score += q.weight
      if (q.critical) hasCritical = true
      hits.push({ id: q.id, text: q.text, advice: q.advice, critical: !!q.critical })
    }
  }
  const percent = MAX_SCORE > 0 ? Math.round((score / MAX_SCORE) * 100) : 0

  let level: RiskLevel
  if (hasCritical) level = '極高風險'
  else if (score === 0) level = '無明顯風險'
  else if (percent >= 35) level = '高風險'
  else if (percent >= 15) level = '中風險'
  else level = '低風險'

  // 關鍵題優先排在最前面
  hits.sort((a, b) => Number(b.critical) - Number(a.critical))

  return { score, maxScore: MAX_SCORE, percent, level, hasCritical, hits }
}

/** 風險等級對應的總結建議。 */
export function summaryFor(level: RiskLevel): string {
  switch (level) {
    case '極高風險':
      return '出現了幾乎可確定是詐騙的關鍵警訊,請立即停止交易,撥打 165 反詐騙專線查證。'
    case '高風險':
      return '多項警訊同時出現,強烈建議不要交易;若已付款請儘速保留證據並向平台與 165 求助。'
    case '中風險':
      return '有一些可疑跡象,交易前務必再三查證賣家與付款方式,優先選有保障的平台金流。'
    case '低風險':
      return '目前風險不高,但仍請保持基本警覺、保留交易紀錄。'
    default:
      return '沒有勾選到明顯警訊,仍建議透過正規平台交易、保留紀錄。'
  }
}
