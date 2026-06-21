<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseNumbers, summarize, histogram } from '@/features/descriptiveStats'

/*
  描述統計計算機 —— 貼上一串數字,算出平均、中位數、眾數、標準差、四分位數、
  偏度峰度、離群值,並畫出直方圖與盒鬚圖。全程在你的瀏覽器計算,不連網、不上傳。
*/

const input = ref('85, 90, 78, 92, 88, 76, 95, 89, 84, 91, 73, 100')
const binChoice = ref<'auto' | number>('auto')

const parsed = computed(() => parseNumbers(input.value))
const s = computed(() => summarize(parsed.value.values))

function fmt(x: number | null | undefined): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—'
  if (Number.isInteger(x)) return x.toLocaleString('en-US')
  const r = Number(x.toPrecision(7))
  return r.toLocaleString('en-US', { maximumFractionDigits: 6 })
}

const modeText = computed(() => {
  const st = s.value
  if (!st) return '—'
  if (!st.modes.length) return '無(數值皆不重複)'
  return `${st.modes.map(fmt).join('、')}(各 ${st.modeCount} 次)`
})

// 偏度白話
const skewText = computed(() => {
  const k = s.value?.skewness
  if (k === null || k === undefined) return ''
  if (Math.abs(k) < 0.5) return '近似對稱'
  if (k > 0) return Math.abs(k) > 1 ? '明顯右偏(長尾在右)' : '輕微右偏'
  return Math.abs(k) > 1 ? '明顯左偏(長尾在左)' : '輕微左偏'
})
const kurtText = computed(() => {
  const k = s.value?.kurtosis
  if (k === null || k === undefined) return ''
  if (Math.abs(k) < 0.5) return '接近常態(中峰)'
  return k > 0 ? '尖峰厚尾(極端值偏多)' : '平峰薄尾(分布平緩)'
})

// ── 直方圖 ──
const bins = computed(() => {
  const vals = parsed.value.values
  if (!vals.length) return []
  return histogram(vals, binChoice.value === 'auto' ? undefined : binChoice.value)
})
const maxBin = computed(() => bins.value.reduce((m, b) => Math.max(m, b.count), 0) || 1)

// ── 盒鬚圖(viewBox 0 0 400 90,資料映射到 x∈[40,360])──
const box = computed(() => {
  const st = s.value
  if (!st) return null
  const lo = st.min
  const hi = st.max
  const span = hi - lo || 1
  const X = (v: number) => 40 + ((v - lo) / span) * 320
  const inside = st.sortedAsc.filter((v) => v >= st.lowerFence && v <= st.upperFence)
  const wLo = inside.length ? inside[0] : st.min
  const wHi = inside.length ? inside[inside.length - 1] : st.max
  return { X, q1: st.q1, q3: st.q3, med: st.median, wLo, wHi, outliers: st.outliers, lo, hi }
})

function loadExample() {
  input.value = '12.5, 13.1, 11.8, 14.2, 13.6, 12.9, 13.4, 11.5, 15.0, 13.2, 12.7, 14.8, 13.9, 12.1'
}
function clearAll() {
  input.value = ''
}
</script>

<template>
  <div class="space-y-6">
    <!-- 輸入 -->
    <div class="card p-6 space-y-3">
      <label class="field-label" for="data">貼上數字(換行、逗號、空白或分號分隔皆可,可直接從 Excel 一欄貼上)</label>
      <textarea
        id="data"
        v-model="input"
        rows="5"
        placeholder="例如&#10;85&#10;90&#10;78&#10;…或 85, 90, 78, 92"
        class="field-input w-full font-mono text-sm"
      ></textarea>
      <div class="flex flex-wrap items-center gap-3 text-sm">
        <button type="button" class="rounded-lg border border-line px-3 py-1.5 font-medium text-ink-700 transition hover:bg-ink-50" @click="loadExample">載入範例</button>
        <button type="button" class="rounded-lg border border-line px-3 py-1.5 font-medium text-ink-700 transition hover:bg-ink-50" @click="clearAll">清空</button>
        <span class="text-ink-500">
          已讀取 <strong class="text-ink-800">{{ parsed.values.length }}</strong> 個數值<span
            v-if="parsed.ignored"
            class="text-amber-600"
            >,忽略 {{ parsed.ignored }} 個非數字</span
          >
        </span>
      </div>
    </div>

    <template v-if="s">
      <!-- 集中趨勢 -->
      <div class="card p-6 space-y-4">
        <h2 class="text-lg font-bold text-ink-900">集中趨勢與基本量</h2>
        <div class="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <div class="rounded-xl bg-brand-50 p-4">
            <div class="text-xs text-ink-500">平均數 (Mean)</div>
            <div class="mt-1 break-all text-2xl font-bold text-ink-900">{{ fmt(s.mean) }}</div>
          </div>
          <div class="rounded-xl bg-brand-50 p-4">
            <div class="text-xs text-ink-500">中位數 (Median)</div>
            <div class="mt-1 break-all text-2xl font-bold text-ink-900">{{ fmt(s.median) }}</div>
          </div>
          <div class="rounded-xl border border-line p-4">
            <div class="text-xs text-ink-500">眾數 (Mode)</div>
            <div class="mt-1 break-all text-base font-semibold text-ink-800">{{ modeText }}</div>
          </div>
          <div class="rounded-xl border border-line p-4">
            <div class="text-xs text-ink-500">總和 (Sum)</div>
            <div class="mt-1 break-all text-xl font-bold text-ink-900">{{ fmt(s.sum) }}</div>
          </div>
          <div class="rounded-xl border border-line p-4">
            <div class="text-xs text-ink-500">個數 (Count)</div>
            <div class="mt-1 text-xl font-bold text-ink-900">{{ fmt(s.count) }}</div>
          </div>
          <div class="rounded-xl border border-line p-4">
            <div class="text-xs text-ink-500">最小值 / 最大值</div>
            <div class="mt-1 break-all text-base font-semibold text-ink-800">{{ fmt(s.min) }} ～ {{ fmt(s.max) }}</div>
          </div>
          <div class="rounded-xl border border-line p-4">
            <div class="text-xs text-ink-500">全距 (Range)</div>
            <div class="mt-1 break-all text-xl font-bold text-ink-900">{{ fmt(s.range) }}</div>
          </div>
          <div class="rounded-xl border border-line p-4">
            <div class="text-xs text-ink-500">均方根 (RMS)</div>
            <div class="mt-1 break-all text-xl font-bold text-ink-900">{{ fmt(s.rms) }}</div>
          </div>
        </div>
      </div>

      <!-- 離散程度 -->
      <div class="card p-6 space-y-4">
        <h2 class="text-lg font-bold text-ink-900">離散程度</h2>
        <p class="text-sm text-ink-500">
          「樣本」用 n−1(資料是從母體抽樣,最常用);「母體」用 n(資料就是全部對象)。
        </p>
        <div class="grid gap-3 sm:grid-cols-3">
          <div class="rounded-xl bg-brand-50 p-4">
            <div class="text-xs text-ink-500">樣本標準差 (s)</div>
            <div class="mt-1 break-all text-2xl font-bold text-ink-900">{{ fmt(s.sampleStdDev) }}</div>
          </div>
          <div class="rounded-xl border border-line p-4">
            <div class="text-xs text-ink-500">母體標準差 (σ)</div>
            <div class="mt-1 break-all text-xl font-bold text-ink-900">{{ fmt(s.popStdDev) }}</div>
          </div>
          <div class="rounded-xl border border-line p-4">
            <div class="text-xs text-ink-500">變異係數 (CV)</div>
            <div class="mt-1 break-all text-xl font-bold text-ink-900">
              {{ s.coefVariation === null ? '—' : (s.coefVariation * 100).toFixed(2) + '%' }}
            </div>
          </div>
          <div class="rounded-xl border border-line p-4">
            <div class="text-xs text-ink-500">樣本變異數 (s²)</div>
            <div class="mt-1 break-all text-lg font-semibold text-ink-800">{{ fmt(s.sampleVariance) }}</div>
          </div>
          <div class="rounded-xl border border-line p-4">
            <div class="text-xs text-ink-500">母體變異數 (σ²)</div>
            <div class="mt-1 break-all text-lg font-semibold text-ink-800">{{ fmt(s.popVariance) }}</div>
          </div>
          <div class="rounded-xl border border-line p-4">
            <div class="text-xs text-ink-500">平均數標準誤 (SEM)</div>
            <div class="mt-1 break-all text-lg font-semibold text-ink-800">{{ fmt(s.stdError) }}</div>
          </div>
        </div>
      </div>

      <!-- 四分位數 + 盒鬚圖 -->
      <div class="card p-6 space-y-4">
        <h2 class="text-lg font-bold text-ink-900">四分位數與離群值</h2>
        <div class="grid gap-3 sm:grid-cols-4">
          <div class="rounded-xl border border-line p-4">
            <div class="text-xs text-ink-500">Q1(25%)</div>
            <div class="mt-1 break-all text-xl font-bold text-ink-900">{{ fmt(s.q1) }}</div>
          </div>
          <div class="rounded-xl border border-line p-4">
            <div class="text-xs text-ink-500">Q2 中位數(50%)</div>
            <div class="mt-1 break-all text-xl font-bold text-ink-900">{{ fmt(s.median) }}</div>
          </div>
          <div class="rounded-xl border border-line p-4">
            <div class="text-xs text-ink-500">Q3(75%)</div>
            <div class="mt-1 break-all text-xl font-bold text-ink-900">{{ fmt(s.q3) }}</div>
          </div>
          <div class="rounded-xl border border-line p-4">
            <div class="text-xs text-ink-500">四分位距 (IQR)</div>
            <div class="mt-1 break-all text-xl font-bold text-ink-900">{{ fmt(s.iqr) }}</div>
          </div>
        </div>

        <!-- 盒鬚圖 -->
        <svg v-if="box" viewBox="0 0 400 90" class="w-full" role="img" aria-label="盒鬚圖">
          <!-- 鬚:從界內最小延伸到界內最大 -->
          <line :x1="box.X(box.wLo)" y1="45" :x2="box.X(box.wHi)" y2="45" stroke="#94a3b8" stroke-width="1.5" />
          <!-- 鬚的端帽 -->
          <line :x1="box.X(box.wLo)" y1="33" :x2="box.X(box.wLo)" y2="57" stroke="#94a3b8" stroke-width="1.5" />
          <line :x1="box.X(box.wHi)" y1="33" :x2="box.X(box.wHi)" y2="57" stroke="#94a3b8" stroke-width="1.5" />
          <!-- 盒 -->
          <rect
            :x="box.X(box.q1)"
            y="25"
            :width="Math.max(box.X(box.q3) - box.X(box.q1), 1)"
            height="40"
            fill="#dbeafe"
            stroke="#3b82f6"
            stroke-width="1.5"
            rx="3"
          />
          <!-- 中位數 -->
          <line :x1="box.X(box.med)" y1="25" :x2="box.X(box.med)" y2="65" stroke="#1d4ed8" stroke-width="2.5" />
          <!-- 離群值 -->
          <circle
            v-for="(o, i) in box.outliers"
            :key="i"
            :cx="box.X(o)"
            cy="45"
            r="3.5"
            fill="#ef4444"
            opacity="0.8"
          />
          <text x="40" y="82" font-size="10" fill="#64748b" text-anchor="middle">{{ fmt(box.lo) }}</text>
          <text x="360" y="82" font-size="10" fill="#64748b" text-anchor="middle">{{ fmt(box.hi) }}</text>
        </svg>

        <div
          v-if="s.outliers.length"
          class="rounded-xl bg-amber-50 p-4 text-sm text-amber-800"
        >
          <strong>偵測到 {{ s.outliers.length }} 個離群值</strong>(落在 [{{ fmt(s.lowerFence) }}, {{ fmt(s.upperFence) }}] 之外,1.5×IQR 規則,紅點):
          <span class="font-mono">{{ s.outliers.map(fmt).join('、') }}</span>
        </div>
        <p v-else class="text-sm text-ink-500">依 1.5×IQR 規則,未偵測到離群值。</p>
      </div>

      <!-- 分布形狀 -->
      <div class="card p-6 space-y-4">
        <h2 class="text-lg font-bold text-ink-900">分布形狀</h2>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-xl border border-line p-4">
            <div class="text-xs text-ink-500">偏度 (Skewness)</div>
            <div class="mt-1 break-all text-xl font-bold text-ink-900">{{ fmt(s.skewness) }}</div>
            <div v-if="skewText" class="mt-1 text-sm text-ink-600">{{ skewText }}</div>
            <div v-else class="mt-1 text-sm text-ink-400">需至少 3 個數值</div>
          </div>
          <div class="rounded-xl border border-line p-4">
            <div class="text-xs text-ink-500">超額峰度 (Excess Kurtosis)</div>
            <div class="mt-1 break-all text-xl font-bold text-ink-900">{{ fmt(s.kurtosis) }}</div>
            <div v-if="kurtText" class="mt-1 text-sm text-ink-600">{{ kurtText }}</div>
            <div v-else class="mt-1 text-sm text-ink-400">需至少 4 個數值</div>
          </div>
          <div class="rounded-xl border border-line p-4">
            <div class="text-xs text-ink-500">幾何平均 (Geometric)</div>
            <div class="mt-1 break-all text-lg font-semibold text-ink-800">{{ fmt(s.geometricMean) }}</div>
            <div v-if="s.geometricMean === null" class="mt-1 text-xs text-ink-400">含非正數,不適用</div>
          </div>
          <div class="rounded-xl border border-line p-4">
            <div class="text-xs text-ink-500">調和平均 (Harmonic)</div>
            <div class="mt-1 break-all text-lg font-semibold text-ink-800">{{ fmt(s.harmonicMean) }}</div>
            <div v-if="s.harmonicMean === null" class="mt-1 text-xs text-ink-400">含非正數,不適用</div>
          </div>
        </div>
      </div>

      <!-- 直方圖 -->
      <div class="card p-6 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-lg font-bold text-ink-900">直方圖</h2>
          <label class="flex items-center gap-2 text-sm text-ink-600">
            分組數
            <select v-model="binChoice" class="field-input py-1">
              <option value="auto">自動</option>
              <option :value="5">5</option>
              <option :value="10">10</option>
              <option :value="15">15</option>
              <option :value="20">20</option>
            </select>
          </label>
        </div>
        <div class="flex items-end gap-1" style="height: 160px">
          <div
            v-for="(b, i) in bins"
            :key="i"
            class="flex-1 rounded-t bg-brand-400/80 transition-all hover:bg-brand-500"
            :style="{ height: (b.count / maxBin) * 100 + '%' }"
            :title="`${fmt(b.start)} ～ ${fmt(b.end)}:${b.count} 筆`"
          ></div>
        </div>
        <div class="flex justify-between text-xs text-ink-500">
          <span>{{ fmt(s.min) }}</span>
          <span>各長條數字代表落在該區間的筆數(滑過看區間)</span>
          <span>{{ fmt(s.max) }}</span>
        </div>
      </div>
    </template>

    <p v-else-if="parsed.values.length === 0 && input.trim()" class="card p-6 text-sm text-ink-500">
      找不到可用的數字,請確認輸入內容。
    </p>

    <LegalNote title="計算方法說明">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>四分位數 / 百分位數</strong>:採線性內插法(R-7),與 Excel 的 <code>QUARTILE.INC</code>、<code>PERCENTILE.INC</code> 一致。</li>
        <li><strong>標準差 / 變異數</strong>:同時給「樣本」(除以 n−1)與「母體」(除以 n);抽樣調查通常看樣本標準差。</li>
        <li><strong>偏度</strong>採 Excel <code>SKEW</code>(調整後 Fisher–Pearson),<strong>峰度</strong>採 Excel <code>KURT</code>(超額峰度,常態分布為 0)。</li>
        <li><strong>離群值</strong>:以 Q1−1.5×IQR 與 Q3+1.5×IQR 為界(Tukey 規則),界外即標為離群;盒鬚圖的鬚只延伸到界內最遠的點。</li>
        <li>非數字內容會自動忽略;結果僅供參考,實際分析請依資料性質選用適當方法。全程在你的瀏覽器計算,<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
