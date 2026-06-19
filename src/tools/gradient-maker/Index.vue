<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  buildGradient,
  buildCSS,
  distributeStops,
  reverseStops,
  type Stop,
  type GradientType,
} from '@/features/gradientMaker'

/*
  CSS 漸層產生器 —— 視覺化調出線性/放射/圓錐漸層,即時預覽並複製可直接用的 CSS。
  全程在你瀏覽器計算,不連網、不上傳;補齊色彩工坊系列(色碼互轉、色階、對比、色盲)的漸層需求。
*/
const PRESETS: { name: string; stops: Stop[]; angle: number }[] = [
  { name: '海洋', angle: 135, stops: [{ color: '#2563eb', pos: 0 }, { color: '#38bdf8', pos: 100 }] },
  { name: '夕陽', angle: 135, stops: [{ color: '#f97316', pos: 0 }, { color: '#ec4899', pos: 100 }] },
  { name: '薄荷', angle: 135, stops: [{ color: '#10b981', pos: 0 }, { color: '#34d399', pos: 100 }] },
  { name: '葡萄', angle: 135, stops: [{ color: '#7c3aed', pos: 0 }, { color: '#c084fc', pos: 100 }] },
  { name: '極光', angle: 120, stops: [{ color: '#00c6ff', pos: 0 }, { color: '#7c3aed', pos: 50 }, { color: '#ec4899', pos: 100 }] },
  { name: '日落三色', angle: 90, stops: [{ color: '#f6d365', pos: 0 }, { color: '#fda085', pos: 50 }, { color: '#f5576c', pos: 100 }] },
  { name: '墨夜', angle: 160, stops: [{ color: '#0f172a', pos: 0 }, { color: '#334155', pos: 100 }] },
  { name: '彩虹', angle: 90, stops: [{ color: '#ff0000', pos: 0 }, { color: '#ffff00', pos: 25 }, { color: '#00ff00', pos: 50 }, { color: '#00ffff', pos: 75 }, { color: '#0000ff', pos: 100 }] },
]
const POSITIONS = ['center', 'top', 'bottom', 'left', 'right', 'top left', 'top right', 'bottom left', 'bottom right']

const opt = reactive({
  type: 'linear' as GradientType,
  angle: 135,
  shape: 'circle' as 'circle' | 'ellipse',
  position: 'center',
  stops: [
    { color: '#2563eb', pos: 0 },
    { color: '#ec4899', pos: 100 },
  ] as Stop[],
})

const copied = ref(false)
const cssText = computed(() => buildCSS(opt))
const previewStyle = computed(() => ({ backgroundImage: buildGradient(opt) }))

function applyPreset(p: (typeof PRESETS)[number]) {
  opt.type = 'linear'
  opt.angle = p.angle
  opt.stops = p.stops.map((s) => ({ ...s }))
}

function addStop() {
  if (opt.stops.length >= 8) return
  const sorted = [...opt.stops].sort((a, b) => a.pos - b.pos)
  const mid = Math.round((sorted[0].pos + sorted[sorted.length - 1].pos) / 2)
  opt.stops.push({ color: '#ffffff', pos: mid })
}

function removeStop(i: number) {
  if (opt.stops.length <= 2) return
  opt.stops.splice(i, 1)
}

async function copyCSS() {
  try {
    await navigator.clipboard.writeText(cssText.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1600)
  } catch {
    /* 忽略:使用者可手動選取複製 */
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-3">
      <div class="h-44 w-full rounded-xl border border-line shadow-inner sm:h-56" :style="previewStyle" />
    </div>

    <div class="card p-6 space-y-5">
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label">漸層類型</label>
          <select v-model="opt.type" class="field-input">
            <option value="linear">線性(linear)</option>
            <option value="radial">放射 / 圓形(radial)</option>
            <option value="conic">圓錐(conic)</option>
          </select>
        </div>
        <div v-if="opt.type !== 'radial'">
          <label class="field-label">角度:{{ opt.angle }}°</label>
          <input v-model.number="opt.angle" type="range" min="0" max="360" step="1" class="w-full accent-brand-600" />
        </div>
        <div v-if="opt.type === 'radial'">
          <label class="field-label">形狀</label>
          <select v-model="opt.shape" class="field-input">
            <option value="circle">圓形</option>
            <option value="ellipse">橢圓</option>
          </select>
        </div>
        <div v-if="opt.type !== 'linear'">
          <label class="field-label">圓心位置</label>
          <select v-model="opt.position" class="field-input">
            <option v-for="p in POSITIONS" :key="p" :value="p">{{ p }}</option>
          </select>
        </div>
      </div>

      <div>
        <label class="field-label">色標({{ opt.stops.length }})</label>
        <div class="space-y-2">
          <div v-for="(s, i) in opt.stops" :key="i" class="flex items-center gap-2">
            <input v-model="s.color" type="color" class="h-9 w-10 shrink-0 cursor-pointer rounded border border-line" />
            <input v-model="s.color" type="text" class="field-input w-28 shrink-0 font-mono text-sm" spellcheck="false" />
            <input v-model.number="s.pos" type="range" min="0" max="100" step="1" class="w-full accent-brand-600" />
            <span class="w-10 shrink-0 text-right text-sm tabular-nums text-ink-500">{{ s.pos }}%</span>
            <button
              class="shrink-0 rounded-lg border border-line px-2 py-1 text-sm text-ink-500 enabled:hover:bg-stone-50 disabled:opacity-40"
              :disabled="opt.stops.length <= 2"
              title="移除這個色標"
              @click="removeStop(i)"
            >
              ✕
            </button>
          </div>
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          <button class="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-stone-50 disabled:opacity-40" :disabled="opt.stops.length >= 8" @click="addStop">＋ 加色標</button>
          <button class="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-stone-50" @click="opt.stops = distributeStops(opt.stops)">平均分布</button>
          <button class="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-stone-50" @click="opt.stops = reverseStops(opt.stops)">反轉</button>
        </div>
      </div>

      <div>
        <label class="field-label">內建配色</label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="p in PRESETS"
            :key="p.name"
            class="h-9 w-9 rounded-lg border border-line shadow-sm transition hover:scale-110"
            :style="{ backgroundImage: `linear-gradient(${p.angle}deg, ${p.stops.map((s) => `${s.color} ${s.pos}%`).join(', ')})` }"
            :title="p.name"
            @click="applyPreset(p)"
          />
        </div>
      </div>
    </div>

    <div class="card p-6 space-y-3">
      <label class="field-label">CSS(可直接複製貼上)</label>
      <pre class="overflow-x-auto rounded-lg bg-stone-900 p-4 text-sm text-stone-100"><code>{{ cssText }}</code></pre>
      <button class="btn-primary" @click="copyCSS">{{ copied ? '已複製 ✓' : '複製 CSS' }}</button>
    </div>

    <LegalNote title="什麼時候用得到?">
      <ul class="list-disc pl-5 space-y-1">
        <li>替網頁、按鈕、卡片、背景、簡報配色,<strong>視覺化調出漸層</strong>後直接複製 CSS,免硬背語法。</li>
        <li>支援<strong>線性 / 放射 / 圓錐</strong>三種漸層、多個色標、角度與圓心位置,即時預覽。</li>
        <li><strong>全程在你瀏覽器計算、不連網、不上傳</strong>;無廣告,和色彩工坊、色階產生器、對比檢測互補。</li>
      </ul>
    </LegalNote>
  </div>
</template>
