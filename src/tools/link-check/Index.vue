<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { analyzeUrl, type Level } from '@/features/linkcheck'
import LegalNote from '@/components/LegalNote.vue'

const route = useRoute()
// 由其他工具(如 QR Code 解碼)用 ?u= 帶網址過來時,自動填入並檢查
const prefill = route.query.u
const input = ref(typeof prefill === 'string' ? prefill : '')
const result = computed(() => (input.value.trim() ? analyzeUrl(input.value) : null))

const examples = [
  'https://line-tw-event.xyz/login',
  'http://192.168.0.1/esun-bank/verify',
  'https://line.me',
]

const verdict: Record<Level, { title: string; sub: string; klass: string; emoji: string }> = {
  danger: {
    title: '高風險,別點!',
    sub: '出現明顯的詐騙特徵,強烈建議不要點開,更不要輸入帳密或個資。',
    klass: 'border-red-300 bg-red-50 text-red-800',
    emoji: '🚫',
  },
  warn: {
    title: '可疑,請小心',
    sub: '有一些需要注意的地方,點之前請再三確認來源,或直接向官方查證。',
    klass: 'border-amber-300 bg-amber-50 text-amber-800',
    emoji: '⚠️',
  },
  safe: {
    title: '沒發現明顯特徵',
    sub: '沒查到常見的詐騙特徵,但這不代表 100% 安全,仍請保持警覺。',
    klass: 'border-brand-300 bg-brand-50 text-brand-800',
    emoji: '✅',
  },
}

const dot: Record<string, string> = {
  danger: 'text-red-500',
  warn: 'text-amber-500',
  ok: 'text-brand-600',
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-3">
      <label class="field-label">把可疑的網址貼到這裡</label>
      <textarea
        v-model="input"
        rows="2"
        placeholder="例如從簡訊、LINE 收到的連結:https://..."
        class="field-input resize-none break-all"
      />
      <div class="flex flex-wrap gap-2">
        <span class="text-sm text-ink-500 self-center">試試:</span>
        <button
          v-for="e in examples"
          :key="e"
          class="rounded-full border border-line bg-white px-3 py-1 text-xs text-ink-600 transition hover:border-brand-300 hover:text-brand-700"
          @click="input = e"
        >
          {{ e.length > 32 ? e.slice(0, 32) + '…' : e }}
        </button>
      </div>
    </div>

    <template v-if="result">
      <div v-if="!result.ok" class="card p-6 text-center text-ink-500">
        這看起來不像一個網址,請確認後再貼一次。
      </div>

      <template v-else>
        <!-- 判定卡 -->
        <div class="rounded-3xl border p-6" :class="verdict[result.level].klass">
          <div class="flex items-center gap-3">
            <span class="text-4xl">{{ verdict[result.level].emoji }}</span>
            <div>
              <div class="text-xl font-black">{{ verdict[result.level].title }}</div>
              <div class="mt-0.5 text-sm opacity-90">{{ verdict[result.level].sub }}</div>
            </div>
          </div>
          <div class="mt-3 rounded-xl bg-white/60 px-3 py-2 text-sm font-mono break-all text-ink-700">
            目的地網域:{{ result.host || '(無法判讀)' }}
          </div>
        </div>

        <!-- 逐項說明 -->
        <div v-if="result.findings.length" class="card p-5">
          <div class="mb-3 font-semibold text-ink-900">檢查項目</div>
          <ul class="space-y-2.5">
            <li v-for="(f, i) in result.findings" :key="i" class="flex gap-2.5 text-sm leading-relaxed">
              <span :class="dot[f.level]" class="mt-0.5 shrink-0">
                {{ f.level === 'ok' ? '✓' : '●' }}
              </span>
              <span class="text-ink-700">{{ f.text }}</span>
            </li>
          </ul>
        </div>

        <!-- 行動建議 -->
        <LegalNote title="該怎麼辦?">
          <ul class="list-disc pl-5 space-y-1">
            <li>不確定就<strong>不要點</strong>,更不要在裡面輸入帳號密碼、信用卡、驗證碼。</li>
            <li>想確認真假,<strong>自己打官方電話或上官方 App</strong>查,不要用連結裡的聯絡方式。</li>
            <li>可撥打反詐騙專線 <strong>165</strong>,或查 165 全民防騙網的最新詐騙手法。</li>
            <li>本工具是啟發式判斷,<strong>不能保證</strong>「沒問題」就一定安全。</li>
          </ul>
        </LegalNote>
      </template>
    </template>

    <!-- 常見詐騙紅旗教育 -->
    <details class="card p-5">
      <summary class="cursor-pointer font-semibold text-ink-900">📋 常見詐騙紅旗(點開看)</summary>
      <ul class="mt-3 space-y-2 text-sm leading-relaxed text-ink-700 list-disc pl-5">
        <li>「您的帳號/包裹/門號異常,請點連結驗證」—— 製造急迫感要你馬上點。</li>
        <li>網址長得像官方但網域怪怪的(多了連字號、數字、奇怪結尾)。</li>
        <li>要你「解除分期付款」「解除約定帳戶」—— 銀行不會這樣要求。</li>
        <li>假投資、保證獲利、要你下載特定 App 或加 LINE 操作。</li>
        <li>假冒檢警、健保署、國稅局說你涉案、要你提供帳戶或匯款。</li>
        <li>中獎、退款、補運費,要你先付一筆小錢或填個資。</li>
      </ul>
    </details>
  </div>
</template>
