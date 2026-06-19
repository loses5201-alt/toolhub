<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'

/*
  色階產生器 —— 從一個主色生出 50~950 的明暗色階(像 Tailwind / Material 的設計系統色板),
  可複製成 CSS 變數 / Tailwind 設定 / JSON。純前端計算,不連網、不上傳。
*/
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
const baseHex = ref('#1f9a7e')
const name = ref('brand')

// ---- 色彩轉換 ----
function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.trim().replace(/^#/, '')
  const s = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return null
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]
}
function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return [h, s, l]
}
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255]
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const baseRgb = computed(() => hexToRgb(baseHex.value))
const valid = computed(() => baseRgb.value !== null)

// 以主色為 500,往亮端內插到 L≈0.97、往暗端內插到 L≈0.13,色相/飽和度維持不變
const scale = computed(() => {
  const rgb = baseRgb.value
  if (!rgb) return []
  const [h, s, lb] = rgbToHsl(...rgb)
  const out: { step: number; hex: string; light: boolean }[] = []
  STEPS.forEach((step, i) => {
    let l: number
    if (step === 500) l = lb
    else if (step < 500) l = lerp(lb, 0.97, (5 - i) / 5) // 50..400:i=0..4 → 50 達近白、400 緊鄰主色
    else l = lerp(lb, 0.13, (i - 5) / 5) // 600..950:i=6..10 → 950 達近黑、600 緊鄰主色
    const hex = rgbToHex(...hslToRgb(h, s, l))
    out.push({ step, hex, light: l > 0.6 })
  })
  return out
})

// ---- 輸出格式 ----
const cssVars = computed(
  () => `:root {\n${scale.value.map((c) => `  --color-${name.value}-${c.step}: ${c.hex};`).join('\n')}\n}`,
)
const twConfig = computed(
  () =>
    `${name.value}: {\n${scale.value.map((c) => `  ${c.step}: '${c.hex}',`).join('\n')}\n},`,
)
const jsonOut = computed(
  () => `{\n${scale.value.map((c) => `  "${c.step}": "${c.hex}"`).join(',\n')}\n}`,
)

const copiedKey = ref('')
async function copy(text: string, key: string) {
  try {
    await navigator.clipboard.writeText(text)
    copiedKey.value = key
    setTimeout(() => (copiedKey.value = ''), 1500)
  } catch {
    /* 可手動選取 */
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block">
          <span class="field-label">主色(會放在色階的 500)</span>
          <div class="flex items-center gap-2">
            <input type="color" v-model="baseHex" class="h-10 w-14 rounded border border-line" aria-label="挑選主色" />
            <input v-model="baseHex" type="text" class="field-input flex-1 font-mono" placeholder="#1f9a7e" />
          </div>
          <p v-if="!valid" class="mt-1 text-sm text-red-700">請輸入有效的 HEX 色碼,例如 #1f9a7e 或 #abc。</p>
        </label>
        <label class="block">
          <span class="field-label">變數名稱前綴</span>
          <input v-model="name" type="text" class="field-input" placeholder="brand" />
          <p class="field-hint">用在 CSS 變數 / Tailwind key,例如 --color-brand-500。</p>
        </label>
      </div>

      <template v-if="valid">
        <div class="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-11">
          <button
            v-for="c in scale"
            :key="c.step"
            class="rounded-lg border border-line py-3 text-center text-xs font-medium transition hover:scale-[1.04]"
            :style="{ backgroundColor: c.hex, color: c.light ? '#1a1a1a' : '#ffffff' }"
            :title="`點擊複製 ${c.hex}`"
            @click="copy(c.hex, 'sw' + c.step)"
          >
            <div class="font-bold">{{ c.step }}</div>
            <div class="font-mono">{{ copiedKey === 'sw' + c.step ? '已複製' : c.hex }}</div>
          </button>
        </div>
        <p class="text-xs text-ink-500">點任一色塊即可複製該色碼。500 = 你選的主色;往左漸亮、往右漸暗。</p>

        <div class="space-y-4">
          <div>
            <div class="flex items-center justify-between">
              <label class="field-label">CSS 變數</label>
              <button class="rounded-md border border-line bg-white px-3 py-1 text-xs hover:border-brand-400" @click="copy(cssVars, 'css')">{{ copiedKey === 'css' ? '已複製 ✓' : '複製' }}</button>
            </div>
            <textarea :value="cssVars" rows="6" readonly class="field-input font-mono text-xs"></textarea>
          </div>
          <div>
            <div class="flex items-center justify-between">
              <label class="field-label">Tailwind 設定(放進 theme.extend.colors)</label>
              <button class="rounded-md border border-line bg-white px-3 py-1 text-xs hover:border-brand-400" @click="copy(twConfig, 'tw')">{{ copiedKey === 'tw' ? '已複製 ✓' : '複製' }}</button>
            </div>
            <textarea :value="twConfig" rows="6" readonly class="field-input font-mono text-xs"></textarea>
          </div>
          <div>
            <div class="flex items-center justify-between">
              <label class="field-label">JSON</label>
              <button class="rounded-md border border-line bg-white px-3 py-1 text-xs hover:border-brand-400" @click="copy(jsonOut, 'json')">{{ copiedKey === 'json' ? '已複製 ✓' : '複製' }}</button>
            </div>
            <textarea :value="jsonOut" rows="6" readonly class="field-input font-mono text-xs"></textarea>
          </div>
        </div>
      </template>
    </div>

    <LegalNote title="使用說明與為什麼用這個">
      <ul class="list-disc space-y-1 pl-5">
        <li>給一個主色,自動生出設計系統常用的 <strong>50~950 明暗色階</strong>,做按鈕 hover、邊框、背景、深淺主題很方便。</li>
        <li>做法:把主色放在 <strong>500</strong>,維持色相與飽和度,往亮端內插到接近白、往暗端內插到接近黑。</li>
        <li>一鍵複製成 <strong>CSS 變數 / Tailwind 設定 / JSON</strong>,直接貼進專案。</li>
        <li>全程在你瀏覽器計算,不連網、不上傳。色階為視覺起點,正式上線建議再用對比工具確認文字可讀性(WCAG)。</li>
      </ul>
    </LegalNote>
  </div>
</template>
