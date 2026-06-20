<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseIcs, type IcsEvent, type IcsDate } from '@/features/ics'
import { describeRRule, occurrences } from '@/features/rrule'

/*
  .ics 行事曆檢視器 —— 貼上或開啟 .ics 檔,列出每筆事件(摘要、起訖、地點、說明),
  重複事件用 RRULE 引擎翻成白話並列出接下來幾次。全程在你瀏覽器解析,不連網、不上傳。
*/
const raw = ref('')
const fileName = ref('')

const SAMPLE = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:每月部門例會
DTSTART:20260105T140000
DTEND:20260105T150000
LOCATION:會議室 A
RRULE:FREQ=MONTHLY;BYDAY=1MO
END:VEVENT
BEGIN:VEVENT
SUMMARY:專案結案日
DTSTART;VALUE=DATE:20260320
END:VEVENT
END:VCALENDAR`

function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  fileName.value = f.name
  const reader = new FileReader()
  reader.onload = () => { raw.value = String(reader.result || '') }
  reader.readAsText(f)
}

const result = computed(() => {
  const text = raw.value.trim()
  if (!text) return { events: [] as IcsEvent[], parsed: false }
  try {
    return { events: parseIcs(text), parsed: true }
  } catch {
    return { events: [] as IcsEvent[], parsed: true }
  }
})

const weekCN = ['日', '一', '二', '三', '四', '五', '六']
const p = (n: number) => (n < 10 ? '0' + n : '' + n)
function fmtDate(d: IcsDate | undefined): string {
  if (!d) return '—'
  const dt = d.date
  const base = `${dt.getFullYear()}/${p(dt.getMonth() + 1)}/${p(dt.getDate())}(週${weekCN[dt.getDay()]})`
  return d.allDay ? `${base}(整天)` : `${base} ${p(dt.getHours())}:${p(dt.getMinutes())}`
}
function fmtRun(d: Date): string {
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}(週${weekCN[d.getDay()]}) ${p(d.getHours())}:${p(d.getMinutes())}`
}
function ruleDesc(ev: IcsEvent): string {
  if (!ev.rrule || !ev.start) return ''
  try { return describeRRule(ev.rrule, ev.start.date) } catch { return ev.rrule }
}
function nextRuns(ev: IcsEvent): Date[] {
  if (!ev.rrule || !ev.start) return []
  try { return occurrences(ev.rrule, ev.start.date, 5) } catch { return [] }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div class="flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept=".ics,text/calendar"
          class="block text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-brand-500 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-brand-600"
          @change="onFile"
        />
        <button type="button" class="text-sm text-brand-700 hover:underline" @click="raw = SAMPLE; fileName = ''">
          載入範例
        </button>
        <span v-if="fileName" class="text-sm text-ink-500">{{ fileName }}</span>
      </div>
      <div>
        <label class="field-label">或直接貼上 .ics 內容</label>
        <textarea
          v-model="raw"
          rows="6"
          class="field-input font-mono text-sm"
          placeholder="BEGIN:VCALENDAR&#10;..."
          spellcheck="false"
        ></textarea>
        <p class="field-hint">支援會議邀請、訂閱行事曆匯出的 .ics。全程在你瀏覽器解析,行程內容不上傳。</p>
      </div>
    </div>

    <div v-if="result.parsed && !result.events.length" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
      ⚠️ 找不到事件(VEVENT)。請確認這是有效的 .ics 行事曆檔。
    </div>

    <div v-if="result.events.length" class="space-y-4">
      <div class="text-sm font-semibold text-ink-700">共 {{ result.events.length }} 筆事件</div>
      <div
        v-for="(ev, i) in result.events"
        :key="i"
        class="card p-5 space-y-2"
      >
        <div class="flex items-baseline gap-2">
          <span class="text-xs font-semibold text-ink-400">{{ i + 1 }}</span>
          <h3 class="text-lg font-semibold text-ink-800">{{ ev.summary || '(無標題)' }}</h3>
        </div>
        <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt class="text-ink-400">開始</dt>
          <dd class="text-ink-700">{{ fmtDate(ev.start) }}</dd>
          <template v-if="ev.end">
            <dt class="text-ink-400">結束</dt>
            <dd class="text-ink-700">{{ fmtDate(ev.end) }}</dd>
          </template>
          <template v-if="ev.location">
            <dt class="text-ink-400">地點</dt>
            <dd class="text-ink-700">{{ ev.location }}</dd>
          </template>
          <template v-if="ev.organizer">
            <dt class="text-ink-400">主辦</dt>
            <dd class="text-ink-700">{{ ev.organizer }}</dd>
          </template>
          <template v-if="ev.status">
            <dt class="text-ink-400">狀態</dt>
            <dd class="text-ink-700">{{ ev.status }}</dd>
          </template>
        </dl>
        <p v-if="ev.description" class="whitespace-pre-wrap rounded-lg bg-ink-50 p-3 text-sm text-ink-600">{{ ev.description }}</p>

        <div v-if="ev.rrule" class="rounded-xl border border-brand-200 bg-brand-50/60 p-3">
          <div class="text-xs font-semibold text-brand-700">🔁 重複規則</div>
          <p class="mt-0.5 text-ink-800">{{ ruleDesc(ev) }}</p>
          <div v-if="nextRuns(ev).length" class="mt-2">
            <div class="text-xs text-ink-400">接下來幾次:</div>
            <ul class="mt-1 space-y-0.5">
              <li v-for="(d, k) in nextRuns(ev)" :key="k" class="font-mono text-sm text-ink-700">{{ fmtRun(d) }}</li>
            </ul>
          </div>
          <div class="mt-1 font-mono text-xs text-ink-400">{{ ev.rrule }}</div>
        </div>
      </div>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>收到 <code>.ics</code> 會議邀請或匯出整本行事曆時,不必匯入手機就能<strong>先看清楚有哪些事件、什麼時候、在哪裡</strong>。</li>
        <li>遇到重複事件,直接把 <code>RRULE</code> 翻成白話(例「每月第一個週一」),並<strong>列出接下來幾次的實際日期</strong>。</li>
        <li>行事曆常含會議、客戶、住家地址等隱私,線上 .ics 檢視器卻要你上傳 —— 本工具<strong>全程在你瀏覽器解析,不連網、不上傳</strong>。</li>
        <li>時間以你裝置的本機時區顯示;若 .ics 標示了其他時區(TZID)或 UTC,實際時間請對照原時區。與「.ics 事件產生器」「RRULE 解讀」互補。</li>
      </ul>
    </LegalNote>
  </div>
</template>
