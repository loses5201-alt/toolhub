<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { validateIban } from '@/features/iban'

/*
  IBAN 國際銀行帳號驗證 —— 檢查國別、長度與 mod-97 檢查碼,拆解各欄位。
  收海外款項(自由接案、跨國匯款)前先驗一下,少打一碼就會匯錯。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

const input = ref('GB82 WEST 1234 5698 7654 32')
const res = computed(() => validateIban(input.value))

const EXAMPLES = [
  { label: '英國 GB', v: 'GB82 WEST 1234 5698 7654 32' },
  { label: '德國 DE', v: 'DE89 3704 0044 0532 0130 00' },
  { label: '法國 FR', v: 'FR14 2004 1010 0505 0001 3M02 606' },
  { label: '荷蘭 NL', v: 'NL91 ABNA 0417 1643 00' },
]
</script>

<template>
  <div class="space-y-6">
    <div class="card p-5 space-y-3">
      <label class="block text-sm">
        <span class="text-ink-500">輸入 IBAN(空白會自動忽略)</span>
        <input
          v-model="input"
          type="text"
          class="ib-input font-mono uppercase"
          placeholder="GB82 WEST 1234 5698 7654 32"
        />
      </label>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="ex in EXAMPLES"
          :key="ex.label"
          type="button"
          class="rounded-lg border border-ink-200 px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          @click="input = ex.v"
        >
          {{ ex.label }}
        </button>
      </div>
    </div>

    <div class="card p-5 text-center" :class="res.valid ? 'bg-emerald-50' : 'bg-rose-50'">
      <div class="text-3xl mb-1">{{ res.valid ? '✅' : '❌' }}</div>
      <div class="text-lg font-semibold" :class="res.valid ? 'text-emerald-700' : 'text-rose-700'">
        {{ res.valid ? 'IBAN 格式正確' : 'IBAN 無效' }}
      </div>
      <div v-if="res.valid" class="text-sm text-ink-600 mt-1 font-mono break-all">
        {{ res.formatted }}
      </div>
      <ul v-else class="text-sm text-rose-600 mt-2 space-y-0.5 text-left inline-block">
        <li v-for="(e, i) in res.errors" :key="i">• {{ e }}</li>
      </ul>
    </div>

    <div v-if="res.normalized.length >= 2" class="card p-5 grid gap-3 sm:grid-cols-2 text-sm">
      <div>
        <span class="text-ink-500">國別代碼</span>
        <div class="text-ink-800 font-mono">
          {{ res.country }}<span v-if="res.countryName" class="text-ink-500"> · {{ res.countryName }}</span>
        </div>
      </div>
      <div>
        <span class="text-ink-500">檢查碼</span>
        <div class="text-ink-800 font-mono">{{ res.checkDigits }}</div>
      </div>
      <div class="sm:col-span-2">
        <span class="text-ink-500">銀行帳號(BBAN)</span>
        <div class="text-ink-800 font-mono break-all">{{ res.bban || '—' }}</div>
      </div>
      <div v-if="res.expectedLength">
        <span class="text-ink-500">長度</span>
        <div class="text-ink-800 font-mono">
          {{ res.normalized.length }} / {{ res.expectedLength }} 碼
        </div>
      </div>
    </div>

    <LegalNote>
      <strong>IBAN</strong>(International Bank Account Number,ISO 13616)用於歐洲、中東等地的跨國匯款,
      結構為 <code>2 碼國別 + 2 碼檢查碼 + 銀行帳號</code>。本工具依各國固定長度與
      <strong>mod-97-10</strong>(ISO 7064)演算法驗證檢查碼:把前 4 碼搬到尾端、字母換成數字後對 97 取餘須為 1,
      可抓出大多數打錯一兩碼的情形。<strong>台灣本地匯款不使用 IBAN</strong>(用銀行代碼 + 帳號)。
      本工具只做格式與檢查碼驗證,<strong>不代表該帳號真實存在</strong>。全程在你的瀏覽器計算,不連網、不上傳。
    </LegalNote>
  </div>
</template>

<style scoped>
.ib-input {
  width: 100%;
  margin-top: 0.25rem;
  border: 1px solid var(--color-ink-200, #e2e8f0);
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  font-size: 0.95rem;
  letter-spacing: 0.05em;
}
</style>
