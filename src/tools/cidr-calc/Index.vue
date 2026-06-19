<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseCidr, computeSubnet, type SubnetInfo } from '@/features/cidr'

/*
  IPv4 CIDR / 子網計算機 —— 給一個 CIDR(192.168.1.10/24)算出網路位址、廣播位址、
  可用主機範圍、子網路遮罩、萬用遮罩、主機數量、私有/等級判斷。
  全程在你的瀏覽器以整數運算,不連網、不上傳。
*/

const input = ref('192.168.1.10/24')

const parsed = computed(() => parseCidr(input.value))
const info = computed<SubnetInfo | null>(() => {
  if (!parsed.value.ok || !parsed.value.value) return null
  return computeSubnet(parsed.value.value.ip, parsed.value.value.prefix)
})

interface Row {
  k: string
  v: string
  hint?: string
}
const rows = computed<Row[]>(() => {
  const s = info.value
  if (!s) return []
  return [
    { k: '網路位址', v: `${s.network}/${s.prefix}`, hint: '這個子網的識別位址' },
    { k: '廣播位址', v: s.broadcast, hint: '送給整個子網的位址' },
    { k: '可用主機範圍', v: `${s.firstHost} – ${s.lastHost}`, hint: '可指派給裝置的位址' },
    { k: '子網路遮罩', v: s.mask },
    { k: '萬用遮罩 (wildcard)', v: s.wildcard, hint: 'ACL / 路由器常用' },
    { k: '可用主機數', v: s.usableHosts.toLocaleString('en-US') },
    { k: '區塊總位址數', v: s.totalHosts.toLocaleString('en-US') },
  ]
})

const examples = ['192.168.1.10/24', '10.0.0.0/8', '172.16.5.4/22', '203.0.113.7/30', '198.51.100.0/31']

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* 忽略 */
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">輸入 IP / CIDR</label>
        <input
          v-model="input"
          class="field-input font-mono text-lg"
          placeholder="192.168.1.10/24"
          spellcheck="false"
          autocomplete="off"
        />
        <p class="field-hint">
          可寫成 <code>192.168.1.10/24</code>、只給位址(預設 /32)、或遮罩寫法
          <code>192.168.1.0 255.255.255.0</code>。
        </p>
        <div class="mt-2 flex flex-wrap gap-1.5">
          <button
            v-for="ex in examples"
            :key="ex"
            type="button"
            class="rounded-md border border-ink-200 px-2 py-1 font-mono text-xs text-ink-500 transition hover:bg-ink-50"
            @click="input = ex"
          >
            {{ ex }}
          </button>
        </div>
      </div>

      <div
        v-if="input.trim() !== '' && !parsed.ok"
        class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800"
      >
        ⚠️ {{ parsed.error }}
      </div>

      <template v-else-if="info">
        <div class="flex flex-wrap gap-2">
          <span
            class="rounded-full px-3 py-1 text-xs font-semibold"
            :class="info.isPrivate ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'"
          >
            {{ info.isPrivate ? '🏠 私有位址 (RFC 1918)' : '🌐 公開位址' }}
          </span>
          <span class="rounded-full bg-ink-100 px-3 py-1 text-xs font-semibold text-ink-600">
            傳統等級 {{ info.class }}
          </span>
          <span class="rounded-full bg-ink-100 px-3 py-1 text-xs font-semibold text-ink-600">
            字首 /{{ info.prefix }}
          </span>
        </div>

        <div class="grid gap-2">
          <button
            v-for="row in rows"
            :key="row.k"
            type="button"
            class="rounded-lg bg-ink-50 px-3 py-2 text-left transition hover:bg-ink-100"
            title="點一下複製"
            @click="copy(row.v)"
          >
            <div class="text-xs font-semibold text-ink-400">
              {{ row.k }}
              <span v-if="row.hint" class="font-normal text-ink-300">· {{ row.hint }}</span>
            </div>
            <div class="break-all font-mono text-ink-800">{{ row.v }}</div>
          </button>
        </div>

        <p class="text-xs text-ink-400">點任一格可複製內容。</p>
      </template>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>設定路由器、防火牆、伺服器時,把一個 <strong>CIDR</strong> 立刻拆成網路位址、廣播位址、可用主機範圍。</li>
        <li>同時給你<strong>子網路遮罩</strong>與<strong>萬用遮罩</strong>(ACL / 路由設定常用),免再手動換算。</li>
        <li>正確處理 <strong>/31 點對點</strong>(RFC 3021,兩端皆可用)與 <strong>/32 單一位址</strong>等邊界。</li>
        <li>判斷是否為<strong>私有位址</strong>(10/8、172.16/12、192.168/16)與傳統 A/B/C 等級。</li>
        <li>全程<strong>在你的瀏覽器</strong>以整數運算,<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
