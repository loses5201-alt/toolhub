<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { spell, spellLine, unspell, type SpellStyle } from '@/features/phonetic'

/*
  拼讀 / 電話報號助手 —— 把帳號、確認碼、訂單號逐字拆成「怎麼念」,在電話裡報給對方不會聽錯;
  也能反向把對方念的「Alpha Bravo」還原回字串。全程在你瀏覽器處理,不連網、不上傳。
*/
const text = ref('')
const style = ref<SpellStyle>('tw')
const reverseInput = ref('')

const segments = computed(() => spell(text.value, style.value))
const line = computed(() => spellLine(text.value, style.value))
const reversed = computed(() => unspell(reverseInput.value))

async function copy(s: string) {
  try { await navigator.clipboard.writeText(s) } catch { /* 忽略 */ }
}

const kindCls: Record<string, string> = {
  letter: 'bg-brand-50 text-brand-700 border-brand-200',
  digit: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  punct: 'bg-ink-50 text-ink-500 border-ink-200',
  other: 'bg-amber-50 text-amber-700 border-amber-200',
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">輸入要報的內容(帳號 / 確認碼 / 訂單號)</label>
        <input v-model="text" type="text" class="field-input font-mono" placeholder="例:A1B-2C9" spellcheck="false" />
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-lg px-3 py-1.5 text-sm font-semibold"
          :class="style === 'tw' ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-600'"
          @click="style = 'tw'"
        >台灣電話報號(洞么拐勾)</button>
        <button
          type="button"
          class="rounded-lg px-3 py-1.5 text-sm font-semibold"
          :class="style === 'nato' ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-600'"
          @click="style = 'nato'"
        >國際 NATO(Alpha Bravo)</button>
      </div>
    </div>

    <div v-if="segments.length" class="card p-5 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-ink-700">逐字念法</h3>
        <button type="button" class="text-xs text-brand-700 hover:underline" @click="copy(line)">複製整句</button>
      </div>
      <div class="flex flex-wrap gap-2">
        <div
          v-for="(s, i) in segments"
          :key="i"
          class="flex flex-col items-center rounded-xl border px-3 py-2"
          :class="kindCls[s.kind]"
        >
          <span class="font-mono text-lg font-bold leading-none">{{ s.char === ' ' ? '␣' : s.char }}</span>
          <span class="mt-1 text-sm">{{ s.label }}</span>
          <span v-if="s.note" class="text-[10px] opacity-70">{{ s.note }}</span>
        </div>
      </div>
      <p class="rounded-lg bg-ink-50 p-3 text-base text-ink-800">{{ line }}</p>
    </div>

    <div class="card p-5 space-y-3">
      <h3 class="text-sm font-semibold text-ink-700">反向:把聽到的拼讀還原</h3>
      <input v-model="reverseInput" type="text" class="field-input" placeholder="例:Alpha One Bravo 或 洞 么 拐" spellcheck="false" />
      <div v-if="reverseInput.trim()" class="flex items-center gap-3">
        <span class="font-mono text-2xl font-bold tracking-widest text-ink-800">{{ reversed }}</span>
        <button type="button" class="text-xs text-brand-700 hover:underline" @click="copy(reversed)">複製</button>
      </div>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>打電話跟銀行 / 客服報<strong>帳號、確認碼、訂單號</strong>時,B/D、M/N、1/7 很容易聽錯 —— 這支幫你把每個字「念清楚」,照著念對方一聽就懂。</li>
        <li><strong>台灣電話報號</strong>用大家熟悉的口語(0 念「洞」、1 念「么」、2 念「兩」、7 念「拐」、9 念「勾」);<strong>國際 NATO</strong> 用 Alpha / Bravo,跟外國客服或唸英文序號時用。</li>
        <li>反過來,把對方念的「Alpha Bravo」或「洞么拐」<strong>還原回原本的字串</strong>,抄錄不出錯。</li>
        <li>純文字處理,全程在你瀏覽器,不連網、不上傳。給長輩報帳號時特別好用。</li>
      </ul>
    </LegalNote>
  </div>
</template>
