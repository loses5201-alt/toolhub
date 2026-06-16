/*
  台灣電話號碼檢視引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  把輸入的號碼正規化(+886 ↔ 0、去掉空白/連字號),判斷類型(手機/市話/免付費/付費語音/短碼),
  標出常見的「詐騙警訊」(國際來電冠碼卻自稱國內機構、付費語音號等),並引導到官方查證管道。
  注意:這是格式判讀與防詐教育,不是「這通是不是詐騙」的保證。號碼可被竄改顯示(來電顯示偽冒)。
*/

export type PhoneKind =
  | 'mobile' // 手機
  | 'landline' // 市話
  | 'tollfree' // 免付費 0800/0809
  | 'premium' // 付費語音 0204/0203
  | 'shortcode' // 短碼/特殊號(110、165…)
  | 'intl' // 國外號碼(非台灣)
  | 'unknown'

export interface PhoneResult {
  input: string
  normalized: string // 正規化後的本地格式(市話/手機以 0 開頭),國外則保留 + 開頭
  kind: PhoneKind
  label: string // 類型白話說明
  region?: string // 市話推測的區域
  warnings: string[] // 防詐警訊(白話)
}

// 長途區域號碼 → 區域(多對一者以「等」標示,僅供參考)
const AREA: Array<[string, string]> = [
  ['0826', '烏坵'],
  ['0836', '馬祖(連江)'],
  ['082', '金門'],
  ['089', '臺東'],
  ['037', '苗栗'],
  ['049', '南投'],
  ['02', '臺北/新北/基隆'],
  ['03', '桃園/新竹/宜蘭/花蓮 等'],
  ['04', '臺中/彰化 等'],
  ['05', '雲林/嘉義 等'],
  ['06', '臺南/澎湖 等'],
  ['07', '高雄'],
  ['08', '屏東 等'],
]

function areaOf(d: string): string | undefined {
  for (const [code, name] of AREA) if (d.startsWith(code)) return name
  return undefined
}

/** 把各種寫法清成純粹的撥號字串,保留開頭可能的 +。 */
function clean(raw: string): string {
  return raw
    .replace(/[（）()]/g, '')
    .replace(/[‐-―—–]/g, '-')
    .replace(/[^\d+]/g, '') // 去掉空白、連字號等,只留數字與 +
}

/**
 * 檢視一個電話號碼。
 */
export function checkPhone(raw: string): PhoneResult {
  const input = raw.trim()
  const warnings: string[] = []
  let s = clean(input)

  // 國際冠碼 / +886 處理
  let camePlus886 = false
  if (s.startsWith('+886')) {
    camePlus886 = true
    s = '0' + s.slice(4)
  } else if (s.startsWith('886') && !s.startsWith('8860')) {
    camePlus886 = true
    s = '0' + s.slice(3)
  } else if (/^00[1-9]886/.test(s)) {
    // 例:002886... 也是撥打台灣
    camePlus886 = true
    s = '0' + s.replace(/^00[1-9]886/, '')
  } else if (s.startsWith('+')) {
    return {
      input,
      normalized: s,
      kind: 'intl',
      label: '國外號碼(+ 開頭的國際格式)',
      warnings: [
        '這是國外號碼。若對方自稱是國內銀行、檢警、電商客服,卻從國外打來,幾乎可以確定是詐騙。',
      ],
    }
  } else if (/^00[1-9]/.test(s)) {
    // 國際冠碼撥出(002/006/009/017…)接著非 886 → 撥到國外
    warnings.push(
      '開頭是國際冠碼(00x),代表這通其實是打到/來自國外。自稱國內機構卻是國際來電是常見詐騙手法。',
    )
  }

  if (camePlus886) {
    warnings.push(
      '以 +886 國際格式呈現的台灣號碼,常見於網路電話。來電顯示可被偽冒,勿只憑號碼就信任對方。',
    )
  }

  const d = s

  // 免付費
  if (/^080[09]/.test(d)) {
    return {
      input, normalized: d, kind: 'tollfree',
      label: '免付費電話(0800 / 0809)',
      warnings: [...warnings, '0800 多為企業客服,但詐騙集團也可能租用。請以官網公布的客服電話為準。'],
    }
  }
  // 付費語音
  if (/^020[34]/.test(d)) {
    return {
      input, normalized: d, kind: 'premium',
      label: '付費語音電話(0204 / 0203)',
      warnings: [...warnings, '⚠️ 這是高費率付費電話,回撥可能被收取高額費用。常見於假中獎、色情、解鎖等誘騙回撥。'],
    }
  }
  // 短碼 / 特殊號(110、119、112、165、166…)
  if (/^1\d{2}$/.test(d)) {
    const known: Record<string, string> = {
      '110': '報案', '119': '消防/救護', '112': '行動電話緊急',
      '113': '保護專線', '165': '反詐騙諮詢', '166': '生活法律',
      '104': '查號台', '117': '報時', '118': '電信客服',
    }
    return {
      input, normalized: d, kind: 'shortcode',
      label: '特殊/短碼號碼' + (known[d] ? `(${known[d]})` : ''),
      warnings,
    }
  }
  // 手機 09XXXXXXXX(共 10 碼)
  if (/^09\d{8}$/.test(d)) {
    return { input, normalized: d, kind: 'mobile', label: '手機號碼', warnings }
  }
  if (/^09\d{0,7}$/.test(d) || /^09\d{9,}$/.test(d)) {
    warnings.push('看起來是手機號碼,但長度不對(台灣手機為 09 開頭共 10 碼),可能打錯一碼。')
    return { input, normalized: d, kind: 'mobile', label: '手機號碼(長度異常)', warnings }
  }
  // 市話:0 + 區碼 + 用戶碼,總長約 9~10 碼
  if (/^0[2-8]\d{6,8}$/.test(d)) {
    return {
      input, normalized: d, kind: 'landline', label: '市話(室內電話)',
      region: areaOf(d), warnings,
    }
  }

  return {
    input, normalized: d, kind: 'unknown',
    label: '無法判讀的號碼格式',
    warnings: [...warnings, '這不是常見的台灣電話格式,請再次確認是否打錯,或對方刻意使用怪異號碼。'],
  }
}
