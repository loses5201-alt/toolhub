<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import { analyzeText } from '@/features/homoglyph'

/*
  同形字 / 混合文字偵測 —— 貼上品牌名、網址或可疑訊息,找出「看起來像英數字、其實是其他語系字元」
  的偽裝(如西里爾 а 冒充拉丁 a),以及一個詞內混用多種語系的釣魚手法。全程在你的瀏覽器,不上傳。
*/
const input = ref('paypаl.com')

const result = computed(() => analyzeText(input.value))

const SCRIPT_LABEL: Record<string, string> = {
  Latin: '拉丁(英文)',
  Cyrillic: '西里爾(俄文等)',
  Greek: '希臘',
  Armenian: '亞美尼亞',
  Hebrew: '希伯來',
  Arabic: '阿拉伯',
  Thai: '泰文',
  Han: '漢字',
  Hiragana: '平假名',
  Katakana: '片假名',
  Hangul: '韓文',
  Fullwidth: '全形',
  Other: '其他',
  Common: '共通',
}
const label = (s: string) => SCRIPT_LABEL[s] ?? s

const copied = ref(false)
function copySkeleton() {
  navigator.clipboard?.writeText(result.value.skeleton)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-3">
      <label class="field-label" for="hg-in">要檢查的文字</label>
      <textarea
        id="hg-in"
        v-model="input"
        rows="3"
        class="field-input font-mono leading-relaxed"
        spellcheck="false"
        placeholder="貼上品牌名、網址或可疑訊息…"
      />
      <p class="field-hint">例:把可疑連結的網域、假冒的品牌名貼進來。全程在你的瀏覽器處理,不上傳。</p>
    </div>

    <div v-if="input">
      <!-- 總結 -->
      <div
        v-if="result.suspicious"
        class="rounded-xl border border-red-200 bg-red-50/70 p-4 text-sm text-red-800"
      >
        ⚠️ <strong>偵測到可疑偽裝</strong> ——
        <template v-if="result.confusableCount">
          含 {{ result.confusableCount }} 個「同形字」(看似英數字、實為其他語系)
        </template>
        <template v-if="result.confusableCount && result.mixedTokenCount">、</template>
        <template v-if="result.mixedTokenCount">
          {{ result.mixedTokenCount }} 個詞混用多種語系
        </template>
        。這是常見的釣魚/假冒手法,務必小心。
      </div>
      <div
        v-else
        class="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-800"
      >
        ✓ 未發現同形字偽裝。
        <template v-if="result.scripts.length > 1">
          (含多種語系:{{ result.scripts.map(label).join('、') }},但屬正常用字)
        </template>
      </div>

      <!-- 逐字顯示 -->
      <div class="card mt-4 p-4 space-y-3">
        <div class="text-sm font-semibold text-ink-700">逐字檢視</div>
        <div class="flex flex-wrap gap-1 font-mono text-lg leading-loose">
          <span
            v-for="(c, i) in result.chars"
            :key="i"
            class="relative inline-flex flex-col items-center rounded px-1 py-0.5"
            :class="c.suspicious ? 'bg-red-100 text-red-700 ring-1 ring-red-300' : 'text-ink-700'"
            :title="`${c.hex} ${label(c.script)}${c.target ? ' — 冒充 ' + c.target : ''}`"
          >
            <span>{{ c.ch === ' ' ? '␣' : c.ch }}</span>
            <span v-if="c.suspicious" class="text-[10px] leading-none text-red-500">{{ c.target }}</span>
          </span>
        </div>
        <p class="text-xs text-ink-500">紅底字 = 同形字(滑鼠移上去看碼位與冒充的字元)。</p>
      </div>

      <!-- skeleton -->
      <div v-if="result.confusableCount" class="card mt-4 p-4 space-y-2">
        <div class="flex items-center gap-3">
          <span class="text-sm font-semibold text-ink-700">它想假裝成的樣子</span>
          <button class="ml-auto text-sm text-brand-700 underline hover:text-brand-800" @click="copySkeleton">
            {{ copied ? '已複製 ✓' : '複製' }}
          </button>
        </div>
        <pre class="overflow-x-auto rounded-lg bg-ink-900 p-3 text-sm text-ink-50"><code>{{ result.skeleton }}</code></pre>
        <p class="text-xs text-ink-500">把同形字還原成它模仿的英數字後,通常就現出原形。</p>
      </div>

      <!-- 語系統計 -->
      <div v-if="result.scripts.length" class="card mt-4 p-4">
        <div class="text-sm font-semibold text-ink-700 mb-2">出現的語系</div>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="s in result.scripts"
            :key="s"
            class="rounded-full bg-ink-100 px-3 py-1 text-xs text-ink-600"
          >{{ label(s) }}</span>
        </div>
      </div>
    </div>

    <div class="text-sm text-ink-500">
      檢查整串網址安全請用
      <RouterLink to="/tools/link-check" class="font-semibold text-brand-700 underline hover:text-brand-800">可疑網址檢查器</RouterLink>;
      網域被仿冒的各種變體看
      <RouterLink to="/tools/domain-twist" class="font-semibold text-brand-700 underline hover:text-brand-800">網域仿冒產生器</RouterLink>。
    </div>

    <LegalNote title="這個工具能、不能做什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>能</strong>:找出文字中「看似英數字、實為其他語系」的同形字(西里爾、希臘、亞美尼亞、全形等),並標出其 Unicode 碼位與冒充的字元;偵測同一個詞混用多種語系(典型釣魚手法),還原出它「想假裝成」的樣子。</li>
        <li><strong>用途</strong>:把可疑的網域、假冒品牌名、釣魚訊息貼進來,一眼看出是否藏了偽裝字元。</li>
        <li><strong>不能</strong>:這不是完整的 Unicode 同形字資料庫,只涵蓋最常見的冒充字元;<strong>中英、日韓夾雜屬正常用字</strong>,工具會提示「混用語系」但不代表詐騙,請以是否含紅底同形字為主要判準。未標記 ≠ 一定安全。</li>
        <li>全程<strong>在你的瀏覽器</strong>處理,不連網、不上傳。</li>
      </ul>
    </LegalNote>
  </div>
</template>
