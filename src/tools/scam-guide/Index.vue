<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import { scamTypes } from '@/features/scamGuide'

// 展開中的項目 id(一次可展開多個)
const open = ref<Set<string>>(new Set())
function toggle(id: string) {
  const next = new Set(open.value)
  next.has(id) ? next.delete(id) : next.add(id)
  open.value = next
}
</script>

<template>
  <div class="space-y-6">
    <div class="rounded-3xl border border-red-200 bg-red-50 p-6">
      <div class="flex items-start gap-3">
        <span class="text-3xl">📞</span>
        <div>
          <div class="text-xl font-black text-red-800">有疑問,先打 165</div>
          <p class="mt-1 text-sm leading-relaxed text-red-700">
            任何要你「立刻匯款、操作 ATM、交出存摺帳密、先繳錢才能領」的,幾乎都是詐騙。
            拿不定主意時,撥打 <strong>165 反詐騙專線</strong>,或先跟家人討論,別急著決定。
          </p>
        </div>
      </div>
    </div>

    <p class="text-ink-500">
      點開每一種詐騙,看「他們會怎麼說」「破綻在哪」「該怎麼做」。給自己,也轉給家裡長輩看看。
    </p>

    <div class="space-y-3">
      <div v-for="s in scamTypes" :key="s.id" class="card overflow-hidden">
        <button
          type="button"
          class="flex w-full items-center gap-3 p-5 text-left transition hover:bg-brand-50/50"
          :aria-expanded="open.has(s.id)"
          @click="toggle(s.id)"
        >
          <span class="text-2xl">{{ s.icon }}</span>
          <span class="flex-1 text-lg font-bold text-ink-900">{{ s.name }}</span>
          <span
            class="text-xl text-ink-300 transition-transform"
            :class="open.has(s.id) ? 'rotate-180' : ''"
            aria-hidden="true"
          >⌄</span>
        </button>

        <div v-if="open.has(s.id)" class="space-y-4 border-t border-line px-5 pb-5 pt-4">
          <div>
            <div class="mb-1 text-sm font-semibold text-ink-500">他們通常會這樣說</div>
            <p class="text-base leading-relaxed text-ink-700">{{ s.scenario }}</p>
          </div>
          <div>
            <div class="mb-1.5 text-sm font-semibold text-red-600">🚩 破綻在這裡</div>
            <ul class="list-disc space-y-1 pl-5 text-base leading-relaxed text-ink-700">
              <li v-for="(f, i) in s.redFlags" :key="i">{{ f }}</li>
            </ul>
          </div>
          <div>
            <div class="mb-1.5 text-sm font-semibold text-brand-700">✅ 該怎麼做</div>
            <ul class="list-disc space-y-1 pl-5 text-base leading-relaxed text-ink-700">
              <li v-for="(d, i) in s.whatToDo" :key="i">{{ d }}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <div class="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
      <p class="flex-1 text-sm text-ink-600">
        收到可疑連結或訊息?用這兩個工具當場檢查:
      </p>
      <div class="flex gap-2">
        <RouterLink to="/tools/link-check" class="rounded-xl border border-line bg-white px-4 py-2 text-sm font-medium text-brand-700 transition hover:border-brand-300">
          🛡️ 網址檢查
        </RouterLink>
        <RouterLink to="/tools/sms-check" class="rounded-xl border border-line bg-white px-4 py-2 text-sm font-medium text-brand-700 transition hover:border-brand-300">
          💬 簡訊檢查
        </RouterLink>
      </div>
    </div>

    <LegalNote title="資料來源與提醒">
      <p>本圖鑑依內政部警政署 165 反詐騙專線與刑事警察局公布的常見詐騙類型整理,供教育辨識用。</p>
      <p class="text-ink-500">
        詐騙手法不斷翻新,沒列到的不代表安全。受騙或可疑時請撥 <strong>165</strong>;若已轉帳,儘速聯絡銀行與報警處理。
      </p>
    </LegalNote>
  </div>
</template>
