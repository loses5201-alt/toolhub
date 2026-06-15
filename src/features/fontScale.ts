import { ref } from 'vue'

/*
  字級放大切換 —— 長輩友善。
  透過調整根元素 font-size,讓整站(Tailwind 用 rem)等比放大。
  設定存 localStorage,下次造訪沿用。
*/
const KEY = 'toolhub-font-scale'
const SIZES = [15, 16, 18, 20] // px,對應 小 / 標準 / 大 / 特大

export const fontIndex = ref(1)

function apply() {
  document.documentElement.style.fontSize = SIZES[fontIndex.value] + 'px'
}

export function initFontScale() {
  const saved = Number(localStorage.getItem(KEY))
  if (Number.isInteger(saved) && saved >= 0 && saved < SIZES.length) {
    fontIndex.value = saved
  }
  apply()
}

export function stepFont(delta: number) {
  const next = Math.max(0, Math.min(SIZES.length - 1, fontIndex.value + delta))
  fontIndex.value = next
  localStorage.setItem(KEY, String(next))
  apply()
}

export const canDecrease = () => fontIndex.value > 0
export const canIncrease = () => fontIndex.value < SIZES.length - 1
