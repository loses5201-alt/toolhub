<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { estimateStrength } from '@/features/passwordStrength'

/*
  密碼強度檢測 —— 在本機即時估算密碼有多容易被破解,給等級、破解時間與改進建議。
  密碼是高敏資訊:本工具全程在你的瀏覽器計算,絕不連網、不上傳、不儲存。
*/
const pw = ref('')
const show = ref(false)

const r = computed(() => estimateStrength(pw.value))

const barColors = ['bg-red-500', 'bg-orange-500', 'bg-amber-400', 'bg-lime-500', 'bg-emerald-600']
const textColors = ['text-red-600', 'text-orange-600', 'text-amber-600', 'text-lime-700', 'text-emerald-700']
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">輸入密碼</label>
        <div class="relative">
          <input
            v-model="pw"
            :type="show ? 'text' : 'password'"
            class="field-input pr-20 font-mono"
            spellcheck="false"
            autocomplete="off"
            placeholder="在這裡輸入要檢測的密碼"
          />
          <button
            class="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-brand-700 underline hover:text-brand-800"
            type="button"
            @click="show = !show"
          >
            {{ show ? '隱藏' : '顯示' }}
          </button>
        </div>
        <p class="field-hint">🔒 全程在你的瀏覽器計算,<strong>絕不連網、不上傳、不儲存</strong>。可放心輸入。</p>
      </div>

      <div v-if="pw.length > 0" class="space-y-4">
        <!-- 強度條 -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-sm text-ink-600">強度</span>
            <span class="text-sm font-bold" :class="textColors[r.score]">{{ r.label }}</span>
          </div>
          <div class="flex gap-1.5">
            <div
              v-for="i in 5"
              :key="i"
              class="h-2.5 flex-1 rounded-full transition-colors"
              :class="i - 1 <= r.score ? barColors[r.score] : 'bg-ink-100'"
            />
          </div>
        </div>

        <!-- 數據 -->
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div class="rounded-lg bg-ink-50/70 p-3 text-center">
            <div class="text-xs text-ink-500">長度</div>
            <div class="text-lg font-bold text-ink-900">{{ r.length }}</div>
          </div>
          <div class="rounded-lg bg-ink-50/70 p-3 text-center">
            <div class="text-xs text-ink-500">亂度</div>
            <div class="text-lg font-bold text-ink-900">{{ r.entropyBits }} <span class="text-xs font-normal">bits</span></div>
          </div>
          <div class="rounded-lg bg-ink-50/70 p-3 text-center">
            <div class="text-xs text-ink-500">離線破解</div>
            <div class="text-sm font-bold text-ink-900">{{ r.crackOffline }}</div>
          </div>
          <div class="rounded-lg bg-ink-50/70 p-3 text-center">
            <div class="text-xs text-ink-500">線上破解</div>
            <div class="text-sm font-bold text-ink-900">{{ r.crackOnline }}</div>
          </div>
        </div>

        <!-- 警告 -->
        <div v-if="r.warnings.length" class="rounded-xl border border-red-200 bg-red-50/60 p-3">
          <p class="text-sm font-semibold text-red-700 mb-1">⚠️ 發現弱點</p>
          <ul class="list-disc pl-5 space-y-0.5 text-sm text-red-700">
            <li v-for="(w, i) in r.warnings" :key="i">{{ w }}</li>
          </ul>
        </div>

        <!-- 建議 -->
        <div v-if="r.suggestions.length" class="rounded-xl border border-brand-200 bg-brand-50/50 p-3">
          <p class="text-sm font-semibold text-brand-800 mb-1">💡 怎麼變更強</p>
          <ul class="list-disc pl-5 space-y-0.5 text-sm text-ink-700">
            <li v-for="(s, i) in r.suggestions" :key="i">{{ s }}</li>
          </ul>
        </div>
      </div>
    </div>

    <LegalNote title="關於密碼強度與這個工具">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>長度比複雜度更重要。</strong>一個 16 字的長密碼,通常比 8 字的「複雜」密碼難破解得多。</li>
        <li>「離線破解」假設攻擊者拿到外洩的密碼雜湊、用 GPU 每秒猜 <strong>100 億</strong>次;「線上破解」假設要逐一登入、每秒約 <strong>100</strong> 次。實際依網站防護差異很大,數字僅供<strong>相對比較</strong>。</li>
        <li>常見密碼(<code>password</code>、<code>123456</code>、<code>qwerty</code>…)、生日、連續與鍵盤順序會被字典攻擊「秒破」,無論看起來多長。</li>
        <li><strong>每個網站都用不同密碼</strong>,並搭配密碼管理器,是目前最實用的做法 —— 一處外洩才不會全部淪陷。</li>
        <li>本工具<strong>不連網、不上傳、不儲存</strong>,密碼只留在你的瀏覽器記憶體;但更好的習慣是:不要把「正在使用中」的真實密碼貼到任何網站(含本站),用相似結構測試即可。</li>
      </ul>
    </LegalNote>
  </div>
</template>
