/*
  干支 / 生肖 / 納音 換算引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  以西曆年為基準計算天干地支(六十甲子)、十二生肖與納音五行。
  注意:傳統八字以「立春」、民俗生肖多以「農曆春節」換年;本工具以西曆年(1/1 起)
  為準計算,年初(春節 / 立春前)出生者請自行往前一年判讀(UI 會提醒)。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

export const HEAVENLY_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
export const EARTHLY_BRANCHES = [
  '子',
  '丑',
  '寅',
  '卯',
  '辰',
  '巳',
  '午',
  '未',
  '申',
  '酉',
  '戌',
  '亥',
]
export const ZODIACS = ['鼠', '牛', '虎', '兔', '龍', '蛇', '馬', '羊', '猴', '雞', '狗', '豬']
// 天干五行
const STEM_ELEMENT = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水']
// 地支對應生肖時辰(地支序)
const BRANCH_HOURS = [
  '23–01',
  '01–03',
  '03–05',
  '05–07',
  '07–09',
  '09–11',
  '11–13',
  '13–15',
  '15–17',
  '17–19',
  '19–21',
  '21–23',
]

// 六十甲子納音五行(每兩個甲子共用一個納音,共 30 種)
const NAYIN_30 = [
  '海中金',
  '爐中火',
  '大林木',
  '路旁土',
  '劍鋒金',
  '山頭火',
  '澗下水',
  '城頭土',
  '白蠟金',
  '楊柳木',
  '泉中水',
  '屋上土',
  '霹靂火',
  '松柏木',
  '長流水',
  '沙中金',
  '山下火',
  '平地木',
  '壁上土',
  '金箔金',
  '覆燈火',
  '天河水',
  '大驛土',
  '釵釧金',
  '桑柘木',
  '大溪水',
  '沙中土',
  '天上火',
  '石榴木',
  '大海水',
]

/** 正數取模(處理負數年份/西元前)。 */
function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}

export interface GanzhiInfo {
  year: number // 西曆年
  rocYear: number // 民國年(year - 1911)
  stemIndex: number // 天干序 0–9
  branchIndex: number // 地支序 0–11
  sexagenaryIndex: number // 六十甲子序 0–59
  stem: string // 天干
  branch: string // 地支
  ganzhi: string // 干支(如 甲子)
  zodiac: string // 生肖
  stemElement: string // 天干五行
  nayin: string // 納音五行
  hour: string // 該地支對應時辰(時)
}

/** 由西曆年計算干支/生肖/納音等。公元 4 年為甲子年。 */
export function ganzhiOfYear(year: number): GanzhiInfo {
  const stemIndex = mod(year - 4, 10)
  const branchIndex = mod(year - 4, 12)
  const sexagenaryIndex = mod(year - 4, 60)
  return {
    year,
    rocYear: year - 1911,
    stemIndex,
    branchIndex,
    sexagenaryIndex,
    stem: HEAVENLY_STEMS[stemIndex],
    branch: EARTHLY_BRANCHES[branchIndex],
    ganzhi: HEAVENLY_STEMS[stemIndex] + EARTHLY_BRANCHES[branchIndex],
    zodiac: ZODIACS[branchIndex],
    stemElement: STEM_ELEMENT[stemIndex],
    nayin: NAYIN_30[Math.floor(sexagenaryIndex / 2)],
    hour: BRANCH_HOURS[branchIndex],
  }
}

/** 民國年轉西曆年。 */
export function rocToAd(rocYear: number): number {
  return rocYear + 1911
}

/**
 * 找出與指定干支相符的近期年份(以參考年為中心,前後各找)。
 * ganzhi 例:'甲子'。回傳遞增的西曆年份陣列。
 */
export function yearsForGanzhi(ganzhi: string, around: number, count = 4): number[] {
  const stem = ganzhi.charAt(0)
  const branch = ganzhi.charAt(1)
  const si = HEAVENLY_STEMS.indexOf(stem)
  const bi = EARTHLY_BRANCHES.indexOf(branch)
  if (si < 0 || bi < 0) return []
  // 干支需相容:天干奇偶與地支奇偶一致(否則不存在此組合)
  if (si % 2 !== bi % 2) return []
  const target = sexagenaryIndexOf(si, bi)
  // 找出 around 附近、(year-4)%60===target 的年份
  const base = around - mod(around - 4 - target, 60)
  const out: number[] = []
  // 往前 2、往後 count-? 以涵蓋 around
  for (let k = -2; out.length < count + 2 && k < count + 2; k++) {
    out.push(base + k * 60)
  }
  return out
    .filter((y) => y > 0)
    .sort((a, b) => Math.abs(a - around) - Math.abs(b - around))
    .slice(0, count)
    .sort((a, b) => a - b)
}

/** 由天干序、地支序求六十甲子序(0–59);不相容回 -1。 */
export function sexagenaryIndexOf(stemIndex: number, branchIndex: number): number {
  for (let i = 0; i < 60; i++) {
    if (i % 10 === stemIndex && i % 12 === branchIndex) return i
  }
  return -1
}
