import type { Component } from 'vue'

/*
  ★ 單一事實來源 ★
  所有工具的 metadata 都註冊在這裡。
  導覽、搜尋、關鍵字導引(chatbot)、分類頁、路由,全部讀這一份。
  新增工具 = 在 src/tools/<id>/Index.vue 寫元件 + 在這裡加一筆。不改主程式。
*/
export interface ToolDef {
  id: string // kebab-case,= 路由 slug,= 資料夾名
  name: string
  category: string // 對應 categories.ts 的 id
  description: string
  keywords: string[] // 關鍵字導引比對用,含同義詞、口語說法
  icon: string
  loader: () => Promise<{ default: Component }>
}

export const tools: ToolDef[] = [
  {
    id: 'image-studio',
    name: '圖片工坊',
    category: 'workshop',
    description: '批次轉檔(JPG/PNG/WebP)、壓縮、縮放 —— 全程在你瀏覽器處理,不上傳、無廣告、自動清掉相片定位等中繼資料。',
    keywords: ['圖片', '照片', '轉檔', '格式', '壓縮', '縮小', '縮放', 'webp', 'jpg', 'png', '批次', '改大小', '去exif'],
    icon: '🖼️',
    loader: () => import('@/tools/image-studio/Index.vue'),
  },
  {
    id: 'pdf-studio',
    name: 'PDF 工坊',
    category: 'workshop',
    description: '合併、刪頁/重排、圖片↔PDF —— 全程在你瀏覽器處理,不上傳機密文件、無廣告、無浮水印、不限檔數。',
    keywords: ['pdf', '合併', '分割', '刪頁', '重排', '頁面', '圖片轉pdf', 'pdf轉圖片', 'pdf轉jpg', '掃描', '轉檔', '擷取', '抽頁', '組合'],
    icon: '📄',
    loader: () => import('@/tools/pdf-studio/Index.vue'),
  },
  {
    id: 'link-check',
    name: '可疑網址檢查器',
    category: 'anti-scam',
    description: '收到怪怪的連結?貼上來,馬上看出假冒網域、釣魚、短網址等詐騙特徵。',
    keywords: ['詐騙', '可疑', '網址', '連結', '釣魚', '假網站', '簡訊', '安全', '查證', '假冒', '釣魚網站'],
    icon: '🛡️',
    loader: () => import('@/tools/link-check/Index.vue'),
  },
  {
    id: 'sms-check',
    name: '詐騙簡訊檢查',
    category: 'anti-scam',
    description: '把可疑的簡訊或 LINE 訊息貼上來,辨識常見詐騙話術,並自動檢查裡面的連結。',
    keywords: ['詐騙', '簡訊', 'LINE', '訊息', '話術', '可疑', '假冒', '解除分期', '包裹', '中獎', '查證'],
    icon: '💬',
    loader: () => import('@/tools/sms-check/Index.vue'),
  },
  {
    id: 'scam-guide',
    name: '常見詐騙手法圖鑑',
    category: 'anti-scam',
    description: '解除分期、假投資、假檢警、包裹簡訊…一次看懂常見詐騙怎麼運作、破綻在哪、該怎麼做。轉給長輩看最有用。',
    keywords: ['詐騙', '手法', '圖鑑', '防詐', '反詐騙', '165', '假投資', '假檢警', '解除分期', '包裹', '一頁式', '假交友', '人頭帳戶', '懶人包', '長輩'],
    icon: '📖',
    loader: () => import('@/tools/scam-guide/Index.vue'),
  },
  {
    id: 'severance-pay',
    name: '資遣費試算',
    category: 'labor',
    description: '輸入年資與平均工資,算出新制/舊制資遣費,並標明法規依據。',
    keywords: ['資遣費', '資遣', '遣散費', '被資遣', '裁員', '解僱', '離職金', '勞退', '年資'],
    icon: '💼',
    loader: () => import('@/tools/severance-pay/Index.vue'),
  },
  {
    id: 'annual-leave',
    name: '特休天數計算',
    category: 'labor',
    description: '依到職日與年資,算出依勞基法第38條應有的特別休假天數。',
    keywords: ['特休', '特別休假', '年假', '休假天數', '可以休幾天', '年資', '勞基法38'],
    icon: '🏖️',
    loader: () => import('@/tools/annual-leave/Index.vue'),
  },
  {
    id: 'overtime-pay',
    name: '加班費計算',
    category: 'labor',
    description: '依勞基法第24條,計算平日與休息日加班的加給金額。',
    keywords: ['加班費', '加班', 'OT', '延長工時', '休息日加班', '時薪', '勞基法24'],
    icon: '⏰',
    loader: () => import('@/tools/overtime-pay/Index.vue'),
  },
  {
    id: 'leave-deduction',
    name: '請假扣薪試算',
    category: 'labor',
    description: '請事假、病假會被扣多少薪水?選假別、填天數,馬上算出應扣金額與仍可領的工資。',
    keywords: ['請假', '扣薪', '事假', '病假', '生理假', '婚假', '喪假', '特休', '家庭照顧假', '半薪', '無薪', '日薪', '時薪', '薪水'],
    icon: '🗓️',
    loader: () => import('@/tools/leave-deduction/Index.vue'),
  },
  {
    id: 'income-tax',
    name: '綜所稅速算',
    category: 'health-tax',
    description: '輸入綜合所得淨額,用財政部速算公式算出應納所得稅與有效稅率。',
    keywords: ['所得稅', '綜所稅', '報稅', '稅額', '級距', '速算', '繳稅', '綜合所得'],
    icon: '🧮',
    loader: () => import('@/tools/income-tax/Index.vue'),
  },
  {
    id: 'nhi-supplement',
    name: '二代健保補充保費',
    category: 'health-tax',
    description: '計算獎金、租金、股利、利息等收入要扣的二代健保補充保費。',
    keywords: ['二代健保', '補充保費', '健保', '獎金', '股利', '租金', '利息', '兼職'],
    icon: '🩺',
    loader: () => import('@/tools/nhi-supplement/Index.vue'),
  },
  {
    id: 'loan-calc',
    name: '貸款試算',
    category: 'finance',
    description: '房貸、車貸的每月應繳、總利息試算,支援本息/本金均攤與寬限期。',
    keywords: ['貸款', '房貸', '車貸', '利息', '每月還款', '月付', '本息均攤', '本金均攤', '寬限期'],
    icon: '🏠',
    loader: () => import('@/tools/loan-calc/Index.vue'),
  },
  {
    id: 'savings-interest',
    name: '定存複利試算',
    category: 'finance',
    description: '輸入本金、年利率、年數與複利次數,算出到期本利和與總利息。',
    keywords: ['定存', '複利', '利息', '存款', '本利和', '年利率', '理財', '單利'],
    icon: '🏦',
    loader: () => import('@/tools/savings-interest/Index.vue'),
  },
  {
    id: 'labor-pension-self',
    name: '勞退自提節稅試算',
    category: 'finance',
    description: '試算勞退自願提繳(上限 6%)金額,以及可省下的所得稅。',
    keywords: ['勞退', '自提', '自願提繳', '退休金', '節稅', '6%', '勞工退休金'],
    icon: '🐷',
    loader: () => import('@/tools/labor-pension-self/Index.vue'),
  },
  {
    id: 'labor-pension-annuity',
    name: '勞保老年年金試算',
    category: 'finance',
    description: '退休後勞保每月能領多少?輸入平均投保薪資與年資,兩式擇優算出月領金額,含提前/延後請領調整。',
    keywords: ['勞保', '老年年金', '退休金', '退休', '月退', '勞保年金', '請領', '投保薪資', '年資', '老年給付', '勞保老年'],
    icon: '👵',
    loader: () => import('@/tools/labor-pension-annuity/Index.vue'),
  },
  {
    id: 'installment-apr',
    name: '分期實際利率(APR)',
    category: 'finance',
    description: '「分期 0 利率」其實不便宜?輸入手續費,算出信用卡/分期付款的真實年利率。',
    keywords: ['分期', '利率', 'APR', '手續費', '信用卡', '免利率', '零利率', '實質利率', '年利率', '分期付款', '免息'],
    icon: '💳',
    loader: () => import('@/tools/installment-apr/Index.vue'),
  },
  {
    id: 'bmi',
    name: 'BMI 計算',
    category: 'life',
    description: '輸入身高體重,算出 BMI 與國健署體位分級,並給理想體重範圍。',
    keywords: ['bmi', '身體質量指數', '體重', '身高', '肥胖', '過重', '理想體重', '健康'],
    icon: '⚖️',
    loader: () => import('@/tools/bmi/Index.vue'),
  },
  {
    id: 'tdee',
    name: '每日熱量需求(TDEE)',
    category: 'life',
    description: '依身高體重年齡活動量,用 Mifflin-St Jeor 公式算出基礎代謝與每日該吃多少熱量。',
    keywords: ['熱量', 'tdee', 'bmr', '基礎代謝', '減重', '減肥', '卡路里', '大卡', '增肌', '飲食', '代謝率'],
    icon: '🔥',
    loader: () => import('@/tools/tdee/Index.vue'),
  },
  {
    id: 'unit-convert',
    name: '單位換算',
    category: 'life',
    description: '長度、重量、面積、溫度換算,含台灣常用的坪、台斤、台尺。',
    keywords: ['單位', '換算', '坪', '平方公尺', '台斤', '台尺', '公斤', '公里', '溫度', '攝氏', '華氏'],
    icon: '📐',
    loader: () => import('@/tools/unit-convert/Index.vue'),
  },
  {
    id: 'due-date',
    name: '預產期計算',
    category: 'life',
    description: '輸入最後一次月經第一天(LMP),推算預產期與目前懷孕週數。',
    keywords: ['預產期', '懷孕', '週數', '生產', 'LMP', '末次月經', '孕期'],
    icon: '🤰',
    loader: () => import('@/tools/due-date/Index.vue'),
  },
  {
    id: 'fuel-cost',
    name: '油錢試算',
    category: 'life',
    description: '輸入距離、油耗、油價,算出整趟油錢,還能直接除以人數算每人分攤。',
    keywords: ['油錢', '油費', '汽油', '加油', '里程', '油耗', '旅程', '開車', '分攤', '高速公路', '電車', '電費'],
    icon: '⛽',
    loader: () => import('@/tools/fuel-cost/Index.vue'),
  },
  {
    id: 'split-bill',
    name: '旅費分帳',
    category: 'life',
    description: '聚餐、旅遊一筆錢幾個人均分,可加服務費,馬上算出每人該付多少。',
    keywords: ['分帳', '均分', '平分', 'AA', '聚餐', '旅遊', '服務費', '每人', '攤錢'],
    icon: '🧮',
    loader: () => import('@/tools/split-bill/Index.vue'),
  },
  {
    id: 'invoice-lottery',
    name: '發票對獎',
    category: 'life',
    description: '輸入發票號碼,比對統一發票中獎號碼,自動算出中獎金額。',
    keywords: ['發票', '對獎', '中獎', '統一發票', '雲端發票', '對發票', '幾獎'],
    icon: '🧾',
    loader: () => import('@/tools/invoice-lottery/Index.vue'),
  },
  {
    id: 'age-calc',
    name: '年齡計算',
    category: 'datetime',
    description: '輸入出生日期,算出實歲、虛歲、人壽保險年齡,還有已活天數與生日倒數。',
    keywords: ['年齡', '幾歲', '實歲', '足歲', '虛歲', '保險年齡', '生日', '倒數', '出生', '活了幾天', '歲數'],
    icon: '🎂',
    loader: () => import('@/tools/age-calc/Index.vue'),
  },
  {
    id: 'roc-year',
    name: '民國年換算',
    category: 'datetime',
    description: '民國年、西元年、日本年號(令和/平成/昭和)即時互換。',
    keywords: ['民國', '西元', '年份', '換算', '日本年號', '令和', '平成', '昭和', '幾年'],
    icon: '📆',
    loader: () => import('@/tools/roc-year/Index.vue'),
  },
]

export const toolMap: Record<string, ToolDef> = Object.fromEntries(
  tools.map((t) => [t.id, t]),
)

export function toolsByCategory(categoryId: string): ToolDef[] {
  return tools.filter((t) => t.category === categoryId)
}
