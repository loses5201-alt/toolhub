<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { fixMojibake } from '@/features/mojibake'

/*
  亂碼修復 —— 修復「原文是 UTF-8、卻被當成西歐編碼讀」造成的亂碼
  (中文變 ä¸­æ–‡、é 變 Ã©、' 變 â€™)。純前端、不上傳。
*/
const input = ref('')
const copied = ref(false)

const result = computed(() => fixMojibake(input.value))
const hasInput = computed(() => input.value.trim().length > 0)

const sample =
  'æ‚¨å¥½ï¼Œé€™æ˜¯ä¸€å€‹äº‚ç¢¼ç¯„ä¾‹ã€‚\ndonâ€™t panic â€” cafÃ© â‚¬20'

function loadSample() {
  input.value = sample
}
function clearAll() {
  input.value = ''
}
async function copyOut() {
  if (!result.value.fixed) return
  try {
    await navigator.clipboard.writeText(result.value.fixed)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    /* 忽略,使用者可手動複製 */
  }
}
function download() {
  if (!result.value.fixed) return
  const blob = new Blob([result.value.fixed], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '修復結果.txt'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
      <div>
        <div class="mb-1.5 flex items-center justify-between">
          <label class="field-label !mb-0">貼上亂碼文字</label>
          <button class="text-sm text-brand-700 underline" @click="loadSample">載入範例</button>
        </div>
        <textarea
          v-model="input"
          rows="6"
          spellcheck="false"
          placeholder="例如:æ‚¨å¥½ä¸–ç•Œ  或  donâ€™t  或  cafÃ©"
          class="field-input font-mono !text-sm leading-relaxed"
        ></textarea>
        <p class="field-hint">文字只在你的瀏覽器處理,不會上傳到任何伺服器。</p>
      </div>

      <div v-if="hasInput">
        <!-- 狀態列 -->
        <div
          v-if="result.changed"
          class="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          ✓ 已修復(套用 {{ result.rounds }} 輪轉碼)。
          <span v-if="result.hasLoss" class="text-amber-700"
            >但偵測到遺失字元 �,部分內容在原本的轉碼過程中已損毀、無法完全還原。</span
          >
        </div>
        <div v-else class="mb-3 rounded-lg bg-stone-100 px-3 py-2 text-sm text-ink-600">
          看起來不是「UTF-8 被誤當西歐編碼」這類亂碼,內容未變更。可能本來就正常,或屬於無法還原的亂碼類型(見下方說明)。
        </div>

        <div class="mb-1.5 flex items-center justify-between">
          <label class="field-label !mb-0">修復結果</label>
          <div class="flex gap-3 text-sm">
            <button class="text-brand-700 underline" @click="copyOut">{{ copied ? '已複製 ✓' : '複製' }}</button>
            <button class="text-brand-700 underline" @click="download">下載 .txt</button>
            <button class="text-ink-400 underline hover:text-red-500" @click="clearAll">清空</button>
          </div>
        </div>
        <textarea
          :value="result.fixed"
          rows="6"
          readonly
          spellcheck="false"
          class="field-input !text-sm leading-relaxed bg-stone-50"
        ></textarea>
      </div>
    </div>

    <LegalNote title="它修的是哪一種亂碼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>
          最常見、<strong>可還原</strong>的一種:原文其實是 UTF-8,但被某個程式/網站/匯出檔當成西歐編碼
          (Latin-1 / Windows-1252)讀,於是「中文」變成 <code>ä¸­æ–‡</code>、<code>é</code> 變成
          <code>Ã©</code>、彎引號 <code>'</code> 變成 <code>â€™</code>。
        </li>
        <li>原理:把畫面上的亂碼字元逆推回原始位元組,再用正確的 UTF-8 重新解讀 —— 全程在你瀏覽器,文字不上傳。</li>
        <li>
          <strong>修不了的情況</strong>:若亂碼裡已出現替換字元 <code>�</code>,代表位元組在當初轉換時就已遺失,
          任何工具都救不回;另外像「Big5 被當成 UTF-8」這種反向亂碼,因資訊已遺失也無法還原。
        </li>
        <li>它<strong>不會破壞</strong>本來就正常的文字:偵測到「修了反而更糟」時會自動保持原狀、不變更。</li>
      </ul>
    </LegalNote>
  </div>
</template>
