<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { buildIcs, type EventInput } from '@/features/icsEvent'

/*
  行事曆事件 .ics 產生器 —— 填好活動內容,下載 .ics 直接匯入 Google / Apple / Outlook 行事曆,
  不必把活動交給任何網站、也不必授權 App 存取你的行事曆。全程在你的瀏覽器產生,不上傳。
*/
const form = reactive<EventInput>({
  title: '',
  start: '',
  end: '',
  allDay: false,
  location: '',
  description: '',
  url: '',
  reminderMinutes: 30,
})

const reminderOptions = [
  { v: null, label: '不提醒' },
  { v: 0, label: '準時' },
  { v: 10, label: '10 分鐘前' },
  { v: 30, label: '30 分鐘前' },
  { v: 60, label: '1 小時前' },
  { v: 1440, label: '1 天前' },
]

const result = computed(() => buildIcs(form))

function downloadIcs() {
  const r = result.value
  if (!r.ok) return
  const blob = new Blob([r.ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = r.filename
  a.click()
  URL.revokeObjectURL(url)
}

const showPreview = ref(false)
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">活動標題 *</label>
        <input v-model="form.title" type="text" placeholder="例:牙醫回診、同學會、繳卡費" class="field-input" />
      </div>

      <label class="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-700">
        <input v-model="form.allDay" type="checkbox" class="accent-brand-600" />
        整天活動(只選日期,不分時段)
      </label>

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label">開始 *</label>
          <input
            v-model="form.start"
            :type="form.allDay ? 'date' : 'datetime-local'"
            class="field-input"
          />
        </div>
        <div>
          <label class="field-label">結束{{ form.allDay ? '' : '(留空 = +1 小時)' }}</label>
          <input
            v-model="form.end"
            :type="form.allDay ? 'date' : 'datetime-local'"
            class="field-input"
          />
        </div>
      </div>

      <div>
        <label class="field-label">地點</label>
        <input v-model="form.location" type="text" placeholder="例:台北市信義區…" class="field-input" />
      </div>

      <div>
        <label class="field-label">備註 / 說明</label>
        <textarea v-model="form.description" rows="3" placeholder="可換行,匯入後會出現在活動說明" class="field-input text-sm" />
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label">相關連結</label>
          <input v-model="form.url" type="url" placeholder="https://…" class="field-input" />
        </div>
        <div>
          <label class="field-label">提醒</label>
          <select v-model="form.reminderMinutes" class="field-input">
            <option v-for="o in reminderOptions" :key="String(o.v)" :value="o.v">{{ o.label }}</option>
          </select>
        </div>
      </div>

      <div v-if="!result.ok" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
        ⚠️ {{ result.error }}
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <button
          class="rounded-xl bg-brand-600 px-6 py-2.5 font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-40"
          :disabled="!result.ok"
          @click="downloadIcs"
        >
          📅 下載 .ics 檔
        </button>
        <button class="text-sm text-brand-700 underline hover:text-brand-800" @click="showPreview = !showPreview">
          {{ showPreview ? '隱藏' : '查看' }}檔案內容
        </button>
      </div>

      <pre v-if="showPreview && result.ok" class="overflow-x-auto rounded-xl bg-stone-900 p-4 text-xs text-stone-100">{{ result.ics }}</pre>
    </div>

    <LegalNote title="怎麼用、為什麼用這個?">
      <ul class="list-disc pl-5 space-y-1">
        <li>下載 <code>.ics</code> 後,在手機/電腦<strong>點開檔案</strong>即可加入內建行事曆;或在 Google 行事曆「設定 → 匯入」上傳。</li>
        <li><strong>不必授權</strong>:不像很多「活動報名/邀請」服務要綁定你的 Google 帳號,這裡只產生一個標準檔案,你自己決定加到哪。</li>
        <li>時間採「<strong>浮動本地時間</strong>」(以你裝置所在時區顯示),適合一般個人行程;跨時區會議請自行確認。</li>
        <li>本工具<strong>不連網、不上傳</strong>,活動內容只在你的瀏覽器組成檔案。</li>
      </ul>
    </LegalNote>
  </div>
</template>
