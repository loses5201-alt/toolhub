<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { describeRRule, occurrences } from '@/features/rrule'

/*
  RRULE(RFC 5545 行事曆重複規則)解讀 —— 貼上 .ics 裡的 RRULE,用白話中文說明,
  並依起始時間算出接下來幾次實際發生的日期。全程在你的瀏覽器計算,不連網、不上傳。
*/
const rule = ref('FREQ=MONTHLY;BYDAY=-1FR')
// datetime-local 字串(本機時間),預設今天 09:00
function defaultStart(): string {
  const d = new Date()
  const p = (n: number) => (n < 10 ? '0' + n : '' + n)
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T09:00`
}
const start = ref(defaultStart())

const examples: { r: string; label: string }[] = [
  { r: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', label: '每個工作日' },
  { r: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=TU', label: '每隔一週的週二' },
  { r: 'FREQ=MONTHLY;BYDAY=-1FR', label: '每月最後一個週五' },
  { r: 'FREQ=MONTHLY;BYMONTHDAY=-1', label: '每月最後一天' },
  { r: 'FREQ=MONTHLY;BYDAY=2MO,4MO', label: '每月第 2、4 個週一' },
  { r: 'FREQ=YEARLY;BYMONTH=11;BYDAY=4TH', label: '每年 11 月第 4 個週四' },
  { r: 'FREQ=DAILY;INTERVAL=3;COUNT=5', label: '每 3 天、共 5 次' },
]

const startDate = computed(() => {
  const d = new Date(start.value)
  return isNaN(d.getTime()) ? null : d
})

const result = computed(() => {
  const e = rule.value.trim()
  if (!e) return { ok: false as const, error: '請輸入 RRULE' }
  const ds = startDate.value
  if (!ds) return { ok: false as const, error: '請選擇有效的開始時間' }
  try {
    return { ok: true as const, desc: describeRRule(e, ds), runs: occurrences(e, ds, 12) }
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : '無法解析' }
  }
})

const weekCN = ['日', '一', '二', '三', '四', '五', '六']
function fmt(d: Date): string {
  const p = (n: number) => (n < 10 ? '0' + n : '' + n)
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}(週${weekCN[d.getDay()]}) ${p(d.getHours())}:${p(d.getMinutes())}`
}
function relative(d: Date): string {
  const diff = d.getTime() - Date.now()
  const past = diff < 0
  const min = Math.round(Math.abs(diff) / 60000)
  let s: string
  if (min < 60) s = `${min} 分鐘`
  else if (min < 2880) s = `${Math.round(min / 60)} 小時`
  else s = `${Math.round(min / 1440)} 天`
  return past ? `${s}前` : `約 ${s}後`
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">RRULE 重複規則</label>
        <input v-model="rule" class="field-input font-mono tracking-wide" placeholder="FREQ=WEEKLY;BYDAY=MO,WE,FR" spellcheck="false" />
        <p class="field-hint">
          貼上行事曆 <code>.ics</code> 檔裡的 <code>RRULE</code> 那行即可(含 <code>RRULE:</code> 或整段含 <code>DTSTART</code> 也可以)。
          支援 <code>FREQ</code> / <code>INTERVAL</code> / <code>COUNT</code> / <code>UNTIL</code> / <code>BYMONTH</code> / <code>BYMONTHDAY</code> / <code>BYDAY</code> / <code>BYSETPOS</code> / <code>WKST</code>。全程在瀏覽器計算,不上傳。
        </p>
      </div>

      <div>
        <label class="field-label">開始時間(DTSTART)</label>
        <input v-model="start" type="datetime-local" class="field-input" />
        <p class="field-hint">重複規則需要一個起算時間;發生時間會沿用這裡的時刻。預設為今天上午 9 點。</p>
      </div>

      <div>
        <div class="mb-1.5 text-xs font-semibold text-ink-400">常用範例</div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="ex in examples"
            :key="ex.r"
            type="button"
            class="rounded-lg border border-ink-200 px-3 py-1.5 text-sm text-ink-600 transition hover:bg-ink-50"
            @click="rule = ex.r"
          >
            {{ ex.label }}
          </button>
        </div>
      </div>

      <div v-if="!result.ok" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
        ⚠️ {{ result.error }}
      </div>

      <div v-else class="rounded-xl border border-brand-200 bg-brand-50/60 p-4">
        <div class="text-xs font-semibold text-brand-700">白話說明</div>
        <p class="mt-1 text-lg text-ink-800">{{ result.desc }}</p>
      </div>
    </div>

    <div v-if="result.ok" class="card p-5">
      <div class="mb-3 flex items-center gap-2">
        <span class="text-sm font-semibold text-ink-700">接下來的發生時間</span>
        <span class="text-xs text-ink-400">(依你裝置的本機時區)</span>
      </div>
      <ol v-if="result.runs.length" class="space-y-2">
        <li
          v-for="(d, i) in result.runs"
          :key="i"
          class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-lg bg-ink-50 px-3 py-2"
        >
          <span class="text-xs font-semibold text-ink-400">{{ i + 1 }}</span>
          <span class="font-mono text-ink-800">{{ fmt(d) }}</span>
          <span class="text-sm text-brand-700">{{ relative(d) }}</span>
        </li>
      </ol>
      <p v-else class="text-sm text-ink-500">在可預見的範圍內找不到符合的時間(可能是規則與開始時間不相符,或日期組合不存在)。</p>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>從 Google / Apple / Outlook 行事曆<strong>匯出的 <code>.ics</code> 檔</strong>裡,那串 <code>RRULE</code> 沒人看得懂 —— 這裡用白話中文解讀,並直接列出接下來幾次的實際日期。</li>
        <li>設定「每月最後一個週五」「每隔一週開會」「每年第 4 個週四」這類規則時,先驗證會不會設錯。</li>
        <li>RRULE 小提醒:當「日」與「週」<strong>同時</strong>限定時(例 <code>BYDAY=FR;BYMONTHDAY=13</code>,黑色星期五)是「兩者都要符合」;<code>WKST</code>(每週起始日)在 <code>INTERVAL</code>&gt;1 且跨週的規則下會影響結果。</li>
        <li>本工具<strong>不連網、不上傳</strong>,發生時間以你裝置的本機時區計算;聚焦行事曆常用的日/週/月/年規則,不支援 <code>BYYEARDAY</code>、<code>BYWEEKNO</code> 等罕用欄位。</li>
      </ul>
    </LegalNote>
  </div>
</template>
