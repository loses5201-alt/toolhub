<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import {
  normalizeAll,
  analyzeText,
  compareStrings,
  type NormForm,
} from '@/features/unicodeNormalize'

/*
  Unicode 正規化 / 比對 —— 解決「兩段文字看起來一樣卻不相等」的問題。
  單一模式:看一段文字的四種正規化形式;比對模式:貼兩段文字找出差異。
  全程在你的瀏覽器處理,內容不上傳。
*/

type Mode = 'normalize' | 'compare'
const mode = ref<Mode>('normalize')

const input = ref('ｅ́ｘａｍｐｌｅ ① ﬁ ㎏')
const a = ref('café')
const b = ref('café') // 一個是組合字、一個是單一碼點(視貼上來源而定)

const forms = computed(() => normalizeAll(input.value))
const stats = computed(() => analyzeText(input.value))

const cmp = computed(() => compareStrings(a.value, b.value))

const FORM_DESC: Record<NormForm, string> = {
  NFC: '正準合成(最常用,比對前建議統一成這個)',
  NFD: '正準分解(基底字 + 附加符號)',
  NFKC: '相容合成(全形→半形、① →1、ﬁ →fi)',
  NFKD: '相容分解',
}

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
      <div class="flex flex-wrap gap-2">
        <button
          v-for="m in (['normalize', 'compare'] as Mode[])"
          :key="m"
          type="button"
          class="rounded-lg border px-3 py-1.5 text-sm transition"
          :class="
            mode === m
              ? 'border-brand-500 bg-brand-600 text-white'
              : 'border-ink-200 text-ink-600 hover:bg-ink-50'
          "
          @click="mode = m"
        >
          {{ m === 'normalize' ? '正規化檢視' : '兩段文字比對' }}
        </button>
      </div>

      <!-- 正規化模式 -->
      <template v-if="mode === 'normalize'">
        <div>
          <label class="field-label">輸入文字</label>
          <textarea
            v-model="input"
            rows="3"
            class="field-input font-mono"
            placeholder="貼上文字 —— 含組合附加符號、全形、相容字時最能看出差異"
            spellcheck="false"
          ></textarea>
        </div>
        <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
          <span>碼點 <strong class="text-ink-700">{{ stats.codePoints }}</strong></span>
          <span>UTF-16 碼元 <strong class="text-ink-700">{{ stats.codeUnits }}</strong></span>
          <span :class="stats.combiningMarks ? 'text-amber-700' : ''">組合符 <strong>{{ stats.combiningMarks }}</strong></span>
          <span :class="stats.fullWidth ? 'text-amber-700' : ''">全形字 <strong>{{ stats.fullWidth }}</strong></span>
          <span :class="stats.zeroWidth ? 'text-red-600' : ''">零寬字元 <strong>{{ stats.zeroWidth }}</strong></span>
        </div>
      </template>

      <!-- 比對模式 -->
      <template v-else>
        <div class="grid gap-3 sm:grid-cols-2">
          <div>
            <label class="field-label">文字 A</label>
            <textarea v-model="a" rows="3" class="field-input font-mono" spellcheck="false"></textarea>
          </div>
          <div>
            <label class="field-label">文字 B</label>
            <textarea v-model="b" rows="3" class="field-input font-mono" spellcheck="false"></textarea>
          </div>
        </div>
      </template>
    </div>

    <!-- 正規化結果 -->
    <div v-if="mode === 'normalize'" class="card p-6 space-y-2">
      <button
        v-for="f in forms"
        :key="f.form"
        type="button"
        class="block w-full rounded-lg px-3 py-2 text-left transition"
        :class="f.changed ? 'bg-amber-50 hover:bg-amber-100' : 'bg-ink-50 hover:bg-ink-100'"
        title="點一下複製"
        @click="copy(f.text)"
      >
        <div class="flex items-baseline justify-between gap-2">
          <span class="text-xs font-semibold text-ink-500">
            {{ f.form }}
            <span class="font-normal text-ink-400">· {{ FORM_DESC[f.form] }}</span>
          </span>
          <span class="text-[10px] text-ink-400">{{ f.codePoints }} 碼點 / {{ f.codeUnits }} 碼元{{ f.changed ? ' · 已改變' : '' }}</span>
        </div>
        <div class="mt-0.5 break-all font-mono text-sm text-ink-800">{{ f.text }}</div>
      </button>
    </div>

    <!-- 比對結果 -->
    <div v-else class="card p-6 space-y-3">
      <div
        class="rounded-xl border p-4 text-sm font-medium"
        :class="cmp.rawEqual ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800' : cmp.nfkcEqual ? 'border-sky-200 bg-sky-50/70 text-sky-800' : 'border-amber-200 bg-amber-50/70 text-amber-800'"
      >
        {{ cmp.rawEqual ? '✅' : cmp.nfkcEqual ? 'ℹ️' : '⚠️' }} {{ cmp.verdict }}
      </div>
      <div class="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4">
        <div class="rounded-lg bg-ink-50 p-2">
          <div class="text-xs text-ink-400">原始</div>
          <div :class="cmp.rawEqual ? 'text-emerald-700' : 'text-ink-400'">{{ cmp.rawEqual ? '相同' : '不同' }}</div>
        </div>
        <div class="rounded-lg bg-ink-50 p-2">
          <div class="text-xs text-ink-400">NFC</div>
          <div :class="cmp.nfcEqual ? 'text-emerald-700' : 'text-ink-400'">{{ cmp.nfcEqual ? '相同' : '不同' }}</div>
        </div>
        <div class="rounded-lg bg-ink-50 p-2">
          <div class="text-xs text-ink-400">NFD</div>
          <div :class="cmp.nfdEqual ? 'text-emerald-700' : 'text-ink-400'">{{ cmp.nfdEqual ? '相同' : '不同' }}</div>
        </div>
        <div class="rounded-lg bg-ink-50 p-2">
          <div class="text-xs text-ink-400">NFKC</div>
          <div :class="cmp.nfkcEqual ? 'text-emerald-700' : 'text-ink-400'">{{ cmp.nfkcEqual ? '相同' : '不同' }}</div>
        </div>
      </div>
      <p v-if="!cmp.rawEqual" class="text-xs text-ink-500">
        第一個不同的位置:第 <strong>{{ cmp.firstDiff + 1 }}</strong> 個碼點。
      </p>
    </div>

    <div class="text-sm text-ink-500">
      想清掉零寬/不可見字元或全形半形互換?用
      <RouterLink to="/tools/text-clean" class="font-semibold text-brand-700 underline hover:text-brand-800">文字清理工坊</RouterLink>
      ;想逐字看碼點與名稱,用
      <RouterLink to="/tools/char-inspect" class="font-semibold text-brand-700 underline hover:text-brand-800">字元檢視器</RouterLink>
      。
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>解釋「<strong>看起來一樣卻不相等</strong>」:同一個字可能是單一碼點(é)或基底字＋組合符號(e+◌́),程式比對時會視為不同。</li>
        <li>提供 <strong>NFC / NFD / NFKC / NFKD</strong> 四種正規化 —— 存進資料庫、比對帳號/檔名、去重前,建議統一成 <strong>NFC</strong>。</li>
        <li><strong>比對模式</strong>會告訴你兩段文字在哪種正規化下才相等,並指出第一個差異點。</li>
        <li>順手統計組合符號、全形字、<strong>零寬/不可見字元</strong>數量,揪出肉眼看不到的夾帶。</li>
        <li>全程<strong>在你的瀏覽器</strong>用內建 Unicode 正規化計算,內容<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
