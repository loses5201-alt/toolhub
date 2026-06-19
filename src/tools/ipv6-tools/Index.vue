<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { analyzeIPv6 } from '@/features/ipv6'

/*
  IPv6 位址展開 / 壓縮工具 —— 貼上任意寫法的 IPv6,正規化成展開式(8 組 4 位數)
  與 RFC 5952 標準壓縮式,並判斷位址類型。全程在你的瀏覽器計算,不連網、不上傳。
*/

const input = ref('2001:0db8:0000:0000:0000:0000:1428:57ab')
const info = computed(() => analyzeIPv6(input.value))

const EXAMPLES = [
  '2001:0db8:0000:0000:0000:0000:1428:57ab',
  '2001:db8:0:0:1:0:0:1',
  '::1',
  'fe80::1%eth0',
  '::ffff:192.168.1.1',
  'fd12:3456:789a:1::1',
]

const copied = ref('')
function copy(text: string, tag: string) {
  navigator.clipboard?.writeText(text)
  copied.value = tag
  setTimeout(() => (copied.value = ''), 1500)
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-5 space-y-3">
      <label class="block text-sm">
        <span class="text-ink-500">輸入 IPv6 位址</span>
        <input
          v-model="input"
          type="text"
          placeholder="例如 2001:db8::1"
          class="ip-input font-mono"
        />
      </label>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="ex in EXAMPLES"
          :key="ex"
          type="button"
          class="rounded-lg border border-ink-200 px-2.5 py-1 text-xs font-mono text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          @click="input = ex"
        >
          {{ ex }}
        </button>
      </div>
    </div>

    <template v-if="info">
      <div class="card p-5 space-y-4">
        <div>
          <div class="flex items-center gap-3">
            <span class="text-sm text-ink-500">壓縮式(RFC 5952)</span>
            <button
              type="button"
              class="ml-auto rounded-lg border border-ink-200 px-3 py-1 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
              @click="copy(info.compressed, 'c')"
            >{{ copied === 'c' ? '已複製' : '複製' }}</button>
          </div>
          <div class="font-mono text-lg text-ink-800 break-all">{{ info.compressed }}</div>
        </div>
        <div>
          <div class="flex items-center gap-3">
            <span class="text-sm text-ink-500">展開式(完整 8 組)</span>
            <button
              type="button"
              class="ml-auto rounded-lg border border-ink-200 px-3 py-1 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
              @click="copy(info.expanded, 'e')"
            >{{ copied === 'e' ? '已複製' : '複製' }}</button>
          </div>
          <div class="font-mono text-lg text-ink-800 break-all">{{ info.expanded }}</div>
        </div>
        <div>
          <span class="text-sm text-ink-500">位址類型</span>
          <div class="text-ink-800">{{ info.type }}</div>
        </div>
      </div>

      <div class="card p-5 space-y-2 overflow-x-auto">
        <span class="text-sm font-semibold text-ink-700">每組 16 位元</span>
        <div class="grid grid-cols-4 gap-2 text-center font-mono text-sm sm:grid-cols-8">
          <div
            v-for="(g, i) in info.groups"
            :key="i"
            class="rounded-lg bg-ink-50 px-2 py-2"
          >
            <div class="text-ink-800">{{ g.toString(16).padStart(4, '0') }}</div>
            <div class="text-[10px] text-ink-400">{{ g }}</div>
          </div>
        </div>
      </div>
    </template>
    <p v-else class="card p-5 text-sm text-ink-500">無法解析,請輸入有效的 IPv6 位址。</p>

    <LegalNote>
      RFC 5952 壓縮規則:全部小寫、去除每組前導零、把「最長一段連續為零的群組」用 <code>::</code> 取代
      (長度需 ≥2,平手時取最左邊),其餘照舊。展開式則把 8 組各補滿 4 位數。支援 <code>::</code> 省略、
      內嵌 IPv4(如 <code>::ffff:192.168.1.1</code>)與 <code>%zone</code> 介面識別。全程在你的瀏覽器計算,不上傳。
    </LegalNote>
  </div>
</template>

<style scoped>
.ip-input {
  width: 100%;
  margin-top: 0.25rem;
  border: 1px solid var(--color-ink-200, #e2e8f0);
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  font-size: 0.95rem;
}
</style>
