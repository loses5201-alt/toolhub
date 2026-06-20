<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import { generateTwists, countTwists, parseDomain } from '@/features/domainTwist'

/*
  相似網域產生(防仿冒)—— 輸入你常用的真實網域(銀行、購物、政府),
  列出詐騙集團常拿來假冒它的「形近 / 錯字」網域樣式,認得仿冒網域長什麼樣。
  全程在你的瀏覽器產生字串,不連網、不查詢、不解析任何網域。
*/

const input = ref('example.com')

const parsed = computed(() => parseDomain(input.value))
const groups = computed(() => generateTwists(input.value))
const total = computed(() => countTwists(groups.value))

const copiedCat = ref('')
function copyGroup(category: string, domains: string[]) {
  navigator.clipboard?.writeText(domains.join('\n'))
  copiedCat.value = category
  setTimeout(() => (copiedCat.value = ''), 1200)
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-3">
      <label class="field-label" for="dt-in">輸入真實網域</label>
      <input
        id="dt-in"
        v-model="input"
        class="field-input font-mono"
        spellcheck="false"
        placeholder="例:google.com、esunbank.com.tw"
      />
      <p class="field-hint">
        會列出詐騙常用來假冒它的形近 / 錯字網域。只在你瀏覽器產生字串,<strong>不連網、不查詢、不會真的去連這些網域</strong>。
      </p>
    </div>

    <div v-if="!parsed && input.trim()" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
      ⚠️ 請輸入有效的網域(需含頂級網域,如 <code>.com</code>;只接受英數網域)。
    </div>

    <div v-if="parsed" class="rounded-xl border border-rose-200 bg-rose-50/60 p-4 text-sm text-rose-800">
      🛡️ 以下 <strong>{{ total }}</strong> 個是仿冒 <span class="font-mono font-semibold">{{ parsed.name }}.{{ parsed.tld }}</span> 常見的網域樣式。
      <strong>這些不是真實存在的清單</strong>,而是提醒你:收到含「長得很像但不完全一樣」網址的簡訊/Email,務必提高警覺、別點。
    </div>

    <div
      v-for="g in groups"
      :key="g.category"
      class="card p-4 space-y-2"
    >
      <div class="flex items-center gap-2">
        <h2 class="text-sm font-semibold text-ink-700">{{ g.label }}</h2>
        <span class="text-xs text-ink-400">{{ g.domains.length }} 個</span>
        <button
          class="ml-auto text-xs text-brand-700 underline hover:text-brand-800"
          @click="copyGroup(g.category, g.domains)"
        >
          {{ copiedCat === g.category ? '已複製 ✓' : '複製本組' }}
        </button>
      </div>
      <div class="flex flex-wrap gap-1.5">
        <span
          v-for="d in g.domains"
          :key="d"
          class="rounded-md bg-ink-50 px-2 py-0.5 font-mono text-xs text-ink-600"
          >{{ d }}</span
        >
      </div>
    </div>

    <div class="text-sm text-ink-500">
      想查某個 <code>xn--</code> 開頭或可疑網址的真面目?用
      <RouterLink to="/tools/punycode" class="font-semibold text-brand-700 underline hover:text-brand-800">Punycode / IDN 檢視</RouterLink>
      ;想判斷一條連結是否危險?用
      <RouterLink to="/tools/link-check" class="font-semibold text-brand-700 underline hover:text-brand-800">可疑網址檢查器</RouterLink>
      。
    </div>

    <LegalNote title="這個工具能、不能做什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>能</strong>:依 dnstwist 風格列出仿冒網域樣式 —— 少打/多打字、相鄰字對調、鍵盤鄰鍵打錯、<strong>形近字假冒</strong>(l↔1、o↔0、m↔rn)、插入連字號、母音替換、位元翻轉、換頂級網域(TLD)。</li>
        <li><strong>用途</strong>:讓你與家中長輩「認得」假網域長什麼樣;企業可拿來盤點該防守、該監控註冊的相似網域。</li>
        <li><strong>不能</strong>:本工具<strong>不會</strong>查詢這些網域是否真的被註冊、是否有架站、是否危險 —— 它只是<strong>產生字串</strong>。不要直接點開或輸入任何個資。</li>
        <li>全程<strong>在你的瀏覽器</strong>運算,<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
