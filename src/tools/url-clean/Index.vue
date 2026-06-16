<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { cleanUrls, type CleanResult } from '@/features/urlClean'

/*
  網址清理器 —— 還原轉址包裝(看清真正會去哪)+ 移除 utm_/fbclid 等追蹤參數。
  全程在本機處理,不上傳。可一次貼多行批次清理。
*/
const input = ref('')
const copiedIdx = ref<number | null>(null)
const copiedAll = ref(false)

const results = computed<CleanResult[]>(() => cleanUrls(input.value))

const okResults = computed(() => results.value.filter((r) => r.ok))
const changedCount = computed(() => okResults.value.filter((r) => r.changed).length)
const cleanedJoined = computed(() => okResults.value.map((r) => r.cleaned).join('\n'))

function loadSample() {
  input.value =
    'https://www.google.com/url?q=https%3A%2F%2Fexample.com%2Fnews&sa=D&usg=AOvVaw\n' +
    'https://shop.example.com/item/123?utm_source=line&utm_medium=share&fbclid=AbCdEf\n' +
    'https://youtu.be/dQw4w9WgXcQ?si=8a2Kp_trackingId'
}

async function copyText(text: string, idx: number | 'all') {
  try {
    await navigator.clipboard.writeText(text)
    if (idx === 'all') {
      copiedAll.value = true
      setTimeout(() => (copiedAll.value = false), 1500)
    } else {
      copiedIdx.value = idx
      setTimeout(() => (copiedIdx.value = null), 1500)
    }
  } catch {
    /* 忽略剪貼簿錯誤 */
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
      <div>
        <div class="mb-1 flex items-center justify-between">
          <label class="field-label mb-0" for="urls">貼上網址(可一行一個、批次清理)</label>
          <button type="button" class="text-sm text-brand-600 hover:underline" @click="loadSample">
            載入範例
          </button>
        </div>
        <textarea
          id="urls"
          v-model="input"
          rows="5"
          class="field-input font-mono text-sm break-all"
          placeholder="https://example.com/page?utm_source=..."
        />
        <p class="field-hint">
          這個工具會把「轉址跳板」還原成真正的目的地,並刪掉只用來追蹤你的參數(utm_、fbclid、gclid…)。
        </p>
      </div>

      <div v-if="okResults.length" class="space-y-4">
        <div class="flex items-center justify-between">
          <p class="text-sm text-ink-600">
            共 {{ okResults.length }} 筆,
            <span :class="changedCount ? 'font-semibold text-emerald-700' : ''">{{ changedCount }} 筆有清掉東西</span>
          </p>
          <button
            v-if="okResults.length > 1"
            type="button"
            class="rounded-lg border border-line bg-white px-3 py-1 text-sm font-semibold text-ink-700 transition hover:border-brand-300 hover:text-brand-700"
            @click="copyText(cleanedJoined, 'all')"
          >
            {{ copiedAll ? '已複製全部 ✓' : '複製全部' }}
          </button>
        </div>

        <div
          v-for="(r, i) in okResults"
          :key="i"
          class="rounded-2xl border border-line bg-paper/60 p-4 space-y-3"
        >
          <div>
            <div class="mb-1 flex items-center justify-between gap-2">
              <span class="text-xs font-semibold uppercase tracking-wide text-ink-500">清理後</span>
              <button
                type="button"
                class="shrink-0 rounded-lg border border-line bg-white px-3 py-1 text-sm font-semibold text-ink-700 transition hover:border-brand-300 hover:text-brand-700"
                @click="copyText(r.cleaned, i)"
              >
                {{ copiedIdx === i ? '已複製 ✓' : '複製' }}
              </button>
            </div>
            <p class="break-all rounded-lg bg-white px-3 py-2 font-mono text-sm text-ink-900 ring-1 ring-line">
              {{ r.cleaned }}
            </p>
          </div>

          <p v-if="!r.changed" class="text-sm text-ink-500">這個網址本來就很乾淨,沒有需要清理的地方 👍</p>

          <div v-if="r.unwrapped" class="text-sm">
            <span class="font-medium text-amber-700">⮑ 已還原轉址:</span>
            <span class="text-ink-600">原本會先經過</span>
            <span class="font-mono text-ink-800">{{ r.unwrapChain.join(' → ') }}</span>
            <span class="text-ink-600">再跳轉,上面是真正的目的地。</span>
          </div>

          <div v-if="r.removed.length" class="text-sm">
            <span class="font-medium text-emerald-700">移除 {{ r.removed.length }} 個追蹤參數:</span>
            <span class="mt-1 flex flex-wrap gap-1.5">
              <span
                v-for="(p, j) in r.removed"
                :key="j"
                class="rounded-full bg-rose-50 px-2 py-0.5 font-mono text-xs text-rose-700 line-through"
                :title="p.value"
              >{{ p.key }}</span>
            </span>
          </div>

          <p v-if="r.schemeAdded" class="text-xs text-ink-500">(已自動補上 https://)</p>
        </div>
      </div>

      <div v-else-if="input.trim()" class="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
        沒有解析到有效的網址。請確認每一行是一個 http / https 開頭的網址。
      </div>
    </div>

    <LegalNote title="這個工具在做什麼 / 注意事項">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>不上傳</strong>:全程在你的瀏覽器內處理,網址不會送到任何伺服器(不像很多線上工具會記錄你查過哪些連結)。</li>
        <li>
          <strong>還原轉址</strong>:Google 搜尋結果、Facebook、Outlook 安全連結等,常把連結包成「先到中介站再跳轉」。
          還原後你能在點擊前看清楚<strong>真正會去哪</strong>,避免被釣魚連結的偽裝騙過去。
        </li>
        <li>
          <strong>移除追蹤參數</strong>:刪掉 <span class="font-mono">utm_*、fbclid、gclid、si</span> 等只用來追蹤、分析你的參數。
          連結變短、不洩漏你是從哪裡點來的,而且網頁照常打得開。
        </li>
        <li class="text-amber-700">
          少數網站可能用 <span class="font-mono">ref、source、from</span> 等參數做必要功能。若清理後連結打不開,請改用原始連結。
        </li>
        <li>還原出真正網址<strong>不代表它就安全</strong>。看到可疑網域,可再用「可疑網址檢查器」進一步檢查。</li>
      </ul>
    </LegalNote>
  </div>
</template>
