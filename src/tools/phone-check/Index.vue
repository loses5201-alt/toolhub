<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { checkPhone, type PhoneKind } from '@/features/phoneCheck'

/*
  台灣電話號碼檢視 / 防詐 —— 在瀏覽器端正規化號碼(+886 ↔ 0)、判斷類型(手機/市話/免付費/付費語音/短碼),
  標出常見詐騙警訊(國際來電卻自稱國內機構、付費語音回撥等),並引導到 165 等官方查證管道。
  不上傳、不查任何資料庫,純格式判讀與防詐教育。
*/
const input = ref('')
const result = computed(() => (input.value.trim() ? checkPhone(input.value) : null))

const KIND_ICON: Record<PhoneKind, string> = {
  mobile: '📱', landline: '☎️', tollfree: '🆓', premium: '💸',
  shortcode: '🔢', intl: '🌐', unknown: '❓',
}
// 危險類型(付費語音、國外、無法判讀)用紅框
const dangerKinds: PhoneKind[] = ['premium', 'intl', 'unknown']
const isDanger = computed(() => !!result.value && dangerKinds.includes(result.value.kind))

const examples = ['0912345678', '02-2720-8889', '+886912345678', '0800000123', '0204123456', '165']
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">輸入要查看的電話號碼</label>
        <input
          v-model="input"
          type="text"
          inputmode="tel"
          placeholder="例:0912-345-678 或 +886 2 2720 8889"
          class="field-input font-mono text-lg tracking-wide"
        />
        <p class="field-hint">全程在你的瀏覽器判讀,不會上傳,也不會查任何資料庫。可貼含「-」「+886」「( )」的寫法。</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <button
            v-for="ex in examples"
            :key="ex"
            type="button"
            class="rounded-full border border-line bg-white px-3 py-1 text-xs font-mono text-ink-700 transition hover:border-brand-300 hover:text-brand-700"
            @click="input = ex"
          >
            {{ ex }}
          </button>
        </div>
      </div>

      <div v-if="result" class="rounded-2xl border p-5"
        :class="isDanger ? 'border-red-200 bg-red-50/60' : 'border-brand-200 bg-brand-50/50'">
        <div class="flex items-center gap-2 text-lg font-bold text-ink-900">
          <span>{{ KIND_ICON[result.kind] }}</span>
          <span>{{ result.label }}</span>
        </div>
        <div class="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-600">
          <span>正規化:<span class="font-mono text-ink-800">{{ result.normalized }}</span></span>
          <span v-if="result.region">📍 區域:{{ result.region }}</span>
        </div>

        <ul v-if="result.warnings.length" class="mt-3 space-y-1.5">
          <li v-for="(w, i) in result.warnings" :key="i"
            class="flex gap-2 text-sm text-ink-700">
            <span class="text-amber-600">⚠️</span><span>{{ w }}</span>
          </li>
        </ul>

        <div class="mt-4 flex flex-wrap gap-2 border-t border-line/70 pt-3 text-sm">
          <span class="text-ink-500">不確定?直接查證:</span>
          <a href="https://165.npa.gov.tw/" target="_blank" rel="noopener"
            class="font-semibold text-brand-700 underline">165 全民防騙網</a>
          <span class="text-ink-300">·</span>
          <a href="https://whoscall.com/zh-TW" target="_blank" rel="noopener"
            class="font-semibold text-brand-700 underline">Whoscall 來電辨識</a>
        </div>
      </div>
    </div>

    <LegalNote title="這個工具能做什麼、不能做什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>能</strong>:把號碼看清楚 —— 正規化(+886 與 0 互換)、判斷類型、標出常見詐騙警訊(付費語音回撥、國際來電卻自稱國內機構等)。</li>
        <li><strong>不能</strong>:這<strong>不是「這通是不是詐騙」的判定</strong>,也不查資料庫。<strong>來電顯示可被偽冒</strong>,正常號碼也可能被假冒。</li>
        <li>遇到要你「解除分期、操作 ATM、提供帳號/驗證碼、加 LINE 投資」一律是詐騙;先掛斷,撥
          <a href="https://165.npa.gov.tw/" target="_blank" rel="noopener" class="font-semibold text-brand-700 underline">165</a> 查證。</li>
        <li>市話區域僅依區碼推測、可能多縣市共用,僅供參考。本工具不連網、不上傳、不儲存任何輸入。</li>
      </ul>
    </LegalNote>
  </div>
</template>
