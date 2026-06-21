/*
  APCA(Accessible Perceptual Contrast Algorithm)對比引擎 —— 純函式、無 DOM,
  可在 Node 直接測試。WCAG 3 草案採用的新一代對比模型,比 WCAG 2 的對比比值
  更貼近人眼實際的可讀性(考慮亮暗極性、深色背景的視覺差異)。
  輸出「Lc 值」(Lightness contrast),範圍約 -108 ~ +106:
    正值 = 深字淺底(一般極性)、負值 = 淺字深底(反白極性),絕對值越大越清楚。
  演算法常數依 APCA-W3 0.1.9(G-4g),與 apcacontrast.com 一致。
  全程在你的瀏覽器計算,不連網、不上傳。
*/
import { parseColor } from './contrast'
import type { RGB } from './contrast'

export { parseColor }
export type { RGB }

// APCA-W3 0.1.9 常數
const MAIN_TRC = 2.4
const R_CO = 0.2126729
const G_CO = 0.7151522
const B_CO = 0.072175
const NORM_BG = 0.56
const NORM_TXT = 0.57
const REV_TXT = 0.62
const REV_BG = 0.65
const BLK_THRS = 0.022
const BLK_CLMP = 1.414
const SCALE = 1.14
const LO_OFFSET = 0.027
const LO_CLIP = 0.1
const DELTA_Y_MIN = 0.0005

/** sRGB 顏色 → 螢幕亮度 Ys(0–1)。APCA 用簡單 2.4 次方曲線、無低端線性段。 */
export function sRGBtoY({ r, g, b }: RGB): number {
  const lin = (c: number) => Math.pow(c / 255, MAIN_TRC)
  return R_CO * lin(r) + G_CO * lin(g) + B_CO * lin(b)
}

/** 由文字亮度 txtY 與背景亮度 bgY 算 APCA Lc 值(-108 ~ 106)。 */
export function apcaContrastY(txtY: number, bgY: number): number {
  // 輸入超出有效範圍視為 0
  if (Math.min(txtY, bgY) < 0 || Math.max(txtY, bgY) > 1.1) return 0

  // 黑階軟鉗:讓極暗區的差異更貼近視覺
  const soft = (y: number) => (y > BLK_THRS ? y : y + Math.pow(BLK_THRS - y, BLK_CLMP))
  const ty = soft(txtY)
  const by = soft(bgY)

  // 差異太小直接視為無對比
  if (Math.abs(by - ty) < DELTA_Y_MIN) return 0

  let sapc: number
  let out: number
  if (by > ty) {
    // 一般極性:深字淺底
    sapc = (Math.pow(by, NORM_BG) - Math.pow(ty, NORM_TXT)) * SCALE
    out = sapc < LO_CLIP ? 0 : sapc - LO_OFFSET
  } else {
    // 反白極性:淺字深底
    sapc = (Math.pow(by, REV_BG) - Math.pow(ty, REV_TXT)) * SCALE
    out = sapc > -LO_CLIP ? 0 : sapc + LO_OFFSET
  }
  return out * 100
}

/** 直接由文字色與背景色算 Lc 值。 */
export function apcaContrast(txt: RGB, bg: RGB): number {
  return apcaContrastY(sRGBtoY(txt), sRGBtoY(bg))
}

export interface LcLevel {
  lc: number // 原始(帶正負號)
  abs: number // 絕對值
  polarity: 'normal' | 'reverse' | 'none' // 深字淺底 / 淺字深底 / 無
  label: string // 白話可讀性等級
  usage: string // 適用建議
  passBodyText: boolean // 是否達一般內文門檻(|Lc| ≥ 60,約對應 WCAG AA)
}

/**
  把 Lc 值翻成白話可讀性等級。APCA 實際門檻會隨字級/字重變動(有對照表),
  這裡給保守的通用級距,僅供快速判斷。
*/
export function describeLc(lc: number): LcLevel {
  const abs = Math.abs(lc)
  const polarity: LcLevel['polarity'] = abs < 1 ? 'none' : lc > 0 ? 'normal' : 'reverse'
  let label: string
  let usage: string
  if (abs < 15) {
    label = '幾乎看不見'
    usage = '不可用於任何文字或有意義的圖形。'
  } else if (abs < 30) {
    label = '極低對比'
    usage = '僅適合純裝飾、停用狀態元素,不可放需閱讀的文字。'
  } else if (abs < 45) {
    label = '低對比'
    usage = '僅適合大型粗體標題(約 ≥ 36px 粗體),不適合內文。'
  } else if (abs < 60) {
    label = '中等對比'
    usage = '適合較大或粗體文字(約 ≥ 24px),小字仍不足。'
  } else if (abs < 75) {
    label = '良好(內文下限)'
    usage = '一般內文的最低建議(約相當 WCAG AA);細小或細體字仍建議再高。'
  } else if (abs < 90) {
    label = '優良'
    usage = '適合多數內文與較小文字,閱讀舒適。'
  } else {
    label = '極佳'
    usage = '適合細小或細體文字,對比最充足。'
  }
  return { lc: round1(lc), abs: round1(abs), polarity, label, usage, passBodyText: abs >= 60 }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
