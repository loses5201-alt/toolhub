<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import { processUrl } from '@/features/urlClean'

/*
  網址清理 / 看穿轉址 —— 兩件事:
   1) 看穿轉址:把 google.com/url?q=…、facebook l.php?u=…、Outlook safelinks 等「轉址包裝」
      一層層拆開,先看清楚連結「最後到底連去哪」再決定點不點(詐騙常用包裝藏釣魚連結)。
   2) 清理追蹤:移除 utm_*、fbclid、gclid 等追蹤參數,分享出去的連結更乾淨、更短、不洩漏來源。
  全程在你的瀏覽器計算,不連網、不上傳。
*/
const input = ref('')
const result = computed(() => (input.value.trim() ? processUrl(input.value) : null))

const copied = ref(false)
function copyClean() {
  const text = result.value?.clean.cleaned
  if (!text) return
  navigator.clipboard?.writeText(text)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

// 最終目標主機名(給看穿轉址的安心/警示提示)
const finalHost = computed(() => {
  try {
    return new URL(result.value!.unwrap.finalUrl).hostname
  } catch {
    return ''
  }
})
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">貼上要檢查 / 清理的網址</label>
        <textarea
          v-model="input"
          rows="3"
          placeholder="例:https://www.google.com/url?q=https%3A%2F%2F…  或帶 ?utm_source=… 的分享連結"
          class="field-input font-mono text-sm break-all"
        />
        <p class="field-hint">全程在你的瀏覽器處理,不會連網、不會上傳。可貼長輩 LINE 轉來的連結先看清楚去哪。</p>
      </div>

      <div v-if="result && !result.ok" class="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-800">
        ⚠️ 這看起來不是有效的 http(s) 網址,請確認貼上的內容。
      </div>

      <template v-if="result && result.ok">
        <!-- 看穿轉址 -->
        <div v-if="result.unwrap.wrapped" class="rounded-2xl border border-sky-200 bg-sky-50/60 p-5 space-y-3">
          <div class="font-bold text-sky-800">🔎 這是「轉址包裝」連結,真正會連到:</div>
          <ol class="space-y-1.5 text-sm">
            <li v-for="(hop, i) in result.unwrap.hops" :key="i" class="flex gap-2">
              <span class="shrink-0 text-ink-400">{{ i === 0 ? '你貼的' : `第 ${i} 層` }}</span>
              <span class="font-mono break-all" :class="i === result.unwrap.hops.length - 1 ? 'font-semibold text-sky-900' : 'text-ink-500'">{{ hop }}</span>
            </li>
          </ol>
          <p class="text-sm text-sky-800">
            最後落點主機:<strong class="font-mono">{{ finalHost }}</strong> —— 點之前先確認這是你信任的網站。
          </p>
        </div>
        <div v-else class="rounded-xl border border-ink-100 bg-stone-50 p-4 text-sm text-ink-600">
          ✅ 這不是轉址包裝連結,目標就是它本身。
        </div>

        <!-- 清理追蹤 -->
        <div class="rounded-2xl border border-line p-5 space-y-3">
          <div class="flex items-center gap-3">
            <h3 class="font-bold text-ink-800">🧹 清理後的乾淨網址</h3>
            <button class="text-sm text-brand-700 underline hover:text-brand-800" @click="copyClean">
              {{ copied ? '已複製 ✓' : '複製' }}
            </button>
          </div>
          <p class="break-all rounded-xl bg-stone-50 p-3 font-mono text-sm text-ink-800">{{ result.clean.cleaned }}</p>
          <div v-if="result.clean.removed.length" class="text-sm text-ink-600">
            已移除 {{ result.clean.removed.length }} 個追蹤參數:
            <span class="font-mono text-amber-700">{{ result.clean.removed.join('、') }}</span>
          </div>
          <div v-else class="text-sm text-emerald-700">這個網址沒有夾帶常見追蹤參數,很乾淨。</div>
        </div>

        <div class="text-sm text-ink-500">
          不確定落點網站安不安全?
          <RouterLink to="/tools/link-check" class="font-semibold text-brand-700 underline hover:text-brand-800">
            用可疑網址檢查器查一下 →
          </RouterLink>
        </div>
      </template>
    </div>

    <LegalNote title="這個工具在做什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>看穿轉址</strong>:很多連結是包裝過的(<code>google.com/url?q=</code>、Facebook <code>l.php?u=</code>、Outlook safelinks…),真正目標藏在參數裡。本工具把它拆開,讓你先看清楚「最後連去哪」—— 詐騙常用包裝把釣魚網址藏起來。</li>
        <li><strong>清理追蹤</strong>:移除 <code>utm_*</code>、<code>fbclid</code>、<code>gclid</code> 等追蹤參數,分享連結更乾淨、更短,也不洩漏你從哪來。</li>
        <li>「看清楚去哪」<strong>不等於「保證安全」</strong>:落點仍可能是釣魚站,務必再用網址檢查器或打 165 查證。</li>
        <li>本工具<strong>不連網、不上傳</strong>:只在你的瀏覽器解析網址字串,不會實際連去那個網站。</li>
      </ul>
    </LegalNote>
  </div>
</template>
