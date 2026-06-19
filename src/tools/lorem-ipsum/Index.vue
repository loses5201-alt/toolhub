<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { generate, type LoremLang, type LoremUnit } from '@/features/loremIpsum'

/*
  假文 / 佔位文字產生器 —— 做版面/設計稿時填入的假內文。
  拉丁 Lorem Ipsum + 中文假文(中文版面排版用,多數線上工具只有拉丁文)。
  全程在你的瀏覽器,不連網、不上傳。
*/
const lang = ref<LoremLang>('latin')
const unit = ref<LoremUnit>('paragraphs')
const count = ref(3)
const startWithClassic = ref(true)
const useSeed = ref(false)
const seed = ref(1)

// nonce:非種子模式下點「重新產生」時改變,觸發 computed 重新呼叫 generate
const nonce = ref(0)
function regenerate() {
  nonce.value++
}

const display = computed(() => {
  void nonce.value // 依賴 nonce,讓非種子模式可手動重產
  return generate({
    lang: lang.value,
    unit: unit.value,
    count: count.value,
    startWithClassic: startWithClassic.value,
    seed: useSeed.value ? seed.value : undefined,
  })
})

const charCount = computed(() => [...display.value].length)

const copied = ref(false)
function copyOut() {
  navigator.clipboard?.writeText(display.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <!-- 語言 -->
      <div>
        <label class="field-label">語言</label>
        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 rounded-lg border px-3 py-2 text-sm"
            :class="lang === 'latin' ? 'border-brand-400 bg-brand-50 text-brand-700 font-medium' : 'border-ink-200 text-ink-600 hover:bg-ink-50'"
            @click="lang = 'latin'"
          >
            拉丁 Lorem Ipsum
          </button>
          <button
            type="button"
            class="flex-1 rounded-lg border px-3 py-2 text-sm"
            :class="lang === 'cjk' ? 'border-brand-400 bg-brand-50 text-brand-700 font-medium' : 'border-ink-200 text-ink-600 hover:bg-ink-50'"
            @click="lang = 'cjk'"
          >
            中文假文
          </button>
        </div>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
        <div>
          <label class="field-label">單位</label>
          <select v-model="unit" class="field-input">
            <option value="paragraphs">段落</option>
            <option value="sentences">句子</option>
            <option value="words">{{ lang === 'cjk' ? '字' : '單字' }}</option>
          </select>
        </div>
        <div>
          <label class="field-label">數量</label>
          <input v-model.number="count" type="number" min="1" max="200" class="field-input" />
        </div>
      </div>

      <div class="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-600">
        <label v-if="lang === 'latin'" class="flex items-center gap-1.5">
          <input v-model="startWithClassic" type="checkbox" class="accent-brand-600" />
          以經典「Lorem ipsum dolor sit amet…」開頭
        </label>
        <label class="flex items-center gap-1.5">
          <input v-model="useSeed" type="checkbox" class="accent-brand-600" />
          固定種子(可重現同一批)
        </label>
        <label v-if="useSeed" class="flex items-center gap-1.5">
          種子
          <input v-model.number="seed" type="number" class="field-input !w-24 !py-1" />
        </label>
      </div>
    </div>

    <!-- 輸出 -->
    <div class="card p-5 space-y-3">
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-ink-700">產生結果</span>
        <span class="text-xs text-ink-400">共 {{ charCount }} 字元</span>
        <button
          v-if="!useSeed"
          type="button"
          class="ml-auto rounded-lg border border-ink-200 px-3 py-1 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          @click="regenerate"
        >
          重新產生
        </button>
        <button
          type="button"
          class="rounded-lg border border-ink-200 px-3 py-1 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          :class="useSeed ? 'ml-auto' : ''"
          @click="copyOut"
        >
          {{ copied ? '已複製' : '複製' }}
        </button>
      </div>
      <pre class="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-800">{{ display }}</pre>
    </div>

    <LegalNote>
      假文僅為「佔位用」的無意義文字,純粹用來預覽版面/字級/行距,內容不具任何意義,正式上線前務必換成真正的文案。
      中文假文以常用字隨機組句,僅模擬中文版面的視覺密度。全程在你的瀏覽器產生,不連網、不上傳。
    </LegalNote>
  </div>
</template>
