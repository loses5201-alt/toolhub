<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { identifyHash } from '@/features/hashIdentify'

/*
  雜湊類型識別 —— 貼上一段雜湊值,推測它可能是哪種演算法。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

const input = ref('5d41402abc4b2a76b9719d911017c592')
const result = computed(() => identifyHash(input.value))

const charsetLabel: Record<string, string> = {
  hex: '十六進位',
  base64: 'Base64',
  mixed: '含特殊符號(結構化格式)',
  other: '其他 / 非雜湊',
}
const confLabel: Record<string, string> = { high: '高', medium: '中', low: '低' }
const confClass: Record<string, string> = {
  high: 'bg-green-100 text-green-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-ink-100 text-ink-600',
}

const examples: { label: string; value: string }[] = [
  { label: 'MD5', value: '5d41402abc4b2a76b9719d911017c592' },
  { label: 'SHA-1', value: 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d' },
  { label: 'SHA-256', value: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
  { label: 'bcrypt', value: '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW' },
  { label: 'sha512crypt', value: '$6$rounds=5000$usesomesillyname$svn8UoSVapNtMuq1ukKS4tPQd8iKwSMHWjl/O817G3uBnIFNjnQJuesI68u4OTLiBFdcbYEdFCoEOfaBhO3UO.' },
  { label: 'Argon2id', value: '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$RdescudvJCsgt3ub+b+dWRWJTmaaJObG' },
]
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label" for="hash">貼上雜湊值</label>
        <textarea
          id="hash"
          v-model="input"
          rows="2"
          placeholder="例如 5d41402abc4b2a76b9719d911017c592"
          class="field-input w-full font-mono text-sm break-all"
        ></textarea>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="e in examples"
          :key="e.label"
          type="button"
          class="rounded-lg border border-line px-3 py-1 text-sm text-ink-700 transition hover:border-brand-300"
          @click="input = e.value"
        >
          {{ e.label }}
        </button>
      </div>

      <div v-if="input.trim()" class="flex flex-wrap gap-3 text-sm text-ink-600">
        <span class="rounded-md bg-ink-50 px-2 py-1">長度:<strong>{{ result.length }}</strong> 字元</span>
        <span class="rounded-md bg-ink-50 px-2 py-1">字元集:<strong>{{ charsetLabel[result.charset] }}</strong></span>
        <span class="rounded-md bg-ink-50 px-2 py-1">候選:<strong>{{ result.candidates.length }}</strong> 種</span>
      </div>
    </div>

    <div v-if="result.candidates.length" class="card p-6 space-y-3">
      <h2 class="text-lg font-bold text-ink-900">可能的演算法</h2>
      <ul class="space-y-2">
        <li
          v-for="c in result.candidates"
          :key="c.name"
          class="flex flex-wrap items-center gap-3 rounded-xl border border-line p-4"
        >
          <span class="text-lg font-semibold text-ink-900">{{ c.name }}</span>
          <span v-if="c.bits" class="rounded-md bg-brand-50 px-2 py-0.5 font-mono text-sm text-brand-700">{{ c.bits }} 位元</span>
          <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold" :class="confClass[c.confidence]">信心 {{ confLabel[c.confidence] }}</span>
          <span v-if="c.note" class="w-full text-sm text-ink-500">{{ c.note }}</span>
        </li>
      </ul>
    </div>

    <div v-else-if="input.trim()" class="card p-6">
      <p class="text-ink-600">無法判定這段字串對應的雜湊演算法。可能不是雜湊值,或長度/格式不符常見演算法。</p>
    </div>

    <LegalNote title="使用說明與限制">
      <ul class="list-disc pl-5 space-y-1">
        <li>本工具<strong>只看格式</strong>(長度、字元集、特殊前綴)來推測,<strong>不會、也無法</strong>還原原文 —— 雜湊是單向的。</li>
        <li>同樣長度的不同演算法(例如 32 字元可能是 MD5、NTLM、MD4)從雜湊值本身<strong>無法區分</strong>,只能列出可能性與相對信心。</li>
        <li>有明確結構的格式(<code>$2a$</code> bcrypt、<code>$6$</code> sha512crypt、<code>$argon2id$</code>、<code>{SSHA}</code>、MySQL <code>*</code> 開頭)可高信心判定。</li>
        <li>用途:看 log/資料庫/設定檔裡的雜湊欄位是什麼演算法、評估密碼儲存是否夠安全(MD5/SHA-1 已不建議用於密碼)。</li>
        <li>全程在你的瀏覽器計算,<strong>不連網、不上傳</strong>,貼上的雜湊值不會離開這台裝置。</li>
      </ul>
    </LegalNote>
  </div>
</template>
